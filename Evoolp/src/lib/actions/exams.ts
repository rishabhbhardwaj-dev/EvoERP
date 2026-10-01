"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { logAudit, diffChanges } from "@/lib/audit";
import {
  createExamSchema,
  updateExamSchema,
  saveExamResultsSchema,
  getExamsQuerySchema,
  type CreateExamInput,
  type UpdateExamInput,
  type SaveExamResultsInput,
  type GetExamsQueryInput,
  type GradeLabelValue,
} from "@/lib/validations/exam";
import type { ActionResult } from "./classes";
import type { GradeLabel } from "@prisma/client";

// ─────────────────────────── Grade computation ───────────────────────────

/**
 * Computes the CBSE scholastic grade label from a percentage score.
 * Boundaries (inclusive): A1=91-100, A2=81-90, B1=71-80, B2=61-70,
 * C1=51-60, C2=41-50, D=33-40, E=<33.
 * This is a pure function — exported so it can be used in tests and components.
 */
export function computeGrade(percentage: number): GradeLabelValue {
  if (percentage >= 91) return "A1";
  if (percentage >= 81) return "A2";
  if (percentage >= 71) return "B1";
  if (percentage >= 61) return "B2";
  if (percentage >= 51) return "C1";
  if (percentage >= 41) return "C2";
  if (percentage >= 33) return "D";
  return "E";
}

/**
 * Rounds a number to N decimal places using Math.round to avoid floating-point
 * accumulation. Safe for typical marks values (integers or simple decimals).
 */
function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─────────────────────────── Shared types ────────────────────────────────

export interface ExamSummary {
  id: string;
  name: string;
  examType: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  academicYear: string;
  maxMarks: number;
  passingMarks: number;
  examDate: string | null;
  notes: string | null;
  resultCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExamStudentResult {
  studentId: string;
  admissionNumber: string;
  name: string;
  gender: string | null;
  marksObtained: number | null;
  percentage: number | null;
  grade: GradeLabelValue | null;
  isPassing: boolean | null;
  remarks: string | null;
  resultId: string | null;
}

export interface ExamDetailData {
  id: string;
  name: string;
  examType: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  academicYear: string;
  maxMarks: number;
  passingMarks: number;
  examDate: string | null;
  notes: string | null;
  createdAt: string;
  students: ExamStudentResult[];
}

// ─────────────────────────── createExam ──────────────────────────────────

/**
 * Creates a new Exam for a class/section/subject.
 * ADMIN only. Validates tenant ownership of class, section, subject.
 * Enforces the unique constraint before insertion for a friendly error message.
 */
export async function createExam(
  input: CreateExamInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: only administrators can create exams.",
      };
    }

    const parsed = createExamSchema.safeParse(input);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Invalid exam data.";
      return { success: false, error: firstError };
    }

    const {
      name,
      examType,
      classId,
      sectionId,
      subjectId,
      academicYear,
      maxMarks,
      passingMarks,
      examDate,
      notes,
    } = parsed.data;

    // 1. Verify class belongs to this school tenant
    const cls = await prisma.class.findFirst({
      where: { id: classId, schoolId: ctx.schoolId },
      select: { id: true, name: true, academicYear: true },
    });

    if (!cls) {
      return {
        success: false,
        error: "Class not found in your school records.",
      };
    }

    // 2. Verify academicYear matches the class's academic year
    if (cls.academicYear !== academicYear) {
      return {
        success: false,
        error: `Academic year "${academicYear}" does not match the selected class's year (${cls.academicYear}).`,
      };
    }

    // 3. Verify section belongs to this class AND school
    const section = await prisma.section.findFirst({
      where: { id: sectionId, classId, schoolId: ctx.schoolId },
      select: { id: true, name: true },
    });

    if (!section) {
      return {
        success: false,
        error: "Section not found in the selected class.",
      };
    }

    // 4. Verify subject belongs to this school
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, schoolId: ctx.schoolId },
      select: { id: true, name: true, code: true },
    });

    if (!subject) {
      return {
        success: false,
        error: "Subject not found in your school catalog.",
      };
    }

    // 5. Pre-check unique constraint for friendly error message
    const existing = await prisma.exam.findFirst({
      where: {
        schoolId: ctx.schoolId,
        classId,
        sectionId,
        subjectId,
        academicYear,
        name: name.trim(),
      },
      select: { id: true },
    });

    if (existing) {
      return {
        success: false,
        error: `An exam named "${name.trim()}" already exists for ${cls.name} / ${section.name} / ${subject.name} (${academicYear}).`,
      };
    }

    // 6. Parse optional examDate to UTC Date
    let examDateParsed: Date | null = null;
    if (examDate && examDate.trim().length > 0) {
      const [y, m, d] = examDate.split("-").map(Number);
      examDateParsed = new Date(Date.UTC(y, m - 1, d));
    }

    // 7. Create exam record
    const exam = await prisma.exam.create({
      data: {
        schoolId: ctx.schoolId,
        classId,
        sectionId,
        subjectId,
        academicYear,
        name: name.trim(),
        examType,
        maxMarks,
        passingMarks,
        examDate: examDateParsed,
        notes: notes?.trim() || null,
        createdById: ctx.userId,
      },
      select: { id: true },
    });

    // 8. Write audit log
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "EXAM_CREATED",
      entityType: "EXAM",
      entityId: exam.id,
      newValues: {
        name: name.trim(),
        examType,
        className: cls.name,
        sectionName: section.name,
        subjectName: subject.name,
        subjectCode: subject.code,
        maxMarks,
        passingMarks,
        academicYear,
        examDate: examDate ?? null,
      },
    });

    revalidatePath("/dashboard/exams");

    return { success: true, data: { id: exam.id } };
  } catch (err) {
    console.error("Error creating exam:", err);
    return {
      success: false,
      error: "An unexpected error occurred while creating the exam.",
    };
  }
}

