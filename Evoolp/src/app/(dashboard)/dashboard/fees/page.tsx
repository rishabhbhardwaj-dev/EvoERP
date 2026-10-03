import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import {
  getFeeCategories,
  getFeeStructures,
  getFeeDiscounts,
} from "@/lib/actions/fees";
import { FeeWorkspace } from "@/components/fees/fee-workspace";
import {
  Tag,
  Layers,
  Percent,
  Receipt,
  AlertCircle,
} from "lucide-react";

export const metadata = {
  title: "Fee Management | EvoERP",
  description:
    "Manage fee categories, master fee structures, concession policies, and cohort fee allocations.",
};

export default async function FeesPage() {
  const ctx = await requireTenant();

  // Role gating: Only ADMIN and TEACHER allowed. STUDENT and PARENT redirect.
  if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
    redirect("/dashboard");
  }

  // Fetch baseline classes with sections and active enrollment count for this school
  const classes = await prisma.class.findMany({
    where: { schoolId: ctx.schoolId },
    include: {
      sections: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
      enrollments: {
        where: { status: "ACTIVE", student: { status: "ACTIVE" } },
        select: { id: true },
      },
    },
    orderBy: [{ academicYear: "desc" }, { name: "asc" }],
  });

  // Fetch initial fee master data via server actions
  const [categoriesRes, structuresRes, discountsRes, allocatedCount] =
    await Promise.all([
      getFeeCategories(),
      getFeeStructures(),
      getFeeDiscounts(),
      prisma.studentFeeItem.count({
        where: { schoolId: ctx.schoolId },
      }),
    ]);

  const categories = categoriesRes.success ? categoriesRes.data ?? [] : [];
  const structures = structuresRes.success ? structuresRes.data ?? [] : [];
  const discounts = discountsRes.success ? discountsRes.data ?? [] : [];

  // Shape classes for client workspace components
  const classesForWorkspace = classes.map((c) => ({
    id: c.id,
    name: c.name,
    academicYear: c.academicYear,
    sections: c.sections,
    enrolledCount: c.enrollments.length,
  }));

  const metrics = [
    {
      label: "Fee Categories",
      value: categories.length,
      icon: Tag,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Active Structures",
      value: structures.filter((s) => s.status === "ACTIVE").length,
      icon: Layers,
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      label: "Discount Policies",
      value: discounts.filter((d) => d.status === "ACTIVE").length,
      icon: Percent,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      label: "Allocated Records",
      value: allocatedCount,
      icon: Receipt,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-900/20",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance &amp; Fees</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ctx.role === "ADMIN"
              ? "Configure fee categories, build master structures, define concession policies, and allocate cohort fees."
              : "Review master fee structures, categories, discounts, and student fee allocations."}
          </p>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="rounded-xl border bg-card p-4 shadow-xs"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {m.label}
                </p>
                <div className={`p-1.5 rounded-lg ${m.bg}`}>
                  <Icon className={`size-4 ${m.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold">{m.value}</p>
            </div>
          );
        })}
      </div>

      {/* Main Fees Workspace Container */}
      {classes.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center bg-card">
          <AlertCircle className="size-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="font-semibold text-muted-foreground">
            No classes found for this school
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Create classes in the Classes module before managing fee structures and allocations.
          </p>
        </div>
      ) : (
        <FeeWorkspace
          userRole={ctx.role}
          classes={classesForWorkspace}
          categories={categories}
          structures={structures}
          discounts={discounts}
        />
      )}
    </div>
  );
}
