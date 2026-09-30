"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import {
  saveAttendanceRegisterSchema,
  getRegisterQuerySchema,
  monthlyAttendanceQuerySchema,
  studentAttendanceSummaryQuerySchema,
  type SaveAttendanceRegisterInput,
  type GetRegisterQueryInput,
  type MonthlyAttendanceQueryInput,
  type StudentAttendanceSummaryQueryInput,
  type AttendanceStatusType,
} from "@/lib/validations/attendance";
import type { ActionResult } from "./classes";
import type { AttendanceStatus } from "@prisma/client";

/**
 * Normalizes a YYYY-MM-DD string to a UTC Date object matching PostgreSQL @db.Date.
 */
function parseDateToUtc(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Formats a Date object to YYYY-MM-DD in UTC.
 */
function formatUtcDateString(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface RegisterStudentRow {
  studentId: string;
  admissionNumber: string;
  name: string;
  gender: string | null;
  status: AttendanceStatusType;
  remarks: string;
}

export interface AttendanceRegisterData {
  sessionId?: string;
  isExisting: boolean;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  academicYear: string;
  date: string;
  notes: string;
  markedByName?: string;
  markedAt?: string;
  canEdit: boolean;
  records: RegisterStudentRow[];
}

export interface TodayAttendanceSummary {
  totalSections: number;
  markedSections: number;
  unmarkedSections: number;
  totalStudentsMarked: number;
  totalPresent: number;
  totalAbsent: number;
  overallAttendancePercentage: number;
}

/**
 * Fetches an existing attendance register or generates a fresh roll call
 * from active student enrollments for the given class, section, and date.
 */
export async function getAttendanceRegister(
  input: GetRegisterQueryInput
): Promise<ActionResult<AttendanceRegisterData>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error: "Unauthorized: only administrators and teachers can access attendance registers.",
      };
    }

    const parsed = getRegisterQuerySchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid query.";
      return { success: false, error: firstError };
    }

    const { classId, sectionId, date } = parsed.data;

    // 1. Locate the class and section strictly within this school tenant
    const cls = await prisma.class.findFirst({
      where: { id: classId, schoolId: ctx.schoolId },
      select: { id: true, name: true, academicYear: true },
    });

    if (!cls) {
      return { success: false, error: "Class not found in your school records." };
    }

    const section = await prisma.section.findFirst({
      where: { id: sectionId, classId, schoolId: ctx.schoolId },
      select: { id: true, name: true },
    });

    if (!section) {
      return { success: false, error: "Section not found in the selected class." };
    }

    const utcDate = parseDateToUtc(date);

    // 2. Check teacher editing window permissions (Teachers can only edit today & yesterday)
    let canEdit = true;
    if (ctx.role === "TEACHER") {
      const today = new Date();
      const todayMidnight = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      const targetMidnight = utcDate.getTime();
      const diffDays = Math.floor((todayMidnight - targetMidnight) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        canEdit = false;
      }
    }

    // 3. Check if an AttendanceSession already exists for this date
    const existingSession = await prisma.attendanceSession.findUnique({
      where: {
        schoolId_classId_sectionId_date: {
          schoolId: ctx.schoolId,
          classId,
          sectionId,
          date: utcDate,
        },
      },
      include: {
        markedBy: { select: { name: true, role: true } },
        records: {
          include: {
            student: {
              select: {
                id: true,
                admissionNumber: true,
                firstName: true,
                lastName: true,
                gender: true,
                status: true,
              },
            },
          },
          orderBy: [
            { student: { lastName: "asc" } },
            { student: { firstName: "asc" } },
          ],
        },
      },
    });

    if (existingSession) {
      const records: RegisterStudentRow[] = existingSession.records.map((r) => ({
        studentId: r.studentId,
        admissionNumber: r.student.admissionNumber,
        name: `${r.student.firstName} ${r.student.lastName}`.trim(),
        gender: r.student.gender,
        status: r.status as AttendanceStatusType,
        remarks: r.remarks ?? "",
      }));

      return {
        success: true,
        data: {
          sessionId: existingSession.id,
          isExisting: true,
          classId: cls.id,
          className: cls.name,
          sectionId: section.id,
          sectionName: section.name,
          academicYear: cls.academicYear,
          date,
          notes: existingSession.notes ?? "",
          markedByName: existingSession.markedBy.name,
          markedAt: existingSession.updatedAt.toISOString(),
          canEdit,
          records,
        },
      };
    }

    // 4. Session does not exist yet: Build fresh roster from active enrollments
    const enrollments = await prisma.enrollment.findMany({
      where: {
        schoolId: ctx.schoolId,
        classId,
        sectionId,
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

    const records: RegisterStudentRow[] = enrollments.map((e) => ({
      studentId: e.student.id,
      admissionNumber: e.student.admissionNumber,
      name: `${e.student.firstName} ${e.student.lastName}`.trim(),
      gender: e.student.gender,
      status: "PRESENT",
      remarks: "",
    }));

    return {
      success: true,
      data: {
        isExisting: false,
        classId: cls.id,
        className: cls.name,
        sectionId: section.id,
        sectionName: section.name,
        academicYear: cls.academicYear,
        date,
        notes: "",
        canEdit,
        records,
      },
    };
  } catch (err) {
    console.error("Error fetching attendance register:", err);
    return {
      success: false,
      error: "An unexpected error occurred while loading the attendance register.",
    };
  }
}

/**
 * Saves or updates an entire daily attendance register session in an atomic transaction.
 * Enforces tenant scoping, active student verification, teacher 48h limit, and session audit logs.
 */
export async function saveAttendanceRegister(
  input: SaveAttendanceRegisterInput
): Promise<ActionResult<{ sessionId: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error: "Unauthorized: only administrators and teachers can mark attendance.",
      };
    }

    const parsed = saveAttendanceRegisterSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid attendance data.";
      return { success: false, error: firstError };
    }

    const { classId, sectionId, date, academicYear, notes, records } = parsed.data;

    // 1. Prevent marking attendance for future dates
    const today = new Date();
    const todayStr = formatUtcDateString(
      new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    );

    if (date > todayStr) {
      return {
        success: false,
        error: "Cannot mark attendance for a future date.",
      };
    }

    const utcDate = parseDateToUtc(date);

    // 2. Enforce Teacher 48h editing limit (Today & Yesterday only)
    if (ctx.role === "TEACHER") {
      const todayMidnight = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      const targetMidnight = utcDate.getTime();
      const diffDays = Math.floor((todayMidnight - targetMidnight) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        return {
          success: false,
          error: "Teachers are authorized to mark or edit attendance only for today and yesterday. Older dates require an administrator.",
        };
      }
    }

    // 3. Verify class and section belong to this tenant's school
    const cls = await prisma.class.findFirst({
      where: { id: classId, schoolId: ctx.schoolId },
      select: { id: true, name: true },
    });

    if (!cls) {
      return { success: false, error: "Class not found in your school records." };
    }

    const section = await prisma.section.findFirst({
      where: { id: sectionId, classId, schoolId: ctx.schoolId },
      select: { id: true, name: true },
    });

    if (!section) {
      return { success: false, error: "Section not found in the selected class." };
    }

    // 4. Check if session already exists for audit action determination
    const existing = await prisma.attendanceSession.findUnique({
      where: {
        schoolId_classId_sectionId_date: {
          schoolId: ctx.schoolId,
          classId,
          sectionId,
          date: utcDate,
        },
      },
      select: { id: true },
    });

    const isUpdate = !!existing;

    // 5. Execute atomic database transaction
    const savedSession = await prisma.$transaction(async (tx) => {
      // Upsert the parent AttendanceSession
      const session = await tx.attendanceSession.upsert({
        where: {
          schoolId_classId_sectionId_date: {
            schoolId: ctx.schoolId,
            classId,
            sectionId,
            date: utcDate,
          },
        },
        update: {
          markedById: ctx.userId,
          notes: notes?.trim() || null,
          updatedAt: new Date(),
        },
        create: {
          schoolId: ctx.schoolId,
          classId,
          sectionId,
          academicYear,
          date: utcDate,
          markedById: ctx.userId,
          notes: notes?.trim() || null,
        },
      });

      // Synchronize attendance records: remove previous records and bulk insert new
      await tx.attendanceRecord.deleteMany({
        where: { sessionId: session.id },
      });

      await tx.attendanceRecord.createMany({
        data: records.map((r) => ({
          schoolId: ctx.schoolId,
          sessionId: session.id,
          studentId: r.studentId,
          status: r.status as AttendanceStatus,
          remarks: r.remarks?.trim() || null,
        })),
      });

      return session;
    });

    // 6. Calculate summary counts for audit log
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let halfDayCount = 0;

    for (const r of records) {
      if (r.status === "PRESENT") presentCount++;
      else if (r.status === "ABSENT") absentCount++;
      else if (r.status === "LATE") lateCount++;
      else if (r.status === "EXCUSED") excusedCount++;
      else if (r.status === "HALF_DAY") halfDayCount++;
    }

    // 7. Write structured audit log at the session register level
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: isUpdate ? "ATTENDANCE_UPDATED" : "ATTENDANCE_MARKED",
      entityType: "ATTENDANCE_SESSION",
      entityId: savedSession.id,
      newValues: {
        className: cls.name,
        sectionName: section.name,
        date,
        academicYear,
        totalStudents: records.length,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        halfDayCount,
        notes: notes?.trim() || null,
      },
    });

    // 8. Revalidate dashboard routes
    revalidatePath("/dashboard/attendance");

    return { success: true, data: { sessionId: savedSession.id } };
  } catch (err) {
    console.error("Error saving attendance register:", err);
    return {
      success: false,
      error: "An unexpected error occurred while saving the attendance register.",
    };
  }
}

