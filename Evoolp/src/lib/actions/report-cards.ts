"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { computeGrade, type GradeLabelValue } from "@/lib/utils/exam";
import {
  compileReportCardData,
  type ReportCardSubjectRow,
  type ReportCardAttendanceSummary,
  type ReportCardTotals,
  type ReportCardRemarkData,
  type ReportCardCoScholasticData,
  type ReportCardData,
  type PureCompileParams,
} from "@/lib/utils/report-card";
import {
  examCycleQuerySchema,
  reportCardQuerySchema,
  classReportCardRosterQuerySchema,
  reportCardPrintAuditSchema,
  batchReportCardQuerySchema,
  exportReportCardsCsvSchema,
  saveTeacherRemarkSchema,
  saveCoScholasticSchema,
  multiTermCompilationSchema,
  type ExamCycleQueryInput,
  type ReportCardQueryInput,
  type ClassReportCardRosterQueryInput,
  type ReportCardPrintAuditInput,
  type BatchReportCardQueryInput,
  type ExportReportCardsCsvInput,
  type SaveTeacherRemarkInput,
  type SaveCoScholasticInput,
  type MultiTermCompilationInput,
} from "@/lib/validations/report-card";
import type { ActionResult } from "./classes";

// Re-export pure types so existing consumers have complete backward compatibility
export type {
  ReportCardSubjectRow,
  ReportCardAttendanceSummary,
  ReportCardTotals,
  ReportCardRemarkData,
  ReportCardCoScholasticData,
  ReportCardData,
  PureCompileParams,
};

// ─────────────────────────── Pure Helpers ───────────────────────────

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function toNum(val: number | { toNumber: () => number }): number {
  return typeof val === "number" ? val : val.toNumber();
}

/**
 * Escapes CSV cell value according to RFC-4180.
 * Prevents formula injection in spreadsheets by escaping leading '=', '+', '-', '@', etc.
 */
function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ─────────────────────────── Exported Types ─────────────────────────

export interface ExamCycleOption {
  cycleId: string;
  cycleName: string;
  examType: string;
  examCount: number;
  examIds: string[];
  subjects: { id: string; name: string; code: string }[];
}

export type RosterStudentReadiness = "READY" | "PARTIAL" | "NO_MARKS";

export interface ClassReportCardRosterItem {
  studentId: string;
  admissionNumber: string;
  studentName: string;
  gender: string | null;
  status: RosterStudentReadiness;
  enteredCount: number;
  totalCount: number;
  overallPercentage: number | null;
  overallGrade: GradeLabelValue | null;
  overallResult: "PASS" | "FAIL" | null;
}

export interface MultiTermSubjectTermScore {
  termName: string;
  cycleKey: string;
  weight: number;
  maxMarks: number;
  marksObtained: number | null;
  percentage: number | null;
  status: "ENTERED" | "ABSENT" | "MISSING";
}

export interface MultiTermSubjectRow {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  termScores: MultiTermSubjectTermScore[];
  annualWeightedPercentage: number | null;
  annualScaledMarks: number | null; // standardized out of 100.00
  annualGrade: GradeLabelValue | null;
  isPassing: boolean | null;
  status: "COMPLETE" | "INCOMPLETE";
}

export interface MultiTermReportCardData {
  school: {
    id: string;
    name: string;
    code: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  student: {
    id: string;
    admissionNumber: string;
    name: string;
    dateOfBirth: string | null;
    gender: string | null;
    category: string;
  };
  placement: {
    classId: string;
    className: string;
    sectionId: string;
    sectionName: string;
    academicYear: string;
  };
  terms: Array<{
    termName: string;
    cycleKey: string;
    weight: number;
    examCount: number;
  }>;
  subjects: MultiTermSubjectRow[];
  totals: {
    totalMaxMarks: number; // subjectCount * 100.00
    totalScaledMarks: number | null;
    overallPercentage: number | null;
    overallGrade: GradeLabelValue | null;
    overallResult: "PASS" | "FAIL" | "INCOMPLETE";
    passedCount: number;
    failedCount: number;
    incompleteCount: number;
    failedSubjectNames: string[];
    incompleteSubjectNames: string[];
  };
  attendance: ReportCardAttendanceSummary;
  remarks: ReportCardRemarkData | null;
  coScholastics: ReportCardCoScholasticData[];
  warnings: string[];
  generatedAt: string;
}

// ────────────────────── Server Actions ──────────────────────────────

/**
 * 1. getAvailableExamCyclesForSection
 * Discovers coherent evaluation cycles from actual Exam records for a class & section.
 * Guarantees that each cycle has at most one exam per subject so PT1 + PT2 are never combined.
 */
export async function getAvailableExamCyclesForSection(
  input: ExamCycleQueryInput
): Promise<ActionResult<ExamCycleOption[]>> {
  try {
    const ctx = await requireTenant();

    const parsed = examCycleQuerySchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid query parameters.";
      return { success: false, error: firstError };
    }

    const { classId, sectionId, academicYear } = parsed.data;

    // 1. Verify class and section ownership
    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        classId,
        schoolId: ctx.schoolId,
      },
      include: {
        class: { select: { id: true, name: true, academicYear: true } },
      },
    });

    if (!section) {
      return {
        success: false,
        error: "Section not found in your school records.",
      };
    }

    // 2. Fetch all exams in this class & section for this academic year
    const exams = await prisma.exam.findMany({
      where: {
        schoolId: ctx.schoolId,
        classId,
        sectionId,
        academicYear,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ examDate: "asc" }, { name: "asc" }],
    });

    if (exams.length === 0) {
      return { success: true, data: [] };
    }

    // 3. Group exams into distinct cycles based on name prefix or examType
    const cycleMap = new Map<
      string,
      {
        cycleName: string;
        examType: string;
        exams: typeof exams;
      }
    >();

    for (const ex of exams) {
      let baseName = ex.name.trim();
      if (baseName.includes(" - ")) {
        baseName = baseName.split(" - ")[0].trim();
      } else if (baseName.includes(": ")) {
        baseName = baseName.split(": ")[0].trim();
      }

      const cycleKey = `${ex.examType}::${baseName.toLowerCase()}`;

      if (!cycleMap.has(cycleKey)) {
        cycleMap.set(cycleKey, {
          cycleName: baseName,
          examType: ex.examType,
          exams: [],
        });
      }

      const grp = cycleMap.get(cycleKey)!;
      const subjectAlreadyInGroup = grp.exams.some(
        (e) => e.subjectId === ex.subjectId
      );
      if (!subjectAlreadyInGroup) {
        grp.exams.push(ex);
      } else {
        const fallbackKey = `${cycleKey}::sub-${ex.id}`;
        cycleMap.set(fallbackKey, {
          cycleName: `${baseName} (${ex.subject.code})`,
          examType: ex.examType,
          exams: [ex],
        });
      }
    }

    const cycles: ExamCycleOption[] = [];
    let idx = 0;
    for (const [, val] of cycleMap.entries()) {
      idx++;
      cycles.push({
        cycleId: `cycle-${idx}-${val.exams.map((e) => e.id).join("-").slice(0, 16)}`,
        cycleName: val.cycleName,
        examType: val.examType,
        examCount: val.exams.length,
        examIds: val.exams.map((e) => e.id),
        subjects: val.exams.map((e) => ({
          id: e.subject.id,
          name: e.subject.name,
          code: e.subject.code,
        })),
      });
    }

    return { success: true, data: cycles };
  } catch (err) {
    console.error("Error discovering exam cycles:", err);
    return {
      success: false,
      error: "An unexpected error occurred while discovering evaluation cycles.",
    };
  }
}

