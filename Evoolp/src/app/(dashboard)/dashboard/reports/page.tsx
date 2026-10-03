import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getReportsWorkspaceData } from "@/lib/actions/reports";
import { ReportsWorkspace } from "@/components/reports/reports-workspace";

export const metadata = {
  title: "Reports & Analytics | EvoERP",
  description: "Institutional enrollment metrics, attendance compliance registers, and academic performance.",
};

export default async function ReportsPage() {
  const ctx = await requireTenant();

  // Non-admin and non-teacher roles are redirected to their appropriate portals
  if (ctx.role === "STUDENT" || ctx.role === "PARENT") {
    redirect("/dashboard/my-attendance");
  }

  const res = await getReportsWorkspaceData({ reportType: "enrollment" });

  if (!res.success || !res.data) {
    return (
      <div className="p-6 text-center text-destructive">
        <p>Error loading reports: {res.error || "Failed to fetch workspace data."}</p>
      </div>
    );
  }

  return <ReportsWorkspace initialData={res.data} />;
}
