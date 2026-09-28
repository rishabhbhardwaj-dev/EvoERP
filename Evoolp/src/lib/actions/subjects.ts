"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { logAudit, diffChanges } from "@/lib/audit";
import {
  createSubjectSchema,
  updateSubjectSchema,
  type CreateSubjectInput,
  type UpdateSubjectInput,
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

/**
 * Updates an existing Subject's name and code within the tenant's school catalog.
 * Identifiers id and schoolId remain strictly immutable.
 * Only ADMIN users are authorized.
 */
export async function updateSubject(
  input: UpdateSubjectInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: only administrators can edit subjects.",
      };
    }

    const parsed = updateSubjectSchema.safeParse(input);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Invalid subject data.";
      return { success: false, error: firstError };
    }

    const { id, name: rawName, code: rawCode } = parsed.data;
    const name = rawName.trim();
    const code = rawCode.trim().toUpperCase();

    // 1. Locate subject strictly within the tenant's school
    const existing = await prisma.subject.findFirst({
      where: {
        id,
        schoolId: ctx.schoolId,
      },
    });

    if (!existing) {
      return {
        success: false,
        error: "Subject record not found in your school records.",
      };
    }

    // 2. If code changed, check for collision with other subjects in this school
    if (code !== existing.code) {
      const collision = await prisma.subject.findFirst({
        where: {
          schoolId: ctx.schoolId,
          code,
          id: { not: existing.id },
        },
      });

      if (collision) {
        return {
          success: false,
          error: `Another subject with code "${code}" already exists in your school catalog.`,
        };
      }
    }

    // 3. Compute field-level diff for audit logging
    const oldVals: Record<string, unknown> = {
      name: existing.name,
      code: existing.code,
    };

    const newVals: Record<string, unknown> = {
      name,
      code,
    };

    const { oldValues, newValues } = diffChanges(oldVals, newVals);

    // 4. Persist update if there are changes
    if (Object.keys(newValues).length > 0) {
      await prisma.subject.update({
        where: { id: existing.id },
        data: {
          name,
          code,
        },
      });

      // 5. Log audit record with granular changes
      await logAudit(ctx.schoolId, {
        userId: ctx.userId,
        action: "SUBJECT_UPDATED",
        entityType: "SUBJECT",
        entityId: existing.id,
        oldValues,
        newValues,
      });
    }

    // 6. Revalidate
    revalidatePath("/dashboard/subjects");

    return { success: true, data: { id: existing.id } };
  } catch (err) {
    console.error("Error updating subject:", err);
    return {
      success: false,
      error: "An unexpected error occurred while updating the subject.",
    };
  }
}

/**
 * Permanently deletes a Subject record from the tenant's school catalog.
 * Captures a full pre-deletion snapshot in AuditLog.
 * Only ADMIN users are authorized.
 */
export async function deleteSubject(
  subjectId: string,
  confirmationCode?: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: only administrators can delete subjects.",
      };
    }

    // 1. Locate subject strictly within this tenant's school
    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        schoolId: ctx.schoolId,
      },
    });

    if (!subject) {
      return {
        success: false,
        error: "Subject record not found in your school records.",
      };
    }

    // 2. Validate confirmation code if supplied
    if (
      confirmationCode &&
      confirmationCode.trim().toUpperCase() !== subject.code
    ) {
      return {
        success: false,
        error: `Confirmation code "${confirmationCode}" does not match subject code "${subject.code}".`,
      };
    }

    // 3. Write pre-deletion snapshot to AuditLog
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "SUBJECT_DELETED",
      entityType: "SUBJECT",
      entityId: subject.id,
      oldValues: {
        id: subject.id,
        schoolId: subject.schoolId,
        name: subject.name,
        code: subject.code,
        createdAt: subject.createdAt,
      },
    });

    // 4. Permanently delete subject record
    await prisma.subject.delete({
      where: { id: subject.id },
    });

    // 5. Revalidate
    revalidatePath("/dashboard/subjects");

    return { success: true, data: { id: subject.id } };
  } catch (err) {
    console.error("Error deleting subject:", err);
    return {
      success: false,
      error: "An unexpected error occurred while deleting the subject.",
    };
  }
}