/**
 * 2. getBatchReportCardData
 * Efficient 7-query batched data engine eliminating per-student N+1 database round-trips.
 * Reuses pure compileReportCardData() in-memory per student.
 */
export async function getBatchReportCardData(
  input: BatchReportCardQueryInput
): Promise<ActionResult<ReportCardData[]>> {
  try {
    const ctx = await requireTenant();

    const parsed = batchReportCardQuerySchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid query parameters.";
      return { success: false, error: firstError };
    }

    const { studentIds, academicYear, examIds, cycleName, cycleKey } = parsed.data;

    // ────────────────────── Query 1 ──────────────────────
    // Fetch requested exams with Subject, Class, Section, and School
    const exams = await prisma.exam.findMany({
      where: {
        id: { in: examIds },
        schoolId: ctx.schoolId,
        academicYear,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        school: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: [{ subject: { name: "asc" } }],
    });

    if (exams.length === 0) {
      return {
        success: false,
        error: "No matching examinations found for this class, section, and academic year.",
      };
    }

    // Verify all exams belong to the same class and section
    const targetClassId = exams[0].classId;
    const targetSectionId = exams[0].sectionId;
    const hasMismatchedSection = exams.some(
      (e) => e.classId !== targetClassId || e.sectionId !== targetSectionId
    );
    if (hasMismatchedSection) {
      return {
        success: false,
        error: "All examinations in a report card cycle must belong to the same class and section.",
      };
    }

    // Duplicate Subject Protection Guard
    const seenSubjectIds = new Set<string>();
    for (const ex of exams) {
      if (seenSubjectIds.has(ex.subjectId)) {
        return {
          success: false,
          error: `Invalid cycle: multiple examinations found for subject '${ex.subject.name}'. Periodic tests cannot be combined.`,
        };
      }
      seenSubjectIds.add(ex.subjectId);
    }

    const schoolInfo = exams[0].school;
    const classInfo = exams[0].class;
    const sectionInfo = exams[0].section;

    // ────────────────────── Query 2 ──────────────────────
    // Fetch Target Students with active enrollment
    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        schoolId: ctx.schoolId,
      },
      include: {
        enrollments: {
          where: {
            classId: targetClassId,
            sectionId: targetSectionId,
            academicYear,
            status: "ACTIVE",
          },
          include: {
            class: { select: { id: true, name: true } },
            section: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    if (students.length === 0) {
      return {
        success: false,
        error: "Student not found in your school records.",
      };
    }

    // Verify student presence and tenant isolation
    const foundStudentIds = new Set(students.map((s) => s.id));
    const missingStudentIds = studentIds.filter((id) => !foundStudentIds.has(id));
    if (missingStudentIds.length > 0) {
      return {
        success: false,
        error: "One or more requested students could not be found in your school records.",
      };
    }

    // Role-based Access Boundaries
    if (ctx.role === "STUDENT") {
      const isSelf = students.length === 1 && students[0].userId === ctx.userId;
      if (!isSelf) {
        return {
          success: false,
          error: "Unauthorized: students can only access their own report card.",
        };
      }
    } else if (ctx.role === "PARENT") {
      const allLinked = students.every((s) => s.parentUserId === ctx.userId);
      if (!allLinked) {
        return {
          success: false,
          error: "Unauthorized: parents can only access report cards for their linked children.",
        };
      }
    }

    // Verify active enrollment for all students
    for (const s of students) {
      if (!s.enrollments[0]) {
        return {
          success: false,
          error: `Student has no active enrollment record for academic year ${academicYear}.`,
        };
      }
    }

    const targetStudentIds = students.map((s) => s.id);

    // ────────────────────── Query 3 ──────────────────────
    // Attendance total working sessions denominator for class/section/year
    const totalClassSessions = await prisma.attendanceSession.count({
      where: {
        schoolId: ctx.schoolId,
        classId: targetClassId,
        sectionId: targetSectionId,
        academicYear,
      },
    });

    // ────────────────────── Query 4 ──────────────────────
    // AttendanceRecord rows for all selected students in this class/section/year
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        schoolId: ctx.schoolId,
        studentId: { in: targetStudentIds },
        session: {
          classId: targetClassId,
          sectionId: targetSectionId,
          academicYear,
        },
      },
      select: {
        studentId: true,
        status: true,
      },
    });

    const attendanceByStudent = new Map<string, Array<{ status: string }>>();
    for (const rec of attendanceRecords) {
      if (!attendanceByStudent.has(rec.studentId)) {
        attendanceByStudent.set(rec.studentId, []);
      }
      attendanceByStudent.get(rec.studentId)!.push({ status: rec.status });
    }

    // ────────────────────── Query 5 ──────────────────────
    // ExamResult rows for selected exams and students
    const examResults = await prisma.examResult.findMany({
      where: {
        schoolId: ctx.schoolId,
        studentId: { in: targetStudentIds },
        examId: { in: exams.map((e) => e.id) },
      },
    });

    const resultsByStudent = new Map<string, typeof examResults>();
    for (const res of examResults) {
      if (!resultsByStudent.has(res.studentId)) {
        resultsByStudent.set(res.studentId, []);
      }
      resultsByStudent.get(res.studentId)!.push(res);
    }

    // ────────────────────── Query 6 ──────────────────────
    // ReportCardRemark rows for target students for this cycle
    const effectiveCycleName =
      cycleName ?? exams[0]?.examType.replace("_", " ") ?? "Examination";
    const effectiveCycleKey =
      cycleKey ??
      (exams[0]
        ? `${exams[0].examType}::${effectiveCycleName.trim().toLowerCase()}`
        : "");

    const remarks = await prisma.reportCardRemark.findMany({
      where: {
        schoolId: ctx.schoolId,
        studentId: { in: targetStudentIds },
        academicYear,
        cycleKey: effectiveCycleKey,
      },
      include: {
        author: { select: { name: true, role: true } },
      },
    });

    const remarksByStudent = new Map(remarks.map((r) => [r.studentId, r]));

    // ────────────────────── Query 7 ──────────────────────
    // CoScholasticEntry rows for target students for this term/cycle
    const coScholastics = await prisma.coScholasticEntry.findMany({
      where: {
        schoolId: ctx.schoolId,
        studentId: { in: targetStudentIds },
        academicYear,
        term: effectiveCycleName,
      },
      select: {
        studentId: true,
        activity: true,
        grade: true,
        remarks: true,
      },
      orderBy: { activity: "asc" },
    });

    const coScholasticsByStudent = new Map<string, typeof coScholastics>();
    for (const cs of coScholastics) {
      if (!coScholasticsByStudent.has(cs.studentId)) {
        coScholasticsByStudent.set(cs.studentId, []);
      }
      coScholasticsByStudent.get(cs.studentId)!.push(cs);
    }

    // ────────────────────── Pure In-Memory Compilation ──────────────────────
    const reportCards: ReportCardData[] = students.map((student) => {
      const studentResults = resultsByStudent.get(student.id) ?? [];
      const studentAttendance = attendanceByStudent.get(student.id) ?? [];
      const studentRemark = remarksByStudent.get(student.id) ?? null;
      const studentCoScholastics = coScholasticsByStudent.get(student.id) ?? [];

      return compileReportCardData({
        school: schoolInfo,
        student: {
          id: student.id,
          admissionNumber: student.admissionNumber,
          firstName: student.firstName,
          lastName: student.lastName,
          dateOfBirth: student.dateOfBirth,
          gender: student.gender,
          category: student.category,
        },
        placement: {
          classId: classInfo.id,
          className: classInfo.name,
          sectionId: sectionInfo.id,
          sectionName: sectionInfo.name,
          academicYear,
        },
        cycleName: effectiveCycleName,
        exams,
        examResults: studentResults,
        totalClassSessions,
        attendanceRecords: studentAttendance,
        remark: studentRemark,
        coScholastics: studentCoScholastics,
      });
    });

    return { success: true, data: reportCards };
  } catch (err) {
    console.error("Error in getBatchReportCardData:", err);
    return {
      success: false,
      error: "An unexpected error occurred while compiling batch report cards.",
    };
  }
}

