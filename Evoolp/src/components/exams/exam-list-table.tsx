"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  Pencil,
  Trash2,
  CalendarDays,
  Users,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteExamDialog, type DeleteExamData } from "./delete-exam-dialog";
import type { ExamSummary } from "@/lib/actions/exams";

const EXAM_TYPE_LABELS: Record<string, string> = {
  PERIODIC_TEST: "Periodic Test",
  HALF_YEARLY: "Half-Yearly",
  ANNUAL: "Annual",
  PRACTICE: "Practice",
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

interface ExamListTableProps {
  exams: ExamSummary[];
  userRole: string;
  totalEnrolled: number;
}

export function ExamListTable({
  exams,
  userRole,
  totalEnrolled,
}: ExamListTableProps) {
  const router = useRouter();
  const isAdmin = userRole === "ADMIN";
  const [deleteTarget, setDeleteTarget] = useState<DeleteExamData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const filtered = exams.filter((e) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.subjectName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "ALL" || e.examType === typeFilter;
    return matchesSearch && matchesType;
  });

  if (exams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <ClipboardList className="size-12 text-muted-foreground/40 mb-4" />
        <p className="font-semibold text-muted-foreground">No exams yet</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          {isAdmin
            ? "Create an exam to get started with marks entry."
            : "No exams have been created for this class/section."}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          id="examSearch"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search exams…"
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
        <select
          id="examTypeFilter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">All Types</option>
          <option value="PERIODIC_TEST">Periodic Test</option>
          <option value="HALF_YEARLY">Half-Yearly</option>
          <option value="ANNUAL">Annual</option>
          <option value="PRACTICE">Practice</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No exams match your filters.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                  Exam Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden sm:table-cell">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">
                  Subject
                </th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground hidden lg:table-cell">
                  Marks
                </th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground hidden lg:table-cell">
                  Date
                </th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">
                  Results
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((exam) => {
                const pendingEntry =
                  totalEnrolled > 0 && exam.resultCount < totalEnrolled;
                return (
                  <tr
                    key={exam.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="size-4 text-muted-foreground shrink-0" />
                        <span className="font-medium line-clamp-1">
                          {exam.name}
                        </span>
                      </div>
                    </td>

                    {/* Type badge */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          EXAM_TYPE_COLORS[exam.examType] ?? ""
                        }`}
                      >
                        {EXAM_TYPE_LABELS[exam.examType] ?? exam.examType}
                      </span>
                    </td>

                    {/* Subject */}
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {exam.subjectName}
                    </td>

                    {/* Max / Passing marks */}
                    <td className="px-4 py-3 text-center hidden lg:table-cell text-muted-foreground text-xs">
                      {exam.maxMarks} / {exam.passingMarks} pass
                    </td>

                    {/* Exam date */}
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      {exam.examDate ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays className="size-3" />
                          {new Date(exam.examDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">
                          —
                        </span>
                      )}
                    </td>

                    {/* Results count */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${
                          pendingEntry
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            : exam.resultCount > 0
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Users className="size-3" />
                        {exam.resultCount}
                        {totalEnrolled > 0 && ` / ${totalEnrolled}`}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs h-7"
                          onClick={() =>
                            router.push(`/dashboard/exams/${exam.id}`)
                          }
                          id={`enter-marks-${exam.id}`}
                        >
                          <ChevronRight className="size-3" />
                          Enter Marks
                        </Button>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive h-7 w-7 p-0"
                            onClick={() =>
                              setDeleteTarget({
                                id: exam.id,
                                name: exam.name,
                                resultCount: exam.resultCount,
                                subjectName: exam.subjectName,
                                className: exam.className,
                                sectionName: exam.sectionName,
                              })
                            }
                            id={`delete-exam-${exam.id}`}
                            aria-label="Delete exam"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete dialog */}
      {deleteTarget && (
        <DeleteExamDialog
          exam={deleteTarget}
          open={!!deleteTarget}
          onOpenChange={(isOpen) => {
            if (!isOpen) setDeleteTarget(null);
          }}
          onSuccess={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
