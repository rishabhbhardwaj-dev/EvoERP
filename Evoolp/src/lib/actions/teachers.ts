"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { logAudit, diffChanges } from "@/lib/audit";
import {
  createTeacherSchema,
  updateTeacherSchema,
  toggleTeacherStatusSchema,
  type CreateTeacherInput,
  type UpdateTeacherInput,
  type ToggleTeacherStatusInput,
} from "@/lib/validations/teacher";
import type { ActionResult } from "./classes";

/**
 * Onboards a new teacher by atomically creating their User account and Teacher profile.
 * Only ADMIN users are authorized.
 */
export async function createTeacher(
  input: CreateTeacherInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return { success: false, error: "Unauthorized: only administrators can onboard teachers." };
    }

    const parsed = createTeacherSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid teacher data.";
      return { success: false, error: firstError };
    }

    const {
      name,
      email,
      employeeCode: rawEmployeeCode,
      department: rawDepartment,
      qualification: rawQualification,
      password,
    } = parsed.data;

    const employeeCode = rawEmployeeCode.trim().toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();
    const department = rawDepartment?.trim() || null;
    const qualification = rawQualification?.trim() || null;

    // 1. Verify employeeCode is unique within the tenant's school
    const existingEmployeeCode = await prisma.teacher.findUnique({
      where: {
        schoolId_employeeCode: {
          schoolId: ctx.schoolId,
          employeeCode,
        },
      },
    });

    if (existingEmployeeCode) {
      return {
        success: false,
        error: `A teacher with employee code "${employeeCode}" already exists in this school.`,
      };
    }

    // 2. Verify email is unique within the tenant's school
    const existingEmail = await prisma.user.findUnique({
      where: {
        schoolId_email: {
          schoolId: ctx.schoolId,
          email: normalizedEmail,
        },
      },
    });

    if (existingEmail) {
      return {
        success: false,
        error: `A user with email "${normalizedEmail}" already exists in this school.`,
      };
    }

    // 3. Hash the initial password with bcryptjs
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Atomically create User + Teacher in a single database transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          schoolId: ctx.schoolId,
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          role: "TEACHER",
          status: "ACTIVE",
        },
      });

      const teacher = await tx.teacher.create({
        data: {
          schoolId: ctx.schoolId,
          userId: user.id,
          employeeCode,
          department,
          qualification,
        },
      });

      return { user, teacher };
    });

    // 5. Write audit log entry (non-blocking, never log password or hash)
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "TEACHER_CREATED",
      entityType: "TEACHER",
      entityId: result.teacher.id,
      newValues: {
        employeeCode,
        name: name.trim(),
        email: normalizedEmail,
        department,
        qualification,
      },
    });

    // 6. Revalidate relevant App Router paths
    revalidatePath("/dashboard/teachers");

    return { success: true, data: { id: result.teacher.id } };
  } catch (err) {
    console.error("Error creating teacher:", err);
    return {
      success: false,
      error: "An unexpected error occurred while onboarding the teacher.",
    };
  }
}

/**
 * Updates editable profile fields for a teacher (name, department, qualification).
 * Identifiers id, schoolId, employeeCode, and email remain immutable.
 * Only ADMIN users are authorized.
 */