/**
 * 3. getStudentReportCard
 * Single-student compilation reusing the shared 7-query engine to eliminate duplicated logic.
 * Preserves exact Stage 1 authorization, audit logging, and payload schema.
 */
export async function getStudentReportCard(
  input: ReportCardQueryInput
): Promise<ActionResult<ReportCardData>> {
  try {
    const ctx = await requireTenant();

    const parsed = reportCardQuerySchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid query parameters.";
      return { success: false, error: firstError };
    }

    const { studentId, academicYear, examIds, cycleName } = parsed.data;

    // Single student access verification
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId: ctx.schoolId },
      select: { id: true, userId: true, parentUserId: true },
    });

    if (!student) {
      return {
        success: false,
        error: "Student not found in your school records.",
      };
    }

    if (ctx.role === "STUDENT" && student.userId !== ctx.userId) {
      return {
        success: false,
        error: "Unauthorized: students can only access their own report card.",
      };
    }

    if (ctx.role === "PARENT" && student.parentUserId !== ctx.userId) {
      return {
        success: false,
        error: "Unauthorized: parents can only access report cards for their linked children.",
      };
    }

    // Delegate compilation through batch engine
    const batchRes = await getBatchReportCardData({
      studentIds: [studentId],
      academicYear,
      examIds,
      cycleName: cycleName ?? undefined,
    });

    if (!batchRes.success || !batchRes.data || batchRes.data.length === 0) {
      return {
        success: false,
        error: batchRes.error ?? "Failed to compile student report card.",
      };
    }

    // Emit Stage 1 Privacy-Preserving Audit Log
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "REPORT_CARD_VIEWED",
      entityType: "ReportCard",
      entityId: studentId,
      newValues: {
        studentId,
        academicYear,
        cycleName: cycleName ?? "Report Card",
        examCount: examIds.length,
        viewedByRole: ctx.role,
      },
    });

    return {
      success: true,
      data: batchRes.data[0],
    };
  } catch (err) {
    console.error("Error generating student report card:", err);
    return {
      success: false,
      error: "An unexpected error occurred while compiling the report card.",
    };
  }
}

