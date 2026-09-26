import { requireTenant, ROLE_LABELS, getFiscalYear } from "@/lib/tenant";

export default async function DashboardPage() {
  const ctx = await requireTenant();
  const fy = getFiscalYear();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome back, {ctx.name} ({ROLE_LABELS[ctx.role]}).
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Tenant</p>
          <p className="text-lg font-medium">{ctx.schoolId}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Role</p>
          <p className="text-lg font-medium">{ROLE_LABELS[ctx.role]}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Indian Fiscal Year</p>
          <p className="text-lg font-medium">{fy.label} (Apr–Mar)</p>
        </div>
      </div>
    </div>
  );
}