// ─────────────────────────── updateExam ──────────────────────────────────

/**
 * Updates mutable Exam fields: name, examDate, notes.
 * maxMarks, passingMarks, examType, classId, sectionId, subjectId are immutable.
 * ADMIN only.
 */
export async function updateExam(
  input: UpdateExamInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: only administrators can edit exams.",
      };
    }

    const parsed = updateExamSchema.safeParse(input);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Invalid exam data.";
      return { success: false, error: firstError };
    }

    const { id, name, examDate, notes } = parsed.data;

    // Locate exam within this school tenant
    const exam = await prisma.exam.findFirst({
      where: { id, schoolId: ctx.schoolId },
      include: {
        class: { select: { name: true } },
        section: { select: { name: true } },
        subject: { select: { name: true } },
      },
    });

    if (!exam) {
      return {
        success: false,
        error: "Exam not found in your school records.",
      };
    }

    // Parse optional examDate
    let examDateParsed: Date | null = null;
    if (examDate && examDate.trim().length > 0) {
      const [y, m, d] = examDate.split("-").map(Number);
      examDateParsed = new Date(Date.UTC(y, m - 1, d));
    }

    // Compute diff for audit
    const oldVals: Record<string, unknown> = {
      name: exam.name,
      examDate: exam.examDate
        ? exam.examDate.toISOString().split("T")[0]
        : null,
      notes: exam.notes ?? null,
    };

    const newVals: Record<string, unknown> = {
      name: name.trim(),
      examDate: examDate?.trim() || null,
      notes: notes?.trim() || null,
    };

    const { oldValues, newValues } = diffChanges(oldVals, newVals);

    if (Object.keys(newValues).length > 0) {
      await prisma.exam.update({
        where: { id: exam.id },
        data: {
          name: name.trim(),
          examDate: examDateParsed,
          notes: notes?.trim() || null,
        },
      });

      await logAudit(ctx.schoolId, {
        userId: ctx.userId,
        action: "EXAM_UPDATED",
        entityType: "EXAM",
        entityId: exam.id,
        oldValues,
        newValues,
      });
    }

    revalidatePath("/dashboard/exams");

    return { success: true, data: { id: exam.id } };
  } catch (err) {
    console.error("Error updating exam:", err);
    return {
      success: false,
      error: "An unexpected error occurred while updating the exam.",
    };
  }
}