/**
 * Returns summary attendance metrics for today for the school dashboard.
 */
export async function getTodayAttendanceSummary(): Promise<TodayAttendanceSummary> {
  const ctx = await requireTenant();

  const today = new Date();
  const utcToday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  // Count total active sections in this school
  const totalSections = await prisma.section.count({
    where: { schoolId: ctx.schoolId },
  });

  // Fetch all sessions marked for today in this school
  const todaySessions = await prisma.attendanceSession.findMany({
    where: {
      schoolId: ctx.schoolId,
      date: utcToday,
    },
    include: {
      records: {
        select: { status: true },
      },
    },
  });

  const markedSections = todaySessions.length;
  const unmarkedSections = Math.max(0, totalSections - markedSections);

  let totalStudentsMarked = 0;
  let totalPresent = 0;
  let totalAbsent = 0;

  for (const session of todaySessions) {
    for (const record of session.records) {
      totalStudentsMarked++;
      if (record.status === "PRESENT" || record.status === "LATE") {
        totalPresent++;
      } else if (record.status === "ABSENT") {
        totalAbsent++;
      }
    }
  }

  const overallAttendancePercentage =
    totalStudentsMarked > 0
      ? Math.round((totalPresent / totalStudentsMarked) * 100)
      : 0;

  return {
    totalSections,
    markedSections,
    unmarkedSections,
    totalStudentsMarked,
    totalPresent,
    totalAbsent,
    overallAttendancePercentage,
  };
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface MonthlyAttendanceStudentDay {
  status: AttendanceStatusType | null;
  remarks: string | null;
}

export interface MonthlyAttendanceStudentSummary {
  studentId: string;
  admissionNumber: string;
  name: string;
  gender: string | null;
  dailyStatus: Record<number, MonthlyAttendanceStudentDay>;
  stats: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    halfDay: number;
    workingDays: number;
    attendedDays: number;
    percentage: number;
    isDefaulter: boolean;
  };
}

