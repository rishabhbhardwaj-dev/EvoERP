import { z } from "zod";

export const createSubjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Subject name is required")
    .max(100, "Subject name must be 100 characters or less"),
  code: z
    .string()
    .trim()
    .min(1, "Subject code is required")
    .max(20, "Subject code must be 20 characters or less")
    .regex(
      /^[A-Za-z0-9\-_/.]{1,20}$/,
      "Subject code may only contain letters, numbers, hyphens, underscores, slashes, or periods (e.g. '041', 'MATH6', 'ENG-101', 'PHY/LAB')"
    ),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
