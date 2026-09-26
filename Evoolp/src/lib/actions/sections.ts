"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { createSectionSchema, type CreateSectionInput } from "@/lib/validations/class";
import type { ActionResult } from "./classes";

/**
 * Creates a new Section under an existing Class in the tenant's school.
 * Only ADMIN users are authorized.
 */
export async function createSection(input: CreateSectionInput): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return { success: false, error: "Unauthorized: only administrators can create sections." };
    }

    const parsed = createSectionSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid section data.";
      return { success: false, error: firstError };
    }

    const { classId, name } = parsed.data;
    const sanitizedName = name.trim().toUpperCase();

    // Verify parent class belongs to this school
    const parentClass = await prisma.class.findFirst({
      where: { id: classId, schoolId: ctx.schoolId },
      select: { id: true, name: true },
    });

    if (!parentClass) {
      return { success: false, error: "Class not found." };
    }

    // Check for duplicate section name in this class
    const existing = await prisma.section.findUnique({
      where: {
        classId_name: {
          classId,
          name: sanitizedName,
        },
      },
    });

    if (existing) {
      return {
        success: false,
        error: `Section "${sanitizedName}" already exists in ${parentClass.name}.`,
      };
    }

    const createdSection = await prisma.section.create({
      data: {
        schoolId: ctx.schoolId,
        classId,
        name: sanitizedName,
      },
      select: { id: true },
    });

    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/sections");

    return { success: true, data: { id: createdSection.id } };
  } catch (err) {
    console.error("Error creating section:", err);
    return { success: false, error: "An unexpected error occurred while creating the section." };
  }
}

/**
 * Deletes a section if it has zero active student enrollments.
 * Only ADMIN users are authorized.
 */
export async function deleteSection(sectionId: string): Promise<ActionResult> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return { success: false, error: "Unauthorized: only administrators can delete sections." };
    }

    const section = await prisma.section.findFirst({
      where: { id: sectionId, schoolId: ctx.schoolId },
      include: {
        class: { select: { name: true } },
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!section) {
      return { success: false, error: "Section not found." };
    }

    if (section._count.enrollments > 0) {
      return {
        success: false,
        error: `Cannot delete Section "${section.name}": ${section._count.enrollments} enrolled student(s) exist. Reassign enrollments first.`,
      };
    }

    await prisma.section.delete({
      where: { id: sectionId },
    });

    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/sections");

    return { success: true };
  } catch (err) {
    console.error("Error deleting section:", err);
    return { success: false, error: "An unexpected error occurred while deleting the section." };
  }
}