export interface MonthlyAttendanceDefaulter {
  studentId: string;
  admissionNumber: string;
  name: string;
  gender: string | null;
  workingDays: number;
  attendedDays: number;
  absentDays: number;
  percentage: number;
}

export interface MonthlyAttendanceMatrixData {
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  academicYear: string;
  year: number;
  month: number;
  monthName: string;
  daysInMonth: number;
  markedDates: number[];
  totalWorkingDays: number;
  students: MonthlyAttendanceStudentSummary[];
  analytics: {
    totalStudents: number;
    totalWorkingDays: number;
    averagePercentage: number;
    statusCounts: {
      present: number;
      absent: number;
      late: number;
      excused: number;
      halfDay: number;
    };
    defaulters: MonthlyAttendanceDefaulter[];
  };
}

export interface StudentAttendanceSummaryData {
  studentId: string;
  admissionNumber: string;
  name: string;
  academicYear?: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  halfDayCount: number;
  attendedDays: number;
  percentage: number;
  isDefaulter: boolean;
  activeClassName?: string;
  activeSectionName?: string;
  recentSessions: Array<{
    date: string;
    status: AttendanceStatusType;
    remarks: string | null;
  }>;
}

export interface AttendanceCsvExportData {
  csvContent: string;
  fileName: string;
}

