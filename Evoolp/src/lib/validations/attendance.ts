import { z } from "zod";

/**
 * Valid attendance statuses aligning with CBSE and Indian school standards.
 */
export const attendanceStatusEnum = z.enum([
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
  "HALF_DAY",
]);

export type AttendanceStatusType = z.infer<typeof attendanceStatusEnum>;

/**
 * Individual student attendance entry within a roll call register.
 */
export const attendanceRecordItemSchema = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  status: attendanceStatusEnum.default("PRESENT"),
  remarks: z
    .string()
    .max(200, "Remarks must be 200 characters or less.")
    .optional()
    .nullable(),
});

export type AttendanceRecordItem = z.infer<typeof attendanceRecordItemSchema>;

/**
 * Payload for saving or updating an entire daily attendance register session.
 */
export const saveAttendanceRegisterSchema = z.object({
  classId: z.string().min(1, "Class is required."),
  sectionId: z.string().min(1, "Section is required."),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD."),
  academicYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "Invalid academic year format (e.g. 2025-2026)."),
  notes: z
    .string()
    .max(500, "Notes must be 500 characters or less.")
    .optional()
    .nullable(),
  records: z
    .array(attendanceRecordItemSchema)
    .min(1, "At least one student record must be provided."),
});

export type SaveAttendanceRegisterInput = z.infer<
  typeof saveAttendanceRegisterSchema
>;

/**
 * Query schema for fetching an attendance register.
 */
export const getRegisterQuerySchema = z.object({
  classId: z.string().min(1, "Class is required."),
  sectionId: z.string().min(1, "Section is required."),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD."),
});

export type GetRegisterQueryInput = z.infer<typeof getRegisterQuerySchema>;

/**
 * Query schema for fetching monthly attendance matrix and analytics.
 */
export const monthlyAttendanceQuerySchema = z.object({
  classId: z.string().min(1, "Class is required."),
  sectionId: z.string().min(1, "Section is required."),
  academicYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "Invalid academic year format (e.g. 2025-2026).")
    .optional(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export type MonthlyAttendanceQueryInput = z.infer<
  typeof monthlyAttendanceQuerySchema
>;

/**
 * Query schema for fetching a single student's attendance summary.
 */
export const studentAttendanceSummaryQuerySchema = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  academicYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "Invalid academic year format (e.g. 2025-2026).")
    .optional(),
});

export type StudentAttendanceSummaryQueryInput = z.infer<
  typeof studentAttendanceSummaryQuerySchema
>;

/**
 * Query schema for student/parent "My Attendance" portal.
 */
export const myAttendanceQuerySchema = z.object({
  studentId: z.string().optional(),
  academicYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "Invalid academic year format (e.g. 2025-2026).")
    .optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export type MyAttendanceQueryInput = z.infer<typeof myAttendanceQuerySchema>;
