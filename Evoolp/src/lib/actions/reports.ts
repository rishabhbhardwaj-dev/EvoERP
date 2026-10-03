"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import type { Prisma } from "@prisma/client";
import {
  reportQuerySchema,
  type ReportQueryInput,
  type ReportType,
} from "@/lib/validations/report";
import type { ActionResult } from "./classes";

export interface EnrollmentReportData {
  totalStudents: number;
  activeStudents: number;
  inactiveStudents: number;
  classDistribution: Array<{
    classId: string;
    className: string;
    academicYear: string;
    totalStudents: number;
    activeStudents: number;
  }>;
  sectionDistribution: Array<{
    sectionId: string;
    sectionName: string;
    className: string;
    studentCount: number;
  }>;
  genderDistribution: {
    male: number;
    female: number;
    other: number;
    unspecified: number;
  };
}

export interface ClassAttendanceComparisonRow {
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
  excusedCount: number;
  attendancePercentage: number;
  defaultersCount: number;
}

export interface CbseShortageRiskRow {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  rollNumber: string | null;
  className: string;
  sectionName: string;
  totalRecordedDays: number;
  effectiveAttendedDays: number;
  attendancePercentage: number;
  isDefaulter: boolean;
}

export interface AttendanceReportData {
  totalSessions: number;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
  excusedCount: number;
  overallPercentage: number;
  classComparison: ClassAttendanceComparisonRow[];
  cbseShortageRiskList: CbseShortageRiskRow[];
}

export interface SubjectPerformanceRow {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  examCount: number;
  totalResults: number;
  passedCount: number;
  passPercentage: number;
  averageMarks: number;
  highestMarks: number;
  lowestMarks: number;
}

export interface AcademicReportData {
  totalExams: number;
  totalResults: number;
  passedCount: number;
  failedCount: number;
  passPercentage: number;
  overallAverageMarks: number;
  gradeDistribution: {
    A1: number;
    A2: number;
    B1: number;
    B2: number;
    C1: number;
    C2: number;
    D: number;
    E: number;
  };
  subjectPerformance: SubjectPerformanceRow[];
}

export interface ReportsWorkspaceData {
  role: string;
  reportType: ReportType;
  classesList: Array<{ id: string; name: string; academicYear: string }>;
  sectionsList: Array<{ id: string; name: string; classId: string }>;
  enrollment?: EnrollmentReportData;
  attendance?: AttendanceReportData;
  academic?: AcademicReportData;
}

export interface ReportCsvExportResult {
  filename: string;
  csvContent: string;
}

/**
 * Escapes CSV cell value according to RFC-4180.
 */
function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Retrieves Enrollment report data.
 */
