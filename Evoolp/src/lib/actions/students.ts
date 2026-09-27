"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { logAudit, diffChanges } from "@/lib/audit";
import type { EnrollmentStatus } from "@prisma/client";
import {
  createStudentSchema,
  updateStudentSchema,
  transferSectionSchema,
  changeStudentStatusSchema,
  type CreateStudentInput,
  type UpdateStudentInput,
  type TransferSectionInput,
  type ChangeStudentStatusInput,
} from "@/lib/validations/student";
import type { ActionResult } from "./classes";

/**
 * Admits a new student and atomically creates their initial class/section enrollment.
 * Only ADMIN users are authorized.
 */
export async function createStudent(
  input: CreateStudentInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return { success: false, error: "Unauthorized: only administrators can admit students." };
    }

    const parsed = createStudentSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid student data.";
      return { success: false, error: firstError };
    }

    const {
      admissionNumber,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      category,
      rteCandidate,
      address,
      academicYear,
      classId,
      sectionId,
    } = parsed.data;

    // 1. Check for duplicate admission number within the tenant's school
    const existingStudent = await prisma.student.findUnique({
      where: {
        schoolId_admissionNumber: {
          schoolId: ctx.schoolId,
          admissionNumber,
        },
      },
    });

    if (existingStudent) {
      return {
        success: false,
        error: `A student with admission number "${admissionNumber}" already exists in this school.`,
      };
    }

    // 2. Validate that class belongs to this school
    const targetClass = await prisma.class.findFirst({
      where: {
        id: classId,
        schoolId: ctx.schoolId,
      },
      select: { id: true, name: true },
    });

    if (!targetClass) {
      return { success: false, error: "Selected class was not found in your school." };
    }

    // 3. Validate that section belongs to this school AND to the selected class
    const targetSection = await prisma.section.findFirst({
      where: {
        id: sectionId,
        schoolId: ctx.schoolId,
        classId,
      },
      select: { id: true, name: true },
    });

    if (!targetSection) {
      return {
        success: false,
        error: `Selected section does not belong to ${targetClass.name}.`,
      };
    }

    // Safe date parsing bounded to valid 4-digit Gregorian years
    let parsedDateOfBirth: Date | null = null;
    if (dateOfBirth && dateOfBirth.trim().length > 0) {
      const d = new Date(dateOfBirth);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2100) {
        parsedDateOfBirth = d;
      }
    }

    // 4. Atomically create Student + Enrollment in a single database transaction
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          schoolId: ctx.schoolId,
          admissionNumber,
          firstName,
          lastName,
          dateOfBirth: parsedDateOfBirth,
          gender: gender ?? null,
          category,
          rteCandidate,
          address: address || null,
          status: "ACTIVE",
        },
      });

      const enrollment = await tx.enrollment.create({
        data: {
          schoolId: ctx.schoolId,
          studentId: student.id,
          classId,
          sectionId,
          academicYear,
          status: "ACTIVE",
        },
      });

      return { student, enrollment };
    });

    // 5. Write audit log entry (non-blocking)
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "STUDENT_ADMITTED",
      entityType: "STUDENT",
      entityId: result.student.id,
      newValues: {
        admissionNumber,
        name: `${firstName} ${lastName}`,
        academicYear,
        className: targetClass.name,
        sectionName: targetSection.name,
        category,
        rteCandidate,
      },
    });

    // 6. Revalidate relevant App Router paths
    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/sections");

    return { success: true, data: { id: result.student.id } };
  } catch (err) {
    console.error("Error admitting student:", err);
    return {
      success: false,
      error: "An unexpected error occurred while admitting the student.",
    };
  }
}

/**
 * Updates demographic and address fields for an existing student.
 * Admission number, id, and schoolId remain immutable.
 * Only ADMIN users are authorized.
 */