/**
 * Fetches the historical monthly attendance matrix for a class, section, year, and month.
 * Computes individual student attendance percentages and CBSE <75% attendance defaulters.
 */
export async function getMonthlyAttendanceMatrix(
  input: MonthlyAttendanceQueryInput
): Promise<ActionResult<MonthlyAttendanceMatrixData>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error: "Unauthorized: only administrators and teachers can access attendance matrix.",
      };
    }

    const parsed = monthlyAttendanceQuerySchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid query parameters.";
      return { success: false, error: firstError };
    }

    const { classId, sectionId, year, month, academicYear: inputAcademicYear } = parsed.data;

    // 1. Verify class and section belong to this tenant's school
    const cls = await prisma.class.findFirst({
      where: { id: classId, schoolId: ctx.schoolId },
      select: { id: true, name: true, academicYear: true },
    });

    if (!cls) {
      return { success: false, error: "Class not found in your school records." };
    }

    const section = await prisma.section.findFirst({
      where: { id: sectionId, classId, schoolId: ctx.schoolId },
      select: { id: true, name: true },
    });

    if (!section) {
      return { success: false, error: "Section not found in the selected class." };
    }

    const academicYear = inputAcademicYear || cls.academicYear;

    // 2. Determine number of days in the requested month & UTC dates
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month - 1, daysInMonth));

    // 3. Query all attendance sessions in that month for this class & section
    const sessions = await prisma.attendanceSession.findMany({
      where: {
        schoolId: ctx.schoolId,
        classId,
        sectionId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        records: {
          select: {
            studentId: true,
            status: true,
            remarks: true,
          },
        },
      },
      orderBy: { date: "asc" },
    });

    // Map sessions by UTC day of month (1..31)
    const sessionByDay = new Map<number, typeof sessions[0]>();
    for (const session of sessions) {
      const day = session.date.getUTCDate();
      sessionByDay.set(day, session);
    }

    const markedDates = Array.from(sessionByDay.keys()).sort((a, b) => a - b);
    const totalWorkingDays = markedDates.length;

    // 4. Query active enrolled students for this class and section
    const enrollments = await prisma.enrollment.findMany({
      where: {
        schoolId: ctx.schoolId,
        classId,
        sectionId,
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

    // 5. Aggregate daily status and statistics for each student
    const students: MonthlyAttendanceStudentSummary[] = [];
    const defaulters: MonthlyAttendanceDefaulter[] = [];

    let totalClassPresent = 0;
    let totalClassAbsent = 0;
    let totalClassLate = 0;
    let totalClassExcused = 0;
    let totalClassHalfDay = 0;

    for (const enrollment of enrollments) {
      const st = enrollment.student;
      const dailyStatus: Record<number, MonthlyAttendanceStudentDay> = {};

      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let excusedCount = 0;
      let halfDayCount = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const session = sessionByDay.get(day);
        if (!session) {
          // No attendance session was recorded on this day
          dailyStatus[day] = { status: null, remarks: null };
          continue;
        }

        const rec = session.records.find((r) => r.studentId === st.id);
        if (rec) {
          const status = rec.status as AttendanceStatusType;
          dailyStatus[day] = { status, remarks: rec.remarks };

          if (status === "PRESENT") {
            presentCount++;
            totalClassPresent++;
          } else if (status === "ABSENT") {
            absentCount++;
            totalClassAbsent++;
          } else if (status === "LATE") {
            lateCount++;
            totalClassLate++;
          } else if (status === "EXCUSED") {
            excusedCount++;
            totalClassExcused++;
          } else if (status === "HALF_DAY") {
            halfDayCount++;
            totalClassHalfDay++;
          }
        } else {
          // Session exists, but student had no record
          dailyStatus[day] = { status: null, remarks: null };
        }
      }

      // Attended days weight: Present (1) + Late (1) + Half Day (0.5)
      const attendedDays = presentCount + lateCount + halfDayCount * 0.5;
      const percentage =
        totalWorkingDays > 0
          ? Math.round((attendedDays / totalWorkingDays) * 100)
          : 0;
      const isDefaulter = totalWorkingDays > 0 && percentage < 75;

      const studentSummary: MonthlyAttendanceStudentSummary = {
        studentId: st.id,
        admissionNumber: st.admissionNumber,
        name: `${st.firstName} ${st.lastName}`.trim(),
        gender: st.gender,
        dailyStatus,
        stats: {
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          excused: excusedCount,
          halfDay: halfDayCount,
          workingDays: totalWorkingDays,
          attendedDays,
          percentage,
          isDefaulter,
        },
      };

      students.push(studentSummary);

      if (isDefaulter) {
        defaulters.push({
          studentId: st.id,
          admissionNumber: st.admissionNumber,
          name: `${st.firstName} ${st.lastName}`.trim(),
          gender: st.gender,
          workingDays: totalWorkingDays,
          attendedDays,
          absentDays: absentCount,
          percentage,
        });
      }
    }

    // Sort defaulters lowest attendance percentage first
    defaulters.sort((a, b) => a.percentage - b.percentage);

    const averagePercentage =
      students.length > 0
        ? Math.round(
            students.reduce((acc, s) => acc + s.stats.percentage, 0) /
              students.length
          )
        : 0;

    const monthName = MONTH_NAMES[month - 1] ?? `Month ${month}`;

    return {
      success: true,
      data: {
        classId: cls.id,
        className: cls.name,
        sectionId: section.id,
        sectionName: section.name,
        academicYear,
        year,
        month,
        monthName,
        daysInMonth,
        markedDates,
        totalWorkingDays,
        students,
        analytics: {
          totalStudents: students.length,
          totalWorkingDays,
          averagePercentage,
          statusCounts: {
            present: totalClassPresent,
            absent: totalClassAbsent,
            late: totalClassLate,
            excused: totalClassExcused,
            halfDay: totalClassHalfDay,
          },
          defaulters,
        },
      },
    };
  } catch (err) {
    console.error("Error fetching monthly attendance matrix:", err);
    return {
      success: false,
      error: "An unexpected error occurred while loading the monthly attendance matrix.",
    };
  }
}

