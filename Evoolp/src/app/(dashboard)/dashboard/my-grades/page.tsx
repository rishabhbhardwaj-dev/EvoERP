import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getMyGrades } from "@/lib/actions/exams";
import { StudentGradesView } from "@/components/exams/student-grades-view";
import { AlertCircle, GraduationCap } from "lucide-react";

export const metadata = {
  title: "My Grades & Scorecard | EvoERP",
  description: "View academic performance, examination results, and CBSE grades.",
};

export default async function MyGradesPage() {
  const ctx = await requireTenant();

  // Strictly for STUDENT and PARENT
  if (ctx.role !== "STUDENT" && ctx.role !== "PARENT") {
    redirect(ctx.role === "ADMIN" || ctx.role === "TEACHER" ? "/dashboard/exams" : "/dashboard");
  }

  const result = await getMyGrades();

  if (!result.success || !result.data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Grades &amp; Scorecard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Academic assessment records and CBSE scholastic tier reports.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <AlertCircle className="size-12 text-destructive/60 mb-3" />
          <p className="font-semibold text-foreground">Unable to load grades</p>
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
            <GraduationCap className="size-3.5" />
            {ctx.role === "PARENT" ? "Parent Evaluation Portal" : "Student Evaluation Portal"}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {ctx.role === "PARENT" ? "Ward Assessment & Grades" : "My Grades & Scorecard"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ctx.role === "PARENT"
            ? "Monitor your child's academic progress, examination scores, and CBSE grade evaluations."
            : "Review your examination results, scholastic percentage, and teacher feedback across all subjects."}
        </p>
      </div>

      <StudentGradesView initialData={result.data} userRole={ctx.role} />
    </div>
  );
}
