"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { logAudit, diffChanges } from "@/lib/audit";
import {
  createFeeCategorySchema,
  updateFeeCategorySchema,
  createFeeStructureSchema,
  updateFeeStructureSchema,
  createFeeDiscountSchema,
  allocateFeesSchema,
  getStudentFeeItemsQuerySchema,
  type CreateFeeCategoryInput,
  type UpdateFeeCategoryInput,
  type CreateFeeStructureInput,
  type UpdateFeeStructureInput,
  type CreateFeeDiscountInput,
  type AllocateFeesInput,
  type GetStudentFeeItemsQueryInput,
} from "@/lib/validations/fee";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEE CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new FeeCategory within the tenant's school.
 * ADMIN only.
 */
export async function createFeeCategory(
  input: CreateFeeCategoryInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: only administrators can create fee categories.",
      };
    }

    const parsed = createFeeCategorySchema.safeParse(input);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Invalid fee category data.";
      return { success: false, error: firstError };
    }

    const { name, code, description, status } = parsed.data;

    // Verify unique code per school
    const existingCode = await prisma.feeCategory.findUnique({
      where: {
        schoolId_code: {
          schoolId: ctx.schoolId,
          code,
        },
      },
    });

    if (existingCode) {
      return {
        success: false,
        error: `A fee category with code "${code}" already exists in this school.`,
      };
    }

    // Verify unique name per school
    const existingName = await prisma.feeCategory.findUnique({
      where: {
        schoolId_name: {
          schoolId: ctx.schoolId,
          name,
        },
      },
    });

    if (existingName) {
      return {
        success: false,
        error: `A fee category named "${name}" already exists in this school.`,
      };
    }

    const created = await prisma.feeCategory.create({
      data: {
        schoolId: ctx.schoolId,
        name,
        code,
        description: description ?? null,
        status: status ?? "ACTIVE",
      },
      select: { id: true, name: true, code: true },
    });

    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "FEE_CATEGORY_CREATED",
      entityType: "FeeCategory",
      entityId: created.id,
      newValues: {
        name,
        code,
        description,
        status: status ?? "ACTIVE",
      },
    });

    revalidatePath("/dashboard/fees");

    return { success: true, data: { id: created.id } };
  } catch (err) {
    console.error("Error creating fee category:", err);
    return {
      success: false,
      error: "An unexpected error occurred while creating the fee category.",
    };
  }
}

/**
 * Updates an existing FeeCategory.
 * ADMIN only.
 */
export async function updateFeeCategory(
  input: UpdateFeeCategoryInput
): Promise<ActionResult> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: only administrators can update fee categories.",
      };
    }

    const parsed = updateFeeCategorySchema.safeParse(input);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Invalid fee category data.";
      return { success: false, error: firstError };
    }

    const { id, name, code, description, status } = parsed.data;

    // Verify tenant ownership
    const existing = await prisma.feeCategory.findFirst({
      where: { id, schoolId: ctx.schoolId },
    });

    if (!existing) {
      return { success: false, error: "Fee category not found." };
    }

    // Enforce code uniqueness ignoring current record
    if (code !== existing.code) {
      const codeDuplicate = await prisma.feeCategory.findFirst({
        where: {
          schoolId: ctx.schoolId,
          code,
          NOT: { id },
        },
      });
      if (codeDuplicate) {
        return {
          success: false,
          error: `A fee category with code "${code}" already exists in this school.`,
        };
      }
    }

    // Enforce name uniqueness ignoring current record
    if (name !== existing.name) {
      const nameDuplicate = await prisma.feeCategory.findFirst({
        where: {
          schoolId: ctx.schoolId,
          name,
          NOT: { id },
        },
      });
      if (nameDuplicate) {
        return {
          success: false,
          error: `A fee category named "${name}" already exists in this school.`,
        };
      }
    }

    const oldVals = {
      name: existing.name,
      code: existing.code,
      description: existing.description,
      status: existing.status,
    };

    const newVals = {
      name,
      code,
      description: description ?? null,
      status: status ?? "ACTIVE",
    };

    await prisma.feeCategory.update({
      where: { id },
      data: newVals,
    });

    const { oldValues, newValues } = diffChanges(oldVals, newVals);

    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "FEE_CATEGORY_UPDATED",
      entityType: "FeeCategory",
      entityId: id,
      oldValues,
      newValues,
    });

    revalidatePath("/dashboard/fees");

    return { success: true };
  } catch (err) {
    console.error("Error updating fee category:", err);
    return {
      success: false,
      error: "An unexpected error occurred while updating the fee category.",
    };
  }
}

