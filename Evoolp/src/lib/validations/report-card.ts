import { z } from "zod";

/**
 * Validates query to discover available exam cycles for a specific class and section.
 */
export const examCycleQuerySchema = z.object({
  classId: z.string().min(1, "Class is required."),
  sectionId: z.string().min(1, "Section is required."),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be formatted as YYYY-YYYY (e.g. '2025-2026')."),
});

export type ExamCycleQueryInput = z.infer<typeof examCycleQuerySchema>;

/**
 * Validates request to compile a single student's report card for an explicit cycle.
 * examIds guarantees that multi-exam ambiguity (e.g. PT1 vs PT2) is completely eliminated.
 */
export const reportCardQuerySchema = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be formatted as YYYY-YYYY (e.g. '2025-2026')."),
  examIds: z
    .array(z.string().min(1, "Invalid exam ID."))
    .min(1, "At least one examination must be selected for the report card cycle."),
  cycleName: z.string().trim().max(100).optional().nullable(),
});

export type ReportCardQueryInput = z.infer<typeof reportCardQuerySchema>;

/**
 * Validates request to list enrolled students in a section with their report-card readiness status.
 */
export const classReportCardRosterQuerySchema = z.object({
  classId: z.string().min(1, "Class is required."),
  sectionId: z.string().min(1, "Section is required."),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be formatted as YYYY-YYYY (e.g. '2025-2026')."),
  examIds: z
    .array(z.string().min(1, "Invalid exam ID."))
    .min(1, "At least one examination must be selected to determine roster readiness."),
});

export type ClassReportCardRosterQueryInput = z.infer<typeof classReportCardRosterQuerySchema>;

/**
 * Validates print audit event. Strictly records metadata only — zero marks or grades!
 */
export const reportCardPrintAuditSchema = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be formatted as YYYY-YYYY (e.g. '2025-2026')."),
  cycleName: z.string().trim().max(100).optional().nullable(),
  examCount: z.number().int().min(1, "Exam count must be at least 1."),
});

export type ReportCardPrintAuditInput = z.infer<typeof reportCardPrintAuditSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 Validation Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. Validates batch request to compile report cards for multiple students.
 */
export const batchReportCardQuerySchema = z.object({
  studentIds: z
    .array(z.string().min(1, "Invalid student ID."))
    .min(1, "At least one student must be selected for batch compilation."),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be formatted as YYYY-YYYY (e.g. '2025-2026')."),
  examIds: z
    .array(z.string().min(1, "Invalid exam ID."))
    .min(1, "At least one examination must be selected for the report card cycle."),
  cycleName: z.string().trim().max(100).optional().nullable(),
  cycleKey: z.string().trim().max(150).optional().nullable(),
});

export type BatchReportCardQueryInput = z.infer<typeof batchReportCardQuerySchema>;

/**
 * 2. Validates request to export cohort/class-section report cards as CSV.
 */
export const exportReportCardsCsvSchema = z.object({
  classId: z.string().min(1, "Class ID is required."),
  sectionId: z.string().min(1, "Section ID is required."),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be formatted as YYYY-YYYY (e.g. '2025-2026')."),
  examIds: z
    .array(z.string().min(1, "Invalid exam ID."))
    .min(1, "At least one examination must be selected for CSV export."),
  cycleName: z.string().trim().min(1, "Cycle name is required.").max(100),
  cycleKey: z.string().trim().max(150).optional().nullable(),
});

export type ExportReportCardsCsvInput = z.infer<typeof exportReportCardsCsvSchema>;

/**
 * 3. Validates saving persistent teacher appraisal remarks for a student.
 * cycleKey enforces the canonical format: examType::normalizedCycleName
 */
export const saveTeacherRemarkSchema = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be formatted as YYYY-YYYY (e.g. '2025-2026')."),
  cycleKey: z
    .string()
    .trim()
    .min(3, "cycleKey is required.")
    .max(150, "cycleKey cannot exceed 150 characters.")
    .regex(
      /^[A-Z0-9_]+::[a-z0-9_\-\s/.]+$/,
      "cycleKey must follow canonical format 'examType::normalizedCycleName' (e.g. 'PERIODIC_TEST::periodic test 1')."
    ),
  cycleName: z.string().trim().min(1, "Cycle name is required.").max(100),
  remarks: z
    .string()
    .trim()
    .min(1, "Remarks cannot be empty.")
    .max(1000, "Remarks cannot exceed 1000 characters."),
});