/**
 * 4. getClassReportCardRoster
 * Retrieves enrolled students with their report-card readiness status: READY / PARTIAL / NO_MARKS.
 * Accessible to ADMIN and TEACHER.
 */
export async function getClassReportCardRoster(
  input: ClassReportCardRosterQueryInput
): Promise<ActionResult<ClassReportCardRosterItem[]>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error: "Unauthorized: only administrators and teachers can access class rosters.",
      };
    }

    const parsed = classReportCardRosterQuerySchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid query parameters.";
      return { success: false, error: firstError };
    }

    const { classId, sectionId, academicYear, examIds } = parsed.data;

    // Verify section ownership
    const section = await prisma.section.findFirst({
      where: { id: sectionId, classId, schoolId: ctx.schoolId },
    });
    if (!section) {
      return {
        success: false,
        error: "Section not found in your school records.",
      };
    }

    // Query active enrollments for this class, section, & year
    const enrollments = await prisma.enrollment.findMany({
      where: {
        schoolId: ctx.schoolId,
        classId,
        sectionId,
        academicYear,
        status: "ACTIVE",
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            firstName: true,
            lastName: true,
            gender: true,
          },
        },
      },
      orderBy: [
        { student: { lastName: "asc" } },
        { student: { firstName: "asc" } },
      ],
    });

    if (enrollments.length === 0) {
      return { success: true, data: [] };
    }

    // Query all results for these exams & students
    const studentIds = enrollments.map((e) => e.student.id);
    const results = await prisma.examResult.findMany({
      where: {
        schoolId: ctx.schoolId,
        examId: { in: examIds },
        studentId: { in: studentIds },
      },
    });

    const resultsByStudent = new Map<string, typeof results>();
    for (const r of results) {
      if (!resultsByStudent.has(r.studentId)) {
        resultsByStudent.set(r.studentId, []);
      }
      resultsByStudent.get(r.studentId)!.push(r);
    }

    const totalCount = examIds.length;

    const roster: ClassReportCardRosterItem[] = enrollments.map((enr) => {
      const student = enr.student;
      const studentResults = resultsByStudent.get(student.id) ?? [];
      const enteredCount = studentResults.length;

      let status: RosterStudentReadiness;
      if (enteredCount === 0) {
        status = "NO_MARKS";
      } else if (enteredCount < totalCount) {
        status = "PARTIAL";
      } else {
        status = "READY";
      }

      let overallPercentage: number | null = null;
      let overallGrade: GradeLabelValue | null = null;
      let overallResult: "PASS" | "FAIL" | null = null;

      if (enteredCount > 0) {
        const avgPct =
          studentResults.reduce((acc, r) => acc + r.percentage.toNumber(), 0) /
          enteredCount;
        overallPercentage = roundTo(avgPct, 2);
        overallGrade = computeGrade(overallPercentage);

        if (status === "READY") {
          const allPassing = studentResults.every((r) => r.isPassing);
          overallResult =
            allPassing && overallPercentage >= 33.0 ? "PASS" : "FAIL";
        }
      }

      return {
        studentId: student.id,
        admissionNumber: student.admissionNumber,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        gender: student.gender,
        status,
        enteredCount,
        totalCount,
        overallPercentage,
        overallGrade,
        overallResult,
      };
    });

    return { success: true, data: roster };
  } catch (err) {
    console.error("Error retrieving class report card roster:", err);
    return {
      success: false,
      error: "An unexpected error occurred while retrieving class roster.",
    };
  }
}

/**
 * 5. exportClassReportCardSummaryCsv
 * Generates an RFC-4180 compliant CSV tabulation register for an entire class/section cohort.
 * One row per student (wide table) with deterministic subject ordering.
 * Role-gated to ADMIN and TEACHER.
 */
export async function exportClassReportCardSummaryCsv(
  input: ExportReportCardsCsvInput
): Promise<ActionResult<{ filename: string; csvContent: string; totalStudents: number }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error: "Unauthorized: only administrators and teachers can export report card summaries.",
      };
    }

    const parsed = exportReportCardsCsvSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid query parameters.";
      return { success: false, error: firstError };
    }

    const { classId, sectionId, academicYear, examIds, cycleName, cycleKey } = parsed.data;

    // Fetch all active students enrolled in this section
    const enrollments = await prisma.enrollment.findMany({
      where: {
        schoolId: ctx.schoolId,
        classId,
        sectionId,
        academicYear,
        status: "ACTIVE",
      },
      select: { studentId: true },
      orderBy: { student: { admissionNumber: "asc" } },
    });

    if (enrollments.length === 0) {
      return {
        success: false,
        error: "No enrolled students found in this class and section.",
      };
    }

    const studentIds = enrollments.map((e) => e.studentId);

    // Fetch batch report card data
    const batchRes = await getBatchReportCardData({
      studentIds,
      academicYear,
      examIds,
      cycleName,
      cycleKey,
    });

    if (!batchRes.success || !batchRes.data || batchRes.data.length === 0) {
      return {
        success: false,
        error: batchRes.error ?? "Failed to compile report cards for export.",
      };
    }

    const reportCards = batchRes.data;
    const firstCard = reportCards[0];
    const subjectList = firstCard.subjects;

    // Build CSV Headers
    const headers: string[] = [
      "Sr No",
      "Admission No",
      "Student Name",
      "Gender",
      "Category",
    ];

    for (const sub of subjectList) {
      headers.push(
        `${sub.subjectName} Marks`,
        `${sub.subjectName} Max`,
        `${sub.subjectName} %`,
        `${sub.subjectName} Grade`
      );
    }

    headers.push(
      "Total Marks",
      "Max Marks",
      "Overall %",
      "Overall Grade",
      "Attended Days",
      "Total Sessions",
      "Attendance %",
      "Status",
      "Result"
    );

    const rows: string[] = [headers.map(escapeCsvCell).join(",")];

    // Build Student Rows
    reportCards.forEach((card, index) => {
      const row: string[] = [
        String(index + 1),
        card.student.admissionNumber,
        card.student.name,
        card.student.gender ?? "",
        card.student.category,
      ];

      for (const sub of card.subjects) {
        row.push(
          sub.marksObtained !== null ? String(sub.marksObtained) : (sub.status === "ABSENT" ? "AB" : "N/A"),
          String(sub.maxMarks),
          sub.percentage !== null ? `${sub.percentage}%` : "N/A",
          sub.grade ?? "N/A"
        );
      }

      row.push(
        String(card.totals.totalMarksObtained),
        String(card.totals.totalMaxMarks),
        `${card.totals.overallPercentage}%`,
        card.totals.overallGrade,
        String(card.attendance.attendedDays),
        String(card.attendance.totalClassSessions),
        `${card.attendance.attendancePercentage}%`,
        card.attendance.isCompliant ? "COMPLIANT" : "DEFAULTER",
        card.totals.overallResult
      );

      rows.push(row.map(escapeCsvCell).join(","));
    });

    const csvContent = "\uFEFF" + rows.join("\r\n"); // Prepend UTF-8 BOM
    const sanitizedCycle = cycleName.replace(/[^a-zA-Z0-9_\-]/g, "_");
    const filename = `Report_Cards_${firstCard.placement.className}_${firstCard.placement.sectionName}_${sanitizedCycle}.csv`;

    // Emit Audit Log with Metadata Only (Zero marks logged)
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "REPORT_CARDS_EXPORTED",
      entityType: "ReportCard",
      entityId: `${classId}_${sectionId}`,
      newValues: {
        classId,
        sectionId,
        academicYear,
        cycleName,
        totalStudentsExported: reportCards.length,
        format: "CSV",
      },
    });

    return {
      success: true,
      data: {
        filename,
        csvContent,
        totalStudents: reportCards.length,
      },
    };
  } catch (err) {
    console.error("Error exporting report card CSV:", err);
    return {
      success: false,
      error: "An unexpected error occurred while exporting report card CSV.",
    };
  }
}

