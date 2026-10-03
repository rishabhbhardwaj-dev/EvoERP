import { z } from "zod";

export const noticeAudienceEnum = z.enum([
  "ALL",
  "STUDENTS",
  "PARENTS",
  "TEACHERS",
]);

export type NoticeAudienceType = z.infer<typeof noticeAudienceEnum>;

export const noticeStatusEnum = z.enum([
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

export type NoticeStatusType = z.infer<typeof noticeStatusEnum>;

export const createNoticeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters.")
    .max(120, "Title must not exceed 120 characters."),
  content: z
    .string()
    .trim()
    .min(5, "Notice content must be at least 5 characters.")
    .max(5000, "Content must not exceed 5000 characters."),
  audience: noticeAudienceEnum.default("ALL"),
  status: noticeStatusEnum.default("PUBLISHED"),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid expiration date format (expected YYYY-MM-DD).")
    .optional()
    .nullable(),
});

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;

export const updateNoticeSchema = createNoticeSchema.partial().extend({
  id: z.string().min(1, "Notice ID is required."),
});

export type UpdateNoticeInput = z.infer<typeof updateNoticeSchema>;

export const noticeQuerySchema = z.object({
  status: noticeStatusEnum.optional(),
  audience: noticeAudienceEnum.optional(),
  search: z.string().optional(),
});

export type NoticeQueryInput = z.infer<typeof noticeQuerySchema>;
