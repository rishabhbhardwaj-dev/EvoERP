"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { createClassSchema, type CreateClassInput } from "@/lib/validations/class";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Creates a new Class within the tenant's school.
 * Only ADMIN users are authorized.
 */
export async function createClass(input: CreateClassInput): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return { success: false, error: "Unauthorized: only administrators can create classes." };
    }

    const parsed = createClassSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid class data.";
      return { success: false, error: firstError };
    }

    const { name, academicYear, initialSections } = parsed.data;

    // Check for existing class with the same name and academic year in this school
    const existing = await prisma.class.findUnique({
      where: {
        schoolId_name_academicYear: {
          schoolId: ctx.schoolId,
          name,
          academicYear,
        },
      },
    });

    if (existing) {
      return {
        success: false,
        error: `A class named "${name}" already exists for academic year ${academicYear}.`,
      };
    }

    // Process initial sections if provided (e.g. "A, B" -> ["A", "B"])
    const sectionNames: string[] = [];
    if (initialSections) {
      const parts = initialSections
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length > 0);
      for (const part of parts) {
        if (!sectionNames.includes(part)) {
          sectionNames.push(part);
        }
      }
    }

    // Default to at least Section "A" if none specified
    if (sectionNames.length === 0) {
      sectionNames.push("A");
    }

    const createdClass = await prisma.class.create({
      data: {
        schoolId: ctx.schoolId,
        name,
        academicYear,
        sections: {
          create: sectionNames.map((sectionName) => ({
            schoolId: ctx.schoolId,
            name: sectionName,
          })),
        },
      },
      select: { id: true },
    });

    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/sections");

    return { success: true, data: { id: createdClass.id } };
  } catch (err) {
    console.error("Error creating class:", err);
    return { success: false, error: "An unexpected error occurred while creating the class." };
  }
}

/**
 * Deletes a class if it has zero active enrollments.
 * Only ADMIN users are authorized.
 */
export async function deleteClass(classId: string): Promise<ActionResult> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return { success: false, error: "Unauthorized: only administrators can delete classes." };
    }

    // Verify class belongs to tenant
    const targetClass = await prisma.class.findFirst({
      where: { id: classId, schoolId: ctx.schoolId },
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!targetClass) {
      return { success: false, error: "Class not found." };
    }

    if (targetClass._count.enrollments > 0) {
      return {
        success: false,
        error: `Cannot delete "${targetClass.name}": ${targetClass._count.enrollments} enrolled student(s) exist. Reassign or archive enrollments first.`,
      };
    }

    await prisma.class.delete({
      where: { id: classId },
    });

    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/sections");

    return { success: true };
  } catch (err) {
    console.error("Error deleting class:", err);
    return { success: false, error: "An unexpected error occurred while deleting the class." };
  }
}
