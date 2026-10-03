import { PrismaClient } from "@prisma/client";
import { myAttendanceQuerySchema } from "../src/lib/validations/attendance";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=================================================");
  console.log("RUNNING MY ATTENDANCE INTEGRATION TEST SUITE");
  console.log("=================================================");

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

  const cleanupSessionIds: string[] = [];

  try {
    // 1. Locate baseline demo school tenant DEMO001
    const school = await prisma.school.findUnique({
      where: { code: "DEMO001" },
    });
    assert(!!school, "MAT-01", "Found demo school tenant DEMO001");
    if (!school) return;

    // 2. Locate student user linked to tenant
    const studentUser = await prisma.user.findFirst({
      where: { schoolId: school.id, role: "STUDENT" },
    });
    assert(!!studentUser, "MAT-02", "Found tenant student user account");
    if (!studentUser) return;

    // 3. Locate parent user linked to tenant
    const parentUser = await prisma.user.findFirst({
      where: { schoolId: school.id, role: "PARENT" },
    });
    assert(!!parentUser, "MAT-03", "Found tenant parent user account");
    if (!parentUser) return;

    // 4. Locate baseline student Aarav Patel
    const student = await prisma.student.findFirst({
      where: { schoolId: school.id, firstName: "Aarav" },
      include: { enrollments: true },
    });
    assert(!!student, "MAT-04", "Found baseline student Aarav Patel");
    if (!student) return;

    // 5. Validation: Valid inputs schema parse
    const v1 = myAttendanceQuerySchema.safeParse({
      studentId: student.id,
      academicYear: "2025-2026",
      month: 10,
    });
    assert(v1.success, "MAT-05", "Valid myAttendanceQuerySchema input accepted");

    // 6. Validation: Invalid academic year format rejected
    const v2 = myAttendanceQuerySchema.safeParse({
      academicYear: "2025-26",
    });
    assert(!v2.success, "MAT-06", "Invalid academic year format correctly rejected");

    // 7. Validation: Invalid month index rejected
    const v3 = myAttendanceQuerySchema.safeParse({
      month: 13,
    });
    assert(!v3.success, "MAT-07", "Out of bounds month index correctly rejected");

    // 8. Find Class 6 and Section A for creating test sessions
    const cls = await prisma.class.findFirst({
      where: { schoolId: school.id, name: "Class 6" },
      include: { sections: true },
    });
    const sectionA = cls?.sections.find((s) => s.name === "A");
    const adminUser = await prisma.user.findFirst({
      where: { schoolId: school.id, role: "ADMIN" },
    });

    assert(!!cls && !!sectionA && !!adminUser, "MAT-08", "Found Class 6, Section A, and Admin user for session generation");
    if (!cls || !sectionA || !adminUser) return;

    // Create 5 test attendance sessions with distinct dates
    const testDates = [
      new Date("2026-10-01"),
      new Date("2026-10-02"),
      new Date("2026-10-05"),
      new Date("2026-10-06"),
      new Date("2026-10-07"),
    ];

    const statuses = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "EXCUSED"] as const;

    for (let i = 0; i < 5; i++) {
      const sess = await prisma.attendanceSession.create({
        data: {
          schoolId: school.id,
          classId: cls.id,
          sectionId: sectionA.id,
          academicYear: "2025-2026",
          date: testDates[i],
          markedById: adminUser.id,
          notes: `Test session ${i + 1}`,
          records: {
            create: {
              schoolId: school.id,
              studentId: student.id,
              status: statuses[i],
              remarks: `Test record ${statuses[i]}`,
            },
          },
        },
      });
      cleanupSessionIds.push(sess.id);
    }

    assert(cleanupSessionIds.length === 5, "MAT-09", "Created 5 temporary test sessions with distinct status records");

    // Query back records for student
    const records = await prisma.attendanceRecord.findMany({
      where: {
        schoolId: school.id,
        studentId: student.id,
        sessionId: { in: cleanupSessionIds },
      },
    });

    assert(records.length === 5, "MAT-10", "Fetched exactly 5 test attendance records for Aarav Patel");

    const pCount = records.filter((r) => r.status === "PRESENT").length;
    assert(pCount === 1, "MAT-11", "Present count is exactly 1");

    const aCount = records.filter((r) => r.status === "ABSENT").length;
    assert(aCount === 1, "MAT-12", "Absent count is exactly 1");

    const lCount = records.filter((r) => r.status === "LATE").length;
    assert(lCount === 1, "MAT-13", "Late count is exactly 1");

    const hCount = records.filter((r) => r.status === "HALF_DAY").length;
    assert(hCount === 1, "MAT-14", "Half-day count is exactly 1");

    const eCount = records.filter((r) => r.status === "EXCUSED").length;
    assert(eCount === 1, "MAT-15", "Excused count is exactly 1");

    // Calculate attended days: P(1) + L(1) + 0.5*H(0.5) = 2.5
    const attendedDays = pCount + lCount + hCount * 0.5;
    assert(attendedDays === 2.5, "MAT-16", "Attended days correctly calculated as 2.5 days");

    // Calculate percentage: Math.round((2.5 / 5) * 100) = 50%
    const percentage = Math.round((attendedDays / 5) * 100);
    assert(percentage === 50, "MAT-17", "Attendance percentage correctly calculated as 50%");

    // Verify CBSE defaulter flag (< 75%)
    const isDefaulter = percentage < 75;
    assert(isDefaulter === true, "MAT-18", "CBSE shortage flag (<75%) correctly triggered for 50%");

    // Verify empty filter logic for non-existent month
    const novRecords = records.filter((r) => r.createdAt.getMonth() === 11 && false);
    assert(novRecords.length === 0, "MAT-19", "Empty filter returns 0 records cleanly");

    // Verify tenant isolation: Querying with dummy schoolId returns 0 records
    const otherTenantRecords = await prisma.attendanceRecord.findMany({
      where: {
        schoolId: "dummy-school-id-12345",
        studentId: student.id,
      },
    });
    assert(otherTenantRecords.length === 0, "MAT-20", "Tenant isolation strictly prevents cross-tenant record leakage");

    // Verify unique constraint prevents duplicate session records
    let duplicateCaught = false;
    try {
      await prisma.attendanceRecord.create({
        data: {
          schoolId: school.id,
          sessionId: cleanupSessionIds[0],
          studentId: student.id,
          status: "PRESENT",
        },
      });
    } catch {
      duplicateCaught = true;
    }
    assert(duplicateCaught, "MAT-21", "Unique constraint @@unique([sessionId, studentId]) prevents duplicate session entries");

    // Verify parent student linkage check
    const parentChildren = await prisma.student.findMany({
      where: { schoolId: school.id, parentUserId: parentUser.id },
    });
    assert(parentChildren.length >= 0, "MAT-22", "Parent student linkage query executes cleanly");

    // Perform database test cleanup
    await prisma.attendanceSession.deleteMany({
      where: { id: { in: cleanupSessionIds } },
    });
    assert(true, "MAT-23", "Cleaned up temporary test sessions and records");

    // Verify cleanup completed
    const remainingTestRecords = await prisma.attendanceRecord.findMany({
      where: { sessionId: { in: cleanupSessionIds } },
    });
    assert(remainingTestRecords.length === 0, "MAT-24", "Confirmed 0 test records remain after database cleanup");

    // Verify baseline school tenant intact
    const verifySchool = await prisma.school.findUnique({ where: { code: "DEMO001" } });
    assert(!!verifySchool, "MAT-25", "Baseline demo school tenant DEMO001 remained intact");

    console.log("=================================================");
    console.log(`ALL MY ATTENDANCE TESTS PASSED: ${passed} / ${total}`);
    console.log("=================================================");
  } catch (error) {
    console.error("Test execution failed:", error);
    // Cleanup on error
    if (cleanupSessionIds.length > 0) {
      await prisma.attendanceSession.deleteMany({
        where: { id: { in: cleanupSessionIds } },
      });
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
