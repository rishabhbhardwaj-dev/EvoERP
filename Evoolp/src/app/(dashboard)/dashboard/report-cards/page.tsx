import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ReportCardWorkspace } from "@/components/report-cards/report-card-workspace";
import { FileText, Award, Calendar } from "lucide-react";

export const metadata = {
  title: "Report Cards | EvoERP",
  description:
    "Generate, inspect, and print official institutional CBSE progress report cards.",
};

export default async function ReportCardsPage() {
  const ctx = await requireTenant();

  // Role Gate: ADMIN and TEACHER only
  if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
    redirect("/dashboard");
  }

  // Fetch all classes with sections for this school
  const classes = await prisma.class.findMany({
    where: { schoolId: ctx.schoolId },
    include: {
      sections: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: [{ academicYear: "desc" }, { name: "asc" }],
  });

  const classesForWorkspace = classes.map((c) => ({
    id: c.id,
    name: c.name,
    academicYear: c.academicYear,
    sections: c.sections,
  }));

  // Overview metrics
  const [totalStudents, totalClasses, totalExams] = await Promise.all([
    prisma.student.count({
      where: { schoolId: ctx.schoolId, status: "ACTIVE" },
    }),
    prisma.class.count({
      where: { schoolId: ctx.schoolId },
    }),
    prisma.exam.count({
      where: { schoolId: ctx.schoolId },
    }),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Student Report Cards</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compile, preview, and print official institutional progress reports with scholastic performance and attendance metrics.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Enrolled Students
            </span>
            <FileText className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold">{totalStudents}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Active candidates across all standards</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Classes &amp; Standards
            </span>
            <Calendar className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold">{totalClasses}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Configured academic standards</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Evaluations Conducted
            </span>
            <Award className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold">{totalExams}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Subject examinations on record</p>
        </div>
      </div>

      {/* Main Interactive Workspace */}
      <ReportCardWorkspace
        classes={classesForWorkspace}
        userRole={ctx.role}
      />
    </div>
  );
}