export async function updateStudent(
  input: UpdateStudentInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return { success: false, error: "Unauthorized: only administrators can edit student details." };
    }

    const parsed = updateStudentSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid student data.";
      return { success: false, error: firstError };
    }

    const {
      id,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      category,
      rteCandidate,
      address,
    } = parsed.data;

    // 1. Locate existing student strictly within this tenant's school
    const existingStudent = await prisma.student.findFirst({
      where: {
        id,
        schoolId: ctx.schoolId,
      },
    });

    if (!existingStudent) {
      return { success: false, error: "Student not found in your school records." };
    }

    // Safe date parsing bounded to valid 4-digit Gregorian years
    let parsedDateOfBirth: Date | null = null;
    if (dateOfBirth && dateOfBirth.trim().length > 0) {
      const d = new Date(dateOfBirth);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2100) {
        parsedDateOfBirth = d;
      }
    }

    // 2. Compute field-level diff for audit logging
    const oldVals: Record<string, unknown> = {
      firstName: existingStudent.firstName,
      lastName: existingStudent.lastName,
      dateOfBirth: existingStudent.dateOfBirth
        ? existingStudent.dateOfBirth.toISOString().split("T")[0]
        : null,
      gender: existingStudent.gender,
      category: existingStudent.category,
      rteCandidate: existingStudent.rteCandidate,
      address: existingStudent.address ?? null,
    };

    const newVals: Record<string, unknown> = {
      firstName,
      lastName,
      dateOfBirth: parsedDateOfBirth
        ? parsedDateOfBirth.toISOString().split("T")[0]
        : null,
      gender: gender ?? null,
      category,
      rteCandidate,
      address: address || null,
    };

    const { oldValues, newValues } = diffChanges(oldVals, newVals);

    // 3. Persist update if there are any changes
    if (Object.keys(newValues).length > 0) {
      await prisma.student.update({
        where: { id: existingStudent.id },
        data: {
          firstName,
          lastName,
          dateOfBirth: parsedDateOfBirth,
          gender: gender ?? null,
          category,
          rteCandidate,
          address: address || null,
        },
      });

      // 4. Log audit record with granular changes
      await logAudit(ctx.schoolId, {
        userId: ctx.userId,
        action: "STUDENT_UPDATED",
        entityType: "STUDENT",
        entityId: existingStudent.id,
        oldValues,
        newValues,
      });
    }

    // 5. Revalidate student directory
    revalidatePath("/dashboard/students");

    return { success: true, data: { id: existingStudent.id } };
  } catch (err) {
    console.error("Error updating student:", err);
    return {
      success: false,
      error: "An unexpected error occurred while updating student details.",
    };
  }
}

/**
 * Transfers an active student to a different section within their current class standard.
 * Updates the active Enrollment record and writes a structured audit log.
 * Only ADMIN users are authorized.
 */
export async function transferStudentSection(
  input: TransferSectionInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return { success: false, error: "Unauthorized: only administrators can transfer students." };
    }

    const parsed = transferSectionSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid transfer data.";
      return { success: false, error: firstError };
    }

    const { studentId, targetSectionId, reason } = parsed.data;

    // 1. Locate student and their active enrollment
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        schoolId: ctx.schoolId,
      },
      include: {
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            class: { select: { id: true, name: true } },
            section: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!student) {
      return { success: false, error: "Student not found in your school records." };
    }

    const activeEnrollment = student.enrollments[0];
    if (!activeEnrollment) {
      return {
        success: false,
        error: "Cannot transfer section: Student has no active enrollment in the current term.",
      };
    }

    // 2. Validate that target section exists in this school AND belongs to student's current class
    const targetSection = await prisma.section.findFirst({
      where: {
        id: targetSectionId,
        schoolId: ctx.schoolId,
        classId: activeEnrollment.classId,
      },
      select: { id: true, name: true },
    });

    if (!targetSection) {
      return {
        success: false,
        error: `Target section does not belong to ${activeEnrollment.class.name}.`,
      };
    }

    if (targetSection.id === activeEnrollment.sectionId) {
      return {
        success: false,
        error: `Student is already placed in Section ${targetSection.name}.`,
      };
    }

    // 3. Update the active enrollment's sectionId
    await prisma.enrollment.update({
      where: { id: activeEnrollment.id },
      data: {
        sectionId: targetSection.id,
        updatedAt: new Date(),
      },
    });

    // 4. Log audit entry for the section transfer
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "STUDENT_SECTION_TRANSFERRED",
      entityType: "STUDENT",
      entityId: student.id,
      oldValues: {
        classId: activeEnrollment.class.id,
        className: activeEnrollment.class.name,
        sectionId: activeEnrollment.section.id,
        sectionName: activeEnrollment.section.name,
        academicYear: activeEnrollment.academicYear,
      },
      newValues: {
        classId: activeEnrollment.class.id,
        className: activeEnrollment.class.name,
        sectionId: targetSection.id,
        sectionName: targetSection.name,
        academicYear: activeEnrollment.academicYear,
        reason: reason || "Section re-allocation",
      },
    });

    // 5. Revalidate relevant routes
    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/sections");

    return { success: true, data: { id: student.id } };
  } catch (err) {
    console.error("Error transferring student section:", err);
    return {
      success: false,
      error: "An unexpected error occurred while transferring the student.",
    };
  }
}

