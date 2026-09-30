import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { AttendanceWorkspace } from "@/components/attendance/attendance-workspace";
import { getTodayAttendanceSummary } from "@/lib/actions/attendance";

interface AttendancePageProps {
  searchParams?: Promise<{ view?: string }>;
}

export default async function AttendancePage({
  searchParams,
}: AttendancePageProps) {
  const ctx = await requireTenant();

  // RBAC: Only ADMIN and TEACHER roles are authorized for attendance registers
  if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
    redirect("/dashboard");
  }

  const resolvedParams = searchParams ? await searchParams : undefined;
  const initialTab = resolvedParams?.view === "monthly" ? "monthly" : "daily";

  // 1. Fetch all classes and their divisions for this school tenant
  const classes = await prisma.class.findMany({
    where: { schoolId: ctx.schoolId },
    include: {
      sections: {
        orderBy: { name: "asc" },
      },
    },
    orderBy: [{ academicYear: "desc" }, { name: "asc" }],
  });

  // 2. Fetch today's summary metrics
  const summary = await getTodayAttendanceSummary();

  const formattedClasses = classes.map((c) => ({
    id: c.id,
    name: c.name,
    academicYear: c.academicYear,
    sections: c.sections.map((s) => ({
      id: s.id,
      name: s.name,
    })),
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance Management</h1>
          <p className="text-sm text-muted-foreground">
            Daily Attendance Register, monthly historical matrix, CBSE 75% defaulters tracking, and exports.
          </p>
        </div>
      </div>

      {/* Attendance Multi-View Workspace */}
      <AttendanceWorkspace
        classes={formattedClasses}
        userRole={ctx.role}
        summary={summary}
        initialTab={initialTab}
      />
    </div>
  );
}

