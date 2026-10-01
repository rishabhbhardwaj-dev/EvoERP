import { redirect, notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getExamDetail } from "@/lib/actions/exams";
import { ExamResultEntry } from "@/components/exams/exam-result-entry";
import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const ctx = await requireTenant().catch(() => null);
  if (!ctx) return { title: "Exam | EvoERP" };

  const result = await getExamDetail(examId);
  if (!result.success || !result.data) {
    return { title: "Exam | EvoERP" };
  }

  return {
    title: `${result.data.name} — Marks Entry | EvoERP`,
    description: `Enter and review marks for ${result.data.name} — ${result.data.subjectName}, ${result.data.className} Section ${result.data.sectionName}.`,
  };
}

export default async function ExamDetailPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const ctx = await requireTenant();

  if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
    redirect("/dashboard");
  }

  const result = await getExamDetail(examId);

  if (!result.success || !result.data) {
    notFound();
  }

  const exam = result.data;

  const EXAM_TYPE_LABELS: Record<string, string> = {
    PERIODIC_TEST: "Periodic Test",
    HALF_YEARLY: "Half-Yearly Exam",
    ANNUAL: "Annual Exam",
    PRACTICE: "Practice / Mock",
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb + back */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/exams"
          className="inline-flex items-center gap-1.5 -ml-2 h-7 rounded-lg px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Exams
        </Link>
      </div>

      {/* Page header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {EXAM_TYPE_LABELS[exam.examType] ?? exam.examType}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{exam.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {exam.className} / Section {exam.sectionName} &mdash;{" "}
            {exam.subjectName} &mdash; {exam.academicYear}
          </p>
        </div>

        {exam.examDate && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground rounded-lg border bg-card px-3 py-2 shadow-xs shrink-0">
            <CalendarDays className="size-4" />
            {new Date(exam.examDate).toLocaleDateString("en-IN", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </div>
        )}
      </div>

      {/* Marks Entry */}
      <ExamResultEntry exam={exam} userRole={ctx.role} />
    </div>
  );
}
