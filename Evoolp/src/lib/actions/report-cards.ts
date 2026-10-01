"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { computeGrade, type GradeLabelValue } from "@/lib/utils/exam";
import {
  examCycleQuerySchema,
  reportCardQuerySchema,
  classReportCardRosterQuerySchema,
  reportCardPrintAuditSchema,
  type ExamCycleQueryInput,
  type ReportCardQueryInput,
  type ClassReportCardRosterQueryInput,
  type ReportCardPrintAuditInput,
} from "@/lib/validations/report-card";
import type { ActionResult } from "./classes";

// ─────────────────────────── Pure Helpers ───────────────────────────

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
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

export interface ReportCardSubjectRow {
  examId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  maxMarks: number;
  passingMarks: number;
  marksObtained: number | null;
  percentage: number | null;
  grade: GradeLabelValue | null;
  isPassing: boolean | null;
  remarks: string | null;
  status: "ENTERED" | "ABSENT" | "PENDING";
}

export interface ReportCardAttendanceSummary {
  totalClassSessions: number;
  studentSessions: number;
  attendedDays: number;
  presentCount: number;
  lateCount: number;
  halfDayCount: number;
  absentCount: number;
  excusedCount: number;
  attendancePercentage: number;
  isCompliant: boolean;
  isPartialHistory: boolean;
}

export interface ReportCardTotals {
  totalMaxMarks: number;
  totalMarksObtained: number;
  overallPercentage: number;
  overallGrade: GradeLabelValue;
  overallResult: "PASS" | "FAIL";
  totalSubjects: number;
  passedCount: number;
  failedCount: number;
  pendingCount: number;
  failedSubjectNames: string[];
}

export interface ReportCardData {
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
  cycleName: string;
  subjects: ReportCardSubjectRow[];
  totals: ReportCardTotals;
  attendance: ReportCardAttendanceSummary;
  generatedAt: string;
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
    // E.g. "Periodic Test 1 - Mathematics" -> cycle: "Periodic Test 1"
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

      // Format cycle key
      const cycleKey = `${ex.examType}::${baseName.toLowerCase()}`;

      if (!cycleMap.has(cycleKey)) {
        cycleMap.set(cycleKey, {
          cycleName: baseName,
          examType: ex.examType,
          exams: [],
        });
      }

      const grp = cycleMap.get(cycleKey)!;
      // Prevent duplicate subject within the same cycle group
      const subjectAlreadyInGroup = grp.exams.some(
        (e) => e.subjectId === ex.subjectId
      );
      if (!subjectAlreadyInGroup) {
        grp.exams.push(ex);
      } else {
        // If the same subject already exists with the same base name, assign to a sub-cycle
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
      error: "An unexpected error occurred while loading exam cycles.",
    };
  }
}