export async function getEnrollmentReportData(
  input?: ReportQueryInput
): Promise<ActionResult<EnrollmentReportData>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return { success: false, error: "Unauthorized access to reports." };
    }

    const parsed = reportQuerySchema.safeParse(input ?? {});
    const { classId, sectionId, academicYear } = parsed.success ? parsed.data : {};

    const studentWhere: Prisma.StudentWhereInput = { schoolId: ctx.schoolId };

    if (classId || sectionId || academicYear) {
      studentWhere.enrollments = {
        some: {
          schoolId: ctx.schoolId,
          ...(classId ? { classId } : {}),
          ...(sectionId ? { sectionId } : {}),
          ...(academicYear ? { academicYear } : {}),
        },
      };
    }

    const students = await prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        status: true,
        gender: true,
        enrollments: {
          where: { schoolId: ctx.schoolId },
          select: {
            class: { select: { id: true, name: true, academicYear: true } },
            section: { select: { id: true, name: true } },
            status: true,
          },
        },
      },
    });

    const totalStudents = students.length;
    const activeStudents = students.filter((s) => s.status === "ACTIVE").length;
    const inactiveStudents = totalStudents - activeStudents;

    // Gender distribution
    const genderMap = { male: 0, female: 0, other: 0, unspecified: 0 };
    students.forEach((s) => {
      const g = (s.gender ?? "").toUpperCase();
      if (g === "MALE" || g === "M") genderMap.male++;
      else if (g === "FEMALE" || g === "F") genderMap.female++;
      else if (g === "OTHER" || g === "O") genderMap.other++;
      else genderMap.unspecified++;
    });

    // Class distribution
    const classMap = new Map<
      string,
      { classId: string; className: string; academicYear: string; total: number; active: number }
    >();

    const sectionMap = new Map<
      string,
      { sectionId: string; sectionName: string; className: string; studentCount: number }
    >();

    students.forEach((s) => {
      s.enrollments.forEach((e) => {
        const cKey = e.class.id;
        if (!classMap.has(cKey)) {
          classMap.set(cKey, {
            classId: e.class.id,
            className: e.class.name,
            academicYear: e.class.academicYear,
            total: 0,
            active: 0,
          });
        }
        const cItem = classMap.get(cKey)!;
        cItem.total++;
        if (s.status === "ACTIVE" && e.status === "ACTIVE") cItem.active++;

        const sKey = e.section.id;
        if (!sectionMap.has(sKey)) {
          sectionMap.set(sKey, {
            sectionId: e.section.id,
            sectionName: e.section.name,
            className: e.class.name,
            studentCount: 0,
          });
        }
        sectionMap.get(sKey)!.studentCount++;
      });
    });

    const classDistribution = Array.from(classMap.values()).map((c) => ({
      classId: c.classId,
      className: c.className,
      academicYear: c.academicYear,
      totalStudents: c.total,
      activeStudents: c.active,
    }));

    const sectionDistribution = Array.from(sectionMap.values()).sort((a, b) =>
      a.className.localeCompare(b.className) || a.sectionName.localeCompare(b.sectionName)
    );

    return {
      success: true,
      data: {
        totalStudents,
        activeStudents,
        inactiveStudents,
        classDistribution,
        sectionDistribution,
        genderDistribution: genderMap,
      },
    };
  } catch (err) {
    console.error("Error fetching enrollment report data:", err);
    return { success: false, error: "Failed to generate enrollment report." };
  }
}

/**
 * Retrieves Attendance report data & analytics.
 */
