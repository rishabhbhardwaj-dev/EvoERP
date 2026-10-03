import { z } from "zod";

/**
 * Report types available in the system.
 */
export const reportTypeEnum = z.enum(["enrollment", "attendance", "academic"]);
export type ReportType = z.infer<typeof reportTypeEnum>;

/**
 * Zod validation schema for report query filters.
 */
export const reportQuerySchema = z.object({
  reportType: reportTypeEnum.default("enrollment"),
  academicYear: z.string().trim().optional(),
  classId: z.string().trim().optional(),
  sectionId: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
