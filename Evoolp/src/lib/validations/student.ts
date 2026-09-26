import { z } from "zod";

export const studentGenderEnum = z.enum(["MALE", "FEMALE", "OTHER"]);
export const studentCategoryEnum = z.enum(["GENERAL", "SC", "ST", "OBC"]);
export const studentStatusEnum = z.enum(["ACTIVE", "ALUMNI", "TRANSFERRED"]);

export const createStudentSchema = z.object({
  admissionNumber: z
    .string()
    .trim()
    .min(1, "Admission number is required")
    .max(50, "Admission number must be 50 characters or less"),
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(50, "First name must be 50 characters or less"),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(50, "Last name must be 50 characters or less"),
  dateOfBirth: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true;
      const d = new Date(val);
      if (isNaN(d.getTime())) return false;
      const year = d.getFullYear();
      return year >= 1900 && year <= 2100;
    }, "Date of birth must be a valid date between 1900 and 2100"),
  gender: studentGenderEnum.optional().nullable(),
  category: studentCategoryEnum,
  rteCandidate: z.boolean(),
  address: z
    .string()
    .trim()
    .max(255, "Address must be 255 characters or less")
    .optional()
    .nullable(),
  academicYear: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{4}$/,
      "Academic year must be formatted as YYYY-YYYY (e.g. '2025-2026')"
    ),
  classId: z.string().min(1, "Class selection is required"),
  sectionId: z.string().min(1, "Section selection is required"),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
