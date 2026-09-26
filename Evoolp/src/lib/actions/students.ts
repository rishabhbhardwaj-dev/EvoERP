"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { createStudentSchema, type CreateStudentInput } from "@/lib/validations/student";
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
