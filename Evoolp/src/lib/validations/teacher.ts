import { z } from "zod";

export const teacherStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);

export const createTeacherSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Teacher full name is required")
    .max(100, "Name must be 100 characters or less"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email address is required")
    .email("Please enter a valid email address")
    .max(100, "Email must be 100 characters or less"),
  employeeCode: z
    .string()
    .trim()
    .min(1, "Employee code is required")
    .max(30, "Employee code must be 30 characters or less"),
  department: z
    .string()
    .trim()
    .max(50, "Department must be 50 characters or less")
    .optional()
    .nullable(),
  qualification: z
    .string()
    .trim()
    .max(100, "Qualification must be 100 characters or less")
    .optional()
    .nullable(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(100, "Password must be 100 characters or less"),
});

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;

export const updateTeacherSchema = z.object({
  id: z.string().min(1, "Teacher ID is required"),
  name: z
    .string()
    .trim()
    .min(1, "Teacher full name is required")
    .max(100, "Name must be 100 characters or less"),
  department: z
    .string()
    .trim()
    .max(50, "Department must be 50 characters or less")
    .optional()
    .nullable(),
  qualification: z
    .string()
    .trim()
    .max(100, "Qualification must be 100 characters or less")
    .optional()
    .nullable(),
});

export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;

export const toggleTeacherStatusSchema = z.object({
  teacherId: z.string().min(1, "Teacher ID is required"),
  status: teacherStatusEnum,
  reason: z
    .string()
    .trim()
    .max(255, "Reason must be 255 characters or less")
    .optional()
    .nullable(),
});

export type ToggleTeacherStatusInput = z.infer<typeof toggleTeacherStatusSchema>;

