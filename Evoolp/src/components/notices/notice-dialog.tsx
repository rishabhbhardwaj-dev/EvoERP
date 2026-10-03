"use client";

import { useState, useTransition } from "react";
import {
  createNotice,
  updateNotice,
  type NoticeRow,
} from "@/lib/actions/notices";
import type {
  NoticeAudienceType,
  NoticeStatusType,
} from "@/lib/validations/notice";
import { Loader2, Megaphone, Calendar, FileText, Tag, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface NoticeDialogProps {
  notice?: NoticeRow | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function NoticeDialog({
  notice,
  isOpen,
  onClose,
  onSuccess,
}: NoticeDialogProps) {
  const isEditing = !!notice;

  const [title, setTitle] = useState(notice?.title ?? "");
  const [content, setContent] = useState(notice?.content ?? "");
  const [audience, setAudience] = useState<NoticeAudienceType>(
    notice?.audience ?? "ALL"
  );
  const [status, setStatus] = useState<NoticeStatusType>(
    notice?.status ?? "PUBLISHED"
  );
  const [expiresAt, setExpiresAt] = useState(notice?.expiresAt ?? "");
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || title.trim().length < 3) {
      toast.error("Notice title must be at least 3 characters.");
      return;
    }

    if (!content.trim() || content.trim().length < 5) {
      toast.error("Notice content must be at least 5 characters.");
      return;
    }

    startTransition(async () => {
      let res;
      if (isEditing && notice) {
        res = await updateNotice({
          id: notice.id,
          title: title.trim(),
          content: content.trim(),
          audience,
          status,
          expiresAt: expiresAt || null,
        });
      } else {
        res = await createNotice({
          title: title.trim(),
          content: content.trim(),
          audience,
          status,
          expiresAt: expiresAt || null,
        });
      }

      if (res.success) {
        toast.success(
          isEditing
            ? "Notice announcement updated successfully."
            : "Notice announcement published successfully."
        );
        onSuccess();
        onClose();
      } else {
        toast.error(res.error ?? "Failed to save notice announcement.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Megaphone className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {isEditing ? "Edit Notice Announcement" : "Create Notice Announcement"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Broadcast school notices and circulars to target roles.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="notice-title" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="size-3.5 text-muted-foreground" /> Notice Title *
            </label>
            <input
              id="notice-title"
              type="text"
              required
              minLength={3}
              maxLength={120}
              placeholder="e.g. Annual Sports Day 2026 Schedule"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isPending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Audience & Status Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="notice-audience" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Tag className="size-3.5 text-muted-foreground" /> Target Audience *
              </label>
              <select
                id="notice-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value as NoticeAudienceType)}
                disabled={isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">ALL (Entire School)</option>
                <option value="STUDENTS">STUDENTS Only</option>
                <option value="PARENTS">PARENTS Only</option>
                <option value="TEACHERS">TEACHERS Only</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="notice-status" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-muted-foreground" /> Publication Status *
              </label>
              <select
                id="notice-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as NoticeStatusType)}
                disabled={isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                <option value="PUBLISHED">PUBLISHED (Active)</option>
                <option value="DRAFT">DRAFT (Hidden)</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          </div>

          {/* Expiration Date */}
          <div className="space-y-1.5">
            <label htmlFor="notice-expires" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="size-3.5 text-muted-foreground" /> Expiration Date (Optional)
            </label>
            <input
              id="notice-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              disabled={isPending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground">
              Leave blank for permanent notices. Expired notices are hidden from student/parent views.
            </p>
          </div>

          {/* Notice Content Body */}
          <div className="space-y-1.5">
            <label htmlFor="notice-content" className="text-xs font-semibold text-foreground">
              Notice Body / Announcement Content *
            </label>
            <textarea
              id="notice-content"
              required
              rows={5}
              minLength={5}
              maxLength={5000}
              placeholder="Write the full announcement text here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isPending}
              className="w-full rounded-md border border-input bg-background p-3 text-xs shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Form Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-md border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-2xs"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              {isEditing ? "Update Notice" : "Publish Notice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