export async function getAttendanceReportData(
  input?: ReportQueryInput
): Promise<ActionResult<AttendanceReportData>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return { success: false, error: "Unauthorized access to reports." };
    }

    const parsed = reportQuerySchema.safeParse(input ?? {});
    const { classId, sectionId, startDate, endDate } = parsed.success ? parsed.data : {};

    const sessionWhere: Prisma.AttendanceSessionWhereInput = { schoolId: ctx.schoolId };
    if (classId) sessionWhere.classId = classId;
    if (sectionId) sessionWhere.sectionId = sectionId;

    if (startDate || endDate) {
      sessionWhere.date = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }

    const sessions = await prisma.attendanceSession.findMany({
      where: sessionWhere,
      select: {
        id: true,
        classId: true,
        sectionId: true,
        date: true,
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        records: {
          select: {
            id: true,
            studentId: true,
            status: true,
            student: { select: { firstName: true, lastName: true, admissionNumber: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    const totalSessions = sessions.length;

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let excusedCount = 0;
    let totalRecords = 0;

    // Per-class comparison map
    const classCompMap = new Map<
      string,
      {
        classId: string;
        className: string;
        sectionId: string;
        sectionName: string;
        sessionsCount: number;
        present: number;
        absent: number;
        late: number;
        halfDay: number;
        excused: number;
        studentStatsMap: Map<string, { total: number; attended: number }>;
      }
    >();

    // Per-student attendance aggregator for CBSE shortage risk
    const studentAggMap = new Map<
      string,
      {
        studentId: string;
        name: string;
        admissionNumber: string;
        rollNumber: string | null;
        className: string;
        sectionName: string;
        total: number;
        attended: number;
      }
    >();

    sessions.forEach((sess) => {
      const compKey = `${sess.classId}_${sess.sectionId}`;
      if (!classCompMap.has(compKey)) {
        classCompMap.set(compKey, {
          classId: sess.classId,
          className: sess.class.name,
          sectionId: sess.sectionId,
          sectionName: sess.section.name,
          sessionsCount: 0,
          present: 0,
          absent: 0,
          late: 0,
          halfDay: 0,
          excused: 0,
          studentStatsMap: new Map(),
        });
      }
      const compItem = classCompMap.get(compKey)!;
      compItem.sessionsCount++;

      sess.records.forEach((rec) => {
        totalRecords++;

        let weight = 0;
        if (rec.status === "PRESENT") {
          presentCount++;
          compItem.present++;
          weight = 1.0;
        } else if (rec.status === "ABSENT") {
          absentCount++;
          compItem.absent++;
          weight = 0.0;
        } else if (rec.status === "LATE") {
          lateCount++;
          compItem.late++;
          weight = 1.0;
        } else if (rec.status === "HALF_DAY") {
          halfDayCount++;
          compItem.halfDay++;
          weight = 0.5;
        } else if (rec.status === "EXCUSED") {
          excusedCount++;
          compItem.excused++;
          weight = 0.0;
        }

        const studentFullName = `${rec.student.firstName} ${rec.student.lastName}`.trim();

        // Student aggregate
        if (!studentAggMap.has(rec.studentId)) {
          studentAggMap.set(rec.studentId, {
            studentId: rec.studentId,
            name: studentFullName,
            admissionNumber: rec.student.admissionNumber,
            rollNumber: null,
            className: sess.class.name,
            sectionName: sess.section.name,
            total: 0,
            attended: 0,
          });
        }
        const stAgg = studentAggMap.get(rec.studentId)!;
        stAgg.total++;
        stAgg.attended += weight;

        if (!compItem.studentStatsMap.has(rec.studentId)) {
          compItem.studentStatsMap.set(rec.studentId, { total: 0, attended: 0 });
        }
        const stComp = compItem.studentStatsMap.get(rec.studentId)!;
        stComp.total++;
        stComp.attended += weight;
      });
    });

    const effectiveAttended = presentCount + lateCount + halfDayCount * 0.5;
    const overallPercentage =
      totalRecords > 0 ? Math.round((effectiveAttended / totalRecords) * 1000) / 10 : 0;

    const classComparison: ClassAttendanceComparisonRow[] = Array.from(classCompMap.values()).map(
      (comp) => {
        const classTotalRecords =
          comp.present + comp.absent + comp.late + comp.halfDay + comp.excused;
        const classEffective = comp.present + comp.late + comp.halfDay * 0.5;
        const pct =
          classTotalRecords > 0
            ? Math.round((classEffective / classTotalRecords) * 1000) / 10
            : 0;

        let defaultersCount = 0;
        comp.studentStatsMap.forEach((st) => {
          if (st.total > 0) {
            const stPct = (st.attended / st.total) * 100;
            if (stPct < 75.0) defaultersCount++;
          }
        });

        return {
          classId: comp.classId,
          className: comp.className,
          sectionId: comp.sectionId,
          sectionName: comp.sectionName,
          totalSessions: comp.sessionsCount,
          presentCount: comp.present,
          absentCount: comp.absent,
          lateCount: comp.late,
          halfDayCount: comp.halfDay,
          excusedCount: comp.excused,
          attendancePercentage: pct,
          defaultersCount,
        };
      }
    );

    const cbseShortageRiskList: CbseShortageRiskRow[] = Array.from(studentAggMap.values())
      .map((st) => {
        const pct = st.total > 0 ? Math.round((st.attended / st.total) * 1000) / 10 : 0;
        return {
          studentId: st.studentId,
          studentName: st.name,
          admissionNumber: st.admissionNumber,
          rollNumber: st.rollNumber,
          className: st.className,
          sectionName: st.sectionName,
          totalRecordedDays: st.total,
          effectiveAttendedDays: st.attended,
          attendancePercentage: pct,
          isDefaulter: pct < 75.0,
        };
      })
      .filter((st) => st.isDefaulter)
      .sort((a, b) => a.attendancePercentage - b.attendancePercentage);

    return {
      success: true,
      data: {
        totalSessions,
        totalRecords,
        presentCount,
        absentCount,
        lateCount,
        halfDayCount,
        excusedCount,
        overallPercentage,
        classComparison,
        cbseShortageRiskList,
      },
    };
  } catch (err) {
    console.error("Error fetching attendance report data:", err);
    return { success: false, error: "Failed to generate attendance report." };
  }
}

/**
 * Retrieves Academic Performance report data.
 */
export async function getAcademicReportData(
  input?: ReportQueryInput
): Promise<ActionResult<AcademicReportData>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return { success: false, error: "Unauthorized access to reports." };
    }

    const parsed = reportQuerySchema.safeParse(input ?? {});
    const { classId, sectionId, academicYear } = parsed.success ? parsed.data : {};

    const examWhere: Prisma.ExamWhereInput = { schoolId: ctx.schoolId };
    if (classId) examWhere.classId = classId;
    if (sectionId) examWhere.sectionId = sectionId;
    if (academicYear) examWhere.academicYear = academicYear;

    const exams = await prisma.exam.findMany({
      where: examWhere,
      select: {
        id: true,
        maxMarks: true,
        passingMarks: true,
        subject: { select: { id: true, name: true, code: true } },
        results: {
          select: {
            id: true,
            marksObtained: true,
            percentage: true,
            grade: true,
            isPassing: true,
          },
        },
      },
    });

    const totalExams = exams.length;

    let totalResults = 0;
    let passedCount = 0;
    let failedCount = 0;
    let sumPercentage = 0;

    const gradeDistribution = {
      A1: 0,
      A2: 0,
      B1: 0,
      B2: 0,
      C1: 0,
      C2: 0,
      D: 0,
      E: 0,
    };

    const subjectMap = new Map<
      string,
      {
        subjectId: string;
        subjectName: string;
        subjectCode: string;
        examCount: number;
        totalResults: number;
        passedCount: number;
        marksSum: number;
        highest: number;
        lowest: number;
      }
    >();

    exams.forEach((ex) => {
      const sKey = ex.subject.id;
      if (!subjectMap.has(sKey)) {
        subjectMap.set(sKey, {
          subjectId: ex.subject.id,
          subjectName: ex.subject.name,
          subjectCode: ex.subject.code,
          examCount: 0,
          totalResults: 0,
          passedCount: 0,
          marksSum: 0,
          highest: 0,
          lowest: 100,
        });
      }
      const sItem = subjectMap.get(sKey)!;
      sItem.examCount++;

      const maxM = Number(ex.maxMarks);
      const passM = Number(ex.passingMarks);

      ex.results.forEach((res) => {
        totalResults++;
        sItem.totalResults++;

        const marksObt = Number(res.marksObtained);
        const pct = Number(res.percentage) || (maxM > 0 ? (marksObt / maxM) * 100 : 0);
        sumPercentage += pct;
        sItem.marksSum += pct;

        if (pct > sItem.highest) sItem.highest = pct;
        if (pct < sItem.lowest) sItem.lowest = pct;

        if (res.isPassing || marksObt >= passM) {
          passedCount++;
          sItem.passedCount++;
        } else {
          failedCount++;
        }

        const g = (res.grade ?? "").toUpperCase();
        if (g === "A1") gradeDistribution.A1++;
        else if (g === "A2") gradeDistribution.A2++;
        else if (g === "B1") gradeDistribution.B1++;
        else if (g === "B2") gradeDistribution.B2++;
        else if (g === "C1") gradeDistribution.C1++;
        else if (g === "C2") gradeDistribution.C2++;
        else if (g === "D") gradeDistribution.D++;
        else if (g === "E") gradeDistribution.E++;
      });
    });

    const passPercentage =
      totalResults > 0 ? Math.round((passedCount / totalResults) * 1000) / 10 : 0;
    const overallAverageMarks =
      totalResults > 0 ? Math.round((sumPercentage / totalResults) * 10) / 10 : 0;

    const subjectPerformance: SubjectPerformanceRow[] = Array.from(subjectMap.values()).map(
      (s) => {
        const sPassPct =
          s.totalResults > 0 ? Math.round((s.passedCount / s.totalResults) * 1000) / 10 : 0;
        const sAvg =
          s.totalResults > 0 ? Math.round((s.marksSum / s.totalResults) * 10) / 10 : 0;
        return {
          subjectId: s.subjectId,
          subjectName: s.subjectName,
          subjectCode: s.subjectCode,
          examCount: s.examCount,
          totalResults: s.totalResults,
          passedCount: s.passedCount,
          passPercentage: sPassPct,
          averageMarks: sAvg,
          highestMarks: s.highest === 0 && s.totalResults === 0 ? 0 : Math.round(s.highest * 10) / 10,
          lowestMarks: s.lowest === 100 && s.totalResults === 0 ? 0 : Math.round(s.lowest * 10) / 10,
        };
      }
    );

    return {
      success: true,
      data: {
        totalExams,
        totalResults,
        passedCount,
        failedCount,
        passPercentage,
        overallAverageMarks,
        gradeDistribution,
        subjectPerformance,
      },
    };
  } catch (err) {
    console.error("Error fetching academic report data:", err);
    return { success: false, error: "Failed to generate academic performance report." };
  }
}

/**
 * Main action to load initial reports workspace data and filter drop-downs.
 */
export async function getReportsWorkspaceData(
  input?: ReportQueryInput
): Promise<ActionResult<ReportsWorkspaceData>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return { success: false, error: "Unauthorized access to reports workspace." };
    }

    const parsed = reportQuerySchema.safeParse(input ?? {});
    const query = parsed.success ? parsed.data : { reportType: "enrollment" as ReportType };

    // Fetch classes list for dropdown
    const classes = await prisma.class.findMany({
      where: { schoolId: ctx.schoolId },
      select: { id: true, name: true, academicYear: true },
      orderBy: { name: "asc" },
    });

    const sections = await prisma.section.findMany({
      where: { schoolId: ctx.schoolId },
      select: { id: true, name: true, classId: true },
      orderBy: { name: "asc" },
    });

    let enrollment: EnrollmentReportData | undefined;
    let attendance: AttendanceReportData | undefined;
    let academic: AcademicReportData | undefined;

    if (query.reportType === "enrollment") {
      const res = await getEnrollmentReportData(query);
      if (res.success) enrollment = res.data;
    } else if (query.reportType === "attendance") {
      const res = await getAttendanceReportData(query);
      if (res.success) attendance = res.data;
    } else if (query.reportType === "academic") {
      const res = await getAcademicReportData(query);
      if (res.success) academic = res.data;
    }

    return {
      success: true,
      data: {
        role: ctx.role,
        reportType: query.reportType,
        classesList: classes,
        sectionsList: sections,
        enrollment,
        attendance,
        academic,
      },
    };
  } catch (err) {
    console.error("Error fetching reports workspace data:", err);
    return { success: false, error: "An unexpected error occurred loading reports." };
  }
}