/**
 * 2. getStudentReportCard
 * Compiles an official, isolated single-student report card for exact examIds.
 * Enforces strict subject uniqueness, correct attendance denominator, and role-based privacy.
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

    // 1. Fetch student & verify tenant ownership
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        schoolId: ctx.schoolId,
      },
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
          where: {
            status: "ACTIVE",
            academicYear,
          },
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

    // 2. Role-based Access Boundaries
    if (ctx.role === "STUDENT") {
      if (student.userId !== ctx.userId) {
        return {
          success: false,
          error: "Unauthorized: students can only access their own report card.",
        };
      }
    } else if (ctx.role === "PARENT") {
      if (student.parentUserId !== ctx.userId) {
        return {
          success: false,
          error: "Unauthorized: parents can only access report cards for their linked children.",
        };
      }
    }
    // Note for TEACHER & ADMIN: Teachers have tenant-wide read-only visibility in Stage 1 MVP.

    const activeEnrollment = student.enrollments[0];
    if (!activeEnrollment) {
      return {
        success: false,
        error: `Student has no active enrollment record for academic year ${academicYear}.`,
      };
    }

    // 3. Query exact requested exams
    const exams = await prisma.exam.findMany({
      where: {
        id: { in: examIds },
        schoolId: ctx.schoolId,
        classId: activeEnrollment.classId,
        sectionId: activeEnrollment.sectionId,
        academicYear,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ subject: { name: "asc" } }],
    });

    if (exams.length === 0) {
      return {
        success: false,
        error: "No matching examinations found for this class, section, and academic year.",
      };
    }

    // 4. DUPLICATE SUBJECT PROTECTION GUARD (Mandatory Requirement)
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

    // 5. Query student's ExamResult records for these exams
    const results = await prisma.examResult.findMany({
      where: {
        schoolId: ctx.schoolId,
        studentId: student.id,
        examId: { in: exams.map((e) => e.id) },
      },
    });

    const resultMap = new Map(results.map((r) => [r.examId, r]));

    // 6. Build Subject-Wise Performance Rows
    let totalMaxMarks = 0;
    let totalMarksObtained = 0;
    let passedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    const failedSubjectNames: string[] = [];

    const subjectRows: ReportCardSubjectRow[] = exams.map((ex) => {
      const res = resultMap.get(ex.id);
      const maxMarks = ex.maxMarks.toNumber();
      const passingMarks = ex.passingMarks.toNumber();

      if (!res) {
        pendingCount++;
        return {
          examId: ex.id,
          subjectId: ex.subject.id,
          subjectName: ex.subject.name,
          subjectCode: ex.subject.code,
          maxMarks,
          passingMarks,
          marksObtained: null,
          percentage: null,
          grade: null,
          isPassing: null,
          remarks: null,
          status: "PENDING",
        };
      }

      const marksObtained = res.marksObtained.toNumber();
      const percentage = res.percentage.toNumber();
      const grade = res.grade as GradeLabelValue;
      const isPassing = res.isPassing;
      const remarks = res.remarks ?? null;
      const isAbsent =
        remarks?.toUpperCase() === "ABSENT" ||
        remarks?.toUpperCase() === "AB";

      totalMaxMarks += maxMarks;
      totalMarksObtained += marksObtained;

      if (isPassing) {
        passedCount++;
      } else {
        failedCount++;
        failedSubjectNames.push(ex.subject.name);
      }

      return {
        examId: ex.id,
        subjectId: ex.subject.id,
        subjectName: ex.subject.name,
        subjectCode: ex.subject.code,
        maxMarks,
        passingMarks,
        marksObtained,
        percentage,
        grade,
        isPassing,
        remarks,
        status: isAbsent ? "ABSENT" : "ENTERED",
      };
    });

    // 7. Academic Totals & Evaluation
    const overallPercentage =
      totalMaxMarks > 0
        ? roundTo((totalMarksObtained / totalMaxMarks) * 100, 2)
        : 0;
    const overallGrade = computeGrade(overallPercentage);
    const overallResult: "PASS" | "FAIL" =
      failedCount === 0 && pendingCount === 0 && overallPercentage >= 33.0
        ? "PASS"
        : "FAIL";

    // 8. Attendance Summary Integration (Correct Denominators)
    // Institutional Denominator: total working sessions conducted for this class & section
    const totalClassSessions = await prisma.attendanceSession.count({
      where: {
        schoolId: ctx.schoolId,
        classId: activeEnrollment.classId,
        sectionId: activeEnrollment.sectionId,
        academicYear,
      },
    });

    // Student Numerator: student's AttendanceRecords in that class, section, & year
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        schoolId: ctx.schoolId,
        studentId: student.id,
        session: {
          classId: activeEnrollment.classId,
          sectionId: activeEnrollment.sectionId,
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

    // 9. Emit Privacy-Preserving Audit Log (Metadata only, ZERO marks or grades)
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "REPORT_CARD_VIEWED",
      entityType: "ReportCard",
      entityId: student.id,
      newValues: {
        studentId: student.id,
        academicYear,
        cycleName: cycleName ?? "Report Card",
        examCount: exams.length,
        viewedByRole: ctx.role,
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
          classId: activeEnrollment.classId,
          className: activeEnrollment.class.name,
          sectionId: activeEnrollment.sectionId,
          sectionName: activeEnrollment.section.name,
          academicYear,
        },
        cycleName: cycleName ?? exams[0]?.examType.replace("_", " ") ?? "Examination",
        subjects: subjectRows,
        totals: {
          totalMaxMarks,
          totalMarksObtained,
          overallPercentage,
          overallGrade,
          overallResult,
          totalSubjects: exams.length,
          passedCount,
          failedCount,
          pendingCount,
          failedSubjectNames,
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
        generatedAt: new Date().toISOString(),
      },
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
 * 3. getClassReportCardRoster
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

    // 1. Verify class & section ownership
    const section = await prisma.section.findFirst({
      where: { id: sectionId, classId, schoolId: ctx.schoolId },
      select: { id: true, name: true },
    });

    if (!section) {
      return { success: false, error: "Section not found in your school records." };
    }

    // 2. Fetch active enrollments
    const enrollments = await prisma.enrollment.findMany({
      where: {
        schoolId: ctx.schoolId,
        classId,
        sectionId,
        academicYear,
        status: "ACTIVE",
        student: { status: "ACTIVE" },
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

    // 3. Fetch existing exam results for these exams
    const studentIds = enrollments.map((e) => e.student.id);
    const results = await prisma.examResult.findMany({
      where: {
        schoolId: ctx.schoolId,
        studentId: { in: studentIds },
        examId: { in: examIds },
      },
      include: {
        exam: { select: { maxMarks: true } },
      },
    });

    const resultsByStudent = new Map<string, typeof results>();
    for (const r of results) {
      const list = resultsByStudent.get(r.studentId) ?? [];
      list.push(r);
      resultsByStudent.set(r.studentId, list);
    }

    const totalCycleExams = examIds.length;

    const roster: ClassReportCardRosterItem[] = enrollments.map((e) => {
      const st = e.student;
      const stResults = resultsByStudent.get(st.id) ?? [];
      const enteredCount = stResults.length;

      let status: RosterStudentReadiness = "NO_MARKS";
      if (enteredCount === totalCycleExams) {
        status = "READY";
      } else if (enteredCount > 0) {
        status = "PARTIAL";
      }

      let overallPercentage: number | null = null;
      let overallGrade: GradeLabelValue | null = null;
      let overallResult: "PASS" | "FAIL" | null = null;

      if (enteredCount > 0) {
        let maxSum = 0;
        let obtSum = 0;
        let failCount = 0;

        for (const r of stResults) {
          maxSum += r.exam.maxMarks.toNumber();
          obtSum += r.marksObtained.toNumber();
          if (!r.isPassing) failCount++;
        }

        overallPercentage = maxSum > 0 ? roundTo((obtSum / maxSum) * 100, 2) : 0;
        overallGrade = computeGrade(overallPercentage);
        if (status === "READY") {
          overallResult =
            failCount === 0 && overallPercentage >= 33.0 ? "PASS" : "FAIL";
        }
      }

      return {
        studentId: st.id,
        admissionNumber: st.admissionNumber,
        studentName: `${st.firstName} ${st.lastName}`.trim(),
        gender: st.gender,
        status,
        enteredCount,
        totalCount: totalCycleExams,
        overallPercentage,
        overallGrade,
        overallResult,
      };
    });

    return { success: true, data: roster };
  } catch (err) {
    console.error("Error fetching class report card roster:", err);
    return {
      success: false,
      error: "An unexpected error occurred while loading the class roster.",
    };
  }
}

/**
 * 4. recordReportCardPrintAudit
 * Records an official REPORT_CARD_PRINTED audit log before browser printing.
 * Strictly records metadata only — NEVER raw marks, percentages, or grades!
 */
