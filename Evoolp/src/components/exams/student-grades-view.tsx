"use client";

import { useState, useTransition } from "react";
import {
  getMyGrades,
  type MyGradesData,
  type ChildProfile,
  type StudentGradeEntry,
} from "@/lib/actions/exams";
import {
  GraduationCap,
  Award,
  CheckCircle2,
  XCircle,
  TrendingUp,
  BookOpen,
  CalendarDays,
  User,
  Filter,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const GRADE_COLORS: Record<string, string> = {
  A1: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 font-bold",
  A2: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold",
  B1: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 font-semibold",
  B2: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 font-semibold",
  C1: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 font-medium",
  C2: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 font-medium",
  D: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 font-medium",
  E: "bg-destructive/15 text-destructive dark:bg-destructive/25 dark:text-destructive font-bold",
};

const EXAM_TYPE_LABELS: Record<string, string> = {
  PERIODIC_TEST: "Periodic Test",
  HALF_YEARLY: "Half-Yearly",
  ANNUAL: "Annual Exam",
  PRACTICE: "Practice / Mock",
};

const EXAM_TYPE_COLORS: Record<string, string> = {
  PERIODIC_TEST:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  HALF_YEARLY:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  ANNUAL:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  PRACTICE:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

interface StudentGradesViewProps {
  initialData: MyGradesData;
  userRole: "STUDENT" | "PARENT";
}

export function StudentGradesView({
  initialData,
  userRole,
}: StudentGradesViewProps) {
  const [data, setData] = useState<MyGradesData>(initialData);
  const [selectedStudentId, setSelectedStudentId] = useState(
    initialData.student.id
  );
  const [examTypeFilter, setExamTypeFilter] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();

  const isParent = userRole === "PARENT";

  function handleChildChange(childId: string) {
    setSelectedStudentId(childId);
    startTransition(async () => {
      const res = await getMyGrades({
        studentId: childId,
        examType:
          examTypeFilter !== "ALL"
            ? (examTypeFilter as "PERIODIC_TEST" | "HALF_YEARLY" | "ANNUAL" | "PRACTICE")
            : undefined,
      });
      if (res.success && res.data) {
        setData(res.data);
      }
    });
  }

  function handleExamTypeFilter(type: string) {
    setExamTypeFilter(type);
    startTransition(async () => {
      const res = await getMyGrades({
        studentId: selectedStudentId,
        examType:
          type !== "ALL"
            ? (type as "PERIODIC_TEST" | "HALF_YEARLY" | "ANNUAL" | "PRACTICE")
            : undefined,
      });
      if (res.success && res.data) {
        setData(res.data);
      }
    });
  }

  const { student, children, overview, grades } = data;
  const passRate =
    overview.totalExams > 0
      ? Math.round((overview.passedCount / overview.totalExams) * 100)
      : null;

  return (
    <div className="space-y-6">
      {/* Header controls: Child selector (for parents) & Type Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-xs">
        {/* Child selector or Student details */}
        {isParent && children.length > 1 ? (
          <div className="space-y-1.5 flex-1 max-w-xs">
            <label
              htmlFor="childSelect"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"
            >
              <User className="size-3.5 text-primary" /> Select Child
            </label>
            <select
              id="childSelect"
              value={selectedStudentId}
              onChange={(e) => handleChildChange(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.className} - {c.sectionName})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-primary/10 text-primary">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{student.name}</p>
              <p className="text-xs text-muted-foreground">
                Adm: {student.admissionNumber} &bull; {student.className} / Sec{" "}
                {student.sectionName} &bull; {student.academicYear}
              </p>
            </div>
          </div>
        )}

        {/* Exam Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground hidden sm:block" />
          <select
            id="examTypeFilter"
            value={examTypeFilter}
            onChange={(e) => handleExamTypeFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">All Exam Cycles</option>
            <option value="PERIODIC_TEST">Periodic Test</option>
            <option value="HALF_YEARLY">Half-Yearly</option>
            <option value="ANNUAL">Annual Exam</option>
            <option value="PRACTICE">Practice / Mock</option>
          </select>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Exams
            </p>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <FileText className="size-4 text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-bold">{overview.totalExams}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {overview.passedCount} Passed &bull; {overview.failedCount} Needs Improvement
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Average Score
            </p>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <TrendingUp className="size-4 text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl font-bold">
            {overview.totalExams > 0 ? `${overview.averagePercentage}%` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Cumulative percentage
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              CBSE Aggregate
            </p>
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <Award className="size-4 text-purple-500" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center rounded-lg px-2.5 py-0.5 text-lg ${
                GRADE_COLORS[overview.overallGrade] ?? "bg-muted text-foreground"
              }`}
            >
              {overview.totalExams > 0 ? overview.overallGrade : "—"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Scholastic tier
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Success Rate
            </p>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <CheckCircle2 className="size-4 text-amber-500" />
            </div>
          </div>
          <p className="text-2xl font-bold">
            {passRate !== null ? `${passRate}%` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Passing threshold compliance
          </p>
        </div>
      </div>

      {/* Scorecard Table */}
      {isPending ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Updating scorecard…</span>
        </div>
      ) : grades.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Award className="size-12 text-muted-foreground/40 mb-3" />
          <p className="font-semibold text-muted-foreground">
            No assessment results recorded
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
            {examTypeFilter !== "ALL"
              ? `No ${EXAM_TYPE_LABELS[examTypeFilter] ?? examTypeFilter} results have been entered yet.`
              : "No exam marks have been entered for this student in the selected cycle."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-card shadow-xs">
          <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Subject Scorecard</h2>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {grades.length} {grades.length === 1 ? "Subject" : "Subjects"} Recorded
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Subject</th>
                  <th className="px-4 py-3 text-left font-semibold">Exam Cycle</th>
                  <th className="px-4 py-3 text-center font-semibold">Marks</th>
                  <th className="px-4 py-3 text-center font-semibold">%</th>
                  <th className="px-4 py-3 text-center font-semibold">Grade</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {grades.map((g) => (
                  <tr
                    key={g.resultId}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {/* Subject */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{g.subjectName}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {g.subjectCode}
                      </p>
                    </td>

                    {/* Exam Name & Type */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground text-xs">{g.examName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-medium ${
                            EXAM_TYPE_COLORS[g.examType] ?? "bg-muted"
                          }`}
                        >
                          {EXAM_TYPE_LABELS[g.examType] ?? g.examType}
                        </span>
                        {g.examDate && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <CalendarDays className="size-2.5" />
                            {new Date(g.examDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Marks */}
                    <td className="px-4 py-3 text-center font-mono">
                      <span className="font-bold text-foreground">
                        {g.marksObtained}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {" "}/ {g.maxMarks}
                      </span>
                    </td>

                    {/* Percentage */}
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      {g.percentage}%
                    </td>

                    {/* Grade Pill */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${
                          GRADE_COLORS[g.grade] ?? "bg-muted text-foreground"
                        }`}
                      >
                        {g.grade}
                      </span>
                    </td>

                    {/* Status Icon */}
                    <td className="px-4 py-3 text-center">
                      {g.isPassing ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-4" />
                          Pass
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                          <XCircle className="size-4" />
                          Needs Imp.
                        </span>
                      )}
                    </td>

                    {/* Remarks */}
                    <td className="px-4 py-3 text-xs text-muted-foreground italic max-w-xs truncate">
                      {g.remarks ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
