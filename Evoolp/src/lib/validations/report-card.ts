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