/**
 * Action for ADMIN users to download RFC-4180 CSV export of report data.
 */
export async function exportReportCsvAction(
  input: ReportQueryInput
): Promise<ActionResult<ReportCsvExportResult>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return { success: false, error: "Unauthorized: CSV exports are restricted to administrators." };
    }

    const parsed = reportQuerySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid report query input." };
    }

    const query = parsed.data;
    const lines: string[] = [];
    let filename = "Report.csv";

    if (query.reportType === "enrollment") {
      const res = await getEnrollmentReportData(query);
      if (!res.success || !res.data) {
        return { success: false, error: res.error || "Failed to generate enrollment data for CSV." };
      }
      const data = res.data;
      lines.push("Enrollment Report Summary");
      lines.push(`Total Students,${escapeCsvCell(data.totalStudents)}`);
      lines.push(`Active Students,${escapeCsvCell(data.activeStudents)}`);
      lines.push(`Inactive Students,${escapeCsvCell(data.inactiveStudents)}`);
      lines.push("");
      lines.push("Class,Academic Year,Total Students,Active Students");
      data.classDistribution.forEach((c) => {
        lines.push(
          [
            escapeCsvCell(c.className),
            escapeCsvCell(c.academicYear),
            escapeCsvCell(c.totalStudents),
            escapeCsvCell(c.activeStudents),
          ].join(",")
        );
      });
      filename = `Enrollment_Report_${new Date().toISOString().split("T")[0]}.csv`;
    } else if (query.reportType === "attendance") {
      const res = await getAttendanceReportData(query);
      if (!res.success || !res.data) {
        return { success: false, error: res.error || "Failed to generate attendance data for CSV." };
      }
      const data = res.data;
      lines.push("Attendance Analytics Summary");
      lines.push(`Total Sessions,${escapeCsvCell(data.totalSessions)}`);
      lines.push(`Overall Attendance %,${escapeCsvCell(data.overallPercentage)}%`);
      lines.push(`Present Count,${escapeCsvCell(data.presentCount)}`);
      lines.push(`Absent Count,${escapeCsvCell(data.absentCount)}`);
      lines.push(`Late Count,${escapeCsvCell(data.lateCount)}`);
      lines.push(`Half-Day Count,${escapeCsvCell(data.halfDayCount)}`);
      lines.push(`Excused Count,${escapeCsvCell(data.excusedCount)}`);
      lines.push("");
      lines.push("Class,Section,Total Sessions,Present,Absent,Late,Half-Day,Excused,Attendance %,CBSE Defaulters (<75%)");
      data.classComparison.forEach((c) => {
        lines.push(
          [
            escapeCsvCell(c.className),
            escapeCsvCell(c.sectionName),
            escapeCsvCell(c.totalSessions),
            escapeCsvCell(c.presentCount),
            escapeCsvCell(c.absentCount),
            escapeCsvCell(c.lateCount),
            escapeCsvCell(c.halfDayCount),
            escapeCsvCell(c.excusedCount),
            escapeCsvCell(`${c.attendancePercentage}%`),
            escapeCsvCell(c.defaultersCount),
          ].join(",")
        );
      });
      filename = `Attendance_Analytics_Report_${new Date().toISOString().split("T")[0]}.csv`;
    } else if (query.reportType === "academic") {
      const res = await getAcademicReportData(query);
      if (!res.success || !res.data) {
        return { success: false, error: res.error || "Failed to generate academic performance data for CSV." };
      }
      const data = res.data;
      lines.push("Academic Performance Summary");
      lines.push(`Total Exams Conducted,${escapeCsvCell(data.totalExams)}`);
      lines.push(`Total Results Processed,${escapeCsvCell(data.totalResults)}`);
      lines.push(`Overall Average Marks %,${escapeCsvCell(data.overallAverageMarks)}%`);
      lines.push(`Pass Percentage,${escapeCsvCell(data.passPercentage)}%`);
      lines.push("");
      lines.push("Subject Name,Subject Code,Exams,Total Results,Passed,Pass %,Average %,Highest %,Lowest %");
      data.subjectPerformance.forEach((sp) => {
        lines.push(
          [
            escapeCsvCell(sp.subjectName),
            escapeCsvCell(sp.subjectCode),
            escapeCsvCell(sp.examCount),
            escapeCsvCell(sp.totalResults),
            escapeCsvCell(sp.passedCount),
            escapeCsvCell(`${sp.passPercentage}%`),
            escapeCsvCell(`${sp.averageMarks}%`),
            escapeCsvCell(`${sp.highestMarks}%`),
            escapeCsvCell(`${sp.lowestMarks}%`),
          ].join(",")
        );
      });
      filename = `Academic_Performance_Report_${new Date().toISOString().split("T")[0]}.csv`;
    }

    const csvContent = "\uFEFF" + lines.join("\r\n"); // UTF-8 BOM + RFC-4180 lines
    return {
      success: true,
      data: {
        filename,
        csvContent,
      },
    };
  } catch (err) {
    console.error("Error exporting report CSV:", err);
    return { success: false, error: "An unexpected error occurred while generating CSV export." };
  }
}
