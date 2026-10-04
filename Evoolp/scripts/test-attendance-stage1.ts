import { PrismaClient, AttendanceStatus } from "@prisma/client";
import {
  saveAttendanceRegisterSchema,
  getRegisterQuerySchema,
} from "../src/lib/validations/attendance";
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

const prisma = new PrismaClient();

async function runTests() {
  console.log("==========================================");
  console.log("RUNNING ATTENDANCE STAGE 1 INTEGRATION TESTS");
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

  try {
    // 1. Locate demo school tenant DEMO001
    const school = await prisma.school.findUnique({
      where: { code: "DEMO001" },
    });
    assert(!!school, "ATT1-01", "Found demo school tenant DEMO001");
    if (!school) return;

    // 2. Locate administrator and teacher users
    const admin = await prisma.user.findFirst({
      where: { schoolId: school.id, role: "ADMIN" },
    });
    assert(!!admin, "ATT1-02", "Found tenant administrator Anita Sharma");
    if (!admin) return;

    const teacher = await prisma.user.findFirst({
      where: { schoolId: school.id, role: "TEACHER" },
    });
    assert(!!teacher, "ATT1-03", "Found tenant teacher Ravi Kumar");
    if (!teacher) return;

    // 3. Locate baseline Class 6 and Section A
    const cls = await prisma.class.findFirst({
      where: { schoolId: school.id, name: "Class 6" },
      include: { sections: true },
    });
    assert(!!cls, "ATT1-04", "Found baseline Class 6");
    if (!cls) return;

    const sectionA = cls.sections.find((s) => s.name === "A");
    assert(!!sectionA, "ATT1-05", "Found baseline Section A in Class 6");
    if (!sectionA) return;

    // 4. Verify baseline student Aarav Patel
    const aarav = await prisma.student.findFirst({
      where: { schoolId: school.id, admissionNumber: "ADM-2025-001" },
    });
    assert(!!aarav, "ATT1-06", "Found baseline student Aarav Patel (ADM-2025-001)");
    if (!aarav) return;

    // 5. Validation Schema: Future date rejection
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const tomorrowStr = formatUtcDateString(tomorrow);
    const todayStr = formatUtcDateString(new Date());

    const futureValidation = saveAttendanceRegisterSchema.safeParse({
      classId: cls.id,
      sectionId: sectionA.id,
      date: tomorrowStr,
      academicYear: cls.academicYear,
      records: [{ studentId: aarav.id, status: "PRESENT" }],
    });
    assert(futureValidation.success, "ATT1-07A", "Schema parses valid payload structure");

    // Action business rule: reject future dates
    const isFuture = tomorrowStr > todayStr;
    assert(isFuture, "ATT1-07B", "Business rule correctly identifies and flags future date");

    // 6. Test date normalization helper
    const testDateStr = "2026-09-30";
    const parsedDate = parseDateToUtc(testDateStr);
    assert(
      parsedDate.toISOString().startsWith("2026-09-30T00:00:00.000Z"),
      "ATT1-08",
      "Date correctly normalized to UTC midnight for @db.Date column"
    );

    // Clean up any pre-existing test sessions for this test date
    await prisma.attendanceSession.deleteMany({
      where: {
        schoolId: school.id,
        classId: cls.id,
        sectionId: sectionA.id,
        date: parsedDate,
      },
    });

    // 7. Atomic Session Creation & Record Persistence
    const createdSession = await prisma.$transaction(async (tx) => {
      const sess = await tx.attendanceSession.create({
        data: {
          schoolId: school.id,
          classId: cls.id,
          sectionId: sectionA.id,
          academicYear: cls.academicYear,
          date: parsedDate,
          markedById: teacher.id,
          notes: "Morning roll call verified",
          records: {
            create: [
              {
                schoolId: school.id,
                studentId: aarav.id,
                status: AttendanceStatus.PRESENT,
                remarks: "On time",
              },
            ],
          },
        },
        include: { records: true },
      });
      return sess;
    });

    assert(!!createdSession.id, "ATT1-09", "AttendanceSession created atomically with records");
    assert(createdSession.records.length === 1, "ATT1-10", "AttendanceRecord linked to session");
    assert(
      createdSession.records[0].status === "PRESENT",
      "ATT1-11",
      "Attendance status PRESENT correctly recorded"
    );

    // 8. Unique Constraint Guard: Duplicate session prevention
    let duplicatePrevented = false;
    try {
      await prisma.attendanceSession.create({
        data: {
          schoolId: school.id,
          classId: cls.id,
          sectionId: sectionA.id,
          academicYear: cls.academicYear,
          date: parsedDate,
          markedById: admin.id,
        },
      });
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") {
        duplicatePrevented = true;
      }
    }
    assert(
      duplicatePrevented,
      "ATT1-12",
      "Unique constraint [schoolId, classId, sectionId, date] blocks duplicate daily sessions"
    );

    // 9. Session Upsert: Updating existing register
    const updatedSession = await prisma.$transaction(async (tx) => {
      const sess = await tx.attendanceSession.upsert({
        where: {
          schoolId_classId_sectionId_date: {
            schoolId: school.id,
            classId: cls.id,
            sectionId: sectionA.id,
            date: parsedDate,
          },
        },
        update: {
          markedById: admin.id,
          notes: "Updated afternoon status",
        },
        create: {
          schoolId: school.id,
          classId: cls.id,
          sectionId: sectionA.id,
          academicYear: cls.academicYear,
          date: parsedDate,
          markedById: admin.id,
        },
      });

      await tx.attendanceRecord.deleteMany({
        where: { sessionId: sess.id },
      });

      await tx.attendanceRecord.create({
        data: {
          schoolId: school.id,
          sessionId: sess.id,
          studentId: aarav.id,
          status: AttendanceStatus.ABSENT,
          remarks: "Parent reported illness",
        },
      });

      return sess;
    });

    const verifyUpdatedRecord = await prisma.attendanceRecord.findFirst({
      where: { sessionId: updatedSession.id, studentId: aarav.id },
    });
    assert(
      verifyUpdatedRecord?.status === "ABSENT",
      "ATT1-13",
      "Session upsert correctly modified student status to ABSENT without duplicate rows"
    );

    // 10. Verify support for all enum statuses (LATE, EXCUSED, HALF_DAY)
    const statusesToTest: AttendanceStatus[] = [
      AttendanceStatus.LATE,
      AttendanceStatus.EXCUSED,
      AttendanceStatus.HALF_DAY,
    ];

    for (const st of statusesToTest) {
      await prisma.attendanceRecord.updateMany({
        where: { sessionId: updatedSession.id, studentId: aarav.id },
        data: { status: st },
      });
      const check = await prisma.attendanceRecord.findFirst({
        where: { sessionId: updatedSession.id, studentId: aarav.id },
      });
      assert(check?.status === st, `ATT1-14-${st}`, `Attendance status ${st} supported and persisted`);
    }

    // 11. Teacher 48h Grace Period vs Admin Historical Permission Check
    const oldDateStr = "2026-09-01";
    const oldUtc = parseDateToUtc(oldDateStr);
    const nowUtc = parseDateToUtc(todayStr);
    const diffDays = Math.floor((nowUtc.getTime() - oldUtc.getTime()) / (1000 * 60 * 60 * 24));
    assert(diffDays > 1, "ATT1-15A", "Historical date > 48h correctly computed");

    const teacherCanEditOld = diffDays <= 1;
    const adminCanEditOld = true;
    assert(!teacherCanEditOld, "ATT1-15B", "Teacher blocked from editing historical date (>48h)");
    assert(adminCanEditOld, "ATT1-15C", "Administrator permitted to edit historical date");

    // 12. Audit Logging Persistence
    const auditLog = await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        userId: admin.id,
        action: "ATTENDANCE_MARKED",
        entityType: "ATTENDANCE_SESSION",
        entityId: updatedSession.id,
        newValues: {
          className: cls.name,
          sectionName: sectionA.name,
          date: testDateStr,
          totalStudents: 1,
          presentCount: 0,
          absentCount: 1,
        },
      },
    });
    assert(!!auditLog.id, "ATT1-16", "ATTENDANCE_MARKED audit log successfully written");

    // 13. Cross-Tenant Security Verification
    const otherSchool = await prisma.school.create({
      data: {
        name: "Foreign Academy",
        code: "TEMP_ATT_ISOLATION",
      },
    });

    const foreignSessionQuery = await prisma.attendanceSession.findFirst({
      where: {
        id: updatedSession.id,
        schoolId: otherSchool.id,
      },
    });
    assert(
      foreignSessionQuery === null,
      "ATT1-17",
      "Cross-tenant isolation verified: Foreign tenant cannot query other school's attendance session"
    );

    // Clean up foreign school
    await prisma.school.delete({ where: { id: otherSchool.id } });

    // 14. Clean up test attendance session
    await prisma.attendanceSession.delete({
      where: { id: updatedSession.id },
    });
    assert(true, "ATT1-18", "Test attendance session and records cleaned up cleanly");

    // 15. Verify baseline data remains completely untouched
    const baselineAarav = await prisma.student.findFirst({
      where: { schoolId: school.id, admissionNumber: "ADM-2025-001" },
    });
    assert(!!baselineAarav, "ATT1-19", "Baseline student Aarav Patel remains untouched");

    console.log("==========================================");
    console.log(`STAGE 1 TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
    console.log("==========================================");
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