/**
 * Deletes a FeeCategory if it is not referenced by any FeeStructureItem or StudentFeeItem.
 * ADMIN only.
 */
export async function deleteFeeCategory(
  feeCategoryId: string
): Promise<ActionResult> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: only administrators can delete fee categories.",
      };
    }

    // Verify tenant ownership and check references
    const category = await prisma.feeCategory.findFirst({
      where: { id: feeCategoryId, schoolId: ctx.schoolId },
      include: {
        _count: {
          select: {
            feeStructureItems: true,
            studentFeeItems: true,
          },
        },
      },
    });

    if (!category) {
      return { success: false, error: "Fee category not found." };
    }

    if (
      category._count.feeStructureItems > 0 ||
      category._count.studentFeeItems > 0
    ) {
      return {
        success: false,
        error:
          "Cannot delete fee category because it is referenced in fee structures or allocated student fee items.",
      };
    }

    await prisma.feeCategory.delete({
      where: { id: feeCategoryId },
    });

    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "FEE_CATEGORY_DELETED",
      entityType: "FeeCategory",
      entityId: feeCategoryId,
      oldValues: {
        name: category.name,
        code: category.code,
        description: category.description,
      },
    });

    revalidatePath("/dashboard/fees");

    return { success: true };
  } catch (err) {
    console.error("Error deleting fee category:", err);
    return {
      success: false,
      error: "An unexpected error occurred while deleting the fee category.",
    };
  }
}

/**
 * Fetches all fee categories for the current school.
 * ADMIN / TEACHER access only.
 */
export async function getFeeCategories(): Promise<
  ActionResult<
    Array<{
      id: string;
      name: string;
      code: string;
      description: string | null;
      isSystem: boolean;
      status: string;
      createdAt: Date;
    }>
  >
> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error: "Unauthorized: read access restricted to staff.",
      };
    }

    const categories = await prisma.feeCategory.findMany({
      where: { schoolId: ctx.schoolId },
      orderBy: { code: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        isSystem: true,
        status: true,
        createdAt: true,
      },
    });

    return { success: true, data: categories };
  } catch (err) {
    console.error("Error fetching fee categories:", err);
    return {
      success: false,
      error: "An unexpected error occurred while fetching fee categories.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEE STRUCTURES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new FeeStructure + line items atomically.
 * ADMIN only.
 */
export async function createFeeStructure(
  input: CreateFeeStructureInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: only administrators can create fee structures.",
      };
    }

    const parsed = createFeeStructureSchema.safeParse(input);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Invalid fee structure data.";
      return { success: false, error: firstError };
    }

    const { classId, sectionId, academicYear, name, notes, items } =
      parsed.data;

    // Verify Class belongs to current school
    const targetClass = await prisma.class.findFirst({
      where: { id: classId, schoolId: ctx.schoolId },
    });

    if (!targetClass) {
      return {
        success: false,
        error: "Selected class does not exist or belong to this school.",
      };
    }

    // Verify optional Section belongs to current school AND selected Class
    if (sectionId) {
      const targetSection = await prisma.section.findFirst({
        where: { id: sectionId, schoolId: ctx.schoolId, classId },
      });
      if (!targetSection) {
        return {
          success: false,
          error: "Selected section does not belong to the chosen class.",
        };
      }
    }

    // Verify all feeCategoryIds belong to current school
    const categoryIds = Array.from(new Set(items.map((i) => i.feeCategoryId)));
    const categories = await prisma.feeCategory.findMany({
      where: {
        id: { in: categoryIds },
        schoolId: ctx.schoolId,
      },
      select: { id: true },
    });

    if (categories.length !== categoryIds.length) {
      return {
        success: false,
        error: "One or more selected fee categories are invalid for this school.",
      };
    }

    // Handle nullable sectionId uniqueness with explicit application guard
    const existingStructure = await prisma.feeStructure.findFirst({
      where: {
        schoolId: ctx.schoolId,
        classId,
        sectionId: sectionId ?? null,
        academicYear,
        name,
      },
    });

    if (existingStructure) {
      return {
        success: false,
        error: `A fee structure named "${name}" already exists for this class/section and academic year.`,
      };
    }

    // Create FeeStructure + FeeStructureItem rows atomically
    const created = await prisma.$transaction(async (tx) => {
      const structure = await tx.feeStructure.create({
        data: {
          schoolId: ctx.schoolId,
          classId,
          sectionId: sectionId ?? null,
          academicYear,
          name,
          notes: notes ?? null,
          status: "ACTIVE",
          items: {
            create: items.map((item) => ({
              schoolId: ctx.schoolId,
              feeCategoryId: item.feeCategoryId,
              amount: new Prisma.Decimal(item.amount),
              frequency: item.frequency,
              dueMonth: item.dueMonth ?? null,
            })),
          },
        },
        select: { id: true },
      });
      return structure;
    });

    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "FEE_STRUCTURE_CREATED",
      entityType: "FeeStructure",
      entityId: created.id,
      newValues: {
        classId,
        sectionId: sectionId ?? null,
        academicYear,
        name,
        notes,
        itemCount: items.length,
      },
    });

    revalidatePath("/dashboard/fees");

    return { success: true, data: { id: created.id } };
  } catch (err) {
    console.error("Error creating fee structure:", err);
    return {
      success: false,
      error: "An unexpected error occurred while creating the fee structure.",
    };
  }
}

