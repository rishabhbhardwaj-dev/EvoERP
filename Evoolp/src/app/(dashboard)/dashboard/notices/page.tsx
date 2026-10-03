import { requireTenant } from "@/lib/tenant";
import { getNotices } from "@/lib/actions/notices";
import { NoticeWorkspace } from "@/components/notices/notice-workspace";
import { Megaphone, AlertCircle } from "lucide-react";

export const metadata = {
  title: "Notices & Announcements | EvoERP",
  description: "Official school circulars, announcements, and notice board.",
};

export default async function NoticesPage() {
  const ctx = await requireTenant();
  const result = await getNotices();

  if (!result.success || !result.data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notices &amp; Announcements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            School circulars, event broadcasts, and role-based notices.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center bg-card">
          <AlertCircle className="size-12 text-destructive/60 mb-3" />
          <p className="font-semibold text-foreground">Unable to load notice announcements</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {result.error ?? "An error occurred while communicating with the database."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Megaphone className="size-3.5" />
            {ctx.role === "ADMIN" ? "Admin Notice Desk" : "School Circular Board"}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Notices &amp; Announcements</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ctx.role === "ADMIN"
            ? "Create, publish, and manage school announcements and role-targeted notice broadcasts."
            : "Review official school announcements, circulars, and event notifications."}
        </p>
      </div>

      <NoticeWorkspace initialData={result.data} userRole={ctx.role} />
    </div>
  );
}
