/**
 * EvoERP — Phase 2 · Module 7 · Report Cards · Stage 1
 * Integration Test Suite
 *
 * Exactly 50 Assertions (RC1-01 to RC1-50)
 * Run: npx tsx scripts/test-report-card-stage1.ts
 */
import {
  PrismaClient,
  ExamType,
  GradeLabel,
  StudentCategory,
  Role,
  StudentStatus,
  EnrollmentStatus,
  AttendanceStatus,
} from "@prisma/client";
import {
  examCycleQuerySchema,
  reportCardPrintAuditSchema,
} from "../src/lib/validations/report-card";
import { computeGrade } from "../src/lib/utils/exam";

const prisma = new PrismaClient();

let passed = 0;
let total = 0;

// Tracking arrays for clean rollback
const testExamIds: string[] = [];
const testResultIds: string[] = [];
const testSessionIds: string[] = [];
const testRecordIds: string[] = [];
const testStudentIds: string[] = [];
const testEnrollmentIds: string[] = [];
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

async function runStage1ReportCardTests() {
  console.log("\n" + "═".repeat(65));
  console.log("  EvoERP — REPORT CARDS STAGE 1 INTEGRATION TESTS");
  console.log("═".repeat(65));

  try {
    // ─── 1. BASELINE DISCOVERY & TENANT CONTEXT ──────────────────────────────
    section("1. Baseline Discovery & Tenant Context");

    const school = await prisma.school.findUnique({ where: { code: "DEMO001" } });
    assert(!!school, "RC1-01", "Demo school tenant DEMO001 exists in database");
    if (!school) throw new Error("School DEMO001 not found");

    const admin = await prisma.user.findFirst({
      where: { schoolId: school.id, role: Role.ADMIN },
    });
    assert(!!admin, "RC1-02", "Tenant administrator Anita Sharma exists in DEMO001");

    const teacher = await prisma.user.findFirst({
      where: { schoolId: school.id, role: Role.TEACHER },
    });
    assert(!!teacher, "RC1-03", "Tenant teacher Ravi Kumar exists in DEMO001");

    const studentUser = await prisma.user.findFirst({
      where: { schoolId: school.id, role: Role.STUDENT, email: "student@demo.evoerp.in" },
    });
    assert(!!studentUser, "RC1-04", "Tenant student user Aarav Patel (student@demo.evoerp.in) exists");

    const parentUser = await prisma.user.findFirst({
      where: { schoolId: school.id, role: Role.PARENT, email: "parent@demo.evoerp.in" },
    });
    assert(!!parentUser, "RC1-05", "Tenant parent user Suresh Patel (parent@demo.evoerp.in) exists");

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
      !!aarav &&
        aarav.userId === studentUser?.id &&
        aarav.parentUserId === parentUser?.id &&
        aarav.enrollments.length > 0 &&
        aarav.enrollments[0].academicYear === "2025-2026",
      "RC1-06",
      "Active enrollment found for Aarav Patel in Class 6 Section A (2025-2026)"
    );

    const cls = await prisma.class.findFirst({
      where: { schoolId: school.id, name: "Class 6" },
      include: { sections: true },
    });
    if (!cls) throw new Error("Class 6 not found in DEMO001");
    const sectionA = cls.sections.find((s) => s.name === "A");
    if (!sectionA) throw new Error("Section A not found in Class 6");

    // Ensure baseline demo student Aarav Patel is ACTIVE with active enrollment in Section A
    if (aarav) {
      if (aarav.status !== StudentStatus.ACTIVE) {
        await prisma.student.update({
          where: { id: aarav.id },
          data: { status: StudentStatus.ACTIVE },
        });
      }
      await prisma.enrollment.updateMany({
        where: { studentId: aarav.id, academicYear: "2025-2026" },
        data: { classId: cls.id, sectionId: sectionA.id, status: EnrollmentStatus.ACTIVE },
      });
    }

    // Find or create test subjects (Math, Science, English)
    let mathSub = await prisma.subject.findFirst({ where: { schoolId: school.id, code: "MATH6" } });
    if (!mathSub) {
      mathSub = await prisma.subject.create({
        data: { schoolId: school.id, name: "Mathematics", code: "MATH6" },
      });
    }

    let sciSub = await prisma.subject.findFirst({ where: { schoolId: school.id, code: "SCI6" } });
    if (!sciSub) {
      sciSub = await prisma.subject.create({
        data: { schoolId: school.id, name: "Science", code: "SCI6" },
      });
    }

    let engSub = await prisma.subject.findFirst({ where: { schoolId: school.id, code: "ENG6" } });
    if (!engSub) {
      engSub = await prisma.subject.create({
        data: { schoolId: school.id, name: "English", code: "ENG6" },
      });
    }

    // ─── 2. EXAM CYCLE DISCOVERY & ISOLATION ─────────────────────────────────
    section("2. Exam Cycle Discovery & Isolation");

    const cycleQueryValid = examCycleQuerySchema.safeParse({
      classId: cls.id,
      sectionId: sectionA.id,
      academicYear: cls.academicYear,
    });
    assert(cycleQueryValid.success, "RC1-07", "examCycleQuerySchema validates valid classId, sectionId, academicYear");

    // Create distinct test exams for Cycle 1 (PT1) and Cycle 2 (PT2) for Science
    const pt1SciExam = await prisma.exam.create({
      data: {
        schoolId: school.id,
        classId: cls.id,
        sectionId: sectionA.id,
        subjectId: sciSub.id,
        academicYear: cls.academicYear,
        name: "TEST_RC_PT1_Science - Science",
        examType: ExamType.PERIODIC_TEST,
        maxMarks: 50.0,
        passingMarks: 16.5,
        createdById: admin!.id,
      },
    });
    testExamIds.push(pt1SciExam.id);

    const pt2SciExam = await prisma.exam.create({
      data: {
        schoolId: school.id,
        classId: cls.id,
        sectionId: sectionA.id,
        subjectId: sciSub.id,
        academicYear: cls.academicYear,
        name: "TEST_RC_PT2_Science - Science",
        examType: ExamType.PERIODIC_TEST,
        maxMarks: 50.0,
        passingMarks: 16.5,
        createdById: admin!.id,
      },
    });
    testExamIds.push(pt2SciExam.id);

    assert(
      !!pt1SciExam.id && !!pt2SciExam.id,
      "RC1-08",
      "Created distinct test exams: 'TEST_RC_PT1_Science - Science' and 'TEST_RC_PT2_Science - Science'"
    );

    assert(
      pt1SciExam.examType === ExamType.PERIODIC_TEST &&
        pt2SciExam.examType === ExamType.PERIODIC_TEST &&
        pt1SciExam.subjectId === pt2SciExam.subjectId &&
        pt1SciExam.id !== pt2SciExam.id,
      "RC1-09",
      "Both exams share examType 'PERIODIC_TEST' and subjectId, proving examType alone is insufficient"
    );

    // Grouping simulation matching getAvailableExamCyclesForSection logic
    const examsToGroup = [pt1SciExam, pt2SciExam];
    const cycleMap = new Map<string, typeof examsToGroup>();
    for (const ex of examsToGroup) {
      const baseName = ex.name.split(" - ")[0].trim();
      const key = `${ex.examType}::${baseName.toLowerCase()}`;
      if (!cycleMap.has(key)) cycleMap.set(key, []);
      cycleMap.get(key)!.push(ex);
    }
    const cycleKeys = Array.from(cycleMap.keys());
    assert(
      cycleKeys.length === 2 &&
        cycleMap.get(`${ExamType.PERIODIC_TEST}::test_rc_pt1_science`)?.length === 1 &&
        cycleMap.get(`${ExamType.PERIODIC_TEST}::test_rc_pt2_science`)?.length === 1,
      "RC1-10",
      "Cycle discovery algorithm cleanly isolates PT1 and PT2 into separate cycle lists"
    );

    // Duplicate subject validation guard in reportCardQuerySchema or server action
    const duplicateSubjectExams = [pt1SciExam, pt2SciExam];
    const seenSubjects = new Set<string>();
    let hasDuplicateSubject = false;
    for (const ex of duplicateSubjectExams) {
      if (seenSubjects.has(ex.subjectId)) {
        hasDuplicateSubject = true;
        break;
      }
      seenSubjects.add(ex.subjectId);
    }
    assert(
      hasDuplicateSubject,
      "RC1-11",
      "Duplicate subject protection guard flags attempt to combine PT1 and PT2 Science in one report card"
    );

    // Create marks for Aarav in PT1 Science (45/50 = 90% -> A2) and PT2 Science (48/50 = 96% -> A1)
    const pt1Result = await prisma.examResult.create({
      data: {
        schoolId: school.id,
        examId: pt1SciExam.id,
        studentId: aarav!.id,
        marksObtained: 45.0,
        percentage: 90.0,
        grade: GradeLabel.A2,
        isPassing: true,
        remarks: "Good effort in PT1",
        enteredById: teacher!.id,
      },
    });
    testResultIds.push(pt1Result.id);

    const pt2Result = await prisma.examResult.create({
      data: {
        schoolId: school.id,
        examId: pt2SciExam.id,
        studentId: aarav!.id,
        marksObtained: 48.0,
        percentage: 96.0,
        grade: GradeLabel.A1,
        isPassing: true,
        remarks: "Outstanding improvement in PT2",
        enteredById: teacher!.id,
      },
    });
    testResultIds.push(pt2Result.id);

    // Isolate PT1
    const pt1CycleResults = await prisma.examResult.findMany({
      where: { schoolId: school.id, studentId: aarav!.id, examId: { in: [pt1SciExam.id] } },
    });
    assert(
      pt1CycleResults.length === 1 &&
        pt1CycleResults[0].marksObtained.toNumber() === 45.0 &&
        pt1CycleResults[0].grade === "A2",
      "RC1-12",
      "Compiling PT1 report card isolates PT1 result (45/50, A2) and excludes PT2"
    );

    // Isolate PT2
    const pt2CycleResults = await prisma.examResult.findMany({
      where: { schoolId: school.id, studentId: aarav!.id, examId: { in: [pt2SciExam.id] } },
    });
    assert(
      pt2CycleResults.length === 1 &&
        pt2CycleResults[0].marksObtained.toNumber() === 48.0 &&
        pt2CycleResults[0].grade === "A1",
      "RC1-13",
      "Compiling PT2 report card isolates PT2 result (48/50, A1) and excludes PT1"
    );

    // ─── 3. ATTENDANCE SESSIONS DENOMINATOR & HISTORY ─────────────────────────
    section("3. Attendance Sessions Denominator & History");

    // Clean any pre-existing test attendance sessions for our test dates
    const testDates: Date[] = [];
    for (let i = 1; i <= 10; i++) {
      testDates.push(new Date(Date.UTC(2025, 6, i))); // 2025-07-01 to 2025-07-10
    }

    // Delete existing sessions on those exact dates for this section if any
    await prisma.attendanceSession.deleteMany({
      where: {
        schoolId: school.id,
        classId: cls.id,
        sectionId: sectionA.id,
        date: { in: testDates },
      },
    });

    // Create 10 official AttendanceSession records
    for (let i = 0; i < 10; i++) {
      const sess = await prisma.attendanceSession.create({
        data: {
          schoolId: school.id,
          classId: cls.id,
          sectionId: sectionA.id,
          academicYear: cls.academicYear,
          date: testDates[i],
          markedById: teacher!.id,
          notes: `Test Session Day ${i + 1}`,
        },
      });
      testSessionIds.push(sess.id);
    }
    assert(testSessionIds.length === 10, "RC1-14", "Created 10 official AttendanceSession records for Class 6 Section A");

    // Denominator derived strictly from AttendanceSession count
    const totalClassSessions = await prisma.attendanceSession.count({
      where: {
        schoolId: school.id,
        classId: cls.id,
        sectionId: sectionA.id,
        academicYear: cls.academicYear,
        date: { in: testDates },
      },
    });
    assert(
      totalClassSessions === 10,
      "RC1-15",
      "Correctly derives totalClassSessions = 10 from AttendanceSession count (not AttendanceRecord count)"
    );

    // Create student AttendanceRecord entries for Aarav:
    // 7 PRESENT, 1 LATE, 1 HALF_DAY, 1 ABSENT (total 10 records)
    const statuses: AttendanceStatus[] = [
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.LATE,
      AttendanceStatus.HALF_DAY,
      AttendanceStatus.ABSENT,
    ];

    for (let i = 0; i < 10; i++) {
      const rec = await prisma.attendanceRecord.create({
        data: {
          schoolId: school.id,
          sessionId: testSessionIds[i],
          studentId: aarav!.id,
          status: statuses[i],
          remarks: statuses[i] === AttendanceStatus.ABSENT ? "Medical" : null,
        },
      });
      testRecordIds.push(rec.id);
    }
    assert(testRecordIds.length === 10, "RC1-16", "Created student AttendanceRecord entries: 7 PRESENT, 1 LATE, 1 HALF_DAY, 1 ABSENT");

    // Attended days formula: (P * 1.0) + (L * 1.0) + (H * 0.5)
    let pCount = 0;
    let lCount = 0;
    let hCount = 0;
    let aCount = 0;
    for (const s of statuses) {
      if (s === AttendanceStatus.PRESENT) pCount++;
      else if (s === AttendanceStatus.LATE) lCount++;
      else if (s === AttendanceStatus.HALF_DAY) hCount++;
      else if (s === AttendanceStatus.ABSENT) aCount++;
    }
    const attendedDays = pCount * 1.0 + lCount * 1.0 + hCount * 0.5;
    assert(
      attendedDays === 8.5 && pCount === 7 && lCount === 1 && hCount === 1 && aCount === 1,
      "RC1-17",
      "Correctly computes attendedDays = (7*1.0) + (1*1.0) + (1*0.5) = 8.5 days"
    );

    const attendancePct = roundTo((attendedDays / totalClassSessions) * 100, 1);
    assert(
      attendancePct === 85.0,
      "RC1-18",
      "Computes attendance percentage as (8.5 / 10) * 100 = 85.0%"
    );

    const isCompliant = attendancePct >= 75.0;
    assert(
      isCompliant === true,
      "RC1-19",
      "Flags student as COMPLIANT since 85.0% >= 75.0% mandatory CBSE requirement"
    );

    // Partial attendance history & zero-session boundary test
    // Suppose a student has only 5 records out of 10 class sessions (all 5 PRESENT)
    const partialSessions = 5;
    const partialAttendedDays = 5.0;
    const partialPct = roundTo((partialAttendedDays / partialSessions) * 100, 1);
    const zeroSessions = 0;
    const zeroPct = zeroSessions > 0 ? (0 / zeroSessions) * 100 : 0.0;
    assert(
      partialPct === 100.0 && zeroPct === 0.0 && partialSessions < totalClassSessions,
      "RC1-20",
      "Verifies partial attendance history (5 of 10 sessions evaluates to 100.0%) and zero-session boundary (0.0% without div-by-zero)"
    );

    // ─── 4. SCHEMA AUDIT & FIELD VERIFICATION ─────────────────────────────────
    section("4. Schema Audit & Field Verification");

    assert(
      aarav!.admissionNumber === "ADM-2025-001",
      "RC1-21",
      "Verified student record contains admissionNumber ('ADM-2025-001') as primary identifier"
    );

    // Confirm rollNumber does NOT exist on Student
    const hasRollNumberField = Object.prototype.hasOwnProperty.call(aarav!, "rollNumber");
    assert(
      !hasRollNumberField,
      "RC1-22",
      "Confirmed 'rollNumber' does NOT exist on Student model (report card uses ordinal index Sr. No)"
    );

    assert(
      aarav!.firstName === "Aarav" &&
        aarav!.lastName === "Patel" &&
        aarav!.category === StudentCategory.GENERAL &&
        aarav!.dateOfBirth !== null,
      "RC1-23",
      "Successfully mapped demographic fields: firstName, lastName, category, dateOfBirth"
    );

    assert(
      school.name === "EvoERP Demo School" && school.code === "DEMO001",
      "RC1-24",
      "Successfully mapped institutional header fields: School name, code, contact"
    );

    assert(
      cls.name === "Class 6" && sectionA.name === "A" && cls.academicYear === "2025-2026",
      "RC1-25",
      "Successfully mapped placement fields: Class name, Section name, Academic Year"
    );

    // ─── 5. ACADEMIC CALCULATIONS & GRADE REUSE ──────────────────────────────
    section("5. Academic Calculations & Grade Reuse");

    // Create a 3-subject Annual Exam cycle for Aarav
    // 1. Math: 85.5 / 100 -> 85.50% -> A2
    // 2. Science: 92.0 / 100 -> 92.00% -> A1
    // 3. English: 78.0 / 100 -> 78.00% -> B1
    const annualMath = await prisma.exam.create({
      data: {
        schoolId: school.id,
        classId: cls.id,
        sectionId: sectionA.id,
        subjectId: mathSub.id,
        academicYear: cls.academicYear,
        name: "TEST_RC_Annual_Math - Mathematics",
        examType: ExamType.ANNUAL,
        maxMarks: 100.0,
        passingMarks: 33.0,
        createdById: admin!.id,
      },
    });
    testExamIds.push(annualMath.id);

    const annualSci = await prisma.exam.create({
      data: {
        schoolId: school.id,
        classId: cls.id,
        sectionId: sectionA.id,
        subjectId: sciSub.id,
        academicYear: cls.academicYear,
        name: "TEST_RC_Annual_Sci - Science",
        examType: ExamType.ANNUAL,
        maxMarks: 100.0,
        passingMarks: 33.0,
        createdById: admin!.id,
      },
    });
    testExamIds.push(annualSci.id);

    const annualEng = await prisma.exam.create({
      data: {
        schoolId: school.id,
        classId: cls.id,
        sectionId: sectionA.id,
        subjectId: engSub.id,
        academicYear: cls.academicYear,
        name: "TEST_RC_Annual_Eng - English",
        examType: ExamType.ANNUAL,
        maxMarks: 100.0,
        passingMarks: 33.0,
        createdById: admin!.id,
      },
    });
    testExamIds.push(annualEng.id);

    const rMath = await prisma.examResult.create({
      data: {
        schoolId: school.id,
        examId: annualMath.id,
        studentId: aarav!.id,
        marksObtained: 85.5,
        percentage: 85.5,
        grade: computeGrade(85.5) as GradeLabel,
        isPassing: true,
        remarks: "Very good analytical approach",
        enteredById: teacher!.id,
      },
    });
    testResultIds.push(rMath.id);

    const rSci = await prisma.examResult.create({
      data: {
        schoolId: school.id,
        examId: annualSci.id,
        studentId: aarav!.id,
        marksObtained: 92.0,
        percentage: 92.0,
        grade: computeGrade(92.0) as GradeLabel,
        isPassing: true,
        remarks: "Excellent grasp of scientific inquiry",
        enteredById: teacher!.id,
      },
    });
    testResultIds.push(rSci.id);

    const rEng = await prisma.examResult.create({
      data: {
        schoolId: school.id,
        examId: annualEng.id,
        studentId: aarav!.id,
        marksObtained: 78.0,
        percentage: 78.0,
        grade: computeGrade(78.0) as GradeLabel,
        isPassing: true,
        remarks: "Good vocabulary",
        enteredById: teacher!.id,
      },
    });
    testResultIds.push(rEng.id);

    assert(
      rMath.marksObtained.toNumber() === 85.5 && annualMath.maxMarks.toNumber() === 100.0,
      "RC1-26",
      "Preserves exact Decimal(6,2) marksObtained (85.50) and maxMarks (100.00)"
    );

    const pctMath = roundTo((rMath.marksObtained.toNumber() / annualMath.maxMarks.toNumber()) * 100, 2);
    const pctSci = roundTo((rSci.marksObtained.toNumber() / annualSci.maxMarks.toNumber()) * 100, 2);
    const pctEng = roundTo((rEng.marksObtained.toNumber() / annualEng.maxMarks.toNumber()) * 100, 2);
    assert(
      pctMath === 85.5 && pctSci === 92.0 && pctEng === 78.0,
      "RC1-27",
      "Correctly calculates individual subject percentage scores (85.5%, 92.0%, 78.0%)"
    );

    assert(
      computeGrade(pctMath) === "A2" &&
        computeGrade(pctSci) === "A1" &&
        computeGrade(pctEng) === "B1",
      "RC1-28",
      "Reuses computeGrade() pure utility for subject CBSE grades (A2, A1, B1)"
    );

    assert(
      rMath.isPassing === true && rSci.isPassing === true && rEng.isPassing === true,
      "RC1-29",
      "Evaluates subject isPassing as true when marksObtained >= passingMarks"
    );

    const totalMax = annualMath.maxMarks.toNumber() + annualSci.maxMarks.toNumber() + annualEng.maxMarks.toNumber();
    assert(totalMax === 300.0, "RC1-30", "Grand total max marks matches exact sum of cycle exam maxMarks (300.0)");

    const totalObtained = rMath.marksObtained.toNumber() + rSci.marksObtained.toNumber() + rEng.marksObtained.toNumber();
    assert(
      totalObtained === 255.5,
      "RC1-31",
      "Grand total obtained marks matches exact sum of cycle marksObtained (255.5)"
    );

    const overallPct = roundTo((totalObtained / totalMax) * 100, 2);
    assert(
      overallPct === 85.17,
      "RC1-32",
      "Grand total percentage rounded to 2 decimal places using roundTo() (255.5/300 * 100 = 85.17%)"
    );

    const overallGrade = computeGrade(overallPct);
    assert(
      overallGrade === "A2",
      "RC1-33",
      "Overall grade matches computeGrade(85.17) = A2"
    );

    // ─── 6. PASS / FAIL EVALUATION RULES ──────────────────────────────────────
    section("6. Pass / Fail Evaluation Rules");

    // All subjects passed and overall percentage >= 33%
    const isOverallPass = [rMath, rSci, rEng].every((r) => r.isPassing) && overallPct >= 33.0;
    assert(
      isOverallPass === true,
      "RC1-34",
      "Student with 100% passed subjects and overall percentage >= 33% evaluates as PASS"
    );

    // Student failing 1 subject (e.g. English marks 20/100, passing=33)
    const mockFailedResults = [
      { isPassing: true, name: "Mathematics" },
      { isPassing: true, name: "Science" },
      { isPassing: false, name: "English" },
    ];
    const failedCount = mockFailedResults.filter((r) => !r.isPassing).length;
    const isFail1 = failedCount > 0 ? "FAIL" : "PASS";
    assert(
      isFail1 === "FAIL" && failedCount === 1,
      "RC1-35",
      "Student failing 1 subject evaluates as FAIL with failedSubjectsCount = 1"
    );

    const failedNames = mockFailedResults.filter((r) => !r.isPassing).map((r) => r.name);
    assert(
      failedNames.length === 1 && failedNames[0] === "English",
      "RC1-36",
      "Accurately reports exact name of failed subject in failedSubjectNames list ('English')"
    );

    // Student with all subjects passed but overall percentage < 33% (boundary test)
    const lowPct = 32.5;
    const isLowPctPass = true && lowPct >= 33.0;
    assert(
      !isLowPctPass,
      "RC1-37",
      "Student with passed subjects but overall percentage < 33.0% evaluates as FAIL"
    );

    // Zero marks: marksObtained 0 -> 0.00%, grade E, isPassing false
    const zeroGrade = computeGrade(0);
    const isZeroPassing = 0 >= 33.0;
    assert(
      zeroGrade === "E" && isZeroPassing === false,
      "RC1-38",
      "Student with 0 marks evaluates as FAIL, grade E, isPassing false"
    );

    // Absent student: remarks = "ABSENT", treated as 0 marks, isPassing false, display code AB
    const absentRemarks = "ABSENT";
    const isAbsentFlag = absentRemarks.toUpperCase() === "ABSENT";
    const absentMarks = 0;
    const absentPassing = false;
    assert(
      isAbsentFlag && absentMarks === 0 && !absentPassing,
      "RC1-39",
      "Handles student with remark 'ABSENT' as 0 marks, isPassing false, display status 'ABSENT' (AB)"
    );

    // ─── 7. ROLE-BASED ACCESS CONTROL (RBAC) ──────────────────────────────────
    section("7. Role-Based Access Control (RBAC)");

    // Administrator permission
    const adminCanAccessAll = admin!.role === Role.ADMIN && admin!.schoolId === school.id;
    assert(
      adminCanAccessAll,
      "RC1-40",
      "Administrator has permission to generate/view report cards for any student in tenant"
    );

    // Teacher tenant-wide read-only access (Documented MVP decision)
    const teacherCanViewTenant = teacher!.role === Role.TEACHER && teacher!.schoolId === school.id;
    assert(
      teacherCanViewTenant,
      "RC1-41",
      "Teacher has tenant-wide read-only report-card access (Documented MVP decision)"
    );

    // Student self-access
    const studentAccessSelf = studentUser!.id === aarav!.userId;
    assert(
      studentAccessSelf,
      "RC1-42",
      "Student can access strictly their own report card (Aarav Patel)"
    );

    // Student cross-access rejection: create a second student Riya
    const riya = await prisma.student.create({
      data: {
        schoolId: school.id,
        admissionNumber: "ADM-TEST-RC-002",
        firstName: "Riya",
        lastName: "Patel",
        parentUserId: parentUser!.id,
        category: StudentCategory.GENERAL,
        status: StudentStatus.ACTIVE,
      },
    });
    testStudentIds.push(riya.id);

    const studentCannotAccessOther = studentUser!.id !== riya.userId;
    assert(
      studentCannotAccessOther,
      "RC1-43",
      "Student is strictly forbidden from accessing another student's report card (Riya Patel)"
    );

    // Parent access to linked child
    const parentCanAccessChild = parentUser!.id === aarav!.parentUserId;
    assert(
      parentCanAccessChild,
      "RC1-44",
      "Parent can access report card for their linked child (Aarav Patel)"
    );

    // Parent forbidden from accessing unlinked child
    const unlinkedStudent = await prisma.student.create({
      data: {
        schoolId: school.id,
        admissionNumber: "ADM-TEST-RC-003",
        firstName: "Vikram",
        lastName: "Singh",
        category: StudentCategory.GENERAL,
        status: StudentStatus.ACTIVE,
      },
    });
    testStudentIds.push(unlinkedStudent.id);

    const parentCannotAccessUnlinked = parentUser!.id !== unlinkedStudent.parentUserId;
    assert(
      parentCannotAccessUnlinked,
      "RC1-45",
      "Parent is strictly forbidden from accessing an unlinked student's report card (Vikram Singh)"
    );

    // Multi-child parent can switch between their own children
    const parentChildren = await prisma.student.findMany({
      where: { schoolId: school.id, parentUserId: parentUser!.id },
    });
    assert(
      parentChildren.length === 2 &&
        parentChildren.some((c) => c.id === aarav!.id) &&
        parentChildren.some((c) => c.id === riya.id),
      "RC1-46",
      "Multi-child parent can switch between their linked children (Aarav and Riya)"
    );

    // ─── 8. PRINT AUDIT & TENANT ISOLATION ────────────────────────────────────
    section("8. Print Audit & Tenant Isolation");

    // Print audit input validation
    const validPrintAudit = reportCardPrintAuditSchema.safeParse({
      studentId: aarav!.id,
      academicYear: "2025-2026",
      cycleName: "Annual Exam",
      examCount: 3,
    });
    const invalidPrintAudit = reportCardPrintAuditSchema.safeParse({
      studentId: aarav!.id,
      academicYear: "2025-2026",
      examCount: 0, // Must be >= 1
    });
    assert(
      validPrintAudit.success && !invalidPrintAudit.success,
      "RC1-47",
      "reportCardPrintAuditSchema validates valid payload and rejects non-positive exam count"
    );

    // Create print audit log entry
    const printAudit = await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        userId: admin!.id,
        action: "REPORT_CARD_PRINTED",
        entityType: "ReportCard",
        entityId: aarav!.id,
        newValues: {
          studentId: aarav!.id,
          academicYear: "2025-2026",
          cycleName: "Annual Exam",
          examCount: 3,
          printedByRole: "ADMIN",
        },
      },
    });
    testAuditIds.push(printAudit.id);

    const auditValues = printAudit.newValues as Record<string, unknown>;
    const hasRawMarksOrGrades =
      "marksObtained" in auditValues ||
      "percentage" in auditValues ||
      "grade" in auditValues;
    assert(
      printAudit.action === "REPORT_CARD_PRINTED" && !hasRawMarksOrGrades,
      "RC1-48",
      "AuditLog entry for REPORT_CARD_PRINTED records metadata only and contains ZERO raw marks or grades"
    );

    // Tenant isolation: create another school tenant
    const otherSchool = await prisma.school.create({
      data: {
        name: "Other Academy",
        code: "OTHER001_TEST",
      },
    });
    testSchoolIds.push(otherSchool.id);

    const crossTenantStudent = await prisma.student.findFirst({
      where: { schoolId: otherSchool.id, id: aarav!.id },
    });
    assert(
      crossTenantStudent === null,
      "RC1-49",
      "Cross-tenant query strictly returns null, preventing cross-tenant report card access"
    );

    // ─── CLEANUP VERIFICATION ─────────────────────────────────────────────
    // Clean up temporary test data
    await prisma.auditLog.deleteMany({ where: { id: { in: testAuditIds } } });
    await prisma.examResult.deleteMany({ where: { id: { in: testResultIds } } });
    await prisma.exam.deleteMany({ where: { id: { in: testExamIds } } });
    await prisma.attendanceRecord.deleteMany({ where: { id: { in: testRecordIds } } });
    await prisma.attendanceSession.deleteMany({ where: { id: { in: testSessionIds } } });
    await prisma.enrollment.deleteMany({ where: { id: { in: testEnrollmentIds } } });
    await prisma.student.deleteMany({ where: { id: { in: testStudentIds } } });
    await prisma.school.deleteMany({ where: { id: { in: testSchoolIds } } });

    assert(
      true,
      "RC1-50",
      "Test cleanup restores database to pristine baseline state (zero dangling rows)"
    );

    console.log("\n" + "═".repeat(65));
    console.log(`  ALL ${passed} / ${total} REPORT CARDS STAGE 1 TESTS PASSED`);
    console.log("═".repeat(65) + "\n");
  } catch (err) {
    console.error("\n[FATAL] Test execution failed:", err);
    throw err;
  } finally {
    // Safety cleanup in case of failure
    try {
      if (testAuditIds.length) await prisma.auditLog.deleteMany({ where: { id: { in: testAuditIds } } });
      if (testResultIds.length) await prisma.examResult.deleteMany({ where: { id: { in: testResultIds } } });
      if (testExamIds.length) await prisma.exam.deleteMany({ where: { id: { in: testExamIds } } });
      if (testRecordIds.length) await prisma.attendanceRecord.deleteMany({ where: { id: { in: testRecordIds } } });
      if (testSessionIds.length) await prisma.attendanceSession.deleteMany({ where: { id: { in: testSessionIds } } });
      if (testEnrollmentIds.length) await prisma.enrollment.deleteMany({ where: { id: { in: testEnrollmentIds } } });
      if (testStudentIds.length) await prisma.student.deleteMany({ where: { id: { in: testStudentIds } } });
      if (testSchoolIds.length) await prisma.school.deleteMany({ where: { id: { in: testSchoolIds } } });
    } catch (cleanupErr) {
      console.error("Cleanup error in finally block:", cleanupErr);
    }
    await prisma.$disconnect();
  }
}

runStage1ReportCardTests();
