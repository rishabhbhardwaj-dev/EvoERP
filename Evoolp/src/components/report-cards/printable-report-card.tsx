"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, Award } from "lucide-react";
import { recordReportCardPrintAudit, type ReportCardData } from "@/lib/actions/report-cards";

interface PrintableReportCardProps {
  data: ReportCardData;
  onClose?: () => void;
}

export function PrintableReportCard({ data, onClose }: PrintableReportCardProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  async function handlePrint() {
    setIsPrinting(true);
    try {
      // 1. Audit log before printing (metadata only)
      await recordReportCardPrintAudit({
        studentId: data.student.id,
        academicYear: data.placement.academicYear,
        cycleName: data.cycleName,
        examCount: data.subjects.length,
      });
    } catch (err) {
      console.error("Print audit failed (non-blocking):", err);
    } finally {
      setIsPrinting(false);
      // 2. Trigger native browser print
      window.print();
    }
  }

  const { school, student, placement, cycleName, subjects, totals, attendance, generatedAt } = data;

  return (
    <div className="space-y-6">
      {/* Interactive Action Bar (Hidden when printing) */}
      <div className="flex items-center justify-between gap-4 p-4 border rounded-xl bg-card shadow-xs print:hidden">
        <div>
          <h2 className="font-semibold text-base">Institutional Report Card</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {student.name} &bull; {placement.className} - {placement.sectionName} &bull; {cycleName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Back to List
            </Button>
          )}
          <Button
            size="sm"
            onClick={handlePrint}
            disabled={isPrinting}
            className="gap-2 shadow-xs"
            id="print-report-card-button"
          >
            {isPrinting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Printer className="size-4" />
            )}
            Print / Save PDF
          </Button>
        </div>
      </div>

      {/*
        A4 Portrait Institutional Card
        Styled for high contrast and pixel-perfect printing
      */}
      <div className="bg-white text-black p-6 sm:p-8 rounded-xl border border-gray-200 shadow-sm print:border-none print:shadow-none print:p-0 print:m-0 max-w-4xl mx-auto font-sans">
        {/* School Header */}
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Award className="size-7 text-black hidden sm:inline-block print:inline-block" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase">
              {school.name}
            </h1>
          </div>
          {school.address && (
            <p className="text-xs text-gray-700 font-medium">
              {school.address}
            </p>
          )}
          <p className="text-xs text-gray-600 mt-0.5">
            Affiliation / School Code: <strong>{school.code}</strong>
            {school.phone ? ` • Phone: ${school.phone}` : ""}
            {school.email ? ` • Email: ${school.email}` : ""}
          </p>
          <div className="inline-block mt-3 px-4 py-1 bg-gray-100 print:bg-transparent border border-black rounded-md">
            <h2 className="text-sm font-bold tracking-wide uppercase">
              Progress Report Card • {cycleName} ({placement.academicYear})
            </h2>
          </div>
        </div>

        {/* Student Particulars Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4 text-xs border border-black p-3 mb-6 bg-gray-50/50 print:bg-transparent">
          <div>
            <span className="text-gray-600 font-medium block">Student Name:</span>
            <span className="font-bold text-sm uppercase">{student.name}</span>
          </div>
          <div>
            <span className="text-gray-600 font-medium block">Admission No:</span>
            <span className="font-bold text-sm">{student.admissionNumber}</span>
          </div>
          <div>
            <span className="text-gray-600 font-medium block">Class &amp; Section:</span>
            <span className="font-bold text-sm uppercase">
              {placement.className} - {placement.sectionName}
            </span>
          </div>
          <div>
            <span className="text-gray-600 font-medium block">Academic Year:</span>
            <span className="font-bold text-sm">{placement.academicYear}</span>
          </div>
          <div>
            <span className="text-gray-600 font-medium block">Date of Birth:</span>
            <span className="font-semibold">{student.dateOfBirth ?? "—"}</span>
          </div>
          <div>
            <span className="text-gray-600 font-medium block">Gender:</span>
            <span className="font-semibold">{student.gender ?? "—"}</span>
          </div>
          <div>
            <span className="text-gray-600 font-medium block">Category:</span>
            <span className="font-semibold">{student.category}</span>
          </div>
          <div>
            <span className="text-gray-600 font-medium block">Evaluation Cycle:</span>
            <span className="font-semibold">{cycleName}</span>
          </div>
        </div>

        {/* Subject-Wise Scholastic Performance Table */}
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100 print:bg-gray-200 border-b border-black text-center font-bold">
                <th className="border border-black px-2 py-1.5 w-10 text-center">Sr.</th>
                <th className="border border-black px-3 py-1.5 text-left">Subject</th>
                <th className="border border-black px-2 py-1.5 w-16">Max</th>
                <th className="border border-black px-2 py-1.5 w-16">Pass</th>
                <th className="border border-black px-2 py-1.5 w-20">Obtained</th>
                <th className="border border-black px-2 py-1.5 w-16">Percentage</th>
                <th className="border border-black px-2 py-1.5 w-16">Grade</th>
                <th className="border border-black px-2 py-1.5 w-16">Result</th>
                <th className="border border-black px-2 py-1.5 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((sub, idx) => (
                <tr key={sub.examId} className="border-b border-black text-center">
                  <td className="border border-black px-2 py-1.5 text-center">{idx + 1}</td>
                  <td className="border border-black px-3 py-1.5 text-left font-medium">
                    {sub.subjectName}{" "}
                    <span className="text-[10px] text-gray-600">({sub.subjectCode})</span>
                  </td>
                  <td className="border border-black px-2 py-1.5">{sub.maxMarks}</td>
                  <td className="border border-black px-2 py-1.5">{sub.passingMarks}</td>
                  <td className="border border-black px-2 py-1.5 font-semibold">
                    {sub.status === "ABSENT" ? (
                      <span className="text-red-600 font-bold">AB</span>
                    ) : sub.marksObtained !== null ? (
                      sub.marksObtained
                    ) : (
                      <span className="text-amber-600 italic">—</span>
                    )}
                  </td>
                  <td className="border border-black px-2 py-1.5">
                    {sub.percentage !== null ? `${sub.percentage}%` : "—"}
                  </td>
                  <td className="border border-black px-2 py-1.5 font-bold">
                    {sub.grade ?? "—"}
                  </td>
                  <td className="border border-black px-2 py-1.5 font-bold">
                    {sub.isPassing === true ? (
                      <span className="text-emerald-700">PASS</span>
                    ) : sub.isPassing === false ? (
                      <span className="text-red-700">FAIL</span>
                    ) : (
                      "PENDING"
                    )}
                  </td>
                  <td className="border border-black px-2 py-1.5 text-left text-[11px] text-gray-700">
                    {sub.remarks ?? "—"}
                  </td>
                </tr>
              ))}

              {/* Grand Totals Summary Row */}
              <tr className="bg-gray-100 print:bg-gray-200 border-t-2 border-black font-bold text-center">
                <td colSpan={2} className="border border-black px-3 py-2 text-left uppercase">
                  Grand Total
                </td>
                <td className="border border-black px-2 py-2">{totals.totalMaxMarks}</td>
                <td className="border border-black px-2 py-2">—</td>
                <td className="border border-black px-2 py-2 font-bold text-sm">
                  {totals.totalMarksObtained}
                </td>
                <td className="border border-black px-2 py-2 text-sm">
                  {totals.overallPercentage}%
                </td>
                <td className="border border-black px-2 py-2 text-sm font-extrabold">
                  {totals.overallGrade}
                </td>
                <td className="border border-black px-2 py-2 font-extrabold">
                  {totals.overallResult === "PASS" ? (
                    <span className="text-emerald-800">PASS</span>
                  ) : (
                    <span className="text-red-800">FAIL</span>
                  )}
                </td>
                <td className="border border-black px-2 py-2 text-left text-[11px]">
                  {totals.failedCount > 0 ? (
                    <span className="text-red-700">
                      Failed in {totals.failedCount} subject(s): {totals.failedSubjectNames.join(", ")}
                    </span>
                  ) : totals.pendingCount > 0 ? (
                    <span className="text-amber-700">
                      {totals.pendingCount} subject result(s) pending
                    </span>
                  ) : (
                    <span className="text-emerald-700">All subjects passed</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Scholastic & Attendance Dual Block */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Scholastic Result Summary */}
          <div className="border border-black p-3 text-xs space-y-1.5">
            <h3 className="font-bold uppercase tracking-wide border-b border-gray-400 pb-1 flex items-center justify-between">
              <span>Overall Evaluation</span>
              <span className="font-extrabold text-sm">
                {totals.overallResult === "PASS" ? (
                  <span className="text-emerald-700">PASS</span>
                ) : (
                  <span className="text-red-700">FAIL</span>
                )}
              </span>
            </h3>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Marks Obtained:</span>
              <span className="font-bold">{totals.totalMarksObtained} / {totals.totalMaxMarks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Grand Percentage:</span>
              <span className="font-bold">{totals.overallPercentage}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Scholastic Grade:</span>
              <span className="font-extrabold">{totals.overallGrade}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Subjects Passed / Evaluated:</span>
              <span className="font-semibold">{totals.passedCount} of {totals.totalSubjects}</span>
            </div>
            {totals.failedCount > 0 && (
              <p className="text-[11px] text-red-700 font-semibold pt-1 border-t border-gray-200">
                Needs Improvement in: {totals.failedSubjectNames.join(", ")}
              </p>
            )}
          </div>

          {/* Attendance Summary */}
          <div className="border border-black p-3 text-xs space-y-1.5">
            <h3 className="font-bold uppercase tracking-wide border-b border-gray-400 pb-1 flex items-center justify-between">
              <span>Attendance Record</span>
              <span className="font-bold">
                {attendance.isCompliant ? (
                  <span className="text-emerald-700 font-semibold">CBSE Compliant (≥75%)</span>
                ) : (
                  <span className="text-red-700 font-semibold">Defaulter (&lt;75%)</span>
                )}
              </span>
            </h3>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Working Days (Class):</span>
              <span className="font-bold">{attendance.totalClassSessions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Evaluated Sessions (Student):</span>
              <span className="font-bold">{attendance.studentSessions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Days Attended (Weighted):</span>
              <span className="font-bold">{attendance.attendedDays} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Attendance Rate:</span>
              <span className="font-extrabold text-sm">{attendance.attendancePercentage}%</span>
            </div>
            {attendance.isPartialHistory && (
              <p className="text-[11px] text-gray-600 italic pt-1 border-t border-gray-200">
                * Partial attendance history (Evaluated {attendance.studentSessions} of {attendance.totalClassSessions} working days).
              </p>
            )}
          </div>
        </div>

        {/* Institutional Signature Block (visible on screen and high contrast on print) */}
        <div className="pt-12 mt-6 border-t border-gray-400 flex justify-between items-end text-center text-xs">
          <div className="w-36 sm:w-44">
            <div className="border-b border-black mb-1.5 h-6" />
            <p className="font-bold uppercase">Class Teacher</p>
            <p className="text-[10px] text-gray-600">Signature</p>
          </div>
          <div className="w-36 sm:w-44">
            <div className="border-b border-black mb-1.5 h-6" />
            <p className="font-bold uppercase">Exam Controller</p>
            <p className="text-[10px] text-gray-600">Verification &amp; Seal</p>
          </div>
          <div className="w-36 sm:w-44">
            <div className="border-b border-black mb-1.5 h-6" />
            <p className="font-bold uppercase">Principal</p>
            <p className="text-[10px] text-gray-600">Official Seal &amp; Signature</p>
          </div>
        </div>

        {/* Official Footer */}
        <div className="mt-8 pt-2 border-t border-gray-300 flex justify-between text-[10px] text-gray-500">
          <span>Generated officially by EvoERP Core Academic Module</span>
          <span>Date of Issue: {new Date(generatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</span>
        </div>
      </div>
    </div>
  );
}