// ─────────────────────────── deleteExam ──────────────────────────────────

/**
 * Hard-deletes an Exam.
 * ADMIN only. Blocked when any ExamResult rows exist for this exam.
 * Writes a full pre-deletion snapshot to AuditLog before deletion.
 */
export async function deleteExam(
  examId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized: only administrators can delete exams.",
      };
    }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, schoolId: ctx.schoolId },
      include: {
        class: { select: { name: true } },
        section: { select: { name: true } },
        subject: { select: { name: true, code: true } },
        _count: { select: { results: true } },
      },
    });

    if (!exam) {
      return {
        success: false,
        error: "Exam not found in your school records.",
      };
    }

    // Guard: cannot delete exam that has result records
    if (exam._count.results > 0) {
      return {
        success: false,
        error: `Cannot delete "${exam.name}": ${exam._count.results} result record(s) exist. Remove all marks first.`,
      };
    }

    // Write pre-deletion snapshot to AuditLog
    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "EXAM_DELETED",
      entityType: "EXAM",
      entityId: exam.id,
      oldValues: {
        name: exam.name,
        examType: exam.examType,
        className: exam.class.name,
        sectionName: exam.section.name,
        subjectName: exam.subject.name,
        subjectCode: exam.subject.code,
        maxMarks: exam.maxMarks.toNumber(),
        passingMarks: exam.passingMarks.toNumber(),
        academicYear: exam.academicYear,
        examDate: exam.examDate
          ? exam.examDate.toISOString().split("T")[0]
          : null,
        notes: exam.notes ?? null,
        createdAt: exam.createdAt.toISOString(),
      },
    });

    await prisma.exam.delete({ where: { id: exam.id } });

    revalidatePath("/dashboard/exams");

    return { success: true, data: { id: exam.id } };
  } catch (err) {
    console.error("Error deleting exam:", err);
    return {
      success: false,
      error: "An unexpected error occurred while deleting the exam.",
    };
  }
}

// ─────────────────────────── getExamsForSection ───────────────────────────

/**
 * Fetches all exams for a given class/section (and optionally academic year).
 * Available to ADMIN and TEACHER.
 */
export async function getExamsForSection(
  input: GetExamsQueryInput
): Promise<ActionResult<ExamSummary[]>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error:
          "Unauthorized: only administrators and teachers can view exams.",
      };
    }

    const parsed = getExamsQuerySchema.safeParse(input);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Invalid query parameters.";
      return { success: false, error: firstError };
    }

    const { classId, sectionId, academicYear } = parsed.data;

    // Verify class + section ownership
    const cls = await prisma.class.findFirst({
      where: { id: classId, schoolId: ctx.schoolId },
      select: { id: true, name: true, academicYear: true },
    });

    if (!cls) {
      return {
        success: false,
        error: "Class not found in your school records.",
      };
    }

    const section = await prisma.section.findFirst({
      where: { id: sectionId, classId, schoolId: ctx.schoolId },
      select: { id: true, name: true },
    });

    if (!section) {
      return {
        success: false,
        error: "Section not found in the selected class.",
      };
    }

    const exams = await prisma.exam.findMany({
      where: {
        schoolId: ctx.schoolId,
        classId,
        sectionId,
        ...(academicYear ? { academicYear } : {}),
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { results: true } },
      },
      orderBy: [{ examDate: "asc" }, { createdAt: "asc" }],
    });

    const data: ExamSummary[] = exams.map((e) => ({
      id: e.id,
      name: e.name,
      examType: e.examType,
      subjectId: e.subject.id,
      subjectName: e.subject.name,
      subjectCode: e.subject.code,
      classId: cls.id,
      className: cls.name,
      sectionId: section.id,
      sectionName: section.name,
      academicYear: e.academicYear,
      maxMarks: e.maxMarks.toNumber(),
      passingMarks: e.passingMarks.toNumber(),
      examDate: e.examDate ? e.examDate.toISOString().split("T")[0] : null,
      notes: e.notes ?? null,
      resultCount: e._count.results,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));

    return { success: true, data };
  } catch (err) {
    console.error("Error fetching exams for section:", err);
    return {
      success: false,
      error: "An unexpected error occurred while loading exams.",
    };
  }
}

