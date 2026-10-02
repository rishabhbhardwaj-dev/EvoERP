"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, Award, AlertTriangle } from "lucide-react";
import {
  recordReportCardPrintAudit,
  type ReportCardData,
  type MultiTermReportCardData,
} from "@/lib/actions/report-cards";

export const CO_SCHOLASTIC_ACTIVITIES = [
  { key: "WORK_EDUCATION", label: "Work Education (Socially Useful Productive Work)" },
  { key: "ART_EDUCATION", label: "Art Education (Visual & Performing Arts)" },
  { key: "HEALTH_AND_PHYSICAL_EDUCATION", label: "Health & Physical Education (Sports/Yoga)" },
  { key: "DISCIPLINE", label: "Discipline & Moral Values (Attendance/Sincerity)" },
] as const;

interface ReportCardDocumentContentProps {
  data?: ReportCardData | null;
  multiTermData?: MultiTermReportCardData | null;
}

/**
 * Pure institutional report card document content.
 * Styled with exact print-safe density for A4 portrait (210mm x 297mm).
 * Guaranteed to fit within physical page content box without clipping or page-splitting.
 */
export function ReportCardDocumentContent({
  data,
  multiTermData,
}: ReportCardDocumentContentProps) {
  const isMultiTerm = Boolean(multiTermData && !data);
  const school = multiTermData?.school ?? data?.school;
  const student = multiTermData?.student ?? data?.student;
  const placement = multiTermData?.placement ?? data?.placement;
  const cycleName = isMultiTerm
    ? `Annual Multi-Term (${multiTermData?.terms.map((t) => t.termName).join(" + ")})`
    : data?.cycleName ?? "Examination";
  const attendance = multiTermData?.attendance ?? data?.attendance;
  const remarks = multiTermData?.remarks ?? data?.remarks;
  const coScholastics = multiTermData?.coScholastics ?? data?.coScholastics ?? [];
  const generatedAt = multiTermData?.generatedAt ?? data?.generatedAt ?? new Date().toISOString();

  if (!school || !student || !placement || !attendance) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No report card data available to render.
      </div>
    );
  }

  // Map co-scholastic entries for display
  const coScholasticMap = new Map<string, { grade: string; remarks: string | null }>();
  for (const entry of coScholastics) {
    coScholasticMap.set(entry.activity, { grade: entry.grade, remarks: entry.remarks });
  }

  return (
    <div className="bg-white text-black font-sans w-full max-w-full box-border leading-normal">
      {/* School Header */}
      <div className="text-center border-b-2 border-black pb-1 mb-1.5">
        <div className="flex items-center justify-center gap-1.5 mb-0.5">
          <Award className="size-4 text-black inline-block shrink-0" />
          <h1 className="text-[17px] font-bold tracking-tight uppercase leading-tight">
            {school.name}
          </h1>
        </div>
        {school.address && (
          <p className="text-[9.5px] text-gray-700 font-medium leading-tight">
            {school.address}
          </p>
        )}
        <p className="text-[9px] text-gray-600 leading-tight">
          Affiliation / School Code: <strong>{school.code}</strong>
          {school.phone ? ` • Phone: ${school.phone}` : ""}
          {school.email ? ` • Email: ${school.email}` : ""}
        </p>
        <div className="inline-block mt-0.5 px-2.5 py-0.5 border border-black rounded">
          <h2 className="text-[10px] font-bold tracking-wide uppercase leading-none">
            {isMultiTerm
              ? "Annual Cumulative Progress Report Card"
              : `Progress Report Card • ${cycleName}`}{" "}
            ({placement.academicYear})
          </h2>
        </div>
      </div>

      {/* Student Particulars Matrix */}
      <div className="grid grid-cols-4 gap-y-0.5 gap-x-2 text-[9.5px] border border-black p-1 mb-1.5 leading-tight">
        <div>
          <span className="text-gray-600 font-medium block text-[8px] uppercase">Student Name:</span>
          <span className="font-bold text-[10.5px] uppercase">{student.name}</span>
        </div>
        <div>
          <span className="text-gray-600 font-medium block text-[8px] uppercase">Admission No:</span>
          <span className="font-bold text-[10.5px]">{student.admissionNumber}</span>
        </div>
        <div>
          <span className="text-gray-600 font-medium block text-[8px] uppercase">Class &amp; Section:</span>
          <span className="font-bold text-[10.5px] uppercase">
            {placement.className} - {placement.sectionName}
          </span>
        </div>
        <div>
          <span className="text-gray-600 font-medium block text-[8px] uppercase">Academic Year:</span>
          <span className="font-bold text-[10.5px]">{placement.academicYear}</span>
        </div>
        <div>
          <span className="text-gray-600 font-medium block text-[8px] uppercase">Date of Birth:</span>
          <span className="font-semibold text-[10px]">{student.dateOfBirth ?? "—"}</span>
        </div>
        <div>
          <span className="text-gray-600 font-medium block text-[8px] uppercase">Gender:</span>
          <span className="font-semibold text-[10px]">{student.gender ?? "—"}</span>
        </div>
        <div>
          <span className="text-gray-600 font-medium block text-[8px] uppercase">Category:</span>
          <span className="font-semibold text-[10px]">{student.category}</span>
        </div>
        <div>
          <span className="text-gray-600 font-medium block text-[8px] uppercase">Evaluation Scope:</span>
          <span className="font-semibold truncate block text-[10px]" title={cycleName}>
            {cycleName}
          </span>
        </div>
      </div>

      {/* Warning Banner for Multi-Term Incomplete Status */}
      {isMultiTerm && multiTermData?.totals.overallResult === "INCOMPLETE" && (
        <div className="mb-1.5 p-1 border border-amber-600 bg-amber-50 rounded text-[9px] text-amber-900 leading-tight">
          <div className="flex items-center gap-1 font-bold mb-0.5">
            <AlertTriangle className="size-3 text-amber-700" />
            <span>ANNUAL EVALUATION INCOMPLETE</span>
          </div>
          <p>
            Official annual grades cannot be compiled because required examinations have unrecorded results.
            Missing: <strong>{multiTermData.totals.incompleteSubjectNames.join(", ")}</strong>.
          </p>
        </div>
      )}

      {/* Part 1: Scholastic Performance Table */}
      {isMultiTerm && multiTermData ? (
        <div className="mb-1.5">
          <h3 className="font-bold text-[10px] uppercase tracking-wide border-b border-black pb-0.5 mb-1">
            Part 1: Scholastic Performance (Multi-Term Weighted Synthesis on 100-Point Scale)
          </h3>
          <table className="w-full text-left text-[9px] border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100 border-b border-black text-center font-bold">
                <th className="border border-black px-1 py-0.5 w-7 text-center">Sr.</th>
                <th className="border border-black px-1.5 py-0.5 text-left">Subject</th>
                {multiTermData.terms.map((term) => (
                  <th key={term.cycleKey} className="border border-black px-1 py-0.5">
                    {term.termName}
                    <span className="block text-[7.5px] text-gray-600 font-normal">
                      ({term.weight}%)
                    </span>
                  </th>
                ))}
                <th className="border border-black px-1 py-0.5 w-16">Weighted %</th>
                <th className="border border-black px-1 py-0.5 w-16">Scaled (/100)</th>
                <th className="border border-black px-1 py-0.5 w-12">Grade</th>
                <th className="border border-black px-1 py-0.5 w-14">Result</th>
              </tr>
            </thead>
            <tbody>
              {multiTermData.subjects.map((sub, idx) => (
                <tr key={sub.subjectId} className="border-b border-black text-center">
                  <td className="border border-black px-1 py-0.5 text-center">{idx + 1}</td>
                  <td className="border border-black px-1.5 py-0.5 text-left font-medium">
                    {sub.subjectName}{" "}
                    <span className="text-[8px] text-gray-600">({sub.subjectCode})</span>
                  </td>
                  {sub.termScores.map((ts) => (
                    <td key={ts.cycleKey} className="border border-black px-1 py-0.5">
                      {ts.status === "ABSENT" ? (
                        <span className="text-red-700 font-bold">AB (0%)</span>
                      ) : ts.status === "MISSING" ? (
                        <span className="text-amber-700 italic font-semibold">MISSING</span>
                      ) : ts.marksObtained !== null ? (
                        <span>
                          {ts.marksObtained}/{ts.maxMarks}{" "}
                          <span className="text-[7.5px] text-gray-600">({ts.percentage}%)</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  ))}
                  <td className="border border-black px-1 py-0.5 font-semibold">
                    {sub.annualWeightedPercentage !== null
                      ? `${sub.annualWeightedPercentage}%`
                      : "—"}
                  </td>
                  <td className="border border-black px-1 py-0.5 font-bold">
                    {sub.annualScaledMarks !== null ? sub.annualScaledMarks : "—"}
                  </td>
                  <td className="border border-black px-1 py-0.5 font-extrabold">
                    {sub.annualGrade ?? "—"}
                  </td>
                  <td className="border border-black px-1 py-0.5 font-bold">
                    {sub.status === "INCOMPLETE" ? (
                      <span className="text-amber-700">INCOMPLETE</span>
                    ) : sub.isPassing === true ? (
                      <span className="text-emerald-700">PASS</span>
                    ) : sub.isPassing === false ? (
                      <span className="text-red-700">FAIL</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}

              {/* Grand Annual Totals Row */}
              <tr className="bg-gray-100 border-t-2 border-black font-bold text-center">
                <td colSpan={2} className="border border-black px-1.5 py-0.5 text-left uppercase">
                  Cumulative Summary
                </td>
                {multiTermData.terms.map((term) => (
                  <td key={term.cycleKey} className="border border-black px-1 py-0.5 text-[8px]">
                    Weight: {term.weight}%
                  </td>
                ))}
                <td className="border border-black px-1 py-0.5 font-extrabold">
                  {multiTermData.totals.overallPercentage !== null
                    ? `${multiTermData.totals.overallPercentage}%`
                    : "—"}
                </td>
                <td className="border border-black px-1 py-0.5 font-bold">
                  {multiTermData.totals.totalScaledMarks !== null
                    ? `${multiTermData.totals.totalScaledMarks} / ${multiTermData.totals.totalMaxMarks}`
                    : "—"}
                </td>
                <td className="border border-black px-1 py-0.5 font-extrabold">
                  {multiTermData.totals.overallGrade ?? "—"}
                </td>
                <td className="border border-black px-1 py-0.5 font-extrabold">
                  {multiTermData.totals.overallResult === "PASS" ? (
                    <span className="text-emerald-800">PASS</span>
                  ) : multiTermData.totals.overallResult === "FAIL" ? (
                    <span className="text-red-800">FAIL</span>
                  ) : (
                    <span className="text-amber-800">INCOMPLETE</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mb-1.5">
          <h3 className="font-bold text-[10px] uppercase tracking-wide border-b border-black pb-0.5 mb-1">
            Part 1: Scholastic Performance
          </h3>
          <table className="w-full text-left text-[9px] border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100 border-b border-black text-center font-bold">
                <th className="border border-black px-1 py-0.5 w-7 text-center">Sr.</th>
                <th className="border border-black px-1.5 py-0.5 text-left">Subject</th>
                <th className="border border-black px-1 py-0.5 w-12">Max</th>
                <th className="border border-black px-1 py-0.5 w-12">Pass</th>
                <th className="border border-black px-1 py-0.5 w-14">Obtained</th>
                <th className="border border-black px-1 py-0.5 w-12">Percentage</th>
                <th className="border border-black px-1 py-0.5 w-12">Grade</th>
                <th className="border border-black px-1 py-0.5 w-12">Result</th>
                <th className="border border-black px-1.5 py-0.5 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {data?.subjects.map((sub, idx) => (
                <tr key={sub.examId} className="border-b border-black text-center">
                  <td className="border border-black px-1 py-0.5 text-center">{idx + 1}</td>
                  <td className="border border-black px-1.5 py-0.5 text-left font-medium">
                    {sub.subjectName}{" "}
                    <span className="text-[7.5px] text-gray-600">({sub.subjectCode})</span>
                  </td>
                  <td className="border border-black px-1 py-0.5">{sub.maxMarks}</td>
                  <td className="border border-black px-1 py-0.5">{sub.passingMarks}</td>
                  <td className="border border-black px-1 py-0.5 font-semibold">
                    {sub.status === "ABSENT" ? (
                      <span className="text-red-600 font-bold">AB</span>
                    ) : sub.marksObtained !== null ? (
                      sub.marksObtained
                    ) : (
                      <span className="text-amber-600 italic">—</span>
                    )}
                  </td>
                  <td className="border border-black px-1 py-0.5">
                    {sub.percentage !== null ? `${sub.percentage}%` : "—"}
                  </td>
                  <td className="border border-black px-1 py-0.5 font-bold">
                    {sub.grade ?? "—"}
                  </td>
                  <td className="border border-black px-1 py-0.5 font-bold">
                    {sub.isPassing === true ? (
                      <span className="text-emerald-700">PASS</span>
                    ) : sub.isPassing === false ? (
                      <span className="text-red-700">FAIL</span>
                    ) : (
                      "PENDING"
                    )}
                  </td>
                  <td className="border border-black px-1.5 py-0.5 text-left text-[8.5px] text-gray-700">
                    {sub.remarks ?? "—"}
                  </td>
                </tr>
              ))}

              {/* Grand Totals Summary Row */}
              {data && (
                <tr className="bg-gray-100 border-t-2 border-black font-bold text-center">
                  <td colSpan={2} className="border border-black px-1.5 py-0.5 text-left uppercase">
                    Grand Total
                  </td>
                  <td className="border border-black px-1 py-0.5">{data.totals.totalMaxMarks}</td>
                  <td className="border border-black px-1 py-0.5">—</td>
                  <td className="border border-black px-1 py-0.5 font-bold">
                    {data.totals.totalMarksObtained}
                  </td>
                  <td className="border border-black px-1 py-0.5">
                    {data.totals.overallPercentage}%
                  </td>
                  <td className="border border-black px-1 py-0.5 font-extrabold">
                    {data.totals.overallGrade}
                  </td>
                  <td className="border border-black px-1 py-0.5 font-extrabold">
                    {data.totals.overallResult === "PASS" ? (
                      <span className="text-emerald-800">PASS</span>
                    ) : (
                      <span className="text-red-800">FAIL</span>
                    )}
                  </td>
                  <td className="border border-black px-1.5 py-0.5 text-left text-[8px]">
                    {data.totals.failedCount > 0 ? (
                      <span className="text-red-700">
                        Failed: {data.totals.failedSubjectNames.join(", ")}
                      </span>
                    ) : data.totals.pendingCount > 0 ? (
                      <span className="text-amber-700">
                        {data.totals.pendingCount} pending
                      </span>
                    ) : (
                      <span className="text-emerald-700">All passed</span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Scholastic & Attendance Dual Block */}
      <div className="grid grid-cols-2 gap-2 mb-1.5">
        {/* Scholastic Result Summary */}
        <div className="border border-black p-1 text-[9px] space-y-0.5">
          <h3 className="font-bold uppercase tracking-wide border-b border-gray-400 pb-0.5 flex items-center justify-between text-[9.5px]">
            <span>Overall Evaluation</span>
            <span className="font-extrabold text-[10px]">
              {(isMultiTerm ? multiTermData?.totals.overallResult : data?.totals.overallResult) === "PASS" ? (
                <span className="text-emerald-700">PASS</span>
              ) : (isMultiTerm ? multiTermData?.totals.overallResult : data?.totals.overallResult) === "FAIL" ? (
                <span className="text-red-700">FAIL</span>
              ) : (
                <span className="text-amber-700">INCOMPLETE</span>
              )}
            </span>
          </h3>
          <div className="flex justify-between text-[8.5px] leading-tight">
            <span className="text-gray-600">Total Marks Obtained:</span>
            <span className="font-bold">
              {isMultiTerm
                ? `${multiTermData?.totals.totalScaledMarks ?? "—"} / ${multiTermData?.totals.totalMaxMarks}`
                : `${data?.totals.totalMarksObtained} / ${data?.totals.totalMaxMarks}`}
            </span>
          </div>
          <div className="flex justify-between text-[8.5px] leading-tight">
            <span className="text-gray-600">Grand Percentage:</span>
            <span className="font-bold">
              {isMultiTerm
                ? (multiTermData?.totals.overallPercentage !== null ? `${multiTermData?.totals.overallPercentage}%` : "—")
                : `${data?.totals.overallPercentage}%`}
            </span>
          </div>
          <div className="flex justify-between text-[8.5px] leading-tight">
            <span className="text-gray-600">Scholastic Grade:</span>
            <span className="font-extrabold">
              {isMultiTerm ? (multiTermData?.totals.overallGrade ?? "—") : data?.totals.overallGrade}
            </span>
          </div>
          <div className="flex justify-between text-[8.5px] leading-tight">
            <span className="text-gray-600">Subjects Passed:</span>
            <span className="font-semibold">
              {isMultiTerm
                ? `${multiTermData?.totals.passedCount} of ${multiTermData?.subjects.length}`
                : `${data?.totals.passedCount} of ${data?.totals.totalSubjects}`}
            </span>
          </div>
          {(isMultiTerm ? (multiTermData?.totals.failedCount ?? 0) : (data?.totals.failedCount ?? 0)) > 0 && (
            <p className="text-[8px] text-red-700 font-semibold pt-0.5 border-t border-gray-200">
              Needs Improvement:{" "}
              {(isMultiTerm
                ? multiTermData?.totals.failedSubjectNames
                : data?.totals.failedSubjectNames
              )?.join(", ")}
            </p>
          )}
        </div>

        {/* Attendance Summary */}
        <div className="border border-black p-1 text-[9px] space-y-0.5">
          <h3 className="font-bold uppercase tracking-wide border-b border-gray-400 pb-0.5 flex items-center justify-between text-[9.5px]">
            <span>Attendance Record</span>
            <span className="font-bold text-[9px]">
              {attendance.isCompliant ? (
                <span className="text-emerald-700 font-semibold">CBSE Compliant (≥75%)</span>
              ) : (
                <span className="text-red-700 font-semibold">Defaulter (&lt;75%)</span>
              )}
            </span>
          </h3>
          <div className="flex justify-between text-[8.5px] leading-tight">
            <span className="text-gray-600">Total Working Days:</span>
            <span className="font-bold">{attendance.totalClassSessions}</span>
          </div>
          <div className="flex justify-between text-[8.5px] leading-tight">
            <span className="text-gray-600">Evaluated Sessions:</span>
            <span className="font-bold">{attendance.studentSessions}</span>
          </div>
          <div className="flex justify-between text-[8.5px] leading-tight">
            <span className="text-gray-600">Days Attended:</span>
            <span className="font-bold">{attendance.attendedDays} days</span>
          </div>
          <div className="flex justify-between text-[8.5px] leading-tight">
            <span className="text-gray-600">Attendance Rate:</span>
            <span className="font-extrabold">{attendance.attendancePercentage}%</span>
          </div>
          {attendance.isPartialHistory && (
            <p className="text-[7.5px] text-gray-600 italic pt-0.5 border-t border-gray-200">
              * Partial history ({attendance.studentSessions} of {attendance.totalClassSessions} days).
            </p>
          )}
        </div>
      </div>

      {/* Part 2: Co-Scholastic Activities & Discipline Block */}
      <div className="mb-1.5">
        <h3 className="font-bold text-[10px] uppercase tracking-wide border-b border-black pb-0.5 mb-1">
          Part 2: Co-Scholastic Activities &amp; Discipline (Graded on 3-Point Scale: A, B, C)
        </h3>
        <table className="w-full text-left text-[9px] border-collapse border border-black">
          <thead>
            <tr className="bg-gray-100 border-b border-black text-center font-bold">
              <th className="border border-black px-1 py-0.5 w-7 text-center">Sr.</th>
              <th className="border border-black px-1.5 py-0.5 text-left">Activity / Trait</th>
              <th className="border border-black px-1 py-0.5 w-14 text-center">Grade</th>
              <th className="border border-black px-1.5 py-0.5 text-left">Appraisal / Teacher Feedback</th>
            </tr>
          </thead>
          <tbody>
            {CO_SCHOLASTIC_ACTIVITIES.map((act, idx) => {
              const recorded = coScholasticMap.get(act.key);
              return (
                <tr key={act.key} className="border-b border-black text-center">
                  <td className="border border-black px-1 py-0.5 text-center">{idx + 1}</td>
                  <td className="border border-black px-1.5 py-0.5 text-left font-medium">
                    {act.label}
                  </td>
                  <td className="border border-black px-1 py-0.5 font-bold text-center">
                    {recorded?.grade ? (
                      <span className="font-extrabold">{recorded.grade}</span>
                    ) : (
                      <span className="text-gray-400 font-normal">—</span>
                    )}
                  </td>
                  <td className="border border-black px-1.5 py-0.5 text-left text-[8.5px] text-gray-700">
                    {recorded?.remarks || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Persistent Teacher Remarks Block */}
      <div className="border border-black p-1 text-[9px] mb-1.5">
        <div className="flex justify-between items-center border-b border-gray-400 pb-0.5 mb-0.5">
          <h3 className="font-bold uppercase tracking-wide text-[9.5px]">Class Teacher&apos;s Remarks</h3>
          {remarks?.authorName ? (
            <span className="text-[8px] text-gray-600">
              Appraisal by: <strong className="text-black">{remarks.authorName}</strong> ({remarks.authorRole})
            </span>
          ) : null}
        </div>
        {remarks?.remarks ? (
          <p className="text-[9px] text-gray-800 italic leading-snug whitespace-pre-wrap">
            &ldquo;{remarks.remarks}&rdquo;
          </p>
        ) : (
          <p className="text-[9px] text-gray-400 italic">
            No formal appraisal remarks recorded for this evaluation cycle.
          </p>
        )}
      </div>

      {/* Institutional Signatures Block */}
      <div className="pt-1 mt-1 border-t border-gray-400 flex justify-between items-end text-center text-[8.5px]">
        <div className="w-32">
          <div className="border-b border-black mb-0.5 h-3.5" />
          <p className="font-bold uppercase text-[9px]">Class Teacher</p>
          <p className="text-[7.5px] text-gray-600">Signature</p>
        </div>
        <div className="w-32">
          <div className="border-b border-black mb-0.5 h-3.5" />
          <p className="font-bold uppercase text-[9px]">Exam Controller</p>
          <p className="text-[7.5px] text-gray-600">Verification &amp; Seal</p>
        </div>
        <div className="w-32">
          <div className="border-b border-black mb-0.5 h-3.5" />
          <p className="font-bold uppercase text-[9px]">Principal</p>
          <p className="text-[7.5px] text-gray-600">Official Seal &amp; Signature</p>
        </div>
      </div>

      {/* Official Footer */}
      <div className="mt-1 pt-0.5 border-t border-gray-300 flex justify-between text-[7.5px] text-gray-500">
        <span>Generated officially by EvoERP Core Academic Module</span>
        <span>
          Date of Issue:{" "}
          {new Date(generatedAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

interface PrintableReportCardProps {
  data?: ReportCardData | null;
  multiTermData?: MultiTermReportCardData | null;
  onClose?: () => void;
  isBatchItem?: boolean;
}

export function PrintableReportCard({
  data,
  multiTermData,
  onClose,
  isBatchItem = false,
}: PrintableReportCardProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isMultiTerm = Boolean(multiTermData && !data);
  const student = multiTermData?.student ?? data?.student;
  const placement = multiTermData?.placement ?? data?.placement;
  const cycleName = isMultiTerm
    ? `Annual Multi-Term (${multiTermData?.terms.map((t) => t.termName).join(" + ")})`
    : data?.cycleName ?? "Examination";

  async function handlePrint() {
    if (!student || !placement) return;
    setIsPrinting(true);
    try {
      await recordReportCardPrintAudit({
        studentId: student.id,
        academicYear: placement.academicYear,
        cycleName,
        examCount: isMultiTerm
          ? (multiTermData?.subjects.length ?? 0)
          : (data?.subjects.length ?? 0),
      });
    } catch (err) {
      console.error("Print audit failed (non-blocking):", err);
    } finally {
      setIsPrinting(false);
      if (typeof window !== "undefined") {
        window.print();
      }
    }
  }

  // Print portal styles applied when printing from single-card view
  const printStyles = `
    @media print {
      @page {
        size: A4 portrait;
        margin: 8mm 6mm;
      }
      html, body {
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
        background: white !important;
        color: black !important;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body:has(#report-card-print-root) > *:not(#report-card-print-root) {
        display: none !important;
      }
      body > *:not(#report-card-print-root) {
        display: none !important;
      }
      #report-card-print-root {
        display: block !important;
        position: static !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        color: black !important;
        visibility: visible !important;
        transform: none !important;
      }
      .report-card-page {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
    @media screen {
      #report-card-print-root {
        display: none !important;
      }
    }
  `;

  return (
    <div className="space-y-4">
      {/* Interactive Action Bar (Visible only on screen) */}
      {!isBatchItem && (
        <div className="flex items-center justify-between gap-4 p-3 border rounded-xl bg-card shadow-xs print:hidden">
          <div>
            <h2 className="font-semibold text-sm">
              {isMultiTerm ? "Annual Multi-Term Progress Report" : "Institutional Report Card"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {student?.name} &bull; {placement?.className} - {placement?.sectionName} &bull; {cycleName}
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
      )}

      {/* Screen Preview Container (Styled comfortably for in-modal inspection) */}
      <div className="bg-white text-black p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm max-w-4xl mx-auto font-sans print:hidden">
        <ReportCardDocumentContent data={data} multiTermData={multiTermData} />
      </div>

      {/* Dedicated Clean Print Root Portal (Completely separated from Dialog tree) */}
      {!isBatchItem && mounted && typeof document !== "undefined" && createPortal(
        <div id="report-card-print-root">
          <style dangerouslySetInnerHTML={{ __html: printStyles }} />
          <div className="report-card-page">
            <ReportCardDocumentContent data={data} multiTermData={multiTermData} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