/**
 * 6. saveTeacherRemark
 * Creates or updates persistent teacher appraisal remarks for a student in an evaluation cycle.
 * Scoped by stable cycleKey. Role-gated to ADMIN and TEACHER.
 */
export async function saveTeacherRemark(
  input: SaveTeacherRemarkInput
): Promise<ActionResult<{ id: string; cycleKey: string; action: "CREATED" | "UPDATED" }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error: "Unauthorized: only administrators and teachers can record appraisal remarks.",
      };
    }

    const parsed = saveTeacherRemarkSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid remark input.";
      return { success: false, error: firstError };
    }

    const { studentId, academicYear, cycleKey, cycleName, remarks } = parsed.data;

    // Verify student belongs to this school
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId: ctx.schoolId },
      include: {
        enrollments: {
          where: { academicYear, status: "ACTIVE" },
          take: 1,
        },
      },
    });

    if (!student) {
      return {
        success: false,
        error: "Student not found in your school records.",
      };
    }

    if (!student.enrollments[0]) {
      return {
        success: false,
        error: `Student has no active enrollment record for academic year ${academicYear}.`,
      };
    }

    const existing = await prisma.reportCardRemark.findUnique({
      where: {
        schoolId_studentId_academicYear_cycleKey: {
          schoolId: ctx.schoolId,
          studentId,
          academicYear,
          cycleKey,
        },
      },
    });

    const action = existing ? "UPDATED" : "CREATED";

    const saved = await prisma.reportCardRemark.upsert({
      where: {
        schoolId_studentId_academicYear_cycleKey: {
          schoolId: ctx.schoolId,
          studentId,
          academicYear,
          cycleKey,
        },
      },
      create: {
        schoolId: ctx.schoolId,
        studentId,
        academicYear,
        cycleKey,
        cycleName,
        remarks,
        authorId: ctx.userId,
      },
      update: {
        remarks,
        cycleName,
        authorId: ctx.userId,
      },
    });

    // Audit Log: Metadata Only (Zero raw remarks text logged)
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: existing ? "TEACHER_REMARK_UPDATED" : "TEACHER_REMARK_SAVED",
      entityType: "ReportCardRemark",
      entityId: saved.id,
      newValues: {
        studentId,
        academicYear,
        cycleKey,
        cycleName,
        remarkLength: remarks.length,
        authorId: ctx.userId,
        authorRole: ctx.role,
        action,
      },
    });

    return {
      success: true,
      data: {
        id: saved.id,
        cycleKey: saved.cycleKey,
        action,
      },
    };
  } catch (err) {
    console.error("Error saving teacher remark:", err);
    return {
      success: false,
      error: "An unexpected error occurred while saving teacher remarks.",
    };
  }
}

/**
 * Helper: Retrieve persistent remarks for all students in a section and cycle.
 */
export async function getTeacherRemarksForSection(input: {
  classId: string;
  sectionId: string;
  academicYear: string;
  cycleKey: string;
}): Promise<ActionResult<ReportCardRemarkData[]>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error: "Unauthorized: only administrators and teachers can inspect section remarks.",
      };
    }

    const { classId, sectionId, academicYear, cycleKey } = input;

    const remarks = await prisma.reportCardRemark.findMany({
      where: {
        schoolId: ctx.schoolId,
        academicYear,
        cycleKey,
        student: {
          enrollments: {
            some: {
              classId,
              sectionId,
              academicYear,
              status: "ACTIVE",
            },
          },
        },
      },
      include: {
        author: { select: { name: true, role: true } },
      },
    });

    const data: ReportCardRemarkData[] = remarks.map((r) => ({
      id: r.id,
      cycleKey: r.cycleKey,
      cycleName: r.cycleName,
      remarks: r.remarks,
      authorName: r.author.name,
      authorRole: r.author.role,
      updatedAt: r.updatedAt.toISOString(),
    }));

    return { success: true, data };
  } catch (err) {
    console.error("Error retrieving section remarks:", err);
    return {
      success: false,
      error: "An unexpected error occurred while fetching section remarks.",
    };
  }
}

