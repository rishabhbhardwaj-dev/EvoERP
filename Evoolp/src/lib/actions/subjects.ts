"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import {
  createSubjectSchema,
  type CreateSubjectInput,
} from "@/lib/validations/subject";
import type { ActionResult } from "./classes";

/**
 * Creates a new Subject within the tenant's school catalog.
 * Only ADMIN users are authorized.
 */
export async function createSubject(
  input: CreateSubjectInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: only administrators can create subjects.",
      };
    }

    const parsed = createSubjectSchema.safeParse(input);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Invalid subject data.";
      return { success: false, error: firstError };
    }

    const name = parsed.data.name.trim();
    const code = parsed.data.code.trim().toUpperCase();

    // Verify code uniqueness within the tenant's school
    const existing = await prisma.subject.findUnique({
      where: {
        schoolId_code: {
          schoolId: ctx.schoolId,
          code,
        },
      },
    });

    if (existing) {
      return {
        success: false,
        error: `A subject with code "${code}" already exists in your school catalog.`,
      };
    }

    // Create the subject record
    const subject = await prisma.subject.create({
      data: {
        schoolId: ctx.schoolId,
        name,
        code,
      },
    });

    // Write audit log entry
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "SUBJECT_CREATED",
      entityType: "SUBJECT",
      entityId: subject.id,
      newValues: {
        name,
        code,
      },
    });

    // Revalidate the subjects directory path
    revalidatePath("/dashboard/subjects");

    return { success: true, data: { id: subject.id } };
  } catch (err) {
    console.error("Error creating subject:", err);
    return {
      success: false,
      error: "An unexpected error occurred while adding the subject to the catalog.",
    };
  }
}