/**
 * Transitions a student's status (ACTIVE -> TRANSFERRED | ALUMNI, or re-activation).
 * Synchronizes the active Enrollment status and logs audit changes.
 * Only ADMIN users are authorized.
 */
export async function changeStudentStatus(
  input: ChangeStudentStatusInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return { success: false, error: "Unauthorized: only administrators can change student status." };
    }

    const parsed = changeStudentStatusSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid status data.";
      return { success: false, error: firstError };
    }

    const { studentId, status, reason } = parsed.data;

    // 1. Locate student with enrollments
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        schoolId: ctx.schoolId,
      },
      include: {
        enrollments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!student) {
      return { success: false, error: "Student not found in your school records." };
    }

    if (student.status === status) {
      return { success: false, error: `Student is already in ${status} status.` };
    }

    const activeEnrollment =
      student.enrollments.find((e) => e.status === "ACTIVE") ?? student.enrollments[0];

    // Determine target enrollment status based on student transition
    let targetEnrollmentStatus: EnrollmentStatus = "ACTIVE";
    if (status === "TRANSFERRED") {
      targetEnrollmentStatus = "WITHDRAWN";
    } else if (status === "ALUMNI") {
      targetEnrollmentStatus = "COMPLETED";
    }

    // 2. Perform status transition in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: student.id },
        data: { status },
      });

      if (activeEnrollment) {
        await tx.enrollment.update({
          where: { id: activeEnrollment.id },
          data: { status: targetEnrollmentStatus },
        });
      }
    });

    // 3. Log audit event
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "STUDENT_STATUS_CHANGED",
      entityType: "STUDENT",
      entityId: student.id,
      oldValues: {
        status: student.status,
        enrollmentStatus: activeEnrollment?.status ?? null,
      },
      newValues: {
        status,
        enrollmentStatus: targetEnrollmentStatus,
        reason: reason || "Status transition",
      },
    });

    // 4. Revalidate
    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/sections");

    return { success: true, data: { id: student.id } };
  } catch (err) {
    console.error("Error changing student status:", err);
    return {
      success: false,
      error: "An unexpected error occurred while updating student status.",
    };
  }
}

/**
 * Safely deletes a student record if no multi-year historical enrollments exist.
 * Logs snapshot to AuditLog before permanent removal.
 * Only ADMIN users are authorized.
 */
export async function deleteStudent(
  studentId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return { success: false, error: "Unauthorized: only administrators can delete students." };
    }

    // 1. Locate student with enrollments
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        schoolId: ctx.schoolId,
      },
      include: {
        _count: {
          select: { enrollments: true },
        },
        enrollments: {
          include: {
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
    });

    if (!student) {
      return { success: false, error: "Student not found in your school records." };
    }

    // 2. Safe deletion guard: Block deletion if student has multi-year academic history
    if (student._count.enrollments > 1) {
      return {
        success: false,
        error: "Cannot delete student with historical academic records across multiple terms. Please change status to Transferred or Alumni instead.",
      };
    }

    // 3. Write audit log snapshot before deletion
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "STUDENT_DELETED",
      entityType: "STUDENT",
      entityId: student.id,
      oldValues: {
        admissionNumber: student.admissionNumber,
        name: `${student.firstName} ${student.lastName}`,
        category: student.category,
        rteCandidate: student.rteCandidate,
        status: student.status,
        enrollments: student.enrollments.map(
          (e) => `${e.class.name}-${e.section.name} (${e.academicYear})`
        ),
      },
    });

    // 4. Delete the student (Prisma cascade cleanly deletes the single enrollment)
    await prisma.student.delete({
      where: { id: student.id },
    });

    // 5. Revalidate
    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/sections");

    return { success: true, data: { id: student.id } };
  } catch (err) {
    console.error("Error deleting student:", err);
    return {
      success: false,
      error: "An unexpected error occurred while deleting the student record.",
    };
  }
}