/**
 * 7. saveCoScholasticGrades
 * Saves CBSE-mandated non-academic grades (A, B, C) for a student in a term.
 * Role-gated to ADMIN and TEACHER.
 */
export async function saveCoScholasticGrades(
  input: SaveCoScholasticInput
): Promise<ActionResult<{ count: number }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error: "Unauthorized: only administrators and teachers can record co-scholastic grades.",
      };
    }

    const parsed = saveCoScholasticSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid co-scholastic input.";
      return { success: false, error: firstError };
    }

    const { studentId, academicYear, term, entries } = parsed.data;

    // Verify student belongs to school
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId: ctx.schoolId },
      include: {
        enrollments: {
          where: { academicYear, status: "ACTIVE" },
          take: 1,
        },
      },
    });

    if (!student) {
      return {
        success: false,
        error: "Student not found in your school records.",
      };
    }

    // Atomic transaction for all activity entries
    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        await tx.coScholasticEntry.upsert({
          where: {
            schoolId_studentId_academicYear_term_activity: {
              schoolId: ctx.schoolId,
              studentId,
              academicYear,
              term,
              activity: entry.activity,
            },
          },
          create: {
            schoolId: ctx.schoolId,
            studentId,
            academicYear,
            term,
            activity: entry.activity,
            grade: entry.grade,
            remarks: entry.remarks ?? null,
            authorId: ctx.userId,
          },
          update: {
            grade: entry.grade,
            remarks: entry.remarks ?? null,
            authorId: ctx.userId,
          },
        });
      }
    });

    // Audit Log: Metadata Only
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "CO_SCHOLASTIC_RECORDED",
      entityType: "CoScholasticEntry",
      entityId: `${studentId}_${term}`,
      newValues: {
        studentId,
        academicYear,
        term,
        activitiesCount: entries.length,
        authorId: ctx.userId,
        authorRole: ctx.role,
      },
    });

    return { success: true, data: { count: entries.length } };
  } catch (err) {
    console.error("Error saving co-scholastic grades:", err);
    return {
      success: false,
      error: "An unexpected error occurred while saving co-scholastic grades.",
    };
  }
}

/**
 * Helper: Retrieve co-scholastic grades for all students in a section.
 */
export async function getCoScholasticForSection(input: {
  classId: string;
  sectionId: string;
  academicYear: string;
  term: string;
}): Promise<ActionResult<Array<{ studentId: string; activity: string; grade: string; remarks: string | null }>>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error: "Unauthorized: only administrators and teachers can inspect co-scholastic grades.",
      };
    }

    const { classId, sectionId, academicYear, term } = input;

    const entries = await prisma.coScholasticEntry.findMany({
      where: {
        schoolId: ctx.schoolId,
        academicYear,
        term,
        student: {
          enrollments: {
            some: {
              classId,
              sectionId,
              academicYear,
              status: "ACTIVE",
            },
          },
        },
      },
      select: {
        studentId: true,
        activity: true,
        grade: true,
        remarks: true,
      },
      orderBy: [{ studentId: "asc" }, { activity: "asc" }],
    });

    return { success: true, data: entries };
  } catch (err) {
    console.error("Error retrieving co-scholastic grades:", err);
    return {
      success: false,
      error: "An unexpected error occurred while fetching co-scholastic grades.",
    };
  }
}

/**
 * 8. getMultiTermReportCard
 * Pure on-demand annual multi-term synthesis combining dynamic evaluation cycles with explicit weights.
 * Applies standardized 100-point annual scaling.
 * Evaluates missing required exams as INCOMPLETE; evaluates ABSENT as 0 marks contributing normally.
 */