export type SaveTeacherRemarkInput = z.infer<typeof saveTeacherRemarkSchema>;

/**
 * 4. Co-Scholastic activities and grades.
 * Strictly constrained to CBSE approved activities and 3-point grade scale (A, B, C).
 */
export const coScholasticActivityEnum = z.enum([
  "WORK_EDUCATION",
  "ART_EDUCATION",
  "HEALTH_AND_PHYSICAL_EDUCATION",
  "DISCIPLINE",
]);

export type CoScholasticActivity = z.infer<typeof coScholasticActivityEnum>;

export const coScholasticGradeEnum = z.enum(["A", "B", "C"]);

export type CoScholasticGrade = z.infer<typeof coScholasticGradeEnum>;

export const coScholasticEntryItemSchema = z.object({
  activity: coScholasticActivityEnum,
  grade: coScholasticGradeEnum,
  remarks: z.string().trim().max(255, "Remarks cannot exceed 255 characters.").optional().nullable(),
});

export type CoScholasticEntryItem = z.infer<typeof coScholasticEntryItemSchema>;

export const saveCoScholasticSchema = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be formatted as YYYY-YYYY (e.g. '2025-2026')."),
  term: z.string().trim().min(1, "Term identifier is required.").max(50),
  entries: z
    .array(coScholasticEntryItemSchema)
    .min(1, "At least one co-scholastic activity entry is required.")
    .refine(
      (items) => {
        const activities = items.map((i) => i.activity);
        return new Set(activities).size === activities.length;
      },
      { message: "Duplicate co-scholastic activities are not permitted within the same term." }
    ),
});

export type SaveCoScholasticInput = z.infer<typeof saveCoScholasticSchema>;

/**
 * 5. Multi-Term Weighted Annual Compilation.
 * Validates dynamic evaluation cycles, positive weights summing to exactly 100%, and uniqueness.
 */
export const multiTermCycleDefinitionSchema = z.object({
  termName: z.string().trim().min(1, "Term name is required.").max(100),
  cycleKey: z
    .string()
    .trim()
    .regex(
      /^[A-Z0-9_]+::[a-z0-9_\-\s/.]+$/,
      "cycleKey must follow canonical format 'examType::normalizedCycleName'."
    ),
  examIds: z
    .array(z.string().min(1, "Invalid exam ID."))
    .min(1, "At least one exam must be included in each term."),
  weight: z
    .number()
    .positive("Weight must be greater than 0.")
    .max(100, "Weight cannot exceed 100%."),
});

export type MultiTermCycleDefinition = z.infer<typeof multiTermCycleDefinitionSchema>;

export const multiTermCompilationSchema = z
  .object({
    studentId: z.string().min(1, "Student ID is required."),
    academicYear: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{4}$/, "Academic year must be formatted as YYYY-YYYY (e.g. '2025-2026')."),
    terms: z
      .array(multiTermCycleDefinitionSchema)
      .min(2, "Multi-term weighted compilation requires at least 2 distinct evaluation terms."),
  })
  .refine(
    (data) => {
      const sum = data.terms.reduce((acc, t) => acc + t.weight, 0);
      return Math.abs(sum - 100) < 0.01;
    },
    {
      message: "Total multi-term weights must sum exactly to 100.0%.",
      path: ["terms"],
    }
  )
  .refine(
    (data) => {
      const cycleKeys = data.terms.map((t) => t.cycleKey);
      return new Set(cycleKeys).size === cycleKeys.length;
    },
    {
      message: "Duplicate evaluation cycles are not permitted in multi-term compilation.",
      path: ["terms"],
    }
  );

export type MultiTermCompilationInput = z.infer<typeof multiTermCompilationSchema>;
