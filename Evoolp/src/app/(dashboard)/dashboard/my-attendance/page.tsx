import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getMyAttendance } from "@/lib/actions/attendance";
import { StudentAttendanceView } from "@/components/attendance/student-attendance-view";
import { AlertCircle, CalendarCheck } from "lucide-react";

export const metadata = {
  title: "My Attendance | EvoERP",
  description: "View daily roll call records, attendance percentage, and CBSE 75% compliance status.",
};

export default async function MyAttendancePage() {
  const ctx = await requireTenant();

  // Strictly for STUDENT and PARENT
  if (ctx.role !== "STUDENT" && ctx.role !== "PARENT") {
    redirect(ctx.role === "ADMIN" || ctx.role === "TEACHER" ? "/dashboard/attendance" : "/dashboard");
  }

  const result = await getMyAttendance();

  if (!result.success || !result.data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Attendance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personal roll call register and CBSE compliance tracking.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center bg-card">
          <AlertCircle className="size-12 text-destructive/60 mb-3" />
          <p className="font-semibold text-foreground">Unable to load attendance</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {result.error ?? "No student profile is currently linked to your user account."}
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
            <CalendarCheck className="size-3.5" />
            {ctx.role === "PARENT" ? "Parent Attendance Portal" : "Student Attendance Portal"}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {ctx.role === "PARENT" ? "Ward Attendance & Register" : "My Attendance & Register"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ctx.role === "PARENT"
            ? "Monitor your child's daily school attendance, session logs, and CBSE examination eligibility."
            : "Review your daily roll call records, working days, and CBSE mandatory attendance percentage."}
        </p>
      </div>

      <StudentAttendanceView initialData={result.data} userRole={ctx.role} />
    </div>
  );
}
