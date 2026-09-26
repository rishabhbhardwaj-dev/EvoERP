import { z } from "zod";

export const createClassSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Class name is required (e.g. 'Class 6' or 'Grade 10')")
    .max(50, "Class name must be 50 characters or less"),
  academicYear: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{4}$/,
      "Academic year must be formatted as YYYY-YYYY (e.g. '2025-2026')"
    ),
  initialSections: z.string().trim().optional(),
});

export const createSectionSchema = z.object({
  classId: z.string().min(1, "Class selection is required"),
  name: z
    .string()
    .trim()
    .min(1, "Section name is required (e.g. 'A', 'B', 'Rose')")
    .max(20, "Section name must be 20 characters or less"),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type CreateSectionInput = z.infer<typeof createSectionSchema>;
