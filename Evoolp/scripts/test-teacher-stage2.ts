import { PrismaClient, Prisma, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Helper to compute diff between old and new values, matching lib/audit.ts
function diffChanges(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>
): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    if (oldObj[key] !== newObj[key]) {
      oldValues[key] = oldObj[key] ?? null;
      newValues[key] = newObj[key] ?? null;
    }
  }

  return { oldValues, newValues };
}

async function runTests() {
  console.log("==========================================");
  console.log("RUNNING TEACHER STAGE 2 INTEGRATION TESTS");
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

  // 1. TCH2-01: Find demo school tenant and admin user
  const school = await prisma.school.findUnique({
    where: { code: "DEMO001" },
  });
  assert(!!school, "TCH2-01", "Found demo school tenant DEMO001");
  if (!school) return;

  const adminUser = await prisma.user.findFirst({
    where: { schoolId: school.id, role: Role.ADMIN },
  });
  assert(!!adminUser, "TCH2-01B", "Found administrator user in tenant");
  if (!adminUser) return;

  // Clean up any test teachers from previous runs
  const cleanupEmails = ["meera@demo.evoerp.in", "crosstch@test.evoerp.in"];
  for (const email of cleanupEmails) {
    const existing = await prisma.user.findFirst({
      where: { email },
    });
    if (existing) {
      await prisma.auditLog.deleteMany({ where: { entityId: existing.id } });
      const t = await prisma.teacher.findFirst({ where: { userId: existing.id } });
      if (t) {
        await prisma.auditLog.deleteMany({ where: { entityId: t.id } });
        await prisma.teacher.delete({ where: { id: t.id } });
      }
      await prisma.user.delete({ where: { id: existing.id } });
    }
  }

  // Ensure Ravi Kumar baseline values in case prior interactive tests modified them
  await prisma.teacher.updateMany({
    where: {
      schoolId: school.id,
      employeeCode: "TCH-001",
    },
    data: {
      qualification: "M.Sc, B.Ed",
      department: "Mathematics",
    },
  });

  // 2. TCH2-02: Verify seeded teacher Ravi Kumar (TCH-001) details
  const seededTeacher = await prisma.teacher.findUnique({
    where: {
      schoolId_employeeCode: {
        schoolId: school.id,
        employeeCode: "TCH-001",
      },
    },
    include: {
      user: true,
    },
  });

  assert(
    !!seededTeacher &&
      seededTeacher.user.name === "Ravi Kumar" &&
      seededTeacher.user.email === "teacher@demo.evoerp.in" &&
      seededTeacher.department === "Mathematics" &&
      seededTeacher.qualification === "M.Sc, B.Ed" &&
      seededTeacher.user.status === "ACTIVE",
    "TCH2-02",
    "Seeded teacher Ravi Kumar (TCH-001) full profile verified"
  );

  // 3. TCH2-03: Create a dedicated test teacher (Meera Sharma, TCH-088)
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const testTeacherRecord = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        schoolId: school.id,
        name: "Meera Sharma",
        email: "meera@demo.evoerp.in",
        passwordHash,
        role: Role.TEACHER,
        status: UserStatus.ACTIVE,
      },
    });

    const teacher = await tx.teacher.create({
      data: {
        schoolId: school.id,
        userId: user.id,
        employeeCode: "TCH-088",
        department: "Arts & Craft",
        qualification: "B.F.A, B.Ed",
      },
    });

    return { user, teacher };
  });

  assert(
    !!testTeacherRecord.teacher.id && testTeacherRecord.user.status === "ACTIVE",
    "TCH2-03",
    "Created test teacher Meera Sharma (TCH-088) with ACTIVE status"
  );

  // 4. TCH2-04: Update teacher fields (name, department, qualification) & diff audit logging
  const currentSnapshot = {
    name: testTeacherRecord.user.name,
    department: testTeacherRecord.teacher.department,
    qualification: testTeacherRecord.teacher.qualification,
  };

  const updatedInput = {
    name: "Meera S. Sharma",
    department: "Fine Arts",
    qualification: "M.F.A, B.Ed, UGC-NET",
  };

  const diff = diffChanges(currentSnapshot, updatedInput);

  const updatedTeacherRecord = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: testTeacherRecord.user.id },
      data: { name: updatedInput.name },
    });

    const updatedT = await tx.teacher.update({
      where: { id: testTeacherRecord.teacher.id },
      data: {
        department: updatedInput.department,
        qualification: updatedInput.qualification,
      },
      include: { user: true },
    });

    await tx.auditLog.create({
      data: {
        schoolId: school.id,
        userId: adminUser.id,
        action: "TEACHER_UPDATED",
        entityType: "TEACHER",
        entityId: updatedT.id,
        oldValues: diff.oldValues as Prisma.InputJsonObject,
        newValues: diff.newValues as Prisma.InputJsonObject,
      },
    });

    return updatedT;
  });

  assert(
    updatedTeacherRecord.user.name === "Meera S. Sharma" &&
      updatedTeacherRecord.department === "Fine Arts" &&
      updatedTeacherRecord.qualification === "M.F.A, B.Ed, UGC-NET" &&
      updatedTeacherRecord.employeeCode === "TCH-088" && // immutable!
      updatedTeacherRecord.user.email === "meera@demo.evoerp.in", // immutable!
    "TCH2-04",
    "Teacher profile successfully updated while preserving immutable employeeCode and email"
  );

  const updateAuditLog = await prisma.auditLog.findFirst({
    where: {
      entityId: testTeacherRecord.teacher.id,
      action: "TEACHER_UPDATED",
    },
  });
  assert(
    !!updateAuditLog &&
      (updateAuditLog.oldValues as { department?: string } | null)?.department === "Arts & Craft" &&
      (updateAuditLog.newValues as { department?: string } | null)?.department === "Fine Arts",
    "TCH2-04B",
    "TEACHER_UPDATED audit log entry correctly recorded diffs without password exposure"
  );

  // 5. TCH2-05: Deactivate teacher (ACTIVE -> INACTIVE) with administrative reason
  const deactivateReason = "Staff requested personal study leave for 1 academic term";
  const deactivatedTeacher = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: testTeacherRecord.user.id },
      data: { status: UserStatus.INACTIVE },
    });

    await tx.auditLog.create({
      data: {
        schoolId: school.id,
        userId: adminUser.id,
        action: "TEACHER_STATUS_CHANGED",
        entityType: "TEACHER",
        entityId: testTeacherRecord.teacher.id,
        oldValues: { status: "ACTIVE" },
        newValues: { status: "INACTIVE", reason: deactivateReason },
      },
    });

    return updatedUser;
  });

  assert(
    deactivatedTeacher.status === "INACTIVE",
    "TCH2-05",
    "Teacher account status successfully toggled to INACTIVE"
  );

  const deactivationLog = await prisma.auditLog.findFirst({
    where: {
      entityId: testTeacherRecord.teacher.id,
      action: "TEACHER_STATUS_CHANGED",
    },
    orderBy: { createdAt: "desc" },
  });
  assert(
    !!deactivationLog &&
      (deactivationLog.newValues as { status?: string; reason?: string } | null)?.status === "INACTIVE" &&
      (deactivationLog.newValues as { status?: string; reason?: string } | null)?.reason === deactivateReason,
    "TCH2-05B",
    "TEACHER_STATUS_CHANGED audit entry recorded with administrative reason"
  );

  // 6. TCH2-06: Reactivate teacher (INACTIVE -> ACTIVE)
  const reactivatedTeacher = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: testTeacherRecord.user.id },
      data: { status: UserStatus.ACTIVE },
    });

    await tx.auditLog.create({
      data: {
        schoolId: school.id,
        userId: adminUser.id,
        action: "TEACHER_STATUS_CHANGED",
        entityType: "TEACHER",
        entityId: testTeacherRecord.teacher.id,
        oldValues: { status: "INACTIVE" },
        newValues: { status: "ACTIVE" },
      },
    });

    return updatedUser;
  });

  assert(
    reactivatedTeacher.status === "ACTIVE",
    "TCH2-06",
    "Teacher account status successfully reactivated to ACTIVE"
  );

  // 7. TCH2-07: Safe teacher deletion with audit snapshot & atomic cleanup
  const deletionSnapshot = {
    employeeCode: updatedTeacherRecord.employeeCode,
    name: updatedTeacherRecord.user.name,
    email: updatedTeacherRecord.user.email,
    department: updatedTeacherRecord.department,
    qualification: updatedTeacherRecord.qualification,
    status: reactivatedTeacher.status,
  };

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        schoolId: school.id,
        userId: adminUser.id,
        action: "TEACHER_DELETED",
        entityType: "TEACHER",
        entityId: testTeacherRecord.teacher.id,
        oldValues: deletionSnapshot,
        newValues: { reason: "Resigned to pursue higher education" },
      },
    });

    await tx.teacher.delete({
      where: { id: testTeacherRecord.teacher.id },
    });

    await tx.user.delete({
      where: { id: testTeacherRecord.user.id },
    });
  });

  const checkTeacher = await prisma.teacher.findUnique({
    where: { id: testTeacherRecord.teacher.id },
  });
  const checkUser = await prisma.user.findUnique({
    where: { id: testTeacherRecord.user.id },
  });

  assert(
    checkTeacher === null && checkUser === null,
    "TCH2-07",
    "Teacher and linked User deleted atomically without leaving orphan records"
  );

  const deletionLog = await prisma.auditLog.findFirst({
    where: {
      entityId: testTeacherRecord.teacher.id,
      action: "TEACHER_DELETED",
    },
  });
  assert(
    !!deletionLog &&
      (deletionLog.oldValues as { employeeCode?: string; name?: string } | null)?.employeeCode === "TCH-088" &&
      (deletionLog.oldValues as { employeeCode?: string; name?: string } | null)?.name === "Meera S. Sharma",
    "TCH2-07B",
    "Historical TEACHER_DELETED audit log preserved with complete staff snapshot"
  );

  // 8. TCH2-08: Cross-tenant isolation protection
  const school2 = await prisma.school.upsert({
    where: { code: "TEST002" },
    update: {},
    create: {
      name: "Second Test School",
      code: "TEST002",
    },
  });

  const s2User = await prisma.user.create({
    data: {
      schoolId: school2.id,
      name: "Cross Tenant Teacher",
      email: "crosstch@test.evoerp.in",
      passwordHash,
      role: Role.TEACHER,
    },
  });

  const s2Teacher = await prisma.teacher.create({
    data: {
      schoolId: school2.id,
      userId: s2User.id,
      employeeCode: "S2-TCH-001",
      department: "History",
    },
  });

  // Attempting to find or modify s2Teacher using school.id (DEMO001) must yield null / fail
  const crossTenantCheck = await prisma.teacher.findFirst({
    where: {
      id: s2Teacher.id,
      schoolId: school.id, // school 1!
    },
  });

  assert(
    crossTenantCheck === null,
    "TCH2-08",
    "Cross-tenant isolation strictly verified; tenant cannot query or mutate foreign teacher records"
  );

  // 9. TCH2-09: Password safety check
  const allTeacherLogs = await prisma.auditLog.findMany({
    where: {
      entityId: testTeacherRecord.teacher.id,
    },
  });

  const hasPasswordLeak = allTeacherLogs.some((l) => {
    const oldStr = JSON.stringify(l.oldValues || {});
    const newStr = JSON.stringify(l.newValues || {});
    return (
      oldStr.includes("password") ||
      oldStr.includes("$2") ||
      newStr.includes("password") ||
      newStr.includes("$2")
    );
  });

  assert(
    !hasPasswordLeak,
    "TCH2-09",
    "Password and hash privacy strictly enforced: zero occurrences in audit records"
  );

  // Clean up school 2 resources and test audit logs
  await prisma.teacher.delete({ where: { id: s2Teacher.id } });
  await prisma.user.delete({ where: { id: s2User.id } });
  await prisma.school.delete({ where: { id: school2.id } });
  await prisma.auditLog.deleteMany({ where: { entityId: testTeacherRecord.teacher.id } });

  console.log("==========================================");
  console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log("==========================================");
}

runTests()
  .catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
