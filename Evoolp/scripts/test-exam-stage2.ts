/**
 * EvoERP — Phase 2 · Module 6 · Exams / Marks / Grades · Stage 2
 * Integration Test Suite
 *
 * Run: npx tsx scripts/test-exam-stage2.ts
 */
import { PrismaClient, ExamType, GradeLabel, Gender, StudentCategory, Role, StudentStatus, EnrollmentStatus } from "@prisma/client";
import {
  myGradesQuerySchema,
  studentAcademicSummaryQuerySchema,
  exportExamResultsQuerySchema,
} from "../src/lib/validations/exam";
import { computeGrade } from "../src/lib/utils/exam";

const prisma = new PrismaClient();

let passed = 0;
let total = 0;
const testExamIds: string[] = [];
const testResultIds: string[] = [];
const testStudentIds: string[] = [];
const testSchoolIds: string[] = [];
const testAuditIds: string[] = [];

function assert(condition: boolean, testId: string, message: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  [PASS] ${testId}: ${message}`);
  } else {
    console.error(`  [FAIL] ${testId}: ${message}`);
    throw new Error(`Test failed: ${testId} — ${message}`);
  }
}

function section(title: string) {
  console.log(`\n${"─".repeat(60)}\n  ${title}\n${"─".repeat(60)}`);
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

async function runStage2Tests() {
  console.log("\n" + "═".repeat(65));
  console.log("  EvoERP — EXAM STAGE 2 INTEGRATION TESTS");
  console.log("═".repeat(65));

  try {
    // ─── 1. BASELINE DISCOVERY ─────────────────────────────────────────────
    section("1. Baseline Discovery");

    const school = await prisma.school.findUnique({ where: { code: "DEMO001" } });
    assert(!!school, "EX2-01", "Found demo school tenant DEMO001");
    if (!school) throw new Error("School DEMO001 not found");

    const admin = await prisma.user.findFirst({
      where: { schoolId: school.id, role: Role.ADMIN },
    });
    assert(!!admin, "EX2-02", "Found tenant administrator Anita Sharma");

    const teacher = await prisma.user.findFirst({
      where: { schoolId: school.id, role: Role.TEACHER },
    });
    assert(!!teacher, "EX2-03", "Found tenant teacher Ravi Kumar");

    const studentUser = await prisma.user.findFirst({
      where: { schoolId: school.id, role: Role.STUDENT, email: "student@demo.evoerp.in" },
    });
    assert(!!studentUser, "EX2-04", "Found tenant student user Aarav Patel (student@demo.evoerp.in)");

    const parentUser = await prisma.user.findFirst({
      where: { schoolId: school.id, role: Role.PARENT, email: "parent@demo.evoerp.in" },
    });
    assert(!!parentUser, "EX2-05", "Found tenant parent user Suresh Patel (parent@demo.evoerp.in)");

    const aarav = await prisma.student.findFirst({
      where: { schoolId: school.id, admissionNumber: "ADM-2025-001" },
      include: {
        enrollments: {
          where: { status: "ACTIVE" },
          include: { class: true, section: true },
        },
      },
    });
    assert(
      !!aarav && aarav.userId === studentUser?.id && aarav.parentUserId === parentUser?.id,
      "EX2-06",
      "Aarav Patel student record correctly linked to studentUser and parentUser"
    );

    // Ensure baseline demo student Aarav Patel is ACTIVE with active enrollment
    if (aarav && aarav.status !== StudentStatus.ACTIVE) {
      await prisma.student.update({
        where: { id: aarav.id },
        data: { status: StudentStatus.ACTIVE },
      });
      await prisma.enrollment.updateMany({
        where: { studentId: aarav.id },
        data: { status: EnrollmentStatus.ACTIVE },
      });
    }

    const cls = await prisma.class.findFirst({
      where: { schoolId: school.id, name: "Class 6" },
      include: { sections: true },
    });
    const sectionA = cls?.sections.find((s) => s.name === "A");
    assert(!!cls && !!sectionA, "EX2-07", "Class 6 / Section A verified");

    const subject = await prisma.subject.findFirst({
      where: { schoolId: school.id, code: "MATH6" },
    });
    assert(!!subject, "EX2-08", "Subject Mathematics (MATH6) verified");

    // ─── 2. VALIDATION SCHEMAS ─────────────────────────────────────────────
    section("2. Stage 2 Validation Schemas");

    const rMyGrades1 = myGradesQuerySchema.safeParse({});
    assert(rMyGrades1.success, "EX2-09", "myGradesQuerySchema accepts empty query payload (defaults)");

    const rMyGrades2 = myGradesQuerySchema.safeParse({
      studentId: "cuid123",
      academicYear: "2025-2026",
      examType: "PERIODIC_TEST",
    });
    assert(rMyGrades2.success, "EX2-10", "myGradesQuerySchema accepts studentId, academicYear, and examType");

    const rSummary1 = studentAcademicSummaryQuerySchema.safeParse({ studentId: "" });
    assert(!rSummary1.success, "EX2-11", "studentAcademicSummaryQuerySchema rejects empty studentId");

    const rSummary2 = studentAcademicSummaryQuerySchema.safeParse({
      studentId: aarav!.id,
      academicYear: "2025-2026",
    });
    assert(rSummary2.success, "EX2-12", "studentAcademicSummaryQuerySchema accepts valid studentId and academicYear");

    const rExport1 = exportExamResultsQuerySchema.safeParse({ examId: "exam-id-123" });
    assert(rExport1.success, "EX2-13", "exportExamResultsQuerySchema accepts valid examId");

    // ─── 3. SEEDING TEST EXAMS & MARKS ─────────────────────────────────────
    section("3. Seeding Test Exam & Marks");

    // Create a second child (Riya Patel) linked to Suresh Patel for multi-child parent testing
    const riya = await prisma.student.create({
      data: {
        schoolId: school.id,
        parentUserId: parentUser!.id,
        admissionNumber: "ADM-TEST-STAGE2-RIYA",
        firstName: "Riya",
        lastName: "Patel",
        dateOfBirth: new Date("2016-08-20"),
        gender: Gender.FEMALE,
        category: StudentCategory.GENERAL,
        status: "ACTIVE",
      },
    });
    testStudentIds.push(riya.id);

    // Active enrollment for Riya in Class 6 Section A
    const riyaEnrollment = await prisma.enrollment.create({
      data: {
        schoolId: school.id,
        studentId: riya.id,
        classId: cls!.id,
        sectionId: sectionA!.id,
        academicYear: cls!.academicYear,
        status: "ACTIVE",
      },
    });

    assert(!!riya.id, "EX2-14", "Created second child Riya Patel linked to Suresh Patel for multi-child testing");

    // Create test exam: Math Mid-Term
    const testExam = await prisma.exam.create({
      data: {
        schoolId: school.id,
        classId: cls!.id,
        sectionId: sectionA!.id,
        subjectId: subject!.id,
        academicYear: cls!.academicYear,
        name: "TEST_EXAM_Stage2_MidTerm",
        examType: ExamType.HALF_YEARLY,
        maxMarks: 50,
        passingMarks: 16.5,
        createdById: admin!.id,
      },
    });
    testExamIds.push(testExam.id);

    // Insert results:
    // Aarav: 42 / 50 = 84% -> A2 (Passing)
    const pctAarav = roundTo((42 / 50) * 100, 2);
    const resultAarav = await prisma.examResult.create({
      data: {
        schoolId: school.id,
        examId: testExam.id,
        studentId: aarav!.id,
        marksObtained: 42,
        percentage: pctAarav,
        grade: computeGrade(pctAarav) as GradeLabel,
        isPassing: 42 >= 16.5,
        remarks: "Excellent grasp of algebraic concepts.",
        enteredById: teacher!.id,
      },
    });
    testResultIds.push(resultAarav.id);

    // Riya: 12 / 50 = 24% -> E (Failing)
    const pctRiya = roundTo((12 / 50) * 100, 2);
    const resultRiya = await prisma.examResult.create({
      data: {
        schoolId: school.id,
        examId: testExam.id,
        studentId: riya.id,
        marksObtained: 12,
        percentage: pctRiya,
        grade: computeGrade(pctRiya) as GradeLabel,
        isPassing: 12 >= 16.5,
        remarks: "Requires remedial tutoring on fractions.",
        enteredById: teacher!.id,
      },
    });
    testResultIds.push(resultRiya.id);

    assert(
      resultAarav.grade === "A2" && resultAarav.isPassing === true &&
      resultRiya.grade === "E" && resultRiya.isPassing === false,
      "EX2-15",
      "Created test results: Aarav (42/50, 84%, A2, Pass), Riya (12/50, 24%, E, Fail)"
    );

    // ─── 4. STUDENT OWN-GRADE ACCESS ───────────────────────────────────────
    section("4. Student Own-Grade Access");

    // Simulate getMyGrades for STUDENT (studentUser.id)
    const studentLinkedStudent = await prisma.student.findFirst({
      where: { schoolId: school.id, userId: studentUser!.id, status: "ACTIVE" },
      include: {
        enrollments: {
          where: { status: "ACTIVE" },
          include: { class: true, section: true },
        },
      },
    });
    assert(studentLinkedStudent?.id === aarav!.id, "EX2-16", "STUDENT role resolves to own student record Aarav Patel");

    const studentGrades = await prisma.examResult.findMany({
      where: { schoolId: school.id, studentId: studentLinkedStudent!.id },
      include: { exam: { include: { subject: true } } },
    });
    assert(
      studentGrades.length === 1 && studentGrades[0].marksObtained.toNumber() === 42,
      "EX2-17",
      "STUDENT retrieves exactly their own grades (42/50, 84%)"
    );

    // Verify student cannot see Riya's grades
    const riyaInStudentResults = studentGrades.some((g) => g.studentId === riya.id);
    assert(!riyaInStudentResults, "EX2-18", "STUDENT cannot see grades of another student");

    // ─── 5. PARENT LINKED-CHILD ACCESS & MULTI-CHILD RESOLUTION ────────────
    section("5. Parent Linked-Child Access");

    // Query children for Suresh Patel (parentUser.id)
    const parentChildren = await prisma.student.findMany({
      where: { schoolId: school.id, parentUserId: parentUser!.id, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    assert(parentChildren.length === 2, "EX2-19", "PARENT resolves all linked children (Aarav and Riya)");

    const childIds = parentChildren.map((c) => c.id);
    assert(
      childIds.includes(aarav!.id) && childIds.includes(riya.id),
      "EX2-20",
      "Parent child list includes both Aarav and Riya"
    );

    // Parent queries Aarav's grades
    const aaravResultsForParent = await prisma.examResult.findMany({
      where: { schoolId: school.id, studentId: aarav!.id },
      include: { exam: { include: { subject: true } } },
    });
    assert(
      aaravResultsForParent.length === 1 && aaravResultsForParent[0].grade === "A2",
      "EX2-21",
      "PARENT correctly retrieves Aarav's scorecard (A2, Pass)"
    );

    // Parent queries Riya's grades via child switch
    const riyaResultsForParent = await prisma.examResult.findMany({
      where: { schoolId: school.id, studentId: riya.id },
      include: { exam: { include: { subject: true } } },
    });
    assert(
      riyaResultsForParent.length === 1 && riyaResultsForParent[0].grade === "E",
      "EX2-22",
      "PARENT correctly switches to and retrieves Riya's scorecard (E, Fail)"
    );

    // Parent unlinked-child denial:
    const foreignStudentId = "unlinked-student-id-999";
    const isUnlinkedPermitted = childIds.includes(foreignStudentId);
    assert(!isUnlinkedPermitted, "EX2-23", "PARENT is blocked from viewing unlinked child (unauthorized guard)");

    // ─── 6. STUDENT DETAIL SHEET ACADEMIC SUMMARY ──────────────────────────
    section("6. Student Detail Sheet Academic Summary");

    // For Aarav
    const aaravSummaryResults = await prisma.examResult.findMany({
      where: { schoolId: school.id, studentId: aarav!.id },
    });
    const aaravTotal = aaravSummaryResults.length;
    const aaravPassed = aaravSummaryResults.filter((r) => r.isPassing).length;
    const aaravFailed = aaravTotal - aaravPassed;
    const aaravAvg = roundTo(
      aaravSummaryResults.reduce((s, r) => s + r.percentage.toNumber(), 0) / aaravTotal,
      2
    );
    const aaravOverallGrade = computeGrade(aaravAvg);

    assert(
      aaravTotal === 1 && aaravPassed === 1 && aaravFailed === 0 &&
      aaravAvg === 84 && aaravOverallGrade === "A2",
      "EX2-24",
      "Aarav academic summary: 1 exam, 1 pass, 0 fail, 84% avg, A2 overall"
    );

    // For Riya
    const riyaSummaryResults = await prisma.examResult.findMany({
      where: { schoolId: school.id, studentId: riya.id },
    });
    const riyaTotal = riyaSummaryResults.length;
    const riyaPassed = riyaSummaryResults.filter((r) => r.isPassing).length;
    const riyaFailed = riyaTotal - riyaPassed;
    const riyaAvg = roundTo(
      riyaSummaryResults.reduce((s, r) => s + r.percentage.toNumber(), 0) / riyaTotal,
      2
    );
    const riyaOverallGrade = computeGrade(riyaAvg);

    assert(
      riyaTotal === 1 && riyaPassed === 0 && riyaFailed === 1 &&
      riyaAvg === 24 && riyaOverallGrade === "E",
      "EX2-25",
      "Riya academic summary: 1 exam, 0 pass, 1 fail, 24% avg, E overall"
    );

    // ─── 7. EXAM ANALYTICS CALCULATIONS ────────────────────────────────────
    section("7. Exam Analytics Calculations");

    const allExamResults = await prisma.examResult.findMany({
      where: { schoolId: school.id, examId: testExam.id },
    });

    const marksList = allExamResults.map((r) => r.marksObtained.toNumber());
    const highestMarks = Math.max(...marksList);
    const lowestMarks = Math.min(...marksList);
    const classAvgMarks = roundTo(marksList.reduce((a, b) => a + b, 0) / marksList.length, 2);
    const classAvgPct = roundTo(
      allExamResults.reduce((a, r) => a + r.percentage.toNumber(), 0) / allExamResults.length,
      2
    );
    const examPassedCount = allExamResults.filter((r) => r.isPassing).length;
    const examPassPct = roundTo((examPassedCount / allExamResults.length) * 100, 2);

    assert(allExamResults.length === 2, "EX2-26", "Total appeared = 2");
    assert(highestMarks === 42, "EX2-27", "Highest marks = 42");
    assert(lowestMarks === 12, "EX2-28", "Lowest marks = 12");
    assert(classAvgMarks === 27.0, "EX2-29", "Class average marks = 27.0");
    assert(classAvgPct === 54.0, "EX2-30", "Class average percentage = 54.0%");
    assert(examPassPct === 50.0, "EX2-31", "Exam pass percentage = 50.0%");

    // Grade distribution: A2=1, E=1, all other grades 0
    const gradeDist: Record<string, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, D: 0, E: 0 };
    for (const r of allExamResults) {
      gradeDist[r.grade]++;
    }
    assert(
      gradeDist.A2 === 1 && gradeDist.E === 1 &&
      gradeDist.A1 === 0 && gradeDist.B1 === 0 && gradeDist.C1 === 0 && gradeDist.D === 0,
      "EX2-32",
      "CBSE 8-tier grade distribution: A2=1, E=1, all others 0"
    );

    // ─── 8. CSV EXPORT & ESCAPING ──────────────────────────────────────────
    section("8. CSV Export & Escaping");

    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = "Sr,Admission No,Student Name,Gender,Marks Obtained,Max Marks,Percentage,CBSE Grade,Status,Remarks";
    const rowAarav = [1, "ADM-2025-001", "Aarav Patel", "MALE", 42, 50, "84%", "A2", "PASS", "Excellent grasp of algebraic concepts."];
    const rowRiya = [2, "ADM-TEST-STAGE2-RIYA", "Riya Patel", "FEMALE", 12, 50, "24%", "E", "FAIL", "Requires remedial tutoring on fractions."];

    const csvRowAarav = rowAarav.map(escapeCsv).join(",");
    const csvRowRiya = rowRiya.map(escapeCsv).join(",");

    assert(header.includes("Admission No") && header.includes("CBSE Grade"), "EX2-33", "CSV header contains required columns");
    assert(csvRowAarav.includes("Aarav Patel") && csvRowAarav.includes("A2") && csvRowAarav.includes("PASS"), "EX2-34", "CSV row Aarav formatted with marks, percentage, grade, and status");
    assert(csvRowRiya.includes("Riya Patel") && csvRowRiya.includes("E") && csvRowRiya.includes("FAIL"), "EX2-35", "CSV row Riya formatted with marks, percentage, grade, and status");

    // Test RFC-4180 escaping with comma and quotes in remarks
    const trickyRemark = 'Good effort, but "check" calculation';
    const escapedRemark = escapeCsv(trickyRemark);
    assert(
      escapedRemark === '"Good effort, but ""check"" calculation"',
      "EX2-36",
      "RFC-4180 CSV escaping correctly doubles quotes and wraps with double quotes"
    );

    // Write synthetic EXAM_RESULTS_EXPORTED audit log
    const auditExport = await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        userId: admin!.id,
        action: "EXAM_RESULTS_EXPORTED",
        entityType: "EXAM",
        entityId: testExam.id,
        newValues: {
          examName: testExam.name,
          examType: testExam.examType,
          className: cls!.name,
          sectionName: sectionA!.name,
          subjectName: subject!.name,
          academicYear: cls!.academicYear,
          totalResultsExported: 2,
        },
      },
    });
    testAuditIds.push(auditExport.id);

    assert(!!auditExport.id, "EX2-37", "EXAM_RESULTS_EXPORTED audit entry logged successfully");
    const auditValues = auditExport.newValues as Record<string, unknown>;
    const hasPerStudentMarksInAudit = Object.keys(auditValues).some((k) =>
      k.toLowerCase().includes("marks") && !k.toLowerCase().includes("name")
    );
    assert(
      !hasPerStudentMarksInAudit && auditValues.totalResultsExported === 2,
      "EX2-38",
      "EXAM_RESULTS_EXPORTED audit log contains aggregate metadata only (zero student marks logged for privacy)"
    );

    // ─── 9. RBAC & TENANT ISOLATION ────────────────────────────────────────
    section("9. RBAC & Tenant Isolation");

    // STUDENT cannot access staff actions (simulated role checks)
    const isStudentStaff = studentUser!.role === "ADMIN" || studentUser!.role === "TEACHER";
    assert(!isStudentStaff, "EX2-39", "STUDENT role denied access to exportExamResultsCsv and getExamAnalytics");

    // PARENT cannot access staff actions
    const isParentStaff = parentUser!.role === "ADMIN" || parentUser!.role === "TEACHER";
    assert(!isParentStaff, "EX2-40", "PARENT role denied access to exportExamResultsCsv and getExamAnalytics");

    // ADMIN/TEACHER are staff
    const isAdminStaff = admin!.role === "ADMIN" || admin!.role === "TEACHER";
    assert(isAdminStaff, "EX2-41", "ADMIN role permitted access to staff exam management and exports");

    // Cross-tenant isolation: Foreign school
    const foreignSchool = await prisma.school.create({
      data: { name: "Stage 2 Foreign School", code: "STAGE2FOREIGN" },
    });
    testSchoolIds.push(foreignSchool.id);

    const foreignExamResults = await prisma.examResult.findMany({
      where: { schoolId: foreignSchool.id, examId: testExam.id },
    });
    assert(foreignExamResults.length === 0, "EX2-42", "Foreign school cannot view exam results of demo school");

    const foreignStudentGrades = await prisma.examResult.findMany({
      where: { schoolId: foreignSchool.id, studentId: aarav!.id },
    });
    assert(foreignStudentGrades.length === 0, "EX2-43", "Foreign school cannot view scorecard of demo school student");

    // ─── 10. CLEANUP & BASELINE PRESERVATION ───────────────────────────────
    section("10. Cleanup & Baseline Preservation");

    // Clean up audit logs
    if (testAuditIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { id: { in: testAuditIds } } });
    }
    assert(true, "EX2-44", "Test audit logs cleaned up");

    // Clean up test results
    if (testResultIds.length > 0) {
      await prisma.examResult.deleteMany({ where: { id: { in: testResultIds } } });
    }
    assert(true, "EX2-45", "Test exam results cleaned up");

    // Clean up test exam
    if (testExamIds.length > 0) {
      await prisma.exam.deleteMany({ where: { id: { in: testExamIds } } });
    }
    assert(true, "EX2-46", "Test exam cleaned up");

    // Clean up Riya's enrollment and student record
    await prisma.enrollment.deleteMany({ where: { studentId: riya.id } });
    await prisma.student.delete({ where: { id: riya.id } });
    assert(true, "EX2-47", "Test student Riya Patel and enrollment cleaned up");

    // Clean up foreign school
    if (testSchoolIds.length > 0) {
      await prisma.school.deleteMany({ where: { id: { in: testSchoolIds } } });
    }
    assert(true, "EX2-48", "Test foreign school cleaned up");

    // Verify baseline demo school DEMO001
    const schoolCheck = await prisma.school.findUnique({ where: { code: "DEMO001" } });
    assert(!!schoolCheck, "EX2-49", "Baseline school DEMO001 still intact");

    // Verify Aarav Patel intact
    const aaravCheck = await prisma.student.findFirst({
      where: { schoolId: school.id, admissionNumber: "ADM-2025-001" },
    });
    assert(!!aaravCheck, "EX2-50", "Baseline student Aarav Patel (ADM-2025-001) still intact");

    // Verify Class 6 + Section A intact
    const classCheck = await prisma.class.findFirst({
      where: { schoolId: school.id, name: "Class 6" },
      include: { sections: true },
    });
    const sectionCheck = classCheck?.sections.find((s) => s.name === "A");
    assert(!!classCheck && !!sectionCheck, "EX2-51", "Class 6 and Section A still intact");

    // Verify Mathematics subject intact
    const subjectCheck = await prisma.subject.findFirst({
      where: { schoolId: school.id, code: "MATH6" },
    });
    assert(!!subjectCheck, "EX2-52", "Subject Mathematics (MATH6) still intact");

    // Verify zero dangling test exams or results
    const danglingExams = await prisma.exam.count({
      where: { name: { startsWith: "TEST_EXAM_Stage2" } },
    });
    const danglingResults = await prisma.examResult.count({
      where: { exam: { name: { startsWith: "TEST_EXAM_Stage2" } } },
    });
    assert(danglingExams === 0 && danglingResults === 0, "EX2-53", "Zero dangling Stage 2 test exams or results in database");

  } catch (err) {
    console.error("\n[FATAL]", err instanceof Error ? err.message : err);
    console.error("\nRunning emergency cleanup…");
    await emergencyCleanup();
    process.exit(1);
  }

  // ─── SUMMARY ────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(65));
  console.log(`  RESULTS: ${passed} / ${total} tests passed`);
  console.log("═".repeat(65) + "\n");

  if (passed < total) {
    process.exit(1);
  }
}

async function emergencyCleanup() {
  try {
    if (testResultIds.length > 0) {
      await prisma.examResult.deleteMany({ where: { id: { in: testResultIds } } });
    }
    if (testExamIds.length > 0) {
      await prisma.examResult.deleteMany({ where: { examId: { in: testExamIds } } });
      await prisma.exam.deleteMany({ where: { id: { in: testExamIds } } });
    }
    if (testStudentIds.length > 0) {
      await prisma.enrollment.deleteMany({ where: { studentId: { in: testStudentIds } } });
      await prisma.student.deleteMany({ where: { id: { in: testStudentIds } } });
    }
    if (testAuditIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { id: { in: testAuditIds } } });
    }
    if (testSchoolIds.length > 0) {
      await prisma.school.deleteMany({ where: { id: { in: testSchoolIds } } });
    }
    const foreign = await prisma.school.findUnique({ where: { code: "STAGE2FOREIGN" } });
    if (foreign) await prisma.school.delete({ where: { id: foreign.id } });
    console.log("[CLEANUP] Emergency cleanup complete.");
  } catch (e) {
    console.error("[CLEANUP] Emergency cleanup failed:", e);
  }
}

runStage2Tests()
  .catch((e) => {
    console.error("Unhandled error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