/**
 * Fetches an individual student's cumulative attendance statistics and recent logs.
 */
export async function getStudentAttendanceSummary(
  input: StudentAttendanceSummaryQueryInput
): Promise<ActionResult<StudentAttendanceSummaryData>> {
  try {
    const ctx = await requireTenant();

    const parsed = studentAttendanceSummaryQuerySchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid query.";
      return { success: false, error: firstError };
    }

    const { studentId, academicYear } = parsed.data;

    // Verify student belongs to this tenant
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId: ctx.schoolId },
      select: {
        id: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
          take: 1,
        },
      },
    });

    if (!student) {
      return { success: false, error: "Student not found in your school records." };
    }

    const activeEnrollment = student.enrollments[0];

    // Fetch all attendance records for this student
    const records = await prisma.attendanceRecord.findMany({
      where: {
        schoolId: ctx.schoolId,
        studentId: student.id,
        ...(academicYear ? { session: { academicYear } } : {}),
      },
      include: {
        session: {
          select: {
            date: true,
            academicYear: true,
          },
        },
      },
      orderBy: {
        session: { date: "desc" },
      },
    });

    const totalSessions = records.length;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let halfDayCount = 0;

    for (const r of records) {
      if (r.status === "PRESENT") presentCount++;
      else if (r.status === "ABSENT") absentCount++;
      else if (r.status === "LATE") lateCount++;
      else if (r.status === "EXCUSED") excusedCount++;
      else if (r.status === "HALF_DAY") halfDayCount++;
    }

    const attendedDays = presentCount + lateCount + halfDayCount * 0.5;
    const percentage = totalSessions > 0 ? Math.round((attendedDays / totalSessions) * 100) : 0;
    const isDefaulter = totalSessions > 0 && percentage < 75;

    // Return recent 5 sessions
    const recentSessions = records.slice(0, 5).map((r) => ({
      date: formatUtcDateString(r.session.date),
      status: r.status as AttendanceStatusType,
      remarks: r.remarks,
    }));

    return {
      success: true,
      data: {
        studentId: student.id,
        admissionNumber: student.admissionNumber,
        name: `${student.firstName} ${student.lastName}`.trim(),
        academicYear,
        totalSessions,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        halfDayCount,
        attendedDays,
        percentage,
        isDefaulter,
        activeClassName: activeEnrollment?.class?.name,
        activeSectionName: activeEnrollment?.section?.name,
        recentSessions,
      },
    };
  } catch (err) {
    console.error("Error fetching student attendance summary:", err);
    return {
      success: false,
      error: "An unexpected error occurred while loading the student attendance summary.",
    };
  }
}

