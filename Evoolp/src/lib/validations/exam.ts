import { z } from "zod";

// ─────────────────────────── Enum mirrors ───────────────────────────

export const examTypeEnum = z.enum([
  "PERIODIC_TEST",
  "HALF_YEARLY",
  "ANNUAL",
  "PRACTICE",
]);

export type ExamTypeValue = z.infer<typeof examTypeEnum>;

export const gradeLabelEnum = z.enum([
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
  "D",
  "E",
]);

export type GradeLabelValue = z.infer<typeof gradeLabelEnum>;

// ─────────────────────────── Create Exam ────────────────────────────

/**
 * Schema for creating a new Exam.
 * ADMIN only. passingMarks must be > 0 and <= maxMarks.
 */
export const createExamSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Exam name is required.")
      .max(100, "Exam name must be 100 characters or less."),
    examType: examTypeEnum,
    classId: z.string().min(1, "Class is required."),
    sectionId: z.string().min(1, "Section is required."),
    subjectId: z.string().min(1, "Subject is required."),
    academicYear: z
      .string()
      .trim()
      .regex(
        /^\d{4}-\d{4}$/,
        "Academic year must be formatted as YYYY-YYYY (e.g. '2025-2026')."
      ),
    maxMarks: z
      .number()
      .positive("Max marks must be greater than 0.")
      .max(9999.99, "Max marks cannot exceed 9999.99."),
    passingMarks: z
      .number()
      .positive("Passing marks must be greater than 0."),
    examDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD.")
      .optional()
      .nullable(),
    notes: z
      .string()
      .max(500, "Notes must be 500 characters or less.")
      .optional()
      .nullable(),
  })
  .refine((data) => data.passingMarks <= data.maxMarks, {
    message: "Passing marks cannot exceed max marks.",
    path: ["passingMarks"],
  });

export type CreateExamInput = z.infer<typeof createExamSchema>;

// ─────────────────────────── Update Exam ────────────────────────────

/**
 * Schema for updating a mutable subset of Exam fields.
 * maxMarks, passingMarks, examType are immutable after creation.
 */
export const updateExamSchema = z.object({
  id: z.string().min(1, "Exam ID is required."),
  name: z
    .string()
    .trim()
    .min(1, "Exam name is required.")
    .max(100, "Exam name must be 100 characters or less."),
  examDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD.")
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(500, "Notes must be 500 characters or less.")
    .optional()
    .nullable(),
});

export type UpdateExamInput = z.infer<typeof updateExamSchema>;

// ─────────────────────── Save Exam Results ──────────────────────────

/**
 * Individual student result row.
 * marksObtained >= 0; upper bound enforced in server action (needs exam.maxMarks).
 */
export const examResultItemSchema = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  marksObtained: z
    .number()
    .min(0, "Marks obtained cannot be negative."),
  remarks: z
    .string()
    .max(200, "Remarks must be 200 characters or less.")
    .optional()
    .nullable(),
});

export type ExamResultItem = z.infer<typeof examResultItemSchema>;

/**
 * Payload for saving (creating or updating) all results for an exam.
 */
export const saveExamResultsSchema = z.object({
  examId: z.string().min(1, "Exam ID is required."),
  results: z
    .array(examResultItemSchema)
    .min(1, "At least one result must be provided."),
});

export type SaveExamResultsInput = z.infer<typeof saveExamResultsSchema>;

// ─────────────────────── Query Schemas ──────────────────────────────

/**
 * Query schema for fetching exams for a class/section.
 */
export const getExamsQuerySchema = z.object({
  classId: z.string().min(1, "Class is required."),
  sectionId: z.string().min(1, "Section is required."),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Invalid academic year format (e.g. 2025-2026).")
    .optional(),
});

export type GetExamsQueryInput = z.infer<typeof getExamsQuerySchema>;

/**
 * Query schema for fetching a single exam's detail and results.
 */
export const getExamDetailQuerySchema = z.object({
  examId: z.string().min(1, "Exam ID is required."),
});

export type GetExamDetailQueryInput = z.infer<typeof getExamDetailQuerySchema>;

// ─────────────────────── Stage 2 Query Schemas ───────────────────────

/**
 * Query schema for student/parent grade scorecard.
 * For parents with multiple children, studentId selects the child.
 */
export const myGradesQuerySchema = z.object({
  studentId: z.string().optional(),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Invalid academic year format (e.g. 2025-2026).")
    .optional(),
  examType: examTypeEnum.optional(),
});

export type MyGradesQueryInput = z.infer<typeof myGradesQuerySchema>;

/**
 * Query schema for fetching student academic performance summary in StudentDetailSheet.
 */
export const studentAcademicSummaryQuerySchema = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Invalid academic year format (e.g. 2025-2026).")
    .optional(),
});

export type StudentAcademicSummaryQueryInput = z.infer<
  typeof studentAcademicSummaryQuerySchema
>;

/**
 * Query schema for exporting exam results to CSV.
 */
export const exportExamResultsQuerySchema = z.object({
  examId: z.string().min(1, "Exam ID is required."),
});

export type ExportExamResultsQueryInput = z.infer<
  typeof exportExamResultsQuerySchema
>;