/**
 * Updates a FeeStructure details and line items.
 * Preserves historical student fee item snapshots.
 * ADMIN only.
 */
export async function updateFeeStructure(
  input: UpdateFeeStructureInput
): Promise<ActionResult> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: only administrators can update fee structures.",
      };
    }

    const parsed = updateFeeStructureSchema.safeParse(input);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Invalid fee structure data.";
      return { success: false, error: firstError };
    }

    const { id, name, notes, items } = parsed.data;

    // Verify tenant ownership
    const existing = await prisma.feeStructure.findFirst({
      where: { id, schoolId: ctx.schoolId },
      include: { items: true },
    });

    if (!existing) {
      return { success: false, error: "Fee structure not found." };
    }

    // Verify all feeCategoryIds belong to current school
    const categoryIds = Array.from(new Set(items.map((i) => i.feeCategoryId)));
    const categories = await prisma.feeCategory.findMany({
      where: {
        id: { in: categoryIds },
        schoolId: ctx.schoolId,
      },
      select: { id: true },
    });

    if (categories.length !== categoryIds.length) {
      return {
        success: false,
        error: "One or more selected fee categories are invalid for this school.",
      };
    }

    // If name changed, check uniqueness
    if (name !== existing.name) {
      const duplicate = await prisma.feeStructure.findFirst({
        where: {
          schoolId: ctx.schoolId,
          classId: existing.classId,
          sectionId: existing.sectionId,
          academicYear: existing.academicYear,
          name,
          NOT: { id },
        },
      });
      if (duplicate) {
        return {
          success: false,
          error: `A fee structure named "${name}" already exists for this class/section and academic year.`,
        };
      }
    }

    const oldVals = {
      name: existing.name,
      notes: existing.notes,
      itemCount: existing.items.length,
    };

    const newVals = {
      name,
      notes: notes ?? null,
      itemCount: items.length,
    };

    await prisma.$transaction(async (tx) => {
      // Update fee structure info
      await tx.feeStructure.update({
        where: { id },
        data: {
          name,
          notes: notes ?? null,
        },
      });

      // Delete old line items (StudentFeeItem relation uses SetNull so student historical records are preserved!)
      await tx.feeStructureItem.deleteMany({
        where: { feeStructureId: id },
      });

      // Insert new line items
      await tx.feeStructureItem.createMany({
        data: items.map((item) => ({
          schoolId: ctx.schoolId,
          feeStructureId: id,
          feeCategoryId: item.feeCategoryId,
          amount: new Prisma.Decimal(item.amount),
          frequency: item.frequency,
          dueMonth: item.dueMonth ?? null,
        })),
      });
    });

    const { oldValues, newValues } = diffChanges(oldVals, newVals);

    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "FEE_STRUCTURE_UPDATED",
      entityType: "FeeStructure",
      entityId: id,
      oldValues,
      newValues,
    });

    revalidatePath("/dashboard/fees");

    return { success: true };
  } catch (err) {
    console.error("Error updating fee structure:", err);
    return {
      success: false,
      error: "An unexpected error occurred while updating the fee structure.",
    };
  }
}

