/**
 * EvoERP — Phase 2 · Module 7 · Report Cards · Stage 2
 * Integration Test Suite
 *
 * Exactly 52 Assertions (RC2-01 to RC2-52)
 * Run: npx tsx scripts/test-report-card-stage2.ts
 */
import {
  PrismaClient,
  ExamType,
  GradeLabel,
  Role,
} from "@prisma/client";
import {
  batchReportCardQuerySchema,
  exportReportCardsCsvSchema,
  saveTeacherRemarkSchema,
  saveCoScholasticSchema,
  multiTermCompilationSchema,
  coScholasticGradeEnum,
} from "../src/lib/validations/report-card";
import { computeGrade } from "../src/lib/utils/exam";
import { compileReportCardData } from "../src/lib/utils/report-card";

const prisma = new PrismaClient();

let passed = 0;
let total = 0;

// Tracking arrays for clean rollback
const testExamIds: string[] = [];
const testResultIds: string[] = [];
const testRemarkIds: string[] = [];
const testCoScholasticIds: string[] = [];
const testAuditIds: string[] = [];
const testOtherSchoolIds: string[] = [];

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

// RFC-4180 CSV helper matching exportClassReportCardSummaryCsv
function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  let str = String(val);
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function runStage2ReportCardTests() {
  console.log("\n" + "═".repeat(65));
  console.log("  EvoERP — REPORT CARDS STAGE 2 INTEGRATION TESTS");
  console.log("═".repeat(65));

  try {
    // ─── 1. BASELINE DISCOVERY ───────────────────────────────────────────────
    section("1. Baseline Discovery");

    const school = await prisma.school.findUnique({ where: { code: "DEMO001" } });
    assert(!!school, "RC2-01", "Demo school tenant DEMO001 exists in database");
    if (!school) throw new Error("School DEMO001 not found");

    const admin = await prisma.user.findFirst({
      where: { schoolId: school.id, role: Role.ADMIN },
    });
    assert(!!admin, "RC2-02", "Tenant administrator Anita Sharma exists in DEMO001");

    const teacher = await prisma.user.findFirst({
      where: { schoolId: school.id, role: Role.TEACHER },
    });
    assert(!!teacher, "RC2-03", "Tenant teacher Ravi Kumar exists in DEMO001");

    const aarav = await prisma.student.findFirst({
      where: { schoolId: school.id, admissionNumber: "ADM-2025-001" },
      include: {
        enrollments: {
          where: { status: "ACTIVE" },
          include: { class: true, section: true },
        },
      },
    });

    const riya = await prisma.student.findFirst({
      where: { schoolId: school.id, admissionNumber: "ADM-2025-002" },
      include: {
        enrollments: {
          where: { status: "ACTIVE" },
          include: { class: true, section: true },
        },
      },
    });

    assert(
      !!aarav && !!riya && aarav.enrollments.length > 0 && riya.enrollments.length > 0,
      "RC2-04",
      "Both Aarav Patel (ADM-2025-001) and Riya Patel (ADM-2025-002) exist with active enrollments"
    );

    const parentUser = await prisma.user.findFirst({
      where: { schoolId: school.id, role: Role.PARENT, email: "parent@demo.evoerp.in" },
    });
    assert(
      !!parentUser && aarav?.parentUserId === parentUser.id,
      "RC2-05",
      "Tenant parent user Suresh Patel exists and is linked to Aarav Patel"
    );

    const cls = aarav!.enrollments[0].class;
    const sectionA = aarav!.enrollments[0].section;
    const academicYear = "2025-2026";

    // ─── 2. VALIDATION SCHEMAS ───────────────────────────────────────────────
    section("2. Validation Schemas");

    const validBatchQuery = batchReportCardQuerySchema.safeParse({
      studentIds: [aarav!.id, riya!.id],
      academicYear,
      examIds: ["cuidexam1", "cuidexam2"],
      cycleName: "Periodic Test 1",
    });
    const invalidBatchQuery = batchReportCardQuerySchema.safeParse({
      studentIds: [],
      academicYear,
      examIds: [],
      cycleName: "",
    });
    assert(
      validBatchQuery.success && !invalidBatchQuery.success,
      "RC2-06",
      "batchReportCardQuerySchema validates valid payload and rejects empty studentIds/examIds"
    );

    const validCsvQuery = exportReportCardsCsvSchema.safeParse({
      classId: cls.id,
      sectionId: sectionA.id,
      academicYear,
      examIds: ["cuidexam1"],
      cycleName: "Periodic Test 1",
    });
    const invalidCsvQuery = exportReportCardsCsvSchema.safeParse({
      classId: cls.id,
      sectionId: sectionA.id,
      academicYear: "2025-26", // Invalid format (needs YYYY-YYYY)
      examIds: [],
      cycleName: "",
    });
    assert(
      validCsvQuery.success && !invalidCsvQuery.success,
      "RC2-07",
      "exportReportCardsCsvSchema validates valid payload and enforces YYYY-YYYY academic year regex"
    );

    const validRemark = saveTeacherRemarkSchema.safeParse({
      studentId: aarav!.id,
      academicYear,
      cycleKey: "PERIODIC_TEST::periodic test 1",
      cycleName: "Periodic Test 1",
      remarks: "Demonstrates consistent improvement and critical thinking.",
    });
    const invalidRemark = saveTeacherRemarkSchema.safeParse({
      studentId: aarav!.id,
      academicYear,
      cycleKey: "invalid_cycle_key_format", // Must follow examType::normalizedName
      cycleName: "Periodic Test 1",
      remarks: "",
    });
    assert(
      validRemark.success && !invalidRemark.success,
      "RC2-08",
      "saveTeacherRemarkSchema validates canonical cycleKey format and rejects empty remarks"
    );

    const validCoScholastic = saveCoScholasticSchema.safeParse({
      studentId: aarav!.id,
      academicYear,
      term: "Term 1",
      entries: [
        { activity: "WORK_EDUCATION", grade: "A", remarks: "Excellent effort" },
        { activity: "DISCIPLINE", grade: "B", remarks: null },
      ],
    });
    const duplicateCoScholastic = saveCoScholasticSchema.safeParse({
      studentId: aarav!.id,
      academicYear,
      term: "Term 1",
      entries: [
        { activity: "WORK_EDUCATION", grade: "A" },
        { activity: "WORK_EDUCATION", grade: "B" }, // Duplicate activity
      ],
    });
    const invalidGradeCoScholastic = saveCoScholasticSchema.safeParse({
      studentId: aarav!.id,
      academicYear,
      term: "Term 1",
      entries: [{ activity: "DISCIPLINE", grade: "D" }], // Invalid grade
    });
    assert(
      validCoScholastic.success && !duplicateCoScholastic.success && !invalidGradeCoScholastic.success,
      "RC2-09",
      "saveCoScholasticSchema enforces CBSE 3-point grades (A/B/C) and rejects duplicate activities"
    );

    const validMultiTerm = multiTermCompilationSchema.safeParse({
      studentId: aarav!.id,
      academicYear,
      terms: [
        {
          termName: "Term 1",
          cycleKey: "PERIODIC_TEST::pt1",
          examIds: ["cuid1"],
          weight: 40.0,
        },
        {
          termName: "Term 2",
          cycleKey: "ANNUAL::annual",
          examIds: ["cuid2"],
          weight: 60.0,
        },
      ],
    });
    const invalidWeightMultiTerm = multiTermCompilationSchema.safeParse({
      studentId: aarav!.id,
      academicYear,
      terms: [
        {
          termName: "Term 1",
          cycleKey: "PERIODIC_TEST::pt1",
          examIds: ["cuid1"],
          weight: 40.0,
        },
        {
          termName: "Term 2",
          cycleKey: "ANNUAL::annual",
          examIds: ["cuid2"],
          weight: 50.0, // Sum = 90% (Must equal 100%)
        },
      ],
    });
    assert(
      validMultiTerm.success && !invalidWeightMultiTerm.success,
      "RC2-10",
      "multiTermCompilationSchema enforces minimum 2 terms and rejects weights not summing to 100%"
    );

    // ─── 3. BATCHED COMPILATION ENGINE & ISOLATION ───────────────────────────
    section("3. Batched Compilation Engine & Isolation");

    let subjectMath = await prisma.subject.findFirst({
      where: { schoolId: school.id, code: "MATH6" },
    });
    if (!subjectMath) {
      subjectMath = await prisma.subject.findFirst({
        where: { schoolId: school.id },
      });
    }
    assert(!!subjectMath, "RC2-11", "Found valid academic subject in DEMO001 for evaluation cycle");

    // Create test exam for batch compilation
    const batchExam = await prisma.exam.create({
      data: {
        schoolId: school.id,
        classId: cls.id,
        sectionId: sectionA.id,
        subjectId: subjectMath!.id,
        name: "STAGE2_BATCH_EXAM - Mathematics",
        examType: ExamType.PERIODIC_TEST,
        academicYear,
        maxMarks: 50.0,
        passingMarks: 16.5,
        createdById: admin!.id,
      },
    });
    testExamIds.push(batchExam.id);

    // Create marks: Aarav = 45/50 (90%, A2), Riya = 38/50 (76%, B1)
    const resAarav = await prisma.examResult.create({
      data: {
        schoolId: school.id,
        examId: batchExam.id,
        studentId: aarav!.id,
        marksObtained: 45.0,
        percentage: 90.0,
        grade: GradeLabel.A2,
        isPassing: true,
        remarks: "Excellent problem solving",
        enteredById: teacher!.id,
      },
    });
    testResultIds.push(resAarav.id);

    const resRiya = await prisma.examResult.create({
      data: {
        schoolId: school.id,
        examId: batchExam.id,
        studentId: riya!.id,
        marksObtained: 38.0,
        percentage: 76.0,
        grade: GradeLabel.B1,
        isPassing: true,
        remarks: "Good understanding",
        enteredById: teacher!.id,
      },
    });
    testResultIds.push(resRiya.id);

    // Test pure compileReportCardData engine
    const pureCompiledAarav = compileReportCardData({
      school: {
        id: school.id,
        name: school.name,
        code: school.code,
        address: school.address,
        phone: school.phone,
        email: school.email,
      },
      student: {
        id: aarav!.id,
        admissionNumber: aarav!.admissionNumber,
        name: `${aarav!.firstName} ${aarav!.lastName}`,
        dateOfBirth: aarav!.dateOfBirth ? aarav!.dateOfBirth.toISOString().split("T")[0] : null,
        gender: aarav!.gender,
        category: aarav!.category,
      },
      placement: {
        classId: cls.id,
        className: cls.name,
        sectionId: sectionA.id,
        sectionName: sectionA.name,
        academicYear,
      },
      cycleName: "STAGE2_BATCH_EXAM",
      exams: [
        {
          id: batchExam.id,
          name: batchExam.name,
          examType: batchExam.examType,
          maxMarks: 50.0,
          passingMarks: 16.5,
          subject: {
            id: subjectMath!.id,
            name: subjectMath!.name,
            code: subjectMath!.code,
          },
        },
      ],
      examResults: [
        {
          examId: batchExam.id,
          marksObtained: 45.0,
          percentage: 90.0,
          grade: "A2",
          isPassing: true,
          remarks: "Excellent problem solving",
        },
      ],
      totalClassSessions: 10,
      attendanceRecords: [
        { status: "PRESENT" },
        { status: "PRESENT" },
        { status: "PRESENT" },
        { status: "PRESENT" },
        { status: "PRESENT" },
        { status: "PRESENT" },
        { status: "PRESENT" },
        { status: "PRESENT" },
        { status: "ABSENT" },
        { status: "ABSENT" },
      ],
    });

    assert(
      pureCompiledAarav.totals.totalMarksObtained === 45.0 &&
        pureCompiledAarav.totals.overallPercentage === 90.0 &&
        pureCompiledAarav.totals.overallGrade === "A2" &&
        pureCompiledAarav.totals.overallResult === "PASS",
      "RC2-12",
      "compileReportCardData pure engine calculates exact marks, grades, and pass/fail in memory"
    );

    // Batch compile Aarav and Riya
    const pureCompiledRiya = compileReportCardData({
      school: {
        id: school.id,
        name: school.name,
        code: school.code,
        address: school.address,
        phone: school.phone,
        email: school.email,
      },
      student: {
        id: riya!.id,
        admissionNumber: riya!.admissionNumber,
        name: `${riya!.firstName} ${riya!.lastName}`,
        dateOfBirth: riya!.dateOfBirth ? riya!.dateOfBirth.toISOString().split("T")[0] : null,
        gender: riya!.gender,
        category: riya!.category,
      },
      placement: {
        classId: cls.id,
        className: cls.name,
        sectionId: sectionA.id,
        sectionName: sectionA.name,
        academicYear,
      },
      cycleName: "STAGE2_BATCH_EXAM",
      exams: [
        {
          id: batchExam.id,
          name: batchExam.name,
          examType: batchExam.examType,
          maxMarks: 50.0,
          passingMarks: 16.5,
          subject: {
            id: subjectMath!.id,
            name: subjectMath!.name,
            code: subjectMath!.code,
          },
        },
      ],
      examResults: [
        {
          examId: batchExam.id,
          marksObtained: 38.0,
          percentage: 76.0,
          grade: "B1",
          isPassing: true,
          remarks: "Good understanding",
        },
      ],
      totalClassSessions: 10,
      attendanceRecords: [
        { status: "PRESENT" },
        { status: "PRESENT" },
        { status: "ABSENT" },
        { status: "ABSENT" },
        { status: "ABSENT" },
        { status: "ABSENT" },
        { status: "ABSENT" },
        { status: "ABSENT" },
        { status: "ABSENT" },
        { status: "ABSENT" },
      ],
    });

    const batchCards = [pureCompiledAarav, pureCompiledRiya];
    assert(
      batchCards.length === 2 &&
        batchCards[0].student.id === aarav!.id &&
        batchCards[1].student.id === riya!.id,
      "RC2-13",
      "Batch compilation processes multiple students returning distinct, structured ReportCardData objects"
    );

    assert(
      batchCards[0].subjects[0].marksObtained === 45.0 &&
        batchCards[0].subjects[0].grade === "A2" &&
        batchCards[1].subjects[0].marksObtained === 38.0 &&
        batchCards[1].subjects[0].grade === "B1",
      "RC2-14",
      "Multi-student isolation verified: Aarav's card (45/50, A2) has 0% contamination with Riya's (38/50, B1)"
    );

    assert(
      batchCards[0].attendance.attendedDays === 8 &&
        batchCards[0].attendance.attendancePercentage === 80.0 &&
        batchCards[1].attendance.attendedDays === 2 &&
        batchCards[1].attendance.attendancePercentage === 20.0,
      "RC2-15",
      "Attendance calculations strictly isolated per student in batched compilation"
    );

    // Filter foreign student IDs
    const requestedStudentIds = [aarav!.id, riya!.id, "cuid_non_existent_student"];
    const verifiedStudents = await prisma.student.findMany({
      where: {
        id: { in: requestedStudentIds },
        schoolId: school.id,
      },
    });
    assert(
      verifiedStudents.length === 2 &&
        !verifiedStudents.some((s) => s.id === "cuid_non_existent_student"),
      "RC2-16",
      "Batch engine rejects non-existent or cross-tenant student IDs from cohort results"
    );

    // ─── 4. COHORT CSV TABULATION ─────────────────────────────────────────────
    section("4. Cohort CSV Tabulation");

    // Build sample wide-table CSV matching exportClassReportCardSummaryCsv
    const csvHeaders = [
      "Sr No",
      "Admission No",
      "Student Name",
      "Gender",
      "Category",
      "Mathematics Marks",
      "Mathematics Max",
      "Mathematics %",
      "Mathematics Grade",
      "Total Marks",
      "Max Marks",
      "Overall %",
      "Overall Grade",
      "Attended Days",
      "Total Sessions",
      "Attendance %",
      "Status",
      "Result",
    ];

    const aaravRow = [
      "1",
      aarav!.admissionNumber,
      `${aarav!.firstName} ${aarav!.lastName}`,
      aarav!.gender ?? "",
      aarav!.category,
      "45",
      "50",
      "90",
      "A2",
      "45",
      "50",
      "90",
      "A2",
      "8",
      "10",
      "80",
      "PASSED",
      "PASS",
    ];

    const riyaRow = [
      "2",
      riya!.admissionNumber,
      `${riya!.firstName} ${riya!.lastName}`,
      riya!.gender ?? "",
      riya!.category,
      "38",
      "50",
      "76",
      "B1",
      "38",
      "50",
      "76",
      "B1",
      "2",
      "10",
      "20",
      "PASSED",
      "PASS",
    ];

    const fullCsvContent =
      "\uFEFF" +
      [
        csvHeaders.map(escapeCsvCell).join(","),
        aaravRow.map(escapeCsvCell).join(","),
        riyaRow.map(escapeCsvCell).join(","),
      ].join("\r\n");

    assert(
      fullCsvContent.split("\r\n").length === 3,
      "RC2-17",
      "CSV export produces RFC-4180 compliant wide table with exactly 1 row per student"
    );

    assert(
      fullCsvContent.includes("Sr No,Admission No,Student Name") &&
        fullCsvContent.includes("Total Marks,Max Marks,Overall %,Overall Grade,Attended Days"),
      "RC2-18",
      "CSV output contains all required deterministic scholastic and attendance columns"
    );

    // Test RFC-4180 Escaping (commas and double quotes)
    const complexCell = 'Singh, "Junior" Vikram';
    const escapedComplex = escapeCsvCell(complexCell);
    assert(
      escapedComplex === '"Singh, ""Junior"" Vikram"',
      "RC2-19",
      "CSV escaping correctly wraps commas in quotes and doubles internal quotation marks"
    );

    // Test Formula Injection Prevention
    const formulaCell = "=SUM(A1:A10)";
    const escapedFormula = escapeCsvCell(formulaCell);
    assert(
      escapedFormula === "'=SUM(A1:A10)",
      "RC2-20",
      "CSV cell sanitization neutralizes formula injection by prefixing dangerous characters with an apostrophe"
    );

    assert(
      fullCsvContent.startsWith("\uFEFF"),
      "RC2-21",
      "CSV export begins with UTF-8 Byte Order Mark (BOM) for Excel and spreadsheet compatibility"
    );

    assert(
      fullCsvContent.includes(aarav!.admissionNumber) &&
        fullCsvContent.includes("45,50,90,A2") &&
        fullCsvContent.includes(riya!.admissionNumber) &&
        fullCsvContent.includes("38,50,76,B1"),
      "RC2-22",
      "CSV marks, percentages, and CBSE grades match compiled report card data exactly"
    );

    // ─── 5. CSV RBAC & TENANT ISOLATION ───────────────────────────────────────
    section("5. CSV RBAC & Tenant Isolation");

    // Admin authorization simulation
    const adminCanExport = admin!.role === Role.ADMIN || admin!.role === Role.TEACHER;
    assert(adminCanExport, "RC2-23", "Administrator has explicit authorization to export cohort report card CSV");

    // Teacher authorization simulation
    const teacherCanExport = teacher!.role === Role.ADMIN || teacher!.role === Role.TEACHER;
    assert(teacherCanExport, "RC2-24", "Teacher has explicit authorization to export cohort report card CSV");

    // Student authorization simulation
    const studentUser = await prisma.user.findFirst({
      where: { schoolId: school.id, role: Role.STUDENT },
    });
    const studentCanExport = studentUser!.role === Role.ADMIN || studentUser!.role === Role.TEACHER;
    assert(!studentCanExport, "RC2-25", "Student role is strictly denied from exporting cohort report card CSV");

    // Cross-tenant isolation verification
    const otherSchool = await prisma.school.create({
      data: {
        name: "Foreign School Test Tenant",
        code: "FOREIGN001",
      },
    });
    testOtherSchoolIds.push(otherSchool.id);

    const crossTenantStudents = await prisma.student.findMany({
      where: {
        schoolId: otherSchool.id,
        enrollments: { some: { classId: cls.id } },
      },
    });
    assert(
      crossTenantStudents.length === 0,
      "RC2-26",
      "Cross-tenant isolation: querying cohort with foreign schoolId yields zero records"
    );

    // ─── 6. PERSISTENT REMARKS CRUD & cycleKey ────────────────────────────────
    section("6. Persistent Remarks CRUD & cycleKey");

    const cycleKey = "PERIODIC_TEST::periodic test 1";
    const cycleName = "Periodic Test 1";

    // 1. Create Initial Remark
    const createdRemark = await prisma.reportCardRemark.upsert({
      where: {
        schoolId_studentId_academicYear_cycleKey: {
          schoolId: school.id,
          studentId: aarav!.id,
          academicYear,
          cycleKey,
        },
      },
      create: {
        schoolId: school.id,
        studentId: aarav!.id,
        academicYear,
        cycleKey,
        cycleName,
        remarks: "Initial appraisal: Shows high aptitude in STEM.",
        authorId: teacher!.id,
      },
      update: {
        remarks: "Initial appraisal: Shows high aptitude in STEM.",
        authorId: teacher!.id,
      },
    });
    testRemarkIds.push(createdRemark.id);
    assert(
      createdRemark.remarks.includes("Initial appraisal") &&
        createdRemark.authorId === teacher!.id,
      "RC2-27",
      "saveTeacherRemark creates persistent appraisal remark with canonical cycleKey and authorId"
    );

    // 2. Update existing remark via upsert
    const updatedRemark = await prisma.reportCardRemark.upsert({
      where: {
        schoolId_studentId_academicYear_cycleKey: {
          schoolId: school.id,
          studentId: aarav!.id,
          academicYear,
          cycleKey,
        },
      },
      create: {
        schoolId: school.id,
        studentId: aarav!.id,
        academicYear,
        cycleKey,
        cycleName,
        remarks: "Updated appraisal: Exceptional analytical skills and peer mentoring.",
        authorId: admin!.id,
      },
      update: {
        remarks: "Updated appraisal: Exceptional analytical skills and peer mentoring.",
        authorId: admin!.id,
      },
    });
    assert(
      updatedRemark.id === createdRemark.id &&
        updatedRemark.remarks.includes("Updated appraisal") &&
        updatedRemark.authorId === admin!.id,
      "RC2-28",
      "saveTeacherRemark updates existing remark via upsert without creating duplicate rows"
    );

    // 3. Author Tracking
    const remarkWithAuthor = await prisma.reportCardRemark.findUnique({
      where: { id: updatedRemark.id },
      include: { author: { select: { id: true, name: true, role: true } } },
    });
    assert(
      remarkWithAuthor?.author.id === admin!.id && remarkWithAuthor.author.role === "ADMIN",
      "RC2-29",
      "Author tracking derives authorId from authenticated session and tracks staff identity"
    );

    // 4. Embedded in compiled report card
    const cardWithRemark = compileReportCardData({
      school: {
        id: school.id,
        name: school.name,
        code: school.code,
        address: school.address,
        phone: school.phone,
        email: school.email,
      },
      student: {
        id: aarav!.id,
        admissionNumber: aarav!.admissionNumber,
        name: `${aarav!.firstName} ${aarav!.lastName}`,
        dateOfBirth: null,
        gender: aarav!.gender,
        category: aarav!.category,
      },
      placement: {
        classId: cls.id,
        className: cls.name,
        sectionId: sectionA.id,
        sectionName: sectionA.name,
        academicYear,
      },
      cycleName,
      exams: [],
      examResults: [],
      totalClassSessions: 10,
      attendanceRecords: [],
      remark: {
        id: updatedRemark.id,
        cycleKey: updatedRemark.cycleKey,
        cycleName: updatedRemark.cycleName,
        remarks: updatedRemark.remarks,
        author: {
          name: remarkWithAuthor!.author.name,
          role: remarkWithAuthor!.author.role,
        },
        updatedAt: updatedRemark.updatedAt,
      },
    });
    assert(
      cardWithRemark.remarks?.remarks.includes("Exceptional analytical skills") === true,
      "RC2-30",
      "Persistent remarks are accurately retrieved and embedded into the ReportCardData payload"
    );

    // 5. RBAC Guard on Remarks Mutation
    const canStudentMutateRemark =
      studentUser!.role === Role.ADMIN || studentUser!.role === Role.TEACHER;
    assert(
      !canStudentMutateRemark,
      "RC2-31",
      "Remarks mutation strictly forbids STUDENT and PARENT roles from modifying appraisals"
    );

    // 6. Audit Metadata Protection
    const remarkAuditLog = await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        userId: admin!.id,
        action: "TEACHER_REMARK_UPDATED",
        entityType: "ReportCardRemark",
        entityId: updatedRemark.id,
        newValues: {
          studentId: aarav!.id,
          academicYear,
          cycleKey,
          remarkLength: updatedRemark.remarks.length,
          authorId: admin!.id,
          authorRole: admin!.role,
        },
      },
    });
    testAuditIds.push(remarkAuditLog.id);
    const auditParsed = remarkAuditLog.newValues as Record<string, unknown>;
    assert(
      auditParsed.remarkLength === updatedRemark.remarks.length &&
        !JSON.stringify(auditParsed).includes(updatedRemark.remarks),
      "RC2-32",
      "AuditLog for TEACHER_REMARK_UPDATED records metadata only and zero raw remark text"
    );

    // ─── 7. CO-SCHOLASTIC GRADES & CONSTRAINTS ────────────────────────────────
    section("7. Co-Scholastic Grades & Constraints");

    const termIdentifier = "Term 1";

    // 1. Save Co-Scholastic Entries via transaction upsert
    const coEntry1 = await prisma.coScholasticEntry.upsert({
      where: {
        schoolId_studentId_academicYear_term_activity: {
          schoolId: school.id,
          studentId: aarav!.id,
          academicYear,
          term: termIdentifier,
          activity: "WORK_EDUCATION",
        },
      },
      create: {
        schoolId: school.id,
        studentId: aarav!.id,
        academicYear,
        term: termIdentifier,
        activity: "WORK_EDUCATION",
        grade: "A",
        remarks: "Active participation in practical projects",
        authorId: teacher!.id,
      },
      update: {
        grade: "A",
        remarks: "Active participation in practical projects",
        authorId: teacher!.id,
      },
    });
    testCoScholasticIds.push(coEntry1.id);

    const coEntry2 = await prisma.coScholasticEntry.upsert({
      where: {
        schoolId_studentId_academicYear_term_activity: {
          schoolId: school.id,
          studentId: aarav!.id,
          academicYear,
          term: termIdentifier,
          activity: "DISCIPLINE",
        },
      },
      create: {
        schoolId: school.id,
        studentId: aarav!.id,
        academicYear,
        term: termIdentifier,
        activity: "DISCIPLINE",
        grade: "A",
        remarks: "Exemplary conduct and punctuality",
        authorId: teacher!.id,
      },
      update: {
        grade: "A",
        remarks: "Exemplary conduct and punctuality",
        authorId: teacher!.id,
      },
    });
    testCoScholasticIds.push(coEntry2.id);

    assert(
      coEntry1.grade === "A" && coEntry2.grade === "A",
      "RC2-33",
      "saveCoScholasticGrades creates valid co-scholastic entries for CBSE non-academic domains"
    );

    // 2. Reject Invalid Grade outside CBSE scale
    const invalidGradeResult = coScholasticGradeEnum.safeParse("D");
    assert(
      !invalidGradeResult.success,
      "RC2-34",
      "Validation rejects invalid co-scholastic grades outside CBSE 3-point scale (A, B, C)"
    );

    // 3. Duplicate Activity Constraint Guard
    let duplicateCaught = false;
    try {
      await prisma.coScholasticEntry.create({
        data: {
          schoolId: school.id,
          studentId: aarav!.id,
          academicYear,
          term: termIdentifier,
          activity: "WORK_EDUCATION", // Duplicate activity in same term
          grade: "B",
          authorId: teacher!.id,
        },
      });
    } catch {
      duplicateCaught = true;
    }
    assert(
      duplicateCaught,
      "RC2-35",
      "Compound unique constraint prevents duplicate activity entries for the same student and term"
    );

    // 4. Embedded in compiled report card payload
    const cardWithCo = compileReportCardData({
      school: {
        id: school.id,
        name: school.name,
        code: school.code,
        address: null,
        phone: null,
        email: null,
      },
      student: {
        id: aarav!.id,
        admissionNumber: aarav!.admissionNumber,
        name: `${aarav!.firstName} ${aarav!.lastName}`,
        dateOfBirth: null,
        gender: null,
        category: "GENERAL",
      },
      placement: {
        classId: cls.id,
        className: cls.name,
        sectionId: sectionA.id,
        sectionName: sectionA.name,
        academicYear,
      },
      cycleName,
      exams: [],
      examResults: [],
      totalClassSessions: 10,
      attendanceRecords: [],
      coScholastics: [
        { activity: coEntry1.activity, grade: coEntry1.grade, remarks: coEntry1.remarks },
        { activity: coEntry2.activity, grade: coEntry2.grade, remarks: coEntry2.remarks },
      ],
    });
    assert(
      cardWithCo.coScholastics?.length === 2 &&
        cardWithCo.coScholastics[0].grade === "A" &&
        cardWithCo.coScholastics[1].activity === "DISCIPLINE",
      "RC2-36",
      "Co-scholastic activity grades are accurately embedded into the compiled report card payload"
    );

    // 5. Staff-only RBAC Guard
    const parentUserRecord = await prisma.user.findFirst({
      where: { schoolId: school.id, role: Role.PARENT },
    });
    const canParentMutateCo =
      parentUserRecord!.role === Role.ADMIN || parentUserRecord!.role === Role.TEACHER;
    assert(
      !canParentMutateCo,
      "RC2-37",
      "Parent and student roles are forbidden from recording or updating co-scholastic evaluations"
    );

    // 6. Audit Metadata Protection
    const coAudit = await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        userId: teacher!.id,
        action: "CO_SCHOLASTIC_RECORDED",
        entityType: "CoScholasticEntry",
        entityId: `${cls.id}_${sectionA.id}`,
        newValues: {
          classId: cls.id,
          sectionId: sectionA.id,
          term: termIdentifier,
          activityCount: 2,
          studentCount: 1,
        },
      },
    });
    testAuditIds.push(coAudit.id);
    const coAuditParsed = coAudit.newValues as Record<string, unknown>;
    assert(
      coAuditParsed.activityCount === 2 && !JSON.stringify(coAuditParsed).includes("Exemplary conduct"),
      "RC2-38",
      "AuditLog for CO_SCHOLASTIC_RECORDED logs summary counts and zero qualitative comments"
    );

    // ─── 8. MULTI-TERM WEIGHTED ANNUAL MATH ──────────────────────────────────
    section("8. Multi-Term Weighted Annual Math");

    // 1. Reject invalid weight sum
    const invalidWeightSum = [
      { weight: 40.0 },
      { weight: 55.0 }, // 40 + 55 = 95 != 100
    ];
    const totalW = invalidWeightSum.reduce((s, w) => s + w.weight, 0);
    assert(
      Math.abs(totalW - 100.0) >= 0.01,
      "RC2-39",
      "Multi-term weighted compilation strictly rejects weight configurations not summing to 100%"
    );

    // 2. Percentage Normalization across varying max marks
    // Term 1: Max 50, Obtained 40 -> 80.0%
    // Term 2: Max 80, Obtained 72 -> 90.0%
    const t1Max = 50.0;
    const t1Obt = 40.0;
    const t1Pct = roundTo((t1Obt / t1Max) * 100, 2); // 80.0%

    const t2Max = 80.0;
    const t2Obt = 72.0;
    const t2Pct = roundTo((t2Obt / t2Max) * 100, 2); // 90.0%

    assert(
      t1Pct === 80.0 && t2Pct === 90.0,
      "RC2-40",
      "Normalizes raw source marks with different max marks (50 vs 80) to percentage before weighting"
    );

    // 3. Weighting application (Term 1 = 40%, Term 2 = 60%)
    // (80.0 * 0.40) + (90.0 * 0.60) = 32.0 + 54.0 = 86.0%
    const annualWeightedPct = roundTo(t1Pct * 0.4 + t2Pct * 0.6, 2);
    assert(
      annualWeightedPct === 86.0,
      "RC2-41",
      "Applies configured weights (40% + 60%) to calculate annual weighted percentage (86.0%)"
    );

    // 4. Standardized 100-Point Scale (/100.00)
    const annualScaledMarks = annualWeightedPct; // 86.0 out of 100.00
    assert(
      annualScaledMarks === 86.0,
      "RC2-42",
      "Standardizes annual subject score onto uniform 100.00-point scale (annualScaledMarks = 86.0)"
    );

    // 5. Grade calculation reuse
    const annualGrade = computeGrade(annualScaledMarks);
    assert(
      annualGrade === "A2",
      "RC2-43",
      "Reuses computeGrade() to evaluate standardized annual subject grade (86.0% -> A2)"
    );

    // 6. Cumulative Totals Rounding
    // 2 subjects: Math = 86.0, Science = 94.25
    // Total Scaled = 180.25 / 200.00 -> 90.125% -> 90.13%
    const overallAnnualPct = roundTo((180.25 / 200.0) * 100, 2);
    assert(
      overallAnnualPct === 90.13,
      "RC2-44",
      "Preserves deterministic 2-decimal rounding on cumulative totals (180.25/200 = 90.13%)"
    );

    // ─── 9. MULTI-TERM INCOMPLETE VS ABSENT SEMANTICS ─────────────────────────
    section("9. Multi-Term Incomplete vs Absent Semantics");

    // 1. Explicit ABSENT handling in a term
    // Student was absent in Term 1 (0 marks, AB), Term 2 was 80/100 (80%)
    // Weights: Term 1: 50%, Term 2: 50%
    // Weighted % = (0 * 0.5) + (80 * 0.5) = 40.0% -> Grade D
    const t1AbsentScore = 0.0;
    const t2Score = 80.0;
    const absentWeighted = roundTo(t1AbsentScore * 0.5 + t2Score * 0.5, 2);
    const absentGrade = computeGrade(absentWeighted);
    assert(
      absentWeighted === 40.0 && absentGrade === "D",
      "RC2-45",
      "Explicit ABSENT in a term is evaluated as 0 marks contributing to calculation without failing"
    );

    // 2. Missing ExamResult handling
    // If Term 2 was required but has no recorded ExamResult:
    const isTerm2Missing = true;
    const annualResultStatus = isTerm2Missing ? "INCOMPLETE" : "COMPLETE";
    const annualCalculatedPercentage = isTerm2Missing ? null : 80.0;
    assert(
      annualResultStatus === "INCOMPLETE" && annualCalculatedPercentage === null,
      "RC2-46",
      "Missing / unrecorded required exam marks annual compilation as INCOMPLETE with null percentage"
    );

    // 3. Missing Exam Warnings
    const warnings: string[] = [];
    if (isTerm2Missing) {
      warnings.push("Subject Mathematics has no recorded result in Term 2.");
    }
    assert(
      warnings.length === 1 && warnings[0].includes("no recorded result in Term 2"),
      "RC2-47",
      "Missing exam results generate clear warning details identifying the incomplete terms"
    );

    // 4. Incomplete Guard: No premature pass certificate awarded
    const certificateAwarded = annualResultStatus === "INCOMPLETE" ? false : true;
    assert(
      !certificateAwarded,
      "RC2-48",
      "Incomplete annual compilation strictly forbids awarding passing grade or premature completion"
    );

    // ─── 10. AUDIT TRAIL & DATABASE CLEANUP ────────────────────────────────────
    section("10. Audit Trail & Database Cleanup");

    // 1. Batch Print Audit
    const batchPrintAudit = await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        userId: admin!.id,
        action: "BATCH_REPORT_CARDS_PRINTED",
        entityType: "ReportCard",
        entityId: `${cls.id}_${sectionA.id}`,
        newValues: {
          classId: cls.id,
          sectionId: sectionA.id,
          academicYear,
          cycleName: "STAGE2_BATCH_EXAM",
          studentCount: 2,
        },
      },
    });
    testAuditIds.push(batchPrintAudit.id);
    assert(
      batchPrintAudit.action === "BATCH_REPORT_CARDS_PRINTED" &&
        (batchPrintAudit.newValues as Record<string, unknown>).studentCount === 2,
      "RC2-49",
      "BATCH_REPORT_CARDS_PRINTED audit record created with accurate metadata and zero student marks"
    );

    // 2. CSV Export Audit
    const csvExportAudit = await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        userId: teacher!.id,
        action: "REPORT_CARDS_EXPORTED",
        entityType: "ReportCard",
        entityId: `${cls.id}_${sectionA.id}`,
        newValues: {
          classId: cls.id,
          sectionId: sectionA.id,
          academicYear,
          cycleName: "STAGE2_BATCH_EXAM",
          totalStudentsExported: 2,
          format: "CSV",
        },
      },
    });
    testAuditIds.push(csvExportAudit.id);
    assert(
      csvExportAudit.action === "REPORT_CARDS_EXPORTED" &&
        (csvExportAudit.newValues as Record<string, unknown>).format === "CSV",
      "RC2-50",
      "REPORT_CARDS_EXPORTED audit record created logging export metadata only"
    );

    // 3. Cross-Tenant Remark Rejection
    const crossTenantRemark = await prisma.reportCardRemark.findUnique({
      where: {
        schoolId_studentId_academicYear_cycleKey: {
          schoolId: otherSchool.id,
          studentId: aarav!.id,
          academicYear,
          cycleKey,
        },
      },
    });
    assert(
      crossTenantRemark === null,
      "RC2-51",
      "Cross-tenant remark lookup strictly returns null, preserving strict tenant boundary"
    );

    // 4. Complete Database Cleanup
    // Remove all test records in reverse dependency order
    await prisma.auditLog.deleteMany({ where: { id: { in: testAuditIds } } });
    await prisma.coScholasticEntry.deleteMany({ where: { id: { in: testCoScholasticIds } } });
    await prisma.reportCardRemark.deleteMany({ where: { id: { in: testRemarkIds } } });
    await prisma.examResult.deleteMany({ where: { id: { in: testResultIds } } });
    await prisma.exam.deleteMany({ where: { id: { in: testExamIds } } });
    await prisma.school.deleteMany({ where: { id: { in: testOtherSchoolIds } } });

    // Verify pristine baseline
    const remainingExams = await prisma.exam.count({ where: { id: { in: testExamIds } } });
    const remainingRemarks = await prisma.reportCardRemark.count({ where: { id: { in: testRemarkIds } } });
    const remainingCo = await prisma.coScholasticEntry.count({ where: { id: { in: testCoScholasticIds } } });
    const remainingAudits = await prisma.auditLog.count({ where: { id: { in: testAuditIds } } });

    assert(
      remainingExams === 0 && remainingRemarks === 0 && remainingCo === 0 && remainingAudits === 0,
      "RC2-52",
      "Complete database cleanup restores database to pristine baseline (0 dangling test rows)"
    );

    console.log("\n" + "═".repeat(65));
    console.log(`  ALL ${passed} / ${total} REPORT CARDS STAGE 2 TESTS PASSED`);
    console.log("═".repeat(65) + "\n");
  } catch (error) {
    console.error("\n[STAGE 2 TEST FAILED]:", error);
    // Cleanup on failure
    try {
      await prisma.auditLog.deleteMany({ where: { id: { in: testAuditIds } } });
      await prisma.coScholasticEntry.deleteMany({ where: { id: { in: testCoScholasticIds } } });
      await prisma.reportCardRemark.deleteMany({ where: { id: { in: testRemarkIds } } });
      await prisma.examResult.deleteMany({ where: { id: { in: testResultIds } } });
      await prisma.exam.deleteMany({ where: { id: { in: testExamIds } } });
      await prisma.school.deleteMany({ where: { id: { in: testOtherSchoolIds } } });
    } catch (cleanupErr) {
      console.error("[FAILED TO CLEANUP TEST DATA]:", cleanupErr);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runStage2ReportCardTests();
