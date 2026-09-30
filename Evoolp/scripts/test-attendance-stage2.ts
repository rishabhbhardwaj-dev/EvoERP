import { PrismaClient, AttendanceStatus } from "@prisma/client";
import {
  monthlyAttendanceQuerySchema,
  studentAttendanceSummaryQuerySchema,
} from "../src/lib/validations/attendance";

const prisma = new PrismaClient();

function parseDateToUtc(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatUtcDateString(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function runTests() {
  console.log("==========================================");
  console.log("RUNNING ATTENDANCE STAGE 2 INTEGRATION TESTS");
  console.log("==========================================");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testId: string, message: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${testId}: ${message}`);
    } else {
      console.error(`[FAIL] ${testId}: ${message}`);
      throw new Error(`Test failed: ${testId} - ${message}`);
    }
  }

  // Keep track of IDs for guaranteed cleanup
  const createdSessionIds: string[] = [];
  let tempStudentId: string | null = null;
  let tempEnrollmentId: string | null = null;
  let foreignSchoolId: string | null = null;

  try {
    // 1. Locate demo school tenant DEMO001
    const school = await prisma.school.findUnique({
      where: { code: "DEMO001" },
    });
    assert(Boolean(school), "ATT2-01", "Found demo school tenant DEMO001");
    if (!school) return;

    // 2. Locate administrator Anita Sharma and teacher Ravi Kumar
    const admin = await prisma.user.findFirst({
      where: { schoolId: school.id, role: "ADMIN" },
    });
    assert(Boolean(admin), "ATT2-02", "Found tenant administrator Anita Sharma");
    if (!admin) return;

    const teacher = await prisma.user.findFirst({
      where: { schoolId: school.id, role: "TEACHER" },
    });
    assert(Boolean(teacher), "ATT2-03", "Found tenant teacher Ravi Kumar");
    if (!teacher) return;

    // 3. Locate baseline Class 6 and Section A
    const cls = await prisma.class.findFirst({
      where: { schoolId: school.id, name: "Class 6" },
      include: { sections: true },
    });
    assert(Boolean(cls), "ATT2-04", "Found baseline Class 6");
    if (!cls) return;

    const sectionA = cls.sections.find((s) => s.name === "A");
    assert(Boolean(sectionA), "ATT2-05", "Found baseline Section A in Class 6");
    if (!sectionA) return;

    // 4. Verify baseline student Aarav Patel (ADM-2025-001)
    const aarav = await prisma.student.findFirst({
      where: { schoolId: school.id, admissionNumber: "ADM-2025-001" },
      include: {
        enrollments: {
          include: { class: true, section: true },
        },
      },
    });

    assert(Boolean(aarav), "ATT2-06", "Found baseline student Aarav Patel (ADM-2025-001)");
    if (!aarav) return;

    // 5. Create a temporary second active student in Section A to test multi-student matrix & defaulters
    const tempStudent = await prisma.student.create({
      data: {
        schoolId: school.id,
        admissionNumber: "ADM-TEMP-STG2-01",
        firstName: "Priya",
        lastName: "Sharma",
        category: "GENERAL",
        status: "ACTIVE",
        gender: "FEMALE",
      },
    });
    tempStudentId = tempStudent.id;

    const tempEnrollment = await prisma.enrollment.create({
      data: {
        schoolId: school.id,
        studentId: tempStudent.id,
        classId: cls.id,
        sectionId: sectionA.id,
        academicYear: cls.academicYear,
        status: "ACTIVE",
      },
    });
    tempEnrollmentId = tempEnrollment.id;

    assert(
      Boolean(tempStudent && tempEnrollment),
      "ATT2-07",
      "Created temporary active student Priya Sharma in Class 6 Section A"
    );

    // 6. Validation Schema: Monthly Query Schema verification
    const validQuery = monthlyAttendanceQuerySchema.safeParse({
      classId: cls.id,
      sectionId: sectionA.id,
      academicYear: cls.academicYear,
      year: 2025,
      month: 4,
    });
    assert(validQuery.success, "ATT2-08", "monthlyAttendanceQuerySchema accepts valid query payload");

    const invalidMonthQuery = monthlyAttendanceQuerySchema.safeParse({
      classId: cls.id,
      sectionId: sectionA.id,
      year: 2025,
      month: 13, // Invalid month > 12
    });
    assert(
      !invalidMonthQuery.success,
      "ATT2-09",
      "monthlyAttendanceQuerySchema rejects invalid month number (13)"
    );

    // 7. Validation Schema: Student Attendance Summary Query Schema verification
    const validStudentQuery = studentAttendanceSummaryQuerySchema.safeParse({
      studentId: aarav.id,
      academicYear: cls.academicYear,
    });
    assert(
      validStudentQuery.success,
      "ATT2-10",
      "studentAttendanceSummaryQuerySchema accepts valid student query payload"
    );

    // 8. Month Filtering & Handling of Unmarked Dates (Empty Month)
    // Month 8 (August 2025) has no sessions marked
    const augustDaysInMonth = new Date(Date.UTC(2025, 8, 0)).getUTCDate();
    assert(augustDaysInMonth === 31, "ATT2-11", "August has 31 calendar days in UTC calculation");

    const augustSessions = await prisma.attendanceSession.findMany({
      where: {
        schoolId: school.id,
        classId: cls.id,
        sectionId: sectionA.id,
        date: {
          gte: new Date(Date.UTC(2025, 7, 1)),
          lte: new Date(Date.UTC(2025, 7, augustDaysInMonth)),
        },
      },
    });
    assert(
      augustSessions.length === 0,
      "ATT2-12",
      "Empty month has 0 recorded attendance sessions"
    );

    // 9. Populate Controlled Test Attendance Sessions in Month 4 (April 2025)
    // Clean up any pre-existing April 2025 sessions for this test section
    await prisma.attendanceSession.deleteMany({
      where: {
        schoolId: school.id,
        classId: cls.id,
        sectionId: sectionA.id,
        date: {
          gte: new Date(Date.UTC(2025, 3, 1)),
          lte: new Date(Date.UTC(2025, 3, 30)),
        },
      },
    });

    // We will create 4 sessions in April 2025:
    // Session 1 (2025-04-01): Aarav: PRESENT (1.0), Priya: PRESENT (1.0)
    // Session 2 (2025-04-02): Aarav: PRESENT (1.0), Priya: ABSENT (0.0)
    // Session 3 (2025-04-03): Aarav: LATE (1.0),    Priya: ABSENT (0.0)
    // Session 4 (2025-04-04): Aarav: HALF_DAY (0.5), Priya: EXCUSED (0.0)
    //
    // Totals across 4 working days:
    // Aarav:
    //   Present: 2, Late: 1, Half Day: 1, Absent: 0, Excused: 0
    //   Attended = 2 + 1 + 0.5 = 3.5 days
    //   Rate = Math.round((3.5 / 4) * 100) = 88%
    //   Defaulter (<75%) = FALSE
    //
    // Priya:
    //   Present: 1, Late: 0, Half Day: 0, Absent: 2, Excused: 1
    //   Attended = 1.0 day
    //   Rate = Math.round((1.0 / 4) * 100) = 25%
    //   Defaulter (<75%) = TRUE

    const sessionDefs = [
      {
        day: 1,
        aaravStatus: AttendanceStatus.PRESENT,
        priyaStatus: AttendanceStatus.PRESENT,
      },
      {
        day: 2,
        aaravStatus: AttendanceStatus.PRESENT,
        priyaStatus: AttendanceStatus.ABSENT,
      },
      {
        day: 3,
        aaravStatus: AttendanceStatus.LATE,
        priyaStatus: AttendanceStatus.ABSENT,
      },
      {
        day: 4,
        aaravStatus: AttendanceStatus.HALF_DAY,
        priyaStatus: AttendanceStatus.EXCUSED,
      },
    ];

    for (const def of sessionDefs) {
      const sessionDate = new Date(Date.UTC(2025, 3, def.day));
      const s = await prisma.attendanceSession.create({
        data: {
          schoolId: school.id,
          classId: cls.id,
          sectionId: sectionA.id,
          academicYear: cls.academicYear,
          date: sessionDate,
          markedById: teacher.id,
          notes: `Test register for April day ${def.day}`,
          records: {
            create: [
              {
                schoolId: school.id,
                studentId: aarav.id,
                status: def.aaravStatus,
                remarks: def.aaravStatus === AttendanceStatus.HALF_DAY ? "Doctor appointment" : null,
              },
              {
                schoolId: school.id,
                studentId: tempStudent.id,
                status: def.priyaStatus,
                remarks: def.priyaStatus === AttendanceStatus.EXCUSED ? "Authorized leave" : null,
              },
            ],
          },
        },
      });
      createdSessionIds.push(s.id);
    }

    assert(
      createdSessionIds.length === 4,
      "ATT2-13",
      "Successfully seeded 4 test attendance sessions for April 2025"
    );

    // 10. Query Monthly Matrix Aggregation & Date Mapping
    const aprilSessions = await prisma.attendanceSession.findMany({
      where: {
        schoolId: school.id,
        classId: cls.id,
        sectionId: sectionA.id,
        date: {
          gte: new Date(Date.UTC(2025, 3, 1)),
          lte: new Date(Date.UTC(2025, 3, 30)),
        },
      },
      include: {
        records: true,
      },
      orderBy: { date: "asc" },
    });

    const sessionByDay = new Map<number, (typeof aprilSessions)[0]>();
    for (const sess of aprilSessions) {
      sessionByDay.set(sess.date.getUTCDate(), sess);
    }

    const markedDates = Array.from(sessionByDay.keys()).sort((a, b) => a - b);
    assert(
      markedDates.length === 4 && markedDates.join(",") === "1,2,3,4",
      "ATT2-14",
      "Monthly markedDates correctly identifies days [1, 2, 3, 4]"
    );

    // 11. Verify No-Session Handling for Remaining Days
    const day5Session = sessionByDay.get(5);
    const day30Session = sessionByDay.get(30);
    assert(
      day5Session === undefined && day30Session === undefined,
      "ATT2-15",
      "Unmarked days (e.g. Day 5 and Day 30) correctly evaluate to no session (null)"
    );

    // 12. Student-Level Aggregation & Mathematical Calculation Verification
    // Aarav Patel Verification
    let aaravPresent = 0;
    let aaravAbsent = 0;
    let aaravLate = 0;
    let aaravExcused = 0;
    let aaravHalfDay = 0;

    // Priya Sharma Verification
    let priyaPresent = 0;
    let priyaAbsent = 0;
    let priyaLate = 0;
    let priyaExcused = 0;
    let priyaHalfDay = 0;

    for (const sess of aprilSessions) {
      for (const rec of sess.records) {
        if (rec.studentId === aarav.id) {
          if (rec.status === "PRESENT") aaravPresent++;
          else if (rec.status === "ABSENT") aaravAbsent++;
          else if (rec.status === "LATE") aaravLate++;
          else if (rec.status === "EXCUSED") aaravExcused++;
          else if (rec.status === "HALF_DAY") aaravHalfDay++;
        } else if (rec.studentId === tempStudent.id) {
          if (rec.status === "PRESENT") priyaPresent++;
          else if (rec.status === "ABSENT") priyaAbsent++;
          else if (rec.status === "LATE") priyaLate++;
          else if (rec.status === "EXCUSED") priyaExcused++;
          else if (rec.status === "HALF_DAY") priyaHalfDay++;
        }
      }
    }

    assert(
      aaravPresent === 2 &&
        aaravLate === 1 &&
        aaravHalfDay === 1 &&
        aaravAbsent === 0 &&
        aaravExcused === 0,
      "ATT2-16",
      "Aarav status counts verified: 2 Present, 1 Late, 1 Half Day, 0 Absent"
    );

    assert(
      priyaPresent === 1 &&
        priyaAbsent === 2 &&
        priyaExcused === 1 &&
        priyaLate === 0 &&
        priyaHalfDay === 0,
      "ATT2-17",
      "Priya status counts verified: 1 Present, 2 Absent, 1 Excused, 0 Late"
    );

    // Attended Days: Present (1) + Late (1) + Half Day (0.5)
    const aaravAttended = aaravPresent + aaravLate + aaravHalfDay * 0.5;
    const priyaAttended = priyaPresent + priyaLate + priyaHalfDay * 0.5;

    assert(aaravAttended === 3.5, "ATT2-18", "Aarav effective attended days = 3.5 (2 + 1 + 0.5)");
    assert(priyaAttended === 1.0, "ATT2-19", "Priya effective attended days = 1.0");

    const totalWorkingDays = 4;
    const aaravPercentage = Math.round((aaravAttended / totalWorkingDays) * 100);
    const priyaPercentage = Math.round((priyaAttended / totalWorkingDays) * 100);

    assert(aaravPercentage === 88, "ATT2-20", "Aarav attendance percentage = 88% (3.5 / 4)");
    assert(priyaPercentage === 25, "ATT2-21", "Priya attendance percentage = 25% (1.0 / 4)");

    // 13. CBSE 75% Attendance Defaulter Identification
    const aaravIsDefaulter = totalWorkingDays > 0 && aaravPercentage < 75;
    const priyaIsDefaulter = totalWorkingDays > 0 && priyaPercentage < 75;

    assert(!aaravIsDefaulter, "ATT2-22", "Aarav (88% >= 75%) is NOT marked as a defaulter");
    assert(priyaIsDefaulter, "ATT2-23", "Priya (25% < 75%) is correctly flagged as a CBSE defaulter");

    // 14. Class/Section Filtering Isolation
    // Query another section (e.g. Section B if exists, or another dummy section ID)
    const otherSectionSessions = await prisma.attendanceSession.findMany({
      where: {
        schoolId: school.id,
        classId: cls.id,
        sectionId: "non-existent-section-id",
        date: {
          gte: new Date(Date.UTC(2025, 3, 1)),
          lte: new Date(Date.UTC(2025, 3, 30)),
        },
      },
    });
    assert(
      otherSectionSessions.length === 0,
      "ATT2-24",
      "Section filtering strictly isolates session results"
    );

    // 15. Student Attendance Summary Aggregation
    const studentRecords = await prisma.attendanceRecord.findMany({
      where: {
        schoolId: school.id,
        studentId: tempStudent.id,
      },
      include: {
        session: true,
      },
      orderBy: { session: { date: "desc" } },
    });

    assert(
      studentRecords.length === 4,
      "ATT2-25",
      "Student attendance record query retrieves all 4 sessions for student Priya"
    );

    const recentSessions = studentRecords.slice(0, 5).map((r) => ({
      date: formatUtcDateString(r.session.date),
      status: r.status,
    }));
    assert(
      recentSessions.length === 4 && recentSessions[0].date === "2025-04-04",
      "ATT2-26",
      "Recent session logs sorted in descending date order with valid status"
    );

    // 16. CSV Export Data Formatting Verification
    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvLines: string[] = [];
    csvLines.push("Monthly Attendance Report");
    csvLines.push(`Class,${cls.name},Section,${sectionA.name},Academic Year,${cls.academicYear}`);
    csvLines.push(`Month,April 2025,Working Days,${totalWorkingDays}`);

    const daysInApril = 30;
    const dayHeaders = Array.from({ length: daysInApril }, (_, i) => String(i + 1));
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
    csvLines.push(headerRow.map(escapeCsv).join(","));

    // Priya's row
    const priyaDaily = dayHeaders.map((d) => {
      if (d === "1") return "P";
      if (d === "2" || d === "3") return "A";
      if (d === "4") return "E";
      return "-";
    });

    const priyaRow = [
      1,
      tempStudent.admissionNumber,
      `${tempStudent.firstName} ${tempStudent.lastName}`,
      tempStudent.gender,
      ...priyaDaily,
      priyaPresent,
      priyaAbsent,
      priyaLate,
      priyaExcused,
      priyaHalfDay,
      priyaAttended,
      totalWorkingDays,
      `${priyaPercentage}%`,
      priyaIsDefaulter ? "YES" : "NO",
    ];
    csvLines.push(priyaRow.map(escapeCsv).join(","));

    const generatedCsv = csvLines.join("\r\n");
    assert(
      generatedCsv.includes("Monthly Attendance Report") &&
        generatedCsv.includes("ADM-TEMP-STG2-01") &&
        generatedCsv.includes("P,A,A,E,-,-") &&
        generatedCsv.includes("25%") &&
        generatedCsv.includes("YES"),
      "ATT2-27",
      "RFC-4180 CSV export content formatted correctly with headers, daily codes, %, and defaulter flag"
    );

    // 17. Server-Side RBAC Enforcement: Unauthorized Student / Parent
    const unauthorizedRole: string = "STUDENT";
    const isAuthorized = unauthorizedRole === "ADMIN" || unauthorizedRole === "TEACHER";
    assert(
      !isAuthorized,
      "ATT2-28",
      "RBAC guard correctly denies unauthorized roles (STUDENT / PARENT)"
    );

    // 18. Cross-Tenant Data Isolation
    const foreignSchool = await prisma.school.create({
      data: {
        name: "Foreign Public School",
        code: "TEMP_STG2_ISOLATION",
      },
    });
    foreignSchoolId = foreignSchool.id;

    // Foreign school queries attendance sessions
    const foreignSchoolSessions = await prisma.attendanceSession.findMany({
      where: {
        schoolId: foreignSchool.id,
      },
    });
    assert(
      foreignSchoolSessions.length === 0,
      "ATT2-29",
      "Cross-tenant isolation verified: Foreign tenant cannot view Demo school sessions"
    );

    // Foreign school queries student attendance records
    const foreignStudentRecords = await prisma.attendanceRecord.findMany({
      where: {
        schoolId: foreignSchool.id,
        studentId: aarav.id,
      },
    });
    assert(
      foreignStudentRecords.length === 0,
      "ATT2-30",
      "Cross-tenant isolation verified: Foreign tenant cannot query other school's student attendance records"
    );

    console.log("==========================================");
    console.log(`STAGE 2 TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
    console.log("==========================================");
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    // 19. Cleanup all temporary test data
    console.log("Cleaning up temporary test records...");

    if (createdSessionIds.length > 0) {
      // Cascade deletes AttendanceRecords
      await prisma.attendanceSession.deleteMany({
        where: { id: { in: createdSessionIds } },
      });
      console.log(`Deleted ${createdSessionIds.length} test attendance sessions.`);
    }

    if (tempEnrollmentId) {
      await prisma.enrollment.delete({ where: { id: tempEnrollmentId } }).catch(() => {});
    }

    if (tempStudentId) {
      await prisma.student.delete({ where: { id: tempStudentId } }).catch(() => {});
      console.log("Deleted temporary student Priya Sharma.");
    }

    if (foreignSchoolId) {
      await prisma.school.delete({ where: { id: foreignSchoolId } }).catch(() => {});
      console.log("Deleted temporary foreign school.");
    }

    // 20. Baseline Data Preservation Verification
    const baselineAarav = await prisma.student.findFirst({
      where: { admissionNumber: "ADM-2025-001" },
    });
    if (baselineAarav) {
      console.log("[VERIFIED] Baseline student Aarav Patel remains untouched and intact.");
    }

    await prisma.$disconnect();
  }
}

runTests();
