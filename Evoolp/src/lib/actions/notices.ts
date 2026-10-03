"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requireTenant } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import {
  createNoticeSchema,
  updateNoticeSchema,
  noticeQuerySchema,
  type CreateNoticeInput,
  type UpdateNoticeInput,
  type NoticeQueryInput,
  type NoticeAudienceType,
  type NoticeStatusType,
} from "@/lib/validations/notice";
import type { ActionResult } from "./classes";

export interface NoticeRow {
  id: string;
  title: string;
  content: string;
  audience: NoticeAudienceType;
  status: NoticeStatusType;
  publishedAt: string; // YYYY-MM-DD
  expiresAt: string | null; // YYYY-MM-DD
  createdByName: string;
  createdAt: string;
  isNew: boolean; // True if published <= 48 hours ago
}

export interface NoticeWorkspaceData {
  notices: NoticeRow[];
  totalCount: number;
  publishedCount: number;
  draftCount: number;
  archivedCount: number;
  canMutate: boolean;
}

function parseDateToUtc(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatUtcDateString(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Creates a new notice announcement (ADMIN only).
 */
export async function createNotice(
  input: CreateNoticeInput
): Promise<ActionResult<NoticeRow>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: Only administrators can create notice announcements.",
      };
    }

    const parsed = createNoticeSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid notice payload.";
      return { success: false, error: firstError };
    }

    const { title, content, audience, status, expiresAt } = parsed.data;

    const expiresAtDate = expiresAt ? parseDateToUtc(expiresAt) : null;

    const notice = await prisma.notice.create({
      data: {
        schoolId: ctx.schoolId,
        title,
        content,
        audience,
        status,
        expiresAt: expiresAtDate,
        createdById: ctx.userId,
      },
      include: {
        createdBy: { select: { name: true } },
      },
    });

    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "NOTICE_CREATED",
      entityType: "Notice",
      entityId: notice.id,
      newValues: { title, audience, status, expiresAt },
    });

    revalidatePath("/dashboard/notices");

    const now = new Date();
    const diffHours = (now.getTime() - notice.publishedAt.getTime()) / (1000 * 60 * 60);

    return {
      success: true,
      data: {
        id: notice.id,
        title: notice.title,
        content: notice.content,
        audience: notice.audience,
        status: notice.status,
        publishedAt: formatUtcDateString(notice.publishedAt),
        expiresAt: notice.expiresAt ? formatUtcDateString(notice.expiresAt) : null,
        createdByName: notice.createdBy.name,
        createdAt: formatUtcDateString(notice.createdAt),
        isNew: diffHours <= 48,
      },
    };
  } catch (err) {
    console.error("Error creating notice:", err);
    return {
      success: false,
      error: "An unexpected error occurred while creating the notice announcement.",
    };
  }
}

/**
 * Updates an existing notice announcement (ADMIN only).
 */
export async function updateNotice(
  input: UpdateNoticeInput
): Promise<ActionResult<NoticeRow>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: Only administrators can update notice announcements.",
      };
    }

    const parsed = updateNoticeSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid update payload.";
      return { success: false, error: firstError };
    }

    const { id, title, content, audience, status, expiresAt } = parsed.data;

    const existing = await prisma.notice.findFirst({
      where: { id, schoolId: ctx.schoolId },
    });

    if (!existing) {
      return { success: false, error: "Notice announcement not found in your school." };
    }

    const expiresAtDate =
      expiresAt !== undefined
        ? expiresAt
          ? parseDateToUtc(expiresAt)
          : null
        : existing.expiresAt;

    const updated = await prisma.notice.update({
      where: { id: existing.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(audience !== undefined ? { audience } : {}),
        ...(status !== undefined ? { status } : {}),
        expiresAt: expiresAtDate,
      },
      include: {
        createdBy: { select: { name: true } },
      },
    });

    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "NOTICE_UPDATED",
      entityType: "Notice",
      entityId: updated.id,
      oldValues: {
        title: existing.title,
        audience: existing.audience,
        status: existing.status,
      },
      newValues: {
        title: updated.title,
        audience: updated.audience,
        status: updated.status,
      },
    });

    revalidatePath("/dashboard/notices");

    const now = new Date();
    const diffHours = (now.getTime() - updated.publishedAt.getTime()) / (1000 * 60 * 60);

    return {
      success: true,
      data: {
        id: updated.id,
        title: updated.title,
        content: updated.content,
        audience: updated.audience,
        status: updated.status,
        publishedAt: formatUtcDateString(updated.publishedAt),
        expiresAt: updated.expiresAt ? formatUtcDateString(updated.expiresAt) : null,
        createdByName: updated.createdBy.name,
        createdAt: formatUtcDateString(updated.createdAt),
        isNew: diffHours <= 48,
      },
    };
  } catch (err) {
    console.error("Error updating notice:", err);
    return {
      success: false,
      error: "An unexpected error occurred while updating the notice announcement.",
    };
  }
}

