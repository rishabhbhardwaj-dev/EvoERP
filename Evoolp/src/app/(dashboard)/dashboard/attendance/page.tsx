import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { AttendanceMetrics } from "@/components/attendance/attendance-metrics";
import { AttendanceRegister } from "@/components/attendance/attendance-register";
import { getTodayAttendanceSummary } from "@/lib/actions/attendance";

export default async function AttendancePage() {
  const ctx = await requireTenant();

  // RBAC: Only ADMIN and TEACHER roles are authorized for attendance registers
  if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
    redirect("/dashboard");
  }

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
          <h1 className="text-2xl font-bold tracking-tight">Daily Attendance Register</h1>
          <p className="text-sm text-muted-foreground">
            Record student roll call, verify daily presence, and track institutional attendance.
          </p>
        </div>
      </div>

      {/* Summary Metrics */}
      <AttendanceMetrics summary={summary} />

      {/* Attendance Register Workspace */}
      <AttendanceRegister classes={formattedClasses} userRole={ctx.role} />
    </div>
  );
}