export async function getMultiTermReportCard(
  input: MultiTermCompilationInput
): Promise<ActionResult<MultiTermReportCardData>> {
  try {
    const ctx = await requireTenant();

    const parsed = multiTermCompilationSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid multi-term input.";
      return { success: false, error: firstError };
    }

    const { studentId, academicYear, terms } = parsed.data;

    // Fetch Student & verify tenant ownership
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId: ctx.schoolId },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            phone: true,
            email: true,
          },
        },
        enrollments: {
          where: { academicYear, status: "ACTIVE" },
          include: {
            class: { select: { id: true, name: true } },
            section: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!student) {
      return {
        success: false,
        error: "Student not found in your school records.",
      };
    }

    // Role-based Access Boundaries
    if (ctx.role === "STUDENT" && student.userId !== ctx.userId) {
      return {
        success: false,
        error: "Unauthorized: students can only access their own report card.",
      };
    }
    if (ctx.role === "PARENT" && student.parentUserId !== ctx.userId) {
      return {
        success: false,
        error: "Unauthorized: parents can only access report cards for their linked children.",
      };
    }

    const activeEnrollment = student.enrollments[0];
    if (!activeEnrollment) {
      return {
        success: false,
        error: `Student has no active enrollment record for academic year ${academicYear}.`,
      };
    }

    const targetClassId = activeEnrollment.classId;
    const targetSectionId = activeEnrollment.sectionId;

    // Collect all examIds across all terms
    const allExamIds = terms.flatMap((t) => t.examIds);

    // Fetch all requested exams with Subject
    const exams = await prisma.exam.findMany({
      where: {
        id: { in: allExamIds },
        schoolId: ctx.schoolId,
        classId: targetClassId,
        sectionId: targetSectionId,
        academicYear,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ subject: { name: "asc" } }],
    });

    const examMap = new Map(exams.map((e) => [e.id, e]));

    // Verify all exams exist
    for (const term of terms) {
      for (const eid of term.examIds) {
        if (!examMap.has(eid)) {
          return {
            success: false,
            error: `Examination ID '${eid}' for term '${term.termName}' could not be found.`,
          };
        }
      }
    }

    // Duplicate Subject Protection per term
    for (const term of terms) {
      const seenSubs = new Set<string>();
      for (const eid of term.examIds) {
        const ex = examMap.get(eid)!;
        if (seenSubs.has(ex.subjectId)) {
          return {
            success: false,
            error: `Duplicate subject '${ex.subject.name}' detected in term '${term.termName}'. Multiple exams for the same subject cannot be combined in one term.`,
          };
        }
        seenSubs.add(ex.subjectId);
      }
    }

    // Fetch student's ExamResults for all exams
    const results = await prisma.examResult.findMany({
      where: {
        schoolId: ctx.schoolId,
        studentId: student.id,
        examId: { in: allExamIds },
      },
    });

    const resultMap = new Map(results.map((r) => [r.examId, r]));

    // Build Distinct Subjects List across all terms
    const distinctSubjectsMap = new Map<string, { id: string; name: string; code: string }>();
    for (const ex of exams) {
      distinctSubjectsMap.set(ex.subjectId, ex.subject);
    }
    const distinctSubjects = Array.from(distinctSubjectsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    const warnings: string[] = [];
    let hasAnyIncompleteExam = false;
    let passedCount = 0;
    let failedCount = 0;
    let incompleteCount = 0;
    const failedSubjectNames: string[] = [];
    const incompleteSubjectNames: string[] = [];

    const subjectRows: MultiTermSubjectRow[] = distinctSubjects.map((sub) => {
      const termScores: MultiTermSubjectTermScore[] = [];
      let isSubjectIncomplete = false;
      let weightedSum = 0;

      for (const term of terms) {
        // Find exam for this subject in this term
        const termExamId = term.examIds.find(
          (eid) => examMap.get(eid)?.subjectId === sub.id
        );

        if (!termExamId) {
          // Exam was not configured in this term for this subject
          isSubjectIncomplete = true;
          warnings.push(`Missing examination for ${sub.name} in ${term.termName}.`);
          termScores.push({
            termName: term.termName,
            cycleKey: term.cycleKey,
            weight: term.weight,
            maxMarks: 0,
            marksObtained: null,
            percentage: null,
            status: "MISSING",
          });
          continue;
        }

        const ex = examMap.get(termExamId)!;
        const res = resultMap.get(termExamId);
        const maxMarks = toNum(ex.maxMarks);

        if (!res) {
          // Required exam was conducted but student has no result recorded
          isSubjectIncomplete = true;
          warnings.push(`Pending marks entry for ${sub.name} in ${term.termName}.`);
          termScores.push({
            termName: term.termName,
            cycleKey: term.cycleKey,
            weight: term.weight,
            maxMarks,
            marksObtained: null,
            percentage: null,
            status: "MISSING",
          });
          continue;
        }

        const remarksUpper = res.remarks?.toUpperCase() ?? "";
        const isAbsent = remarksUpper === "ABSENT" || remarksUpper === "AB";

        if (isAbsent) {
          // Explicitly absent: 0 marks, contributes to calculation
          termScores.push({
            termName: term.termName,
            cycleKey: term.cycleKey,
            weight: term.weight,
            maxMarks,
            marksObtained: 0,
            percentage: 0.0,
            status: "ABSENT",
          });
          // 0 contributes 0 to weightedSum
        } else {
          const marksObtained = toNum(res.marksObtained);
          const termPct = maxMarks > 0 ? roundTo((marksObtained / maxMarks) * 100, 2) : 0;
          weightedSum += termPct * (term.weight / 100);
          termScores.push({
            termName: term.termName,
            cycleKey: term.cycleKey,
            weight: term.weight,
            maxMarks,
            marksObtained,
            percentage: termPct,
            status: "ENTERED",
          });
        }
      }

      if (isSubjectIncomplete) {
        hasAnyIncompleteExam = true;
        incompleteCount++;
        incompleteSubjectNames.push(sub.name);
        return {
          subjectId: sub.id,
          subjectName: sub.name,
          subjectCode: sub.code,
          termScores,
          annualWeightedPercentage: null,
          annualScaledMarks: null,
          annualGrade: null,
          isPassing: null,
          status: "INCOMPLETE",
        };
      }

      const annualWeightedPercentage = roundTo(weightedSum, 2);
      const annualScaledMarks = annualWeightedPercentage; // Standardized out of 100.00
      const annualGrade = computeGrade(annualWeightedPercentage);
      const isPassing = annualWeightedPercentage >= 33.0;

      if (isPassing) {
        passedCount++;
      } else {
        failedCount++;
        failedSubjectNames.push(sub.name);
      }

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        termScores,
        annualWeightedPercentage,
        annualScaledMarks,
        annualGrade,
        isPassing,
        status: "COMPLETE",
      };
    });

    // Grand Totals Evaluation
    const totalMaxMarks = distinctSubjects.length * 100.0;
    let totalScaledMarks: number | null = null;
    let overallPercentage: number | null = null;
    let overallGrade: GradeLabelValue | null = null;
    let overallResult: "PASS" | "FAIL" | "INCOMPLETE";

    if (hasAnyIncompleteExam) {
      overallResult = "INCOMPLETE";
    } else {
      totalScaledMarks = subjectRows.reduce(
        (acc, s) => acc + (s.annualScaledMarks ?? 0),
        0
      );
      totalScaledMarks = roundTo(totalScaledMarks, 2);
      overallPercentage =
        totalMaxMarks > 0 ? roundTo((totalScaledMarks / totalMaxMarks) * 100, 2) : 0;
      overallGrade = computeGrade(overallPercentage);
      const allPassed = subjectRows.every((s) => s.isPassing === true);
      overallResult = allPassed && overallPercentage >= 33.0 ? "PASS" : "FAIL";
    }

    // Cumulative Attendance Integration for entire year
    const totalClassSessions = await prisma.attendanceSession.count({
      where: {
        schoolId: ctx.schoolId,
        classId: targetClassId,
        sectionId: targetSectionId,
        academicYear,
      },
    });

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        schoolId: ctx.schoolId,
        studentId: student.id,
        session: {
          classId: targetClassId,
          sectionId: targetSectionId,
          academicYear,
        },
      },
    });

    let presentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let excusedCount = 0;

    for (const rec of attendanceRecords) {
      if (rec.status === "PRESENT") presentCount++;
      else if (rec.status === "LATE") lateCount++;
      else if (rec.status === "HALF_DAY") halfDayCount++;
      else if (rec.status === "ABSENT") absentCount++;
      else if (rec.status === "EXCUSED") excusedCount++;
    }

    const studentSessions = attendanceRecords.length;
    const attendedDays = presentCount * 1.0 + lateCount * 1.0 + halfDayCount * 0.5;
    const attendancePercentage =
      studentSessions > 0
        ? roundTo((attendedDays / studentSessions) * 100, 1)
        : 0.0;
    const isCompliant = attendancePercentage >= 75.0;
    const isPartialHistory = studentSessions < totalClassSessions;

    // Fetch Annual Persistent Remark (cycleKey: ANNUAL::annual)
    const annualRemark = await prisma.reportCardRemark.findUnique({
      where: {
        schoolId_studentId_academicYear_cycleKey: {
          schoolId: ctx.schoolId,
          studentId: student.id,
          academicYear,
          cycleKey: "ANNUAL::annual",
        },
      },
      include: {
        author: { select: { name: true, role: true } },
      },
    });

    const remarksData: ReportCardRemarkData | null = annualRemark
      ? {
          id: annualRemark.id,
          cycleKey: annualRemark.cycleKey,
          cycleName: annualRemark.cycleName,
          remarks: annualRemark.remarks,
          authorName: annualRemark.author.name,
          authorRole: annualRemark.author.role,
          updatedAt: annualRemark.updatedAt.toISOString(),
        }
      : null;

    // Fetch Annual Co-Scholastic Entries
    const coScholastics = await prisma.coScholasticEntry.findMany({
      where: {
        schoolId: ctx.schoolId,
        studentId: student.id,
        academicYear,
        term: "Annual",
      },
      select: {
        activity: true,
        grade: true,
        remarks: true,
      },
      orderBy: { activity: "asc" },
    });

    // Emit Audit Log with Metadata Only
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "ANNUAL_REPORT_CARD_COMPILED",
      entityType: "ReportCard",
      entityId: student.id,
      newValues: {
        studentId: student.id,
        academicYear,
        termCount: terms.length,
        overallResult,
        hasWarnings: warnings.length > 0,
      },
    });

    return {
      success: true,
      data: {
        school: {
          id: student.school.id,
          name: student.school.name,
          code: student.school.code,
          address: student.school.address,
          phone: student.school.phone,
          email: student.school.email,
        },
        student: {
          id: student.id,
          admissionNumber: student.admissionNumber,
          name: `${student.firstName} ${student.lastName}`.trim(),
          dateOfBirth: student.dateOfBirth
            ? student.dateOfBirth.toISOString().split("T")[0]
            : null,
          gender: student.gender,
          category: student.category,
        },
        placement: {
          classId: targetClassId,
          className: activeEnrollment.class.name,
          sectionId: targetSectionId,
          sectionName: activeEnrollment.section.name,
          academicYear,
        },
        terms: terms.map((t) => ({
          termName: t.termName,
          cycleKey: t.cycleKey,
          weight: t.weight,
          examCount: t.examIds.length,
        })),
        subjects: subjectRows,
        totals: {
          totalMaxMarks,
          totalScaledMarks,
          overallPercentage,
          overallGrade,
          overallResult,
          passedCount,
          failedCount,
          incompleteCount,
          failedSubjectNames,
          incompleteSubjectNames,
        },
        attendance: {
          totalClassSessions,
          studentSessions,
          attendedDays,
          presentCount,
          lateCount,
          halfDayCount,
          absentCount,
          excusedCount,
          attendancePercentage,
          isCompliant,
          isPartialHistory,
        },
        remarks: remarksData,
        coScholastics,
        warnings,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    console.error("Error in getMultiTermReportCard:", err);
    return {
      success: false,
      error: "An unexpected error occurred while compiling annual multi-term report card.",
    };
  }
}

