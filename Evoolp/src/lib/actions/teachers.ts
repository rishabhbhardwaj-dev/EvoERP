"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { createTeacherSchema, type CreateTeacherInput } from "@/lib/validations/teacher";
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
