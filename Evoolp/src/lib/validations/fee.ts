import { z } from "zod";

export const feeCategoryStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);
export const feeStructureStatusEnum = z.enum(["ACTIVE", "ARCHIVED"]);
export const feeFrequencyEnum = z.enum([
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
  "ONE_TIME",
]);
export const discountTypeEnum = z.enum(["PERCENTAGE", "FIXED_AMOUNT"]);
export const feeAllocationStatusEnum = z.enum([
  "ASSIGNED",
  "WAIVED",
  "CANCELLED",
]);

// ── Fee Category Schemas ──────────────────────────────────────────────

export const createFeeCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .max(100, "Category name must be 100 characters or less"),
  code: z
    .string()
    .trim()
    .min(1, "Category code is required")
    .max(50, "Category code must be 50 characters or less")
    .transform((val) => val.toUpperCase()),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .nullable(),
  status: feeCategoryStatusEnum.optional().default("ACTIVE"),
});

export type CreateFeeCategoryInput = z.infer<typeof createFeeCategorySchema>;

export const updateFeeCategorySchema = z.object({
  id: z.string().min(1, "Fee category ID is required"),
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .max(100, "Category name must be 100 characters or less"),
  code: z
    .string()
    .trim()
    .min(1, "Category code is required")
    .max(50, "Category code must be 50 characters or less")
    .transform((val) => val.toUpperCase()),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .nullable(),
  status: feeCategoryStatusEnum.optional().default("ACTIVE"),
});

export type UpdateFeeCategoryInput = z.infer<typeof updateFeeCategorySchema>;

// ── Fee Structure Schemas ─────────────────────────────────────────────

export const feeStructureItemInputSchema = z
  .object({
    feeCategoryId: z.string().min(1, "Fee category is required"),
    amount: z
      .union([z.number(), z.string()])
      .refine((val) => {
        const num = typeof val === "number" ? val : parseFloat(val);
        return !isNaN(num) && num > 0;
      }, "Amount must be a positive number greater than 0")
      .transform((val) => (typeof val === "number" ? val : parseFloat(val))),
    frequency: feeFrequencyEnum,
    dueMonth: z
      .number()
      .int("Due month must be an integer between 1 and 12")
      .min(1, "Due month must be between 1 and 12")
      .max(12, "Due month must be between 1 and 12")
      .optional()
      .nullable(),
  })
  .refine(
    (item) => {
      if (item.dueMonth !== undefined && item.dueMonth !== null) {
        return item.dueMonth >= 1 && item.dueMonth <= 12;
      }
      return true;
    },
    { message: "Due month must be between 1 and 12", path: ["dueMonth"] }
  );

export type FeeStructureItemInput = z.infer<typeof feeStructureItemInputSchema>;

export const createFeeStructureSchema = z
  .object({
    classId: z.string().min(1, "Class selection is required"),
    sectionId: z.string().trim().optional().nullable(),
    academicYear: z
      .string()
      .trim()
      .regex(
        /^\d{4}-\d{4}$/,
        "Academic year must be formatted as YYYY-YYYY (e.g. '2025-2026')"
      ),
    name: z
      .string()
      .trim()
      .min(1, "Fee structure name is required")
      .max(100, "Fee structure name must be 100 characters or less"),
    notes: z
      .string()
      .trim()
      .max(500, "Notes must be 500 characters or less")
      .optional()
      .nullable(),
    items: z
      .array(feeStructureItemInputSchema)
      .min(1, "At least one fee line item is required"),
  })
  .refine(
    (val) => {
      const categoryIds = val.items.map((i) => i.feeCategoryId);
      const uniqueCategoryIds = new Set(categoryIds);
      return categoryIds.length === uniqueCategoryIds.size;
    },
    {
      message:
        "Duplicate fee categories are not allowed within the same fee structure",
      path: ["items"],
    }
  );

export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>;

export const updateFeeStructureSchema = z
  .object({
    id: z.string().min(1, "Fee structure ID is required"),
    name: z
      .string()
      .trim()
      .min(1, "Fee structure name is required")
      .max(100, "Fee structure name must be 100 characters or less"),
    notes: z
      .string()
      .trim()
      .max(500, "Notes must be 500 characters or less")
      .optional()
      .nullable(),
    items: z
      .array(feeStructureItemInputSchema)
      .min(1, "At least one fee line item is required"),
  })
  .refine(
    (val) => {
      const categoryIds = val.items.map((i) => i.feeCategoryId);
      const uniqueCategoryIds = new Set(categoryIds);
      return categoryIds.length === uniqueCategoryIds.size;
    },
    {
      message:
        "Duplicate fee categories are not allowed within the same fee structure",
      path: ["items"],
    }
  );

export type UpdateFeeStructureInput = z.infer<typeof updateFeeStructureSchema>;

// ── Fee Discount Schemas ──────────────────────────────────────────────

export const createFeeDiscountSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Discount name is required")
      .max(100, "Discount name must be 100 characters or less"),
    code: z
      .string()
      .trim()
      .min(1, "Discount code is required")
      .max(50, "Discount code must be 50 characters or less")
      .transform((val) => val.toUpperCase()),
    type: discountTypeEnum,
    value: z
      .union([z.number(), z.string()])
      .refine((val) => {
        const num = typeof val === "number" ? val : parseFloat(val);
        return !isNaN(num) && num >= 0;
      }, "Discount value must be a non-negative number")
      .transform((val) => (typeof val === "number" ? val : parseFloat(val))),
    isRteDefault: z.boolean().optional().default(false),
    status: feeCategoryStatusEnum.optional().default("ACTIVE"),
  })
  .refine(
    (data) => {
      if (data.type === "PERCENTAGE") {
        return data.value >= 0 && data.value <= 100;
      }
      return data.value >= 0;
    },
    {
      message: "Percentage discount must be between 0 and 100",
      path: ["value"],
    }
  );

export type CreateFeeDiscountInput = z.infer<typeof createFeeDiscountSchema>;

// ── Allocation Schema ──────────────────────────────────────────────────

export const allocateFeesSchema = z.object({
  classId: z.string().min(1, "Class selection is required"),
  sectionId: z.string().trim().optional().nullable(),
  academicYear: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{4}$/,
      "Academic year must be formatted as YYYY-YYYY (e.g. '2025-2026')"
    ),
  feeStructureId: z.string().min(1, "Fee structure selection is required"),
  discountId: z.string().trim().optional().nullable(),
});

export type AllocateFeesInput = z.infer<typeof allocateFeesSchema>;

// ── Read Query Schemas ────────────────────────────────────────────────

export const getStudentFeeItemsQuerySchema = z.object({
  classId: z.string().min(1, "Class ID is required"),
  sectionId: z.string().trim().optional().nullable(),
  academicYear: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{4}$/,
      "Academic year must be formatted as YYYY-YYYY (e.g. '2025-2026')"
    ),
});

export type GetStudentFeeItemsQueryInput = z.infer<
  typeof getStudentFeeItemsQuerySchema
>;