/**
 * 9. recordReportCardPrintAudit
 * Records single-student report card printing in AuditLog (Metadata only).
 */
export async function recordReportCardPrintAudit(
  input: ReportCardPrintAuditInput
): Promise<ActionResult<{ recorded: boolean }>> {
  try {
    const ctx = await requireTenant();

    const parsed = reportCardPrintAuditSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid print audit payload." };
    }

    const { studentId, academicYear, cycleName, examCount } = parsed.data;

    // Verify student belongs to this school
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId: ctx.schoolId },
      select: { id: true },
    });

    if (!student) {
      return { success: false, error: "Student not found in your school records." };
    }

    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "REPORT_CARD_PRINTED",
      entityType: "ReportCard",
      entityId: studentId,
      newValues: {
        studentId,
        academicYear,
        cycleName: cycleName ?? "Report Card",
        examCount,
        printedByRole: ctx.role,
      },
    });

    return { success: true, data: { recorded: true } };
  } catch (err) {
    console.error("Error recording report card print audit:", err);
    return { success: false, error: "Failed to record print audit." };
  }
}

/**
 * 10. recordBatchReportCardPrintAudit
 * Records batch report card printing in AuditLog (Metadata only).
 */
export async function recordBatchReportCardPrintAudit(input: {
  classId: string;
  sectionId: string;
  academicYear: string;
  cycleName: string;
  studentCount: number;
}): Promise<ActionResult<{ recorded: boolean }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error: "Unauthorized: only administrators and teachers can record batch print audits.",
      };
    }

    const { classId, sectionId, academicYear, cycleName, studentCount } = input;

    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "BATCH_REPORT_CARDS_PRINTED",
      entityType: "ReportCard",
      entityId: `${classId}_${sectionId}`,
      newValues: {
        classId,
        sectionId,
        academicYear,
        cycleName,
        studentCount,
        printedByRole: ctx.role,
      },
    });

    return { success: true, data: { recorded: true } };
  } catch (err) {
    console.error("Error recording batch print audit:", err);
    return { success: false, error: "Failed to record batch print audit." };
  }
}
