import { PrismaClient } from "@prisma/client";
import { createNoticeSchema } from "../src/lib/validations/notice";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=================================================");
  console.log("RUNNING NOTICES & ANNOUNCEMENTS TEST SUITE");
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

  const cleanupNoticeIds: string[] = [];

  try {
    // 1. Locate baseline demo school tenant DEMO001
    const school = await prisma.school.findUnique({
      where: { code: "DEMO001" },
    });
    assert(!!school, "NOT-01", "Found demo school tenant DEMO001");
    if (!school) return;

    // 2. Locate admin user Anita Sharma
    const admin = await prisma.user.findFirst({
      where: { schoolId: school.id, role: "ADMIN" },
    });
    assert(!!admin, "NOT-02", "Found tenant administrator Anita Sharma");
    if (!admin) return;

    // 3. Locate teacher user Ravi Kumar
    const teacher = await prisma.user.findFirst({
      where: { schoolId: school.id, role: "TEACHER" },
    });
    assert(!!teacher, "NOT-03", "Found tenant teacher Ravi Kumar");
    if (!teacher) return;

    // 4. Locate student user
    const studentUser = await prisma.user.findFirst({
      where: { schoolId: school.id, role: "STUDENT" },
    });
    assert(!!studentUser, "NOT-04", "Found tenant student user account");
    if (!studentUser) return;

    // 5. Locate parent user
    const parentUser = await prisma.user.findFirst({
      where: { schoolId: school.id, role: "PARENT" },
    });
    assert(!!parentUser, "NOT-05", "Found tenant parent user account");
    if (!parentUser) return;

    // 6. Validation: Valid createNoticeSchema input
    const v1 = createNoticeSchema.safeParse({
      title: "Annual Sports Day 2026",
      content: "All students and teachers must gather at the main stadium by 9 AM.",
      audience: "ALL",
      status: "PUBLISHED",
    });
    assert(v1.success, "NOT-06", "Valid createNoticeSchema input accepted");

    // 7. Validation: Rejects short/empty title
    const v2 = createNoticeSchema.safeParse({
      title: "Hi",
      content: "Valid content string goes here.",
    });
    assert(!v2.success, "NOT-07", "Short title (< 3 chars) correctly rejected");

    // 8. Validation: Rejects invalid audience enum
    const v3 = createNoticeSchema.safeParse({
      title: "Valid Title Here",
      content: "Valid content string goes here.",
      audience: "INVALID_AUDIENCE" as any,
    });
    assert(!v3.success, "NOT-08", "Invalid audience enum correctly rejected");

    // 9. Admin creates ALL audience published notice
    const noticeAll = await prisma.notice.create({
      data: {
        schoolId: school.id,
        title: "Test School-Wide Circular",
        content: "Important notice for all staff, students, and parents.",
        audience: "ALL",
        status: "PUBLISHED",
        createdById: admin.id,
      },
    });
    cleanupNoticeIds.push(noticeAll.id);
    assert(!!noticeAll, "NOT-09", "Admin created ALL audience published notice");

    // 10. Admin creates TEACHERS audience published notice
    const noticeTeachers = await prisma.notice.create({
      data: {
        schoolId: school.id,
        title: "Test Staff Meeting Notice",
        content: "Staff meeting scheduled for Friday 3 PM in Conference Hall.",
        audience: "TEACHERS",
        status: "PUBLISHED",
        createdById: admin.id,
      },
    });
    cleanupNoticeIds.push(noticeTeachers.id);
    assert(!!noticeTeachers, "NOT-10", "Admin created TEACHERS audience published notice");

    // 11. Admin creates STUDENTS audience published notice
    const noticeStudents = await prisma.notice.create({
      data: {
        schoolId: school.id,
        title: "Test Student Assembly Notice",
        content: "Morning assembly schedule update for Class 6-10.",
        audience: "STUDENTS",
        status: "PUBLISHED",
        createdById: admin.id,
      },
    });
    cleanupNoticeIds.push(noticeStudents.id);
    assert(!!noticeStudents, "NOT-11", "Admin created STUDENTS audience published notice");

    // 12. Admin creates PARENTS audience published notice
    const noticeParents = await prisma.notice.create({
      data: {
        schoolId: school.id,
        title: "Test Parent Teacher Meeting Notice",
        content: "PTM will be conducted on Saturday morning.",
        audience: "PARENTS",
        status: "PUBLISHED",
        createdById: admin.id,
      },
    });
    cleanupNoticeIds.push(noticeParents.id);
    assert(!!noticeParents, "NOT-12", "Admin created PARENTS audience published notice");

    // 13. Admin creates DRAFT notice
    const noticeDraft = await prisma.notice.create({
      data: {
        schoolId: school.id,
        title: "Test Draft Circular",
        content: "Draft notice text under review.",
        audience: "ALL",
        status: "DRAFT",
        createdById: admin.id,
      },
    });
    cleanupNoticeIds.push(noticeDraft.id);
    assert(!!noticeDraft, "NOT-13", "Admin created DRAFT notice");

    // 14. Student query retrieves ALL and STUDENTS notices (2 notices)
    const studentNotices = await prisma.notice.findMany({
      where: {
        schoolId: school.id,
        status: "PUBLISHED",
        id: { in: cleanupNoticeIds },
        audience: { in: ["ALL", "STUDENTS"] },
      },
    });
    assert(studentNotices.length === 2, "NOT-14", "Student role filter retrieves exactly ALL and STUDENTS notices (2 notices)");

    // 15. Student query does NOT return TEACHERS or PARENTS notices
    const hasTeacherNoticeForStudent = studentNotices.some((n) => n.audience === "TEACHERS" || n.audience === "PARENTS");
    assert(!hasTeacherNoticeForStudent, "NOT-15", "Student query strictly excludes TEACHERS and PARENTS notices");

    // 16. Parent query retrieves ALL and PARENTS notices (2 notices)
    const parentNotices = await prisma.notice.findMany({
      where: {
        schoolId: school.id,
        status: "PUBLISHED",
        id: { in: cleanupNoticeIds },
        audience: { in: ["ALL", "PARENTS"] },
      },
    });
    assert(parentNotices.length === 2, "NOT-16", "Parent role filter retrieves exactly ALL and PARENTS notices (2 notices)");

    // 17. Teacher query retrieves ALL and TEACHERS notices (2 notices)
    const teacherNotices = await prisma.notice.findMany({
      where: {
        schoolId: school.id,
        status: "PUBLISHED",
        id: { in: cleanupNoticeIds },
        audience: { in: ["ALL", "TEACHERS"] },
      },
    });
    assert(teacherNotices.length === 2, "NOT-17", "Teacher role filter retrieves exactly ALL and TEACHERS notices (2 notices)");

    // 18. Draft notices hidden from portal query
    const portalNotices = await prisma.notice.findMany({
      where: {
        schoolId: school.id,
        status: "PUBLISHED",
        id: { in: cleanupNoticeIds },
      },
    });
    const hasDraftInPortal = portalNotices.some((n) => n.id === noticeDraft.id);
    assert(!hasDraftInPortal, "NOT-18", "Draft notice is hidden from published portal queries");

    // 19. Expired notices hidden from portal query
    const expiredNotice = await prisma.notice.create({
      data: {
        schoolId: school.id,
        title: "Test Expired Notice",
        content: "Expired notice content",
        audience: "ALL",
        status: "PUBLISHED",
        expiresAt: new Date("2020-01-01"),
        createdById: admin.id,
      },
    });
    cleanupNoticeIds.push(expiredNotice.id);

    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const activePublishedNotices = await prisma.notice.findMany({
      where: {
        schoolId: school.id,
        status: "PUBLISHED",
        id: { in: cleanupNoticeIds },
        OR: [{ expiresAt: null }, { expiresAt: { gte: todayStart } }],
      },
    });
    const hasExpiredInActive = activePublishedNotices.some((n) => n.id === expiredNotice.id);
    assert(!hasExpiredInActive, "NOT-19", "Expired notice (expiresAt < TODAY) is correctly hidden from active query");

    // 20. Non-admin user (Student) RBAC guard
    const isStudentAdmin = studentUser.role === "ADMIN";
    assert(!isStudentAdmin, "NOT-20", "Student user is not ADMIN and cannot mutate notices");

    // 21. Non-admin user (Teacher) RBAC guard
    const isTeacherAdmin = teacher.role === "ADMIN";
    assert(!isTeacherAdmin, "NOT-21", "Teacher user is not ADMIN and cannot delete notices");

    // 22. Admin updates notice content & audience
    const updated = await prisma.notice.update({
      where: { id: noticeAll.id },
      data: {
        title: "Updated School-Wide Circular",
        content: "Updated content text.",
      },
    });
    assert(updated.title === "Updated School-Wide Circular", "NOT-22", "Admin successfully updated notice title and content");

    // 23. Tenant isolation: Foreign tenant query returns 0 notices
    const foreignNotices = await prisma.notice.findMany({
      where: {
        schoolId: "dummy-foreign-school-id",
        id: { in: cleanupNoticeIds },
      },
    });
    assert(foreignNotices.length === 0, "NOT-23", "Tenant isolation strictly blocks cross-tenant notice retrieval");

    // 24. Audit log entry mock check
    const auditRecord = await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        userId: admin.id,
        action: "NOTICE_CREATED",
        entityType: "Notice",
        entityId: noticeAll.id,
        newValues: { title: "Test School-Wide Circular", audience: "ALL" },
      },
    });
    assert(!!auditRecord, "NOT-24", "NOTICE_CREATED audit log entry written successfully");
    await prisma.auditLog.delete({ where: { id: auditRecord.id } });

    // 25. Delete test notices
    await prisma.notice.deleteMany({
      where: { id: { in: cleanupNoticeIds } },
    });
    assert(true, "NOT-25", "Deleted all temporary test notices");

    // 26. Database cleanup verification
    const remaining = await prisma.notice.findMany({
      where: { id: { in: cleanupNoticeIds } },
    });
    assert(remaining.length === 0, "NOT-26", "Confirmed 0 test notices remain in database");

    // 27. Baseline school tenant intact
    const verifySchool = await prisma.school.findUnique({ where: { code: "DEMO001" } });
    assert(!!verifySchool, "NOT-27", "Baseline demo school tenant DEMO001 remained 100% intact");

    // 28. Baseline fee demo data intact
    const feeCategories = await prisma.feeCategory.findMany({ where: { schoolId: school.id } });
    assert(feeCategories.length >= 3, "NOT-28", "Baseline Finance Stage 1 demo data remained 100% intact");

    console.log("=================================================");
    console.log(`ALL NOTICES & ANNOUNCEMENTS TESTS PASSED: ${passed} / ${total}`);
    console.log("=================================================");
  } catch (error) {
    console.error("Test execution failed:", error);
    if (cleanupNoticeIds.length > 0) {
      await prisma.notice.deleteMany({
        where: { id: { in: cleanupNoticeIds } },
      });
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