/**
 * Archives a FeeStructure (status -> ARCHIVED).
 * ADMIN only.
 */
export async function archiveFeeStructure(
  feeStructureId: string
): Promise<ActionResult> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: only administrators can archive fee structures.",
      };
    }

    const structure = await prisma.feeStructure.findFirst({
      where: { id: feeStructureId, schoolId: ctx.schoolId },
    });

    if (!structure) {
      return { success: false, error: "Fee structure not found." };
    }

    await prisma.feeStructure.update({
      where: { id: feeStructureId },
      data: { status: "ARCHIVED" },
    });

    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "FEE_STRUCTURE_ARCHIVED",
      entityType: "FeeStructure",
      entityId: feeStructureId,
      oldValues: { status: structure.status },
      newValues: { status: "ARCHIVED" },
    });

    revalidatePath("/dashboard/fees");

    return { success: true };
  } catch (err) {
    console.error("Error archiving fee structure:", err);
    return {
      success: false,
      error: "An unexpected error occurred while archiving the fee structure.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEE DISCOUNTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new FeeDiscount.
 * ADMIN only.
 */
export async function createFeeDiscount(
  input: CreateFeeDiscountInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: only administrators can create fee discounts.",
      };
    }

    const parsed = createFeeDiscountSchema.safeParse(input);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Invalid fee discount data.";
      return { success: false, error: firstError };
    }

    const { name, code, type, value, isRteDefault, status } = parsed.data;

    // Check unique code per school
    const existingCode = await prisma.feeDiscount.findUnique({
      where: {
        schoolId_code: {
          schoolId: ctx.schoolId,
          code,
        },
      },
    });

    if (existingCode) {
      return {
        success: false,
        error: `A fee discount with code "${code}" already exists in this school.`,
      };
    }

    // Check unique name per school
    const existingName = await prisma.feeDiscount.findUnique({
      where: {
        schoolId_name: {
          schoolId: ctx.schoolId,
          name,
        },
      },
    });

    if (existingName) {
      return {
        success: false,
        error: `A fee discount named "${name}" already exists in this school.`,
      };
    }

    const created = await prisma.feeDiscount.create({
      data: {
        schoolId: ctx.schoolId,
        name,
        code,
        type,
        value: new Prisma.Decimal(value),
        isRteDefault: isRteDefault ?? false,
        status: status ?? "ACTIVE",
      },
      select: { id: true },
    });

    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "FEE_DISCOUNT_CREATED",
      entityType: "FeeDiscount",
      entityId: created.id,
      newValues: {
        name,
        code,
        type,
        value,
        isRteDefault: isRteDefault ?? false,
        status: status ?? "ACTIVE",
      },
    });

    revalidatePath("/dashboard/fees");

    return { success: true, data: { id: created.id } };
  } catch (err) {
    console.error("Error creating fee discount:", err);
    return {
      success: false,
      error: "An unexpected error occurred while creating the fee discount.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COHORT ALLOCATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export interface CohortAllocationResult {
  totalStudents: number;
  allocatedCount: number;
  skippedCount: number;
  grossTotal: number;
  discountTotal: number;
  netTotal: number;
}

/**
 * Allocates fees from a FeeStructure to an active student cohort.
 * ADMIN only.
 */
export async function allocateFeesToCohort(
  input: AllocateFeesInput
): Promise<ActionResult<CohortAllocationResult>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: only administrators can allocate fees.",
      };
    }

    const parsed = allocateFeesSchema.safeParse(input);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Invalid allocation request data.";
      return { success: false, error: firstError };
    }

    const { classId, sectionId, academicYear, feeStructureId, discountId } =
      parsed.data;

    // 1. Verify FeeStructure belongs to current school and is ACTIVE
    const structure = await prisma.feeStructure.findFirst({
      where: {
        id: feeStructureId,
        schoolId: ctx.schoolId,
      },
      include: {
        items: {
          include: { feeCategory: true },
        },
      },
    });

    if (!structure) {
      return {
        success: false,
        error: "Fee structure not found or does not belong to this school.",
      };
    }

    if (structure.status === "ARCHIVED") {
      return {
        success: false,
        error: "Cannot allocate from an archived fee structure.",
      };
    }

    if (structure.items.length === 0) {
      return {
        success: false,
        error: "Fee structure has no line items to allocate.",
      };
    }

    // 2. Verify target Class belongs to current school
    const targetClass = await prisma.class.findFirst({
      where: { id: classId, schoolId: ctx.schoolId },
    });

    if (!targetClass) {
      return {
        success: false,
        error: "Selected class does not exist or belong to this school.",
      };
    }

    // 3. Verify optional Section belongs to current school and selected Class
    if (sectionId) {
      const targetSection = await prisma.section.findFirst({
        where: { id: sectionId, schoolId: ctx.schoolId, classId },
      });

      if (!targetSection) {
        return {
          success: false,
          error: "Selected section does not belong to the chosen class.",
        };
      }
    }

    // 4. Verify academicYear matches structure and class target
    if (structure.academicYear !== academicYear) {
      return {
        success: false,
        error: `Fee structure academic year (${structure.academicYear}) does not match target academic year (${academicYear}).`,
      };
    }

    // 5. Resolve active Enrollments matching cohort strictly
    const enrollments = await prisma.enrollment.findMany({
      where: {
        schoolId: ctx.schoolId,
        classId,
        ...(sectionId ? { sectionId } : {}),
        academicYear,
        status: "ACTIVE",
        student: {
          status: "ACTIVE",
        },
      },
      include: {
        student: true,
      },
    });

    if (enrollments.length === 0) {
      return {
        success: false,
        error: "No active student enrollments found in the specified cohort.",
      };
    }

    // 6. Check custom discount if supplied
    let customDiscount: {
      id: string;
      type: "PERCENTAGE" | "FIXED_AMOUNT";
      value: Prisma.Decimal;
    } | null = null;

    if (discountId) {
      const disc = await prisma.feeDiscount.findFirst({
        where: { id: discountId, schoolId: ctx.schoolId, status: "ACTIVE" },
      });
      if (!disc) {
        return {
          success: false,
          error: "Selected discount is invalid or inactive.",
        };
      }
      customDiscount = {
        id: disc.id,
        type: disc.type,
        value: disc.value,
      };
    }

    // 7. Check default RTE discount in school for RTE candidates
    const rteDiscount = await prisma.feeDiscount.findFirst({
      where: {
        schoolId: ctx.schoolId,
        isRteDefault: true,
        status: "ACTIVE",
      },
    });

    // 8. Query existing StudentFeeItems to avoid duplicate allocations
    const studentIds = enrollments.map((e) => e.studentId);
    const feeCategoryIds = structure.items.map((i) => i.feeCategoryId);
    const feeStructureItemIds = structure.items.map((i) => i.id);

    const existingFeeItems = await prisma.studentFeeItem.findMany({
      where: {
        schoolId: ctx.schoolId,
        academicYear,
        studentId: { in: studentIds },
        feeCategoryId: { in: feeCategoryIds },
        feeStructureItemId: { in: feeStructureItemIds },
      },
      select: {
        studentId: true,
        feeCategoryId: true,
        feeStructureItemId: true,
      },
    });

    const existingKeySet = new Set(
      existingFeeItems.map(
        (ef) => `${ef.studentId}::${ef.feeCategoryId}::${ef.feeStructureItemId}`
      )
    );

    // 9. Prepare batch allocation operations using exact Decimal math
    const newItemsToCreate: Array<Prisma.StudentFeeItemCreateManyInput> = [];

    let aggregateGross = new Prisma.Decimal(0);
    let aggregateDiscount = new Prisma.Decimal(0);
    let aggregateNet = new Prisma.Decimal(0);

    let allocatedCount = 0;
    let skippedCount = 0;

    // Helper for due date calculation based on Indian FY (Apr-Mar)
    const [startYearStr, endYearStr] = academicYear.split("-");
    const startYear = parseInt(startYearStr, 10);
    const endYear = parseInt(endYearStr, 10);

    for (const enrollment of enrollments) {
      const student = enrollment.student;

      // Determine applicable discount for this student
      let applicableDisc = customDiscount;
      if (student.rteCandidate && rteDiscount) {
        applicableDisc = {
          id: rteDiscount.id,
          type: rteDiscount.type,
          value: rteDiscount.value,
        };
      }

      for (const item of structure.items) {
        const key = `${student.id}::${item.feeCategoryId}::${item.id}`;
        if (existingKeySet.has(key)) {
          skippedCount++;
          continue;
        }

        const gross = new Prisma.Decimal(item.amount);
        let discAmt = new Prisma.Decimal(0);
        let discId: string | null = null;

        if (applicableDisc) {
          discId = applicableDisc.id;
          if (applicableDisc.type === "PERCENTAGE") {
            discAmt = gross
              .times(applicableDisc.value)
              .dividedBy(100)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
          } else {
            discAmt = new Prisma.Decimal(applicableDisc.value);
          }

          if (discAmt.greaterThan(gross)) {
            discAmt = gross;
          }
          if (discAmt.lessThan(0)) {
            discAmt = new Prisma.Decimal(0);
          }
        }

        let net = gross.minus(discAmt);
        if (net.lessThan(0)) {
          net = new Prisma.Decimal(0);
        }

        const status = net.equals(0) ? "WAIVED" : "ASSIGNED";

        // Calculate due date if dueMonth is present
        let dueDate: Date | null = null;
        if (item.dueMonth && item.dueMonth >= 1 && item.dueMonth <= 12) {
          const yr =
            item.dueMonth >= 4 && item.dueMonth <= 12 ? startYear : endYear;
          dueDate = new Date(Date.UTC(yr, item.dueMonth - 1, 10));
        }

        newItemsToCreate.push({
          schoolId: ctx.schoolId,
          studentId: student.id,
          enrollmentId: enrollment.id,
          feeStructureItemId: item.id,
          feeCategoryId: item.feeCategoryId,
          academicYear,
          dueDate,
          grossAmount: gross,
          discountId: discId,
          discountAmount: discAmt,
          netAmount: net,
          status,
          assignedById: ctx.userId,
        });

        aggregateGross = aggregateGross.plus(gross);
        aggregateDiscount = aggregateDiscount.plus(discAmt);
        aggregateNet = aggregateNet.plus(net);

        allocatedCount++;
      }
    }

    if (newItemsToCreate.length > 0) {
      await prisma.studentFeeItem.createMany({
        data: newItemsToCreate,
      });
    }

    // 10. Audit event aggregate
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "FEE_ITEMS_ALLOCATED",
      entityType: "StudentFeeItem",
      entityId: feeStructureId,
      newValues: {
        classId,
        sectionId: sectionId ?? null,
        academicYear,
        feeStructureId,
        studentCount: enrollments.length,
        allocatedCount,
        skippedCount,
        grossTotal: aggregateGross.toFixed(2),
        discountTotal: aggregateDiscount.toFixed(2),
        netTotal: aggregateNet.toFixed(2),
      },
    });

    revalidatePath("/dashboard/fees");

    return {
      success: true,
      data: {
        totalStudents: enrollments.length,
        allocatedCount,
        skippedCount,
        grossTotal: aggregateGross.toNumber(),
        discountTotal: aggregateDiscount.toNumber(),
        netTotal: aggregateNet.toNumber(),
      },
    };
  } catch (err) {
    console.error("Error allocating fees to cohort:", err);
    return {
      success: false,
      error: "An unexpected error occurred while allocating fees.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY & READ ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface FormattedStudentFeeItem {
  id: string;
  schoolId: string;
  studentId: string;
  enrollmentId: string;
  feeStructureItemId: string | null;
  feeCategoryId: string;
  academicYear: string;
  dueDate: Date | null;
  grossAmount: number;
  discountId: string | null;
  discountAmount: number;
  netAmount: number;
  remarks: string | null;
  status: string;
  assignedById: string;
  createdAt: Date;
  updatedAt: Date;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    rteCandidate: boolean;
  };
  feeCategory: {
    id: string;
    name: string;
    code: string;
  };
  discount: {
    id: string;
    name: string;
    type: string;
    value: number;
  } | null;
}

