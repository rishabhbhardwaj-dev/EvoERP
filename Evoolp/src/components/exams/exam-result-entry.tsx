"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveExamResults, computeGrade } from "@/lib/actions/exams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
} from "lucide-react";
import type { ExamDetailData } from "@/lib/actions/exams";

const GRADE_COLORS: Record<string, string> = {
  A1: "text-emerald-600 font-bold",
  A2: "text-emerald-500 font-bold",
  B1: "text-blue-600 font-semibold",
  B2: "text-blue-500 font-semibold",
  C1: "text-amber-600 font-medium",
  C2: "text-amber-500 font-medium",
  D: "text-orange-500 font-medium",
  E: "text-destructive font-bold",
};

interface StudentMarksRow {
  studentId: string;
  marks: string; // string for controlled input (allows empty)
  remarks: string;
}

interface ExamResultEntryProps {
  exam: ExamDetailData;
  userRole: string;
}

export function ExamResultEntry({ exam, userRole }: ExamResultEntryProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const canEdit = userRole === "ADMIN" || userRole === "TEACHER";

  // Initialize rows from existing results
  const [rows, setRows] = useState<StudentMarksRow[]>(() =>
    exam.students.map((s) => ({
      studentId: s.studentId,
      marks:
        s.marksObtained !== null ? String(s.marksObtained) : "",
      remarks: s.remarks ?? "",
    }))
  );

  const [serverError, setServerError] = useState<string | null>(null);

  function updateMarks(studentId: string, marks: string) {
    setRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, marks } : r))
    );
  }

  function updateRemarks(studentId: string, remarks: string) {
    setRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, remarks } : r))
    );
  }

  // Client-side preview computation (server always recomputes authoritatively)
  function previewGrade(marksStr: string) {
    const val = parseFloat(marksStr);
    if (isNaN(val) || val < 0) return null;
    const pct = (val / exam.maxMarks) * 100;
    return {
      percentage: Math.round(pct * 100) / 100,
      grade: computeGrade(pct),
      isPassing: val >= exam.passingMarks,
    };
  }

  async function handleSave() {
    setServerError(null);

    // Validate client-side before sending
    const filled = rows.filter((r) => r.marks.trim() !== "");
    if (filled.length === 0) {
      toast.error("Enter marks for at least one student.");
      return;
    }

    const invalid = filled.find((r) => {
      const v = parseFloat(r.marks);
      return isNaN(v) || v < 0 || v > exam.maxMarks;
    });
    if (invalid) {
      toast.error(
        `Invalid marks for a student. Marks must be between 0 and ${exam.maxMarks}.`
      );
      return;
    }

    startTransition(async () => {
      const result = await saveExamResults({
        examId: exam.id,
        results: filled.map((r) => ({
          studentId: r.studentId,
          marksObtained: parseFloat(r.marks),
          remarks: r.remarks.trim() || undefined,
        })),
      });

      if (result.success) {
        toast.success(
          `Saved marks for ${result.data?.saved ?? filled.length} student(s).`
        );
        router.refresh();
      } else {
        setServerError(result.error ?? "Failed to save marks.");
        toast.error(result.error ?? "Failed to save marks.");
      }
    });
  }

  const filledCount = rows.filter((r) => r.marks.trim() !== "").length;

  return (
    <div className="space-y-6">
      {/* Exam Info Banner */}
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground font-semibold">Subject</p>
            <p className="font-medium mt-0.5">
              {exam.subjectName}
              <span className="text-xs text-muted-foreground ml-1">
                ({exam.subjectCode})
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold">Class</p>
            <p className="font-medium mt-0.5">
              {exam.className} / Sec {exam.sectionName}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold">Max Marks</p>
            <p className="font-medium mt-0.5">{exam.maxMarks}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold">Passing</p>
            <p className="font-medium mt-0.5">
              {exam.passingMarks}{" "}
              <span className="text-xs text-muted-foreground">
                ({Math.round((exam.passingMarks / exam.maxMarks) * 100)}%)
              </span>
            </p>
          </div>
        </div>
        {exam.notes && (
          <p className="mt-3 text-xs text-muted-foreground border-t pt-3">
            <span className="font-semibold">Notes:</span> {exam.notes}
          </p>
        )}
      </div>

      {/* Server error */}
      {serverError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Marks Entry Table */}
      {exam.students.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Users className="size-12 text-muted-foreground/40 mb-4" />
          <p className="font-semibold text-muted-foreground">
            No enrolled students
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            No active students are enrolled in{" "}
            {exam.className} / Section {exam.sectionName} for {exam.academicYear}.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground w-[130px]">
                    Adm. No.
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Student Name
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground w-[130px]">
                    Marks / {exam.maxMarks}
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground w-[80px] hidden sm:table-cell">
                    %
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground w-[60px] hidden sm:table-cell">
                    Grade
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground w-[80px] hidden md:table-cell">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden lg:table-cell">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {exam.students.map((student, idx) => {
                  const row = rows[idx];
                  const preview = row
                    ? previewGrade(row.marks)
                    : null;

                  return (
                    <tr
                      key={student.studentId}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      {/* Admission No */}
                      <td className="px-4 py-2 text-xs text-muted-foreground font-mono">
                        {student.admissionNumber}
                      </td>

                      {/* Name */}
                      <td className="px-4 py-2 font-medium">{student.name}</td>

                      {/* Marks Input */}
                      <td className="px-4 py-2 text-center">
                        {canEdit ? (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max={exam.maxMarks}
                            value={row?.marks ?? ""}
                            onChange={(e) =>
                              updateMarks(student.studentId, e.target.value)
                            }
                            id={`marks-${student.studentId}`}
                            placeholder="—"
                            className="h-8 w-24 text-center mx-auto text-sm"
                          />
                        ) : (
                          <span className="font-mono">
                            {student.marksObtained ?? "—"}
                          </span>
                        )}
                      </td>

                      {/* Preview % */}
                      <td className="px-4 py-2 text-center hidden sm:table-cell text-muted-foreground text-xs">
                        {preview
                          ? `${preview.percentage}%`
                          : student.percentage !== null
                          ? `${student.percentage}%`
                          : "—"}
                      </td>

                      {/* Preview Grade */}
                      <td className="px-4 py-2 text-center hidden sm:table-cell">
                        <span
                          className={
                            GRADE_COLORS[
                              preview?.grade ??
                                student.grade ??
                                ""
                            ] ?? "text-muted-foreground"
                          }
                        >
                          {preview?.grade ?? student.grade ?? "—"}
                        </span>
                      </td>

                      {/* Pass/Fail */}
                      <td className="px-4 py-2 text-center hidden md:table-cell">
                        {preview !== null ? (
                          preview.isPassing ? (
                            <CheckCircle className="size-4 text-emerald-500 mx-auto" />
                          ) : (
                            <XCircle className="size-4 text-destructive mx-auto" />
                          )
                        ) : student.isPassing !== null ? (
                          student.isPassing ? (
                            <CheckCircle className="size-4 text-emerald-500 mx-auto" />
                          ) : (
                            <XCircle className="size-4 text-destructive mx-auto" />
                          )
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">
                            —
                          </span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="px-4 py-2 hidden lg:table-cell">
                        {canEdit ? (
                          <input
                            type="text"
                            value={row?.remarks ?? ""}
                            onChange={(e) =>
                              updateRemarks(student.studentId, e.target.value)
                            }
                            placeholder="Optional remark…"
                            maxLength={200}
                            className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {student.remarks ?? "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Save bar */}
          {canEdit && (
            <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-xs">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {filledCount}
                </span>{" "}
                of {exam.students.length} marks entered
              </p>
              <Button
                onClick={handleSave}
                disabled={filledCount === 0}
                className="gap-2"
                id="save-exam-results"
              >
                <Save className="size-4" />
                Save All Results
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
