import { computeGrade, type GradeLabelValue } from "./exam";

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function toNum(val: number | { toNumber: () => number } | undefined | null): number {
  if (val === undefined || val === null) return 0;
  return typeof val === "number"
    ? val
    : typeof val.toNumber === "function"
    ? val.toNumber()
    : Number(val);
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

export interface ReportCardRemarkData {
  id: string;
  cycleKey: string;
  cycleName: string;
  remarks: string;
  authorName: string;
  authorRole: string;
  updatedAt: string;
}

export interface ReportCardCoScholasticData {
  activity: string;
  grade: string;
  remarks: string | null;
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
  remarks?: ReportCardRemarkData | null;
  coScholastics?: ReportCardCoScholasticData[];
  generatedAt: string;
}

export interface PureCompileParams {
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
    firstName?: string;
    lastName?: string;
    name?: string;
    dateOfBirth: Date | string | null;
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
  exams: Array<{
    id: string;
    name: string;
    examType: string;
    maxMarks: number | { toNumber: () => number };
    passingMarks: number | { toNumber: () => number };
    subject: {
      id: string;
      name: string;
      code: string;
    };
  }>;
  examResults: Array<{
    examId: string;
    marksObtained: number | { toNumber: () => number };
    percentage: number | { toNumber: () => number };
    grade: string;
    isPassing: boolean;
    remarks: string | null;
  }>;
  totalClassSessions: number;
  attendanceRecords: Array<{
    status: string;
  }>;
  remark?: {
    id: string;
    cycleKey: string;
    cycleName: string;
    remarks: string;
    author: {
      name: string;
      role: string;
    };
    updatedAt: Date;
  } | null;
  coScholastics?: Array<{
    activity: string;
    grade: string;
    remarks: string | null;
  }>;
  generatedAt?: string;
}

/**
 * Pure synchronous report-card compiler.
 * Zero database calls, zero auth/session calls, zero tenant lookups.
 * Fully deterministic: exactly maps marks, grades, attendance, and pass/fail rules.
 */
export function compileReportCardData(params: PureCompileParams): ReportCardData {
  const {
    school,
    student,
    placement,
    cycleName,
    exams,
    examResults,
    totalClassSessions,
    attendanceRecords,
    remark,
    coScholastics,
    generatedAt,
  } = params;

  const resultMap = new Map(examResults.map((r) => [r.examId, r]));

  let totalMaxMarks = 0;
  let totalMarksObtained = 0;
  let passedCount = 0;
  let failedCount = 0;
  let pendingCount = 0;
  const failedSubjectNames: string[] = [];

  const subjectRows: ReportCardSubjectRow[] = exams.map((ex) => {
    const res = resultMap.get(ex.id);
    const maxMarks = toNum(ex.maxMarks);
    const passingMarks = toNum(ex.passingMarks);

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

    const marksObtained = toNum(res.marksObtained);
    const percentage = toNum(res.percentage);
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

  const overallPercentage =
    totalMaxMarks > 0
      ? roundTo((totalMarksObtained / totalMaxMarks) * 100, 2)
      : 0;
  const overallGrade = computeGrade(overallPercentage);
  const overallResult: "PASS" | "FAIL" =
    failedCount === 0 && pendingCount === 0 && overallPercentage >= 33.0
      ? "PASS"
      : "FAIL";

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

  const remarksData: ReportCardRemarkData | null = remark
    ? {
        id: remark.id,
        cycleKey: remark.cycleKey,
        cycleName: remark.cycleName,
        remarks: remark.remarks,
        authorName: remark.author.name,
        authorRole: remark.author.role,
        updatedAt: remark.updatedAt.toISOString(),
      }
    : null;

  const coScholasticsData: ReportCardCoScholasticData[] = coScholastics
    ? coScholastics.map((cs) => ({
        activity: cs.activity,
        grade: cs.grade,
        remarks: cs.remarks,
      }))
    : [];

  return {
    school: {
      id: school.id,
      name: school.name,
      code: school.code,
      address: school.address,
      phone: school.phone,
      email: school.email,
    },
    student: {
      id: student.id,
      admissionNumber: student.admissionNumber,
      name: student.name
        ? student.name
        : `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim(),
      dateOfBirth: student.dateOfBirth
        ? student.dateOfBirth instanceof Date
          ? student.dateOfBirth.toISOString().split("T")[0]
          : String(student.dateOfBirth).split("T")[0]
        : null,
      gender: student.gender,
      category: student.category,
    },
    placement: {
      classId: placement.classId,
      className: placement.className,
      sectionId: placement.sectionId,
      sectionName: placement.sectionName,
      academicYear: placement.academicYear,
    },
    cycleName,
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
    remarks: remarksData,
    coScholastics: coScholasticsData,
    generatedAt: generatedAt ?? new Date().toISOString(),
  };
}
