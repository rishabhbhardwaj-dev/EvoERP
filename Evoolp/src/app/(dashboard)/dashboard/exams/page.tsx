import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ExamWorkspace } from "@/components/exams/exam-workspace";
import { CreateExamDialog } from "@/components/exams/create-exam-dialog";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";

export const metadata = {
  title: "Exams & Marks | EvoERP",
  description:
    "Manage exam schedules, enter marks, and view CBSE grade reports for your school.",
};

export default async function ExamsPage() {
  const ctx = await requireTenant();

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
      enrollments: {
        where: { status: "ACTIVE", student: { status: "ACTIVE" } },
        select: { id: true },
      },
    },
    orderBy: [{ academicYear: "desc" }, { name: "asc" }],
  });

  // Fetch subjects for this school (for CreateExamDialog)
  const subjects = await prisma.subject.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  // Summary metric queries
  const [totalExams, examsWithResults, pendingResults] = await Promise.all([
    prisma.exam.count({ where: { schoolId: ctx.schoolId } }),

    prisma.exam.count({
      where: {
        schoolId: ctx.schoolId,
        results: { some: {} },
      },
    }),

    prisma.exam.count({
      where: {
        schoolId: ctx.schoolId,
        results: { none: {} },
      },
    }),
  ]);

  // Overall pass rate (exams with results where isPassing=true exists)
  const passRateData = await prisma.examResult.aggregate({
    where: { schoolId: ctx.schoolId },
    _count: { id: true },
  });

  const passingData = await prisma.examResult.count({
    where: { schoolId: ctx.schoolId, isPassing: true },
  });

  const totalResults = passRateData._count.id;
  const passRate =
    totalResults > 0
      ? Math.round((passingData / totalResults) * 100)
      : null;

  // Shape classes for workspace (include enrolled count per section's class)
  const classesForWorkspace = classes.map((c) => ({
    id: c.id,
    name: c.name,
    academicYear: c.academicYear,
    sections: c.sections,
    enrolledCount: c.enrollments.length,
  }));

  const classesForDialog = classes.map((c) => ({
    id: c.id,
    name: c.name,
    academicYear: c.academicYear,
    sections: c.sections,
  }));

  const metrics = [
    {
      label: "Total Exams",
      value: totalExams,
      icon: ClipboardList,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Marks Entered",
      value: examsWithResults,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      label: "Pending Entry",
      value: pendingResults,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      label: "Overall Pass Rate",
      value: passRate !== null ? `${passRate}%` : "—",
      icon: TrendingUp,
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-900/20",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Exams &amp; Marks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ctx.role === "ADMIN"
              ? "Create and manage exam definitions, enter marks, and review CBSE grades."
              : "Enter marks for exams and review student grade reports."}
          </p>
        </div>

        {ctx.role === "ADMIN" && (
          <CreateExamDialog
            classes={classesForDialog}
            subjects={subjects}
          />
        )}
      </div>

      {/* Metric Cards */}
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

      {/* Exam Workspace (class/section filter + table) */}
      {classes.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <ClipboardList className="size-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="font-semibold text-muted-foreground">
            No classes found
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Create classes in the Classes module before setting up exams.
          </p>
        </div>
      ) : (
        <ExamWorkspace
          classes={classesForWorkspace}
          userRole={ctx.role}
        />
      )}
    </div>
  );
}
