"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveExamResults,
  exportExamResultsCsv,
} from "@/lib/actions/exams";
import { computeGrade } from "@/lib/utils/exam";
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
  Download,
  Printer,
} from "lucide-react";
import type { ExamDetailData } from "@/lib/actions/exams";
import { ExamAnalyticsCard } from "./exam-analytics-card";

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
  const [isExporting, setIsExporting] = useState(false);

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

  async function handleExportCsv() {
    setIsExporting(true);
    try {
      const res = await exportExamResultsCsv(exam.id);
      if (res.success && res.data) {
        const blob = new Blob([res.data.csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", res.data.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Exam results exported to CSV.");
      } else {
        toast.error(res.error ?? "Failed to export CSV.");
      }
    } catch (err) {
      toast.error("Failed to generate CSV export.");
    } finally {
      setIsExporting(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const filledCount = rows.filter((r) => r.marks.trim() !== "").length;

  return (
    <div className="space-y-6">
      {/* Official Institutional Print Header (visible only when printing) */}
      <div className="hidden print:block border-b-2 border-black pb-4 mb-4 text-center">
        <h1 className="text-xl font-bold uppercase tracking-wide">
          Official Examination Scorecard
        </h1>
        <p className="text-sm font-semibold mt-1">
          {exam.name} &bull; {exam.academicYear}
        </p>
        <div className="flex justify-between text-xs mt-2 pt-2 border-t border-gray-300">
          <span>
            <strong>Class:</strong> {exam.className} &bull; <strong>Section:</strong> {exam.sectionName}
          </span>
          <span>
            <strong>Subject:</strong> {exam.subjectName} ({exam.subjectCode})
          </span>
          <span>
            <strong>Max:</strong> {exam.maxMarks} &bull; <strong>Passing:</strong> {exam.passingMarks}
          </span>
        </div>
      </div>

      {/* Exam Info Banner & Action Controls */}
      <div className="rounded-xl border bg-card p-4 shadow-xs print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm flex-1">
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

          {/* Action Buttons: Export CSV & Print */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isExporting || exam.students.length === 0}
              className="gap-1.5 text-xs h-8"
              id="export-exam-csv"
            >
              {isExporting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={exam.students.length === 0}
              className="gap-1.5 text-xs h-8"
              id="print-exam-results"
            >
              <Printer className="size-3.5" />
              Print Sheet
            </Button>
          </div>
        </div>

        {exam.notes && (
          <p className="mt-3 text-xs text-muted-foreground border-t pt-3">
            <span className="font-semibold">Notes:</span> {exam.notes}
          </p>
        )}
      </div>

      {/* Cohort Performance Analytics (print:hidden) */}
      <div className="print:hidden">
        <ExamAnalyticsCard examId={exam.id} />
      </div>

      {/* Server error */}
      {serverError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive print:hidden">
          <AlertCircle className="size-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Marks Entry Table */}
      {exam.students.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center print:hidden">
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
          <div className="rounded-xl border overflow-x-auto print:border-black print:rounded-none">
            <table className="w-full text-sm print:text-xs">
              <thead className="bg-muted/50 print:bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground print:text-black w-[130px] print:border print:border-black">
                    Adm. No.
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground print:text-black print:border print:border-black">
                    Student Name
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground print:text-black w-[130px] print:border print:border-black">
                    Marks / {exam.maxMarks}
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground print:text-black w-[80px] print:border print:border-black">
                    %
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground print:text-black w-[60px] print:border print:border-black">
                    Grade
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground print:text-black w-[80px] print:border print:border-black">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground print:text-black print:border print:border-black">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y print:divide-black">
                {exam.students.map((student, idx) => {
                  const row = rows[idx];
                  const preview = row
                    ? previewGrade(row.marks)
                    : null;

                  return (
                    <tr
                      key={student.studentId}
                      className="hover:bg-muted/20 transition-colors print:hover:bg-transparent"
                    >
                      {/* Admission No */}
                      <td className="px-4 py-2 text-xs text-muted-foreground print:text-black font-mono print:border print:border-black">
                        {student.admissionNumber}
                      </td>

                      {/* Name */}
                      <td className="px-4 py-2 font-medium print:text-black print:border print:border-black">
                        {student.name}
                      </td>

                      {/* Marks Input */}
                      <td className="px-4 py-2 text-center print:border print:border-black font-mono">
                        {canEdit ? (
                          <>
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
                              className="h-8 w-24 text-center mx-auto text-sm print:hidden"
                            />
                            <span className="hidden print:inline font-bold">
                              {row?.marks || "—"}
                            </span>
                          </>
                        ) : (
                          <span>{student.marksObtained ?? "—"}</span>
                        )}
                      </td>

                      {/* Preview % */}
                      <td className="px-4 py-2 text-center text-muted-foreground print:text-black text-xs font-mono print:border print:border-black">
                        {preview
                          ? `${preview.percentage}%`
                          : student.percentage !== null
                          ? `${student.percentage}%`
                          : "—"}
                      </td>

                      {/* Preview Grade */}
                      <td className="px-4 py-2 text-center print:border print:border-black">
                        <span
                          className={`print:text-black font-bold ${
                            GRADE_COLORS[
                              preview?.grade ??
                                student.grade ??
                                ""
                            ] ?? "text-muted-foreground"
                          }`}
                        >
                          {preview?.grade ?? student.grade ?? "—"}
                        </span>
                      </td>

                      {/* Pass/Fail */}
                      <td className="px-4 py-2 text-center print:border print:border-black">
                        {preview !== null ? (
                          preview.isPassing ? (
                            <>
                              <CheckCircle className="size-4 text-emerald-500 mx-auto print:hidden" />
                              <span className="hidden print:inline font-bold text-black">PASS</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="size-4 text-destructive mx-auto print:hidden" />
                              <span className="hidden print:inline font-bold text-black">FAIL</span>
                            </>
                          )
                        ) : student.isPassing !== null ? (
                          student.isPassing ? (
                            <>
                              <CheckCircle className="size-4 text-emerald-500 mx-auto print:hidden" />
                              <span className="hidden print:inline font-bold text-black">PASS</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="size-4 text-destructive mx-auto print:hidden" />
                              <span className="hidden print:inline font-bold text-black">FAIL</span>
                            </>
                          )
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="px-4 py-2 print:border print:border-black">
                        {canEdit ? (
                          <>
                            <input
                              type="text"
                              value={row?.remarks ?? ""}
                              onChange={(e) =>
                                updateRemarks(student.studentId, e.target.value)
                              }
                              placeholder="Optional remark…"
                              maxLength={200}
                              className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring print:hidden"
                            />
                            <span className="hidden print:inline text-xs italic">
                              {row?.remarks || ""}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground print:text-black">
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

          {/* Institutional Print Signature Block (visible only in print) */}
          <div className="hidden print:flex justify-between pt-16 mt-8 text-xs border-t border-gray-400">
            <div className="text-center w-48">
              <div className="border-b border-black mb-1 h-8" />
              <p className="font-semibold">Class Teacher</p>
              <p className="text-[10px] text-gray-600">Name &amp; Signature</p>
            </div>
            <div className="text-center w-48">
              <div className="border-b border-black mb-1 h-8" />
              <p className="font-semibold">Exam Controller</p>
              <p className="text-[10px] text-gray-600">Signature</p>
            </div>
            <div className="text-center w-48">
              <div className="border-b border-black mb-1 h-8" />
              <p className="font-semibold">Principal</p>
              <p className="text-[10px] text-gray-600">Seal &amp; Signature</p>
            </div>
          </div>

          {/* Save bar (print:hidden) */}
          {canEdit && (
            <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-xs print:hidden">
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