export async function updateTeacher(
  input: UpdateTeacherInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return { success: false, error: "Unauthorized: only administrators can edit teacher profiles." };
    }

    const parsed = updateTeacherSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid teacher data.";
      return { success: false, error: firstError };
    }

    const { id, name, department, qualification } = parsed.data;

    // 1. Locate existing teacher strictly within this tenant's school
    const existingTeacher = await prisma.teacher.findFirst({
      where: {
        id,
        schoolId: ctx.schoolId,
      },
      include: {
        user: true,
      },
    });

    if (!existingTeacher) {
      return { success: false, error: "Teacher record not found in your school records." };
    }

    // 2. Compute field-level diff for audit logging
    const oldVals: Record<string, unknown> = {
      name: existingTeacher.user.name,
      department: existingTeacher.department ?? null,
      qualification: existingTeacher.qualification ?? null,
    };

    const newVals: Record<string, unknown> = {
      name: name.trim(),
      department: department?.trim() || null,
      qualification: qualification?.trim() || null,
    };

    const { oldValues, newValues } = diffChanges(oldVals, newVals);

    // 3. Persist update atomically if there are changes
    if (Object.keys(newValues).length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existingTeacher.userId },
          data: { name: name.trim() },
        });

        await tx.teacher.update({
          where: { id: existingTeacher.id },
          data: {
            department: department?.trim() || null,
            qualification: qualification?.trim() || null,
          },
        });
      });

      // 4. Log audit record with granular changes
      await logAudit(ctx.schoolId, {
        userId: ctx.userId,
        action: "TEACHER_UPDATED",
        entityType: "TEACHER",
        entityId: existingTeacher.id,
        oldValues,
        newValues,
      });
    }

    // 5. Revalidate teacher directory
    revalidatePath("/dashboard/teachers");

    return { success: true, data: { id: existingTeacher.id } };
  } catch (err) {
    console.error("Error updating teacher:", err);
    return {
      success: false,
      error: "An unexpected error occurred while updating the teacher profile.",
    };
  }
}

/**
 * Toggles a teacher's account status between ACTIVE and INACTIVE.
 * Uses the native User.status model and logs audit changes.
 * Only ADMIN users are authorized.
 */
export async function toggleTeacherStatus(
  input: ToggleTeacherStatusInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return { success: false, error: "Unauthorized: only administrators can change teacher status." };
    }

    const parsed = toggleTeacherStatusSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid status data.";
      return { success: false, error: firstError };
    }

    const { teacherId, status, reason } = parsed.data;

    // 1. Locate teacher strictly within this tenant's school
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: teacherId,
        schoolId: ctx.schoolId,
      },
      include: {
        user: true,
      },
    });

    if (!teacher) {
      return { success: false, error: "Teacher record not found in your school records." };
    }

    if (teacher.user.status === status) {
      return { success: false, error: `Teacher account is already ${status.toLowerCase()}.` };
    }

    // 2. Update User status
    await prisma.user.update({
      where: { id: teacher.userId },
      data: { status },
    });

    // 3. Log audit event
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "TEACHER_STATUS_CHANGED",
      entityType: "TEACHER",
      entityId: teacher.id,
      oldValues: {
        status: teacher.user.status,
      },
      newValues: {
        status,
        reason: reason || "Administrative status transition",
      },
    });

    // 4. Revalidate
    revalidatePath("/dashboard/teachers");

    return { success: true, data: { id: teacher.id } };
  } catch (err) {
    console.error("Error changing teacher status:", err);
    return {
      success: false,
      error: "An unexpected error occurred while updating teacher status.",
    };
  }
}

/**
 * Permanently deletes a teacher record and their linked user account.
 * Writes a full snapshot to AuditLog before deletion.
 * Only ADMIN users are authorized.
 */
export async function deleteTeacher(
  teacherId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return { success: false, error: "Unauthorized: only administrators can delete teachers." };
    }

    // 1. Locate teacher strictly within this tenant's school
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: teacherId,
        schoolId: ctx.schoolId,
      },
      include: {
        user: true,
      },
    });

    if (!teacher) {
      return { success: false, error: "Teacher record not found in your school records." };
    }

    // 2. Write audit log snapshot before deletion
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "TEACHER_DELETED",
      entityType: "TEACHER",
      entityId: teacher.id,
      oldValues: {
        employeeCode: teacher.employeeCode,
        name: teacher.user.name,
        email: teacher.user.email,
        department: teacher.department,
        qualification: teacher.qualification,
        status: teacher.user.status,
        createdAt: teacher.createdAt,
      },
    });

    // 3. Atomically delete Teacher and linked User records
    await prisma.$transaction(async (tx) => {
      await tx.teacher.delete({
        where: { id: teacher.id },
      });

      await tx.user.delete({
        where: { id: teacher.userId },
      });
    });

    // 4. Revalidate
    revalidatePath("/dashboard/teachers");

    return { success: true, data: { id: teacher.id } };
  } catch (err) {
    console.error("Error deleting teacher:", err);
    return {
      success: false,
      error: "An unexpected error occurred while deleting the teacher record.",
    };
  }
}