// ─────────────────────────── getExamDetail ───────────────────────────────

/**
 * Fetches a single exam with full detail and the list of enrolled students
 * plus their existing result rows (if any).
 * Available to ADMIN and TEACHER.
 */
export async function getExamDetail(
  examId: string
): Promise<ActionResult<ExamDetailData>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error: "Unauthorized: only administrators and teachers can view exam details.",
      };
    }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, schoolId: ctx.schoolId },
      include: {
        class: { select: { id: true, name: true, academicYear: true } },
        section: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        results: {
          select: {
            id: true,
            studentId: true,
            marksObtained: true,
            percentage: true,
            grade: true,
            isPassing: true,
            remarks: true,
          },
        },
      },
    });

    if (!exam) {
      return {
        success: false,
        error: "Exam not found in your school records.",
      };
    }

    // Fetch enrolled students for this class/section/academicYear
    const enrollments = await prisma.enrollment.findMany({
      where: {
        schoolId: ctx.schoolId,
        classId: exam.classId,
        sectionId: exam.sectionId,
        academicYear: exam.academicYear,
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

    // Build result lookup by studentId
    const resultMap = new Map(
      exam.results.map((r) => [r.studentId, r])
    );

    const students: ExamStudentResult[] = enrollments.map((e) => {
      const st = e.student;
      const result = resultMap.get(st.id) ?? null;
      return {
        studentId: st.id,
        admissionNumber: st.admissionNumber,
        name: `${st.firstName} ${st.lastName}`.trim(),
        gender: st.gender,
        marksObtained: result ? result.marksObtained.toNumber() : null,
        percentage: result ? result.percentage.toNumber() : null,
        grade: result ? (result.grade as GradeLabelValue) : null,
        isPassing: result ? result.isPassing : null,
        remarks: result ? result.remarks ?? null : null,
        resultId: result ? result.id : null,
      };
    });

    return {
      success: true,
      data: {
        id: exam.id,
        name: exam.name,
        examType: exam.examType,
        subjectId: exam.subject.id,
        subjectName: exam.subject.name,
        subjectCode: exam.subject.code,
        classId: exam.class.id,
        className: exam.class.name,
        sectionId: exam.section.id,
        sectionName: exam.section.name,
        academicYear: exam.academicYear,
        maxMarks: exam.maxMarks.toNumber(),
        passingMarks: exam.passingMarks.toNumber(),
        examDate: exam.examDate
          ? exam.examDate.toISOString().split("T")[0]
          : null,
        notes: exam.notes ?? null,
        createdAt: exam.createdAt.toISOString(),
        students,
      },
    };
  } catch (err) {
    console.error("Error fetching exam detail:", err);
    return {
      success: false,
      error: "An unexpected error occurred while loading exam details.",
    };
  }
}

// ─────────────────────────── saveExamResults ─────────────────────────────

/**
 * Saves (creates or updates) results for all students in a single exam.
 * ADMIN and TEACHER. Computes percentage, grade, and isPassing server-side.
 * Upserts each result in one atomic transaction.
 * Audit log records aggregate metrics only — never individual student marks.
 */
export async function saveExamResults(
  input: SaveExamResultsInput
): Promise<ActionResult<{ saved: number }>> {
  try {
    const ctx = await requireTenant();

    if (ctx.role !== "ADMIN" && ctx.role !== "TEACHER") {
      return {
        success: false,
        error:
          "Unauthorized: only administrators and teachers can enter exam marks.",
      };
    }

    const parsed = saveExamResultsSchema.safeParse(input);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Invalid marks data.";
      return { success: false, error: firstError };
    }

    const { examId, results } = parsed.data;

    // Fetch exam and verify school ownership
    const exam = await prisma.exam.findFirst({
      where: { id: examId, schoolId: ctx.schoolId },
      include: {
        class: { select: { name: true } },
        section: { select: { name: true } },
        subject: { select: { name: true } },
      },
    });

    if (!exam) {
      return {
        success: false,
        error: "Exam not found in your school records.",
      };
    }

    const maxMarks = exam.maxMarks.toNumber();
    const passingMarks = exam.passingMarks.toNumber();

    // Validate all marksObtained against maxMarks before any DB writes
    for (const row of results) {
      if (row.marksObtained > maxMarks) {
        return {
          success: false,
          error: `Marks obtained (${row.marksObtained}) cannot exceed max marks (${maxMarks}) for student ${row.studentId}.`,
        };
      }
    }

    // Validate each studentId has an ACTIVE enrollment in this exam's class/section/year
    const studentIds = results.map((r) => r.studentId);

    const validEnrollments = await prisma.enrollment.findMany({
      where: {
        schoolId: ctx.schoolId,
        classId: exam.classId,
        sectionId: exam.sectionId,
        academicYear: exam.academicYear,
        status: "ACTIVE",
        studentId: { in: studentIds },
        student: { status: "ACTIVE" },
      },
      select: { studentId: true },
    });

    const validStudentIds = new Set(validEnrollments.map((e) => e.studentId));

    const invalidStudents = studentIds.filter((id) => !validStudentIds.has(id));
    if (invalidStudents.length > 0) {
      return {
        success: false,
        error: `${invalidStudents.length} student(s) are not actively enrolled in the exam's class/section. Refresh the page and try again.`,
      };
    }

    // Compute derived fields and execute atomic upsert transaction
    const savedSession = await prisma.$transaction(async (tx) => {
      let savedCount = 0;

      for (const row of results) {
        const percentage = roundTo(
          (row.marksObtained / maxMarks) * 100,
          2
        );
        const grade = computeGrade(percentage) as GradeLabel;
        const isPassing = row.marksObtained >= passingMarks;

        await tx.examResult.upsert({
          where: {
            examId_studentId: {
              examId: exam.id,
              studentId: row.studentId,
            },
          },
          create: {
            schoolId: ctx.schoolId,
            examId: exam.id,
            studentId: row.studentId,
            marksObtained: row.marksObtained,
            percentage,
            grade,
            isPassing,
            remarks: row.remarks?.trim() || null,
            enteredById: ctx.userId,
          },
          update: {
            marksObtained: row.marksObtained,
            percentage,
            grade,
            isPassing,
            remarks: row.remarks?.trim() || null,
            enteredById: ctx.userId,
            updatedAt: new Date(),
          },
        });

        savedCount++;
      }

      return savedCount;
    });

    // Calculate aggregate metrics for audit log (never log individual marks)
    let passingCount = 0;
    let totalPercentage = 0;

    for (const row of results) {
      const pct = roundTo((row.marksObtained / maxMarks) * 100, 2);
      totalPercentage += pct;
      if (row.marksObtained >= passingMarks) passingCount++;
    }

    const averagePercentage =
      results.length > 0
        ? roundTo(totalPercentage / results.length, 2)
        : 0;

    await logAudit(ctx.schoolId, {
      userId: ctx.userId,
      action: "EXAM_RESULTS_SAVED",
      entityType: "EXAM",
      entityId: exam.id,
      newValues: {
        examName: exam.name,
        className: exam.class.name,
        sectionName: exam.section.name,
        subjectName: exam.subject.name,
        academicYear: exam.academicYear,
        totalStudents: results.length,
        resultCount: savedSession,
        passingCount,
        failingCount: results.length - passingCount,
        averagePercentage,
      },
    });

    revalidatePath("/dashboard/exams");
    revalidatePath(`/dashboard/exams/${exam.id}`);

    return { success: true, data: { saved: savedSession } };
  } catch (err) {
    console.error("Error saving exam results:", err);
    return {
      success: false,
      error: "An unexpected error occurred while saving marks.",
    };
  }
}
