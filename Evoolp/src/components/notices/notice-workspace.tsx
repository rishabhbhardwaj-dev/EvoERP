"use client";

import { useState, useTransition } from "react";
import {
  getNotices,
  deleteNotice,
  updateNotice,
  type NoticeRow,
  type NoticeWorkspaceData,
} from "@/lib/actions/notices";
import type { NoticeAudienceType, NoticeStatusType } from "@/lib/validations/notice";
import { NoticeDialog } from "./notice-dialog";
import {
  Plus,
  Search,
  Calendar,
  Sparkles,
  Edit2,
  Trash2,
  Eye,
  Loader2,
  Clock,
  AlertCircle,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

const AUDIENCE_BADGES: Record<NoticeAudienceType, { label: string; badge: string }> = {
  ALL: {
    label: "ALL SCHOOL",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
  STUDENTS: {
    label: "STUDENTS",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  PARENTS: {
    label: "PARENTS",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  },
  TEACHERS: {
    label: "TEACHERS",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
};

const STATUS_BADGES: Record<NoticeStatusType, { label: string; badge: string }> = {
  PUBLISHED: {
    label: "Published",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  DRAFT: {
    label: "Draft",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  ARCHIVED: {
    label: "Archived",
    badge: "bg-muted text-muted-foreground border-muted-foreground/20",
  },
};

interface NoticeWorkspaceProps {
  initialData: NoticeWorkspaceData;
  userRole: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
}

export function NoticeWorkspace({ initialData, userRole }: NoticeWorkspaceProps) {
  const [data, setData] = useState<NoticeWorkspaceData>(initialData);
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>("ALL");
  const [selectedAudienceFilter, setSelectedAudienceFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [dialogNotice, setDialogNotice] = useState<NoticeRow | null | undefined>(undefined);
  const [readNoticeModal, setReadNoticeModal] = useState<NoticeRow | null>(null);

  const [isPending, startTransition] = useTransition();

  const isAdmin = userRole === "ADMIN";

  function refreshData(overrides?: { status?: string; audience?: string; search?: string }) {
    const statusVal = overrides?.status ?? selectedStatusTab;
    const audienceVal = overrides?.audience ?? selectedAudienceFilter;
    const searchVal = overrides?.search ?? searchQuery;

    startTransition(async () => {
      const res = await getNotices({
        status: statusVal !== "ALL" ? (statusVal as NoticeStatusType) : undefined,
        audience: audienceVal !== "ALL" ? (audienceVal as NoticeAudienceType) : undefined,
        search: searchVal ? searchVal : undefined,
      });

      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error ?? "Failed to refresh notice announcements.");
      }
    });
  }

  function handleDeleteNotice(id: string, title: string) {
    if (!window.confirm(`Are you sure you want to delete notice "${title}"?`)) return;

    startTransition(async () => {
      const res = await deleteNotice(id);
      if (res.success) {
        toast.success("Notice announcement deleted successfully.");
        refreshData();
      } else {
        toast.error(res.error ?? "Failed to delete notice announcement.");
      }
    });
  }

  function handleToggleStatus(notice: NoticeRow) {
    const nextStatus: NoticeStatusType =
      notice.status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED";

    startTransition(async () => {
      const res = await updateNotice({
        id: notice.id,
        status: nextStatus,
      });

      if (res.success) {
        toast.success(`Notice status updated to ${nextStatus}.`);
        refreshData();
      } else {
        toast.error(res.error ?? "Failed to update notice status.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search notices by title or content..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              refreshData({ search: e.target.value });
            }}
            aria-label="Search notices by title or content"
            className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-xs shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Action Button for Admin */}
        {isAdmin && (
          <button
            onClick={() => setDialogNotice(null)}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-2xs"
          >
            <Plus className="size-4" /> Create Notice Announcement
          </button>
        )}
      </div>

      {/* Admin Stats & Tab Bar */}
      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium">Total Notices</span>
            <div className="mt-1 text-2xl font-bold text-foreground">{data.totalCount}</div>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Published Active</span>
            <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.publishedCount}</div>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Drafts</span>
            <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{data.draftCount}</div>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium">Archived</span>
            <div className="mt-1 text-2xl font-bold text-muted-foreground">{data.archivedCount}</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Filter Audience:</span>
          <div className="flex flex-wrap items-center gap-1">
            {["ALL", "STUDENTS", "PARENTS", "TEACHERS"].map((aud) => (
              <button
                key={aud}
                onClick={() => {
                  setSelectedAudienceFilter(aud);
                  refreshData({ audience: aud });
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedAudienceFilter === aud
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {aud}
              </button>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground mr-1">Status:</span>
            {["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setSelectedStatusTab(st);
                  refreshData({ status: st });
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedStatusTab === st
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading Indicator */}
      {isPending && (
        <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span className="text-xs">Updating notices...</span>
        </div>
      )}

      {/* Notice List Container */}
      {data.notices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-16 text-center px-4">
          <AlertCircle className="size-10 text-muted-foreground/50 mb-3" />
          <p className="font-semibold text-foreground text-sm">No notice announcements found</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {isAdmin
              ? "No notices match the selected status/audience filters. Click 'Create Notice Announcement' to publish a new circular."
              : "There are currently no active notice announcements for your role."}
          </p>
        </div>
      ) : isAdmin ? (
        /* ADMIN TABLE VIEW */
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b">
                <tr>
                  <th className="px-6 py-3">Notice Title</th>
                  <th className="px-6 py-3">Audience</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Published Date</th>
                  <th className="px-6 py-3">Expiry Date</th>
                  <th className="px-6 py-3">Author</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.notices.map((n) => {
                  const audCfg = AUDIENCE_BADGES[n.audience] ?? AUDIENCE_BADGES.ALL;
                  const stCfg = STATUS_BADGES[n.status] ?? STATUS_BADGES.PUBLISHED;
                  return (
                    <tr key={n.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{n.title}</span>
                          {n.isNew && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <Sparkles className="size-3" /> NEW
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${audCfg.badge}`}>
                          {audCfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${stCfg.badge}`}>
                          {stCfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground font-mono">{n.publishedAt}</td>
                      <td className="px-6 py-3.5 text-muted-foreground font-mono">
                        {n.expiresAt ? n.expiresAt : "Permanent"}
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground">{n.createdByName}</td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setReadNoticeModal(n)}
                            title="Read Notice"
                            className="rounded-md border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <Eye className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setDialogNotice(n)}
                            title="Edit Notice"
                            className="rounded-md border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(n)}
                            title={n.status === "PUBLISHED" ? "Archive Notice" : "Publish Notice"}
                            className="rounded-md border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <Clock className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteNotice(n.id, n.title)}
                            title="Delete Notice"
                            className="rounded-md border p-1.5 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* PORTAL CARD GRID VIEW (Student / Parent / Teacher) */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.notices.map((n) => {
            const audCfg = AUDIENCE_BADGES[n.audience] ?? AUDIENCE_BADGES.ALL;
            return (
              <div
                key={n.id}
                className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-semibold ${audCfg.badge}`}>
                      {audCfg.label}
                    </span>
                    {n.isNew && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="size-3" /> NEW
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
                    {n.title}
                  </h3>

                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                    {n.content}
                  </p>
                </div>

                <div className="mt-4 border-t pt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3.5" />
                    <span>{n.publishedAt}</span>
                  </div>
                  <button
                    onClick={() => setReadNoticeModal(n)}
                    className="font-medium text-primary hover:underline"
                  >
                    Read Circular &rarr;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Dialog Modal */}
      {dialogNotice !== undefined && (
        <NoticeDialog
          isOpen={true}
          notice={dialogNotice}
          onClose={() => setDialogNotice(undefined)}
          onSuccess={() => refreshData()}
        />
      )}

      {/* Read Notice Reading Modal */}
      {readNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-semibold ${AUDIENCE_BADGES[readNoticeModal.audience]?.badge ?? ""}`}>
                  {readNoticeModal.audience}
                </span>
                {readNoticeModal.isNew && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="size-3" /> NEW
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                Published: {readNoticeModal.publishedAt}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <h2 className="text-lg font-bold tracking-tight text-foreground leading-snug">
                {readNoticeModal.title}
              </h2>
              <p className="text-xs text-muted-foreground">
                Issued by: <span className="font-semibold text-foreground">{readNoticeModal.createdByName}</span>
                {readNoticeModal.expiresAt && ` | Expires: ${readNoticeModal.expiresAt}`}
              </p>

              <div className="rounded-lg bg-muted/40 p-4 text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto border">
                {readNoticeModal.content}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end border-t pt-4">
              <button
                onClick={() => setReadNoticeModal(null)}
                className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-2xs"
              >
                Close Circular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