export interface FormattedFeeStructure {
  id: string;
  schoolId: string;
  classId: string;
  sectionId: string | null;
  academicYear: string;
  name: string;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  class: { id: string; name: string };
  section: { id: string; name: string } | null;
  items: Array<{
    id: string;
    schoolId: string;
    feeStructureId: string;
    feeCategoryId: string;
    amount: number;
    frequency: string;
    dueMonth: number | null;
    createdAt: Date;
    updatedAt: Date;
    feeCategory: { id: string; name: string; code: string };
  }>;
}

export interface FormattedFeeDiscount {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  type: string;
  value: number;
  isRteDefault: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Fetches allocated StudentFeeItems for a specific class/section/academicYear.
 * ADMIN / TEACHER access only.
 */
export async function getStudentFeeItemsForClass(
  input: GetStudentFeeItemsQueryInput
): Promise<ActionResult<FormattedStudentFeeItem[]>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error: "Unauthorized: read access restricted to staff.",
      };
    }

    const parsed = getStudentFeeItemsQuerySchema.safeParse(input);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Invalid query parameters.";
      return { success: false, error: firstError };
    }

    const { classId, sectionId, academicYear } = parsed.data;

    // Verify Class belongs to current school
    const targetClass = await prisma.class.findFirst({
      where: { id: classId, schoolId: ctx.schoolId },
    });

    if (!targetClass) {
      return { success: false, error: "Class not found." };
    }

    const feeItems = await prisma.studentFeeItem.findMany({
      where: {
        schoolId: ctx.schoolId,
        academicYear,
        enrollment: {
          classId,
          ...(sectionId ? { sectionId } : {}),
        },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            rteCandidate: true,
          },
        },
        feeCategory: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        discount: {
          select: {
            id: true,
            name: true,
            type: true,
            value: true,
          },
        },
      },
      orderBy: [{ student: { firstName: "asc" } }, { createdAt: "desc" }],
    });

    // Format Decimal values for JSON consumption
    const formatted: FormattedStudentFeeItem[] = feeItems.map((item) => ({
      ...item,
      grossAmount: item.grossAmount.toNumber(),
      discountAmount: item.discountAmount.toNumber(),
      netAmount: item.netAmount.toNumber(),
      discount: item.discount
        ? {
            ...item.discount,
            value: item.discount.value.toNumber(),
          }
        : null,
    }));

    return { success: true, data: formatted };
  } catch (err) {
    console.error("Error fetching student fee items:", err);
    return {
      success: false,
      error: "An unexpected error occurred while fetching fee items.",
    };
  }
}