export async function recordReportCardPrintAudit(
  input: ReportCardPrintAuditInput
): Promise<ActionResult<{ logged: boolean }>> {
  try {
    const ctx = await requireTenant();

    const parsed = reportCardPrintAuditSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid print audit parameters." };
    }

    const { studentId, academicYear, cycleName, examCount } = parsed.data;

    // Verify student belongs to this tenant
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId: ctx.schoolId },
      select: { id: true, userId: true, parentUserId: true },
    });

    if (!student) {
      return { success: false, error: "Student not found in school records." };
    }

    // Role checks
    if (ctx.role === "STUDENT" && student.userId !== ctx.userId) {
      return { success: false, error: "Unauthorized." };
    }
    if (ctx.role === "PARENT" && student.parentUserId !== ctx.userId) {
      return { success: false, error: "Unauthorized." };
    }

    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "REPORT_CARD_PRINTED",
      entityType: "ReportCard",
      entityId: student.id,
      newValues: {
        studentId: student.id,
        academicYear,
        cycleName: cycleName ?? "Report Card",
        examCount,
        printedByRole: ctx.role,
        printedByUserId: ctx.userId,
      },
    });

    return { success: true, data: { logged: true } };
  } catch (err) {
    console.error("Error logging print audit:", err);
    // Audit failures should not block operation
    return { success: true, data: { logged: false } };
  }
}