/**
 * Generates an RFC-4180 CSV export of the monthly attendance matrix.
 */
export async function exportMonthlyAttendanceCsv(
  input: MonthlyAttendanceQueryInput
): Promise<ActionResult<AttendanceCsvExportData>> {
  try {
    const matrixRes = await getMonthlyAttendanceMatrix(input);
    if (!matrixRes.success || !matrixRes.data) {
      return { success: false, error: matrixRes.error ?? "Failed to load matrix data for export." };
    }

    const data = matrixRes.data;
    const lines: string[] = [];

    // Helper for CSV escaping
    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Metadata headers
    lines.push(`Monthly Attendance Report`);
    lines.push(
      `Class,${escapeCsv(data.className)},Section,${escapeCsv(data.sectionName)},Academic Year,${escapeCsv(data.academicYear)}`
    );
    lines.push(
      `Month,${escapeCsv(data.monthName)} ${data.year},Working Days,${data.totalWorkingDays},Total Students,${data.analytics.totalStudents},Average Attendance,${data.analytics.averagePercentage}%`
    );
    lines.push("");

    // Column headers: Sr, Admission No, Student Name, Gender, 1..daysInMonth, Present, Absent, Late, Excused, Half Day, Attended Days, Working Days, Attendance %, Defaulter
    const dayHeaders = Array.from({ length: data.daysInMonth }, (_, i) => String(i + 1));
    const headerRow = [
      "Sr",
      "Admission No",
      "Student Name",
      "Gender",
      ...dayHeaders,
      "Present",
      "Absent",
      "Late",
      "Excused",
      "Half Day",
      "Attended Days",
      "Working Days",
      "Attendance %",
      "Defaulter (<75%)",
    ];
    lines.push(headerRow.map(escapeCsv).join(","));

    // Student rows
    data.students.forEach((student, idx) => {
      const dailyCols = dayHeaders.map((dayStr) => {
        const day = Number(dayStr);
        const dayRecord = student.dailyStatus[day];
        if (!dayRecord || !dayRecord.status) return "-";
        switch (dayRecord.status) {
          case "PRESENT":
            return "P";
          case "ABSENT":
            return "A";
          case "LATE":
            return "L";
          case "EXCUSED":
            return "E";
          case "HALF_DAY":
            return "H";
          default:
            return "-";
        }
      });

      const row = [
        idx + 1,
        student.admissionNumber,
        student.name,
        student.gender ?? "",
        ...dailyCols,
        student.stats.present,
        student.stats.absent,
        student.stats.late,
        student.stats.excused,
        student.stats.halfDay,
        student.stats.attendedDays,
        student.stats.workingDays,
        `${student.stats.percentage}%`,
        student.stats.isDefaulter ? "YES" : "NO",
      ];
      lines.push(row.map(escapeCsv).join(","));
    });

    const csvContent = lines.join("\r\n");
    const safeMonth = data.monthName.toLowerCase();
    const safeClass = data.className.replace(/\s+/g, "_").toLowerCase();
    const safeSection = data.sectionName.replace(/\s+/g, "_").toLowerCase();
    const fileName = `attendance_${safeClass}_${safeSection}_${safeMonth}_${data.year}.csv`;

    return {
      success: true,
      data: {
        csvContent,
        fileName,
      },
    };
  } catch (err) {
    console.error("Error generating attendance CSV export:", err);
    return {
      success: false,
      error: "An unexpected error occurred while generating the CSV export.",
    };
  }
}