/**
 * Deletes a notice announcement (ADMIN only).
 */
export async function deleteNotice(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: Only administrators can delete notice announcements.",
      };
    }

    const existing = await prisma.notice.findFirst({
      where: { id, schoolId: ctx.schoolId },
    });

    if (!existing) {
      return { success: false, error: "Notice announcement not found." };
    }

    await prisma.notice.delete({
      where: { id: existing.id },
    });

    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "NOTICE_DELETED",
      entityType: "Notice",
      entityId: existing.id,
      oldValues: { title: existing.title, audience: existing.audience },
    });

    revalidatePath("/dashboard/notices");

    return {
      success: true,
      data: { id: existing.id },
    };
  } catch (err) {
    console.error("Error deleting notice:", err);
    return {
      success: false,
      error: "An unexpected error occurred while deleting the notice announcement.",
    };
  }
}

/**
 * Retrieves notice announcements for the workspace.
 * ADMINs get all notices for management.
 * TEACHER, STUDENT, and PARENT roles get published, non-expired notices matching their audience.
 */
export async function getNotices(
  input?: NoticeQueryInput
): Promise<ActionResult<NoticeWorkspaceData>> {
  try {
    const ctx = await requireTenant();

    const parsed = noticeQuerySchema.safeParse(input ?? {});
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid query parameters.";
      return { success: false, error: firstError };
    }

    const { status, audience, search } = parsed.data;
    const now = new Date();

    const isStaffAdmin = ctx.role === "ADMIN";

    let whereClause: Prisma.NoticeWhereInput = {
      schoolId: ctx.schoolId,
    };

    if (isStaffAdmin) {
      if (status) whereClause.status = status;
      if (audience) whereClause.audience = audience;
    } else {
      // Non-admin roles: strictly PUBLISHED, publishedAt <= now, expiresAt >= today (or null)
      const allowedAudiences: NoticeAudienceType[] = ["ALL"];
      if (ctx.role === "TEACHER") allowedAudiences.push("TEACHERS");
      if (ctx.role === "STUDENT") allowedAudiences.push("STUDENTS");
      if (ctx.role === "PARENT") allowedAudiences.push("PARENTS");

      const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      whereClause = {
        schoolId: ctx.schoolId,
        status: "PUBLISHED",
        publishedAt: { lte: now },
        audience: { in: allowedAudiences },
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: todayStart } },
        ],
      };
    }

    if (search && search.trim().length > 0) {
      whereClause.AND = [
        {
          OR: [
            { title: { contains: search.trim(), mode: "insensitive" } },
            { content: { contains: search.trim(), mode: "insensitive" } },
          ],
        },
      ];
    }

    const notices = await prisma.notice.findMany({
      where: whereClause,
      include: {
        createdBy: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" },
    });

    // Compute stats for admin workspace
    const allSchoolNotices = isStaffAdmin
      ? await prisma.notice.findMany({
          where: { schoolId: ctx.schoolId },
          select: { status: true },
        })
      : [];

    const totalCount = isStaffAdmin ? allSchoolNotices.length : notices.length;
    const publishedCount = isStaffAdmin
      ? allSchoolNotices.filter((n) => n.status === "PUBLISHED").length
      : notices.length;
    const draftCount = isStaffAdmin
      ? allSchoolNotices.filter((n) => n.status === "DRAFT").length
      : 0;
    const archivedCount = isStaffAdmin
      ? allSchoolNotices.filter((n) => n.status === "ARCHIVED").length
      : 0;

    const formattedRows: NoticeRow[] = notices.map((n) => {
      const diffHours = (now.getTime() - n.publishedAt.getTime()) / (1000 * 60 * 60);
      return {
        id: n.id,
        title: n.title,
        content: n.content,
        audience: n.audience as NoticeAudienceType,
        status: n.status as NoticeStatusType,
        publishedAt: formatUtcDateString(n.publishedAt),
        expiresAt: n.expiresAt ? formatUtcDateString(n.expiresAt) : null,
        createdByName: n.createdBy.name,
        createdAt: formatUtcDateString(n.createdAt),
        isNew: diffHours <= 48,
      };
    });

    return {
      success: true,
      data: {
        notices: formattedRows,
        totalCount,
        publishedCount,
        draftCount,
        archivedCount,
        canMutate: isStaffAdmin,
      },
    };
  } catch (err) {
    console.error("Error fetching notices:", err);
    return {
      success: false,
      error: "An unexpected error occurred while loading notice announcements.",
    };
  }
}