/**
 * Fetches fee structures for the school, optionally filtered by classId and academicYear.
 * ADMIN / TEACHER access only.
 */
export async function getFeeStructures(params?: {
  classId?: string;
  academicYear?: string;
}): Promise<ActionResult<FormattedFeeStructure[]>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error: "Unauthorized: read access restricted to staff.",
      };
    }

    const structures = await prisma.feeStructure.findMany({
      where: {
        schoolId: ctx.schoolId,
        ...(params?.classId ? { classId: params.classId } : {}),
        ...(params?.academicYear ? { academicYear: params.academicYear } : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        items: {
          include: {
            feeCategory: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted: FormattedFeeStructure[] = structures.map((s) => ({
      ...s,
      items: s.items.map((i) => ({
        ...i,
        amount: i.amount.toNumber(),
      })),
    }));

    return { success: true, data: formatted };
  } catch (err) {
    console.error("Error fetching fee structures:", err);
    return {
      success: false,
      error: "An unexpected error occurred while fetching fee structures.",
    };
  }
}

/**
 * Fetches fee discounts for the school.
 * ADMIN / TEACHER access only.
 */
export async function getFeeDiscounts(): Promise<
  ActionResult<FormattedFeeDiscount[]>
> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error: "Unauthorized: read access restricted to staff.",
      };
    }

    const discounts = await prisma.feeDiscount.findMany({
      where: { schoolId: ctx.schoolId },
      orderBy: { code: "asc" },
    });

    const formatted: FormattedFeeDiscount[] = discounts.map((d) => ({
      ...d,
      value: d.value.toNumber(),
    }));

    return { success: true, data: formatted };
  } catch (err) {
    console.error("Error fetching fee discounts:", err);
    return {
      success: false,
      error: "An unexpected error occurred while fetching fee discounts.",
    };
  }
}
