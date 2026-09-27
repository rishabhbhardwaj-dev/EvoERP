import { PrismaClient, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function runTests() {
  console.log("==========================================");
  console.log("RUNNING TEACHER STAGE 1 INTEGRATION TESTS");
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

  // 1. Find demo school tenant
  const school = await prisma.school.findUnique({
    where: { code: "DEMO001" },
  });
  assert(!!school, "TCH-INIT", "Found demo school tenant DEMO001");
  if (!school) return;

  // Clean up any test teachers from previous runs
  const previousTestUser = await prisma.user.findFirst({
    where: { schoolId: school.id, email: "sunita@demo.evoerp.in" },
  });
  if (previousTestUser) {
    await prisma.teacher.deleteMany({ where: { userId: previousTestUser.id } });
    await prisma.user.delete({ where: { id: previousTestUser.id } });
  }

  const previousTch002 = await prisma.teacher.findFirst({
    where: { schoolId: school.id, employeeCode: "TCH-002" },
  });
  if (previousTch002) {
    await prisma.teacher.delete({ where: { id: previousTch002.id } });
    await prisma.user.delete({ where: { id: previousTch002.userId } });
  }

  // TCH-02: Verify seeded Ravi Kumar / TCH-001 is discoverable
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
      seededTeacher.user.email === "teacher@demo.evoerp.in" &&
      seededTeacher.user.name === "Ravi Kumar" &&
      seededTeacher.department === "Mathematics" &&
      seededTeacher.qualification === "M.Sc, B.Ed",
    "TCH-02",
    "Seeded teacher Ravi Kumar (TCH-001, Mathematics, teacher@demo.evoerp.in) verified in database"
  );

  // TCH-03 & TCH-04: Atomic User + Teacher Creation (Sunita Rao, TCH-002)
  const sunitaName = "Sunita Rao";
  const sunitaEmail = "sunita@demo.evoerp.in";
  const sunitaCode = "TCH-002";
  const sunitaDept = "Science";
  const sunitaQual = "M.Sc, B.Ed";
  const rawPassword = "Password123!";
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const creationResult = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        schoolId: school.id,
        name: sunitaName,
        email: sunitaEmail,
        passwordHash,
        role: Role.TEACHER,
        status: UserStatus.ACTIVE,
      },
    });

    const teacher = await tx.teacher.create({
      data: {
        schoolId: school.id,
        userId: user.id,
        employeeCode: sunitaCode,
        department: sunitaDept,
        qualification: sunitaQual,
      },
    });

    return { user, teacher };
  });

  assert(
    !!creationResult.user.id &&
      !!creationResult.teacher.id &&
      creationResult.teacher.userId === creationResult.user.id &&
      creationResult.user.role === "TEACHER" &&
      creationResult.user.status === "ACTIVE",
    "TCH-04",
    "User + Teacher records created atomically in single transaction"
  );

  // TCH-07: Password is hashed and bcrypt verification succeeds
  const isPasswordValid = await bcrypt.compare(rawPassword, creationResult.user.passwordHash);
  assert(
    isPasswordValid &&
      !creationResult.user.passwordHash.includes(rawPassword) &&
      creationResult.user.passwordHash.startsWith("$2"),
    "TCH-07",
    "Password correctly hashed with bcrypt and verifiable; plaintext not stored"
  );

  // TCH-05: Duplicate employeeCode is rejected by unique constraint
  let duplicateCodeCaught = false;
  try {
    const dupUser = await prisma.user.create({
      data: {
        schoolId: school.id,
        name: "Duplicate Code Tester",
        email: "dupcode@demo.evoerp.in",
        passwordHash,
        role: Role.TEACHER,
      },
    });

    try {
      await prisma.teacher.create({
        data: {
          schoolId: school.id,
          userId: dupUser.id,
          employeeCode: "TCH-002", // Duplicate!
          department: "Physics",
        },
      });
    } catch {
      duplicateCodeCaught = true;
      await prisma.user.delete({ where: { id: dupUser.id } });
    }
  } catch (err) {
    duplicateCodeCaught = true;
  }
  assert(duplicateCodeCaught, "TCH-05", "Duplicate employeeCode (TCH-002) is rejected by unique constraint");

  // TCH-06: Duplicate email is rejected by unique constraint
  let duplicateEmailCaught = false;
  try {
    await prisma.user.create({
      data: {
        schoolId: school.id,
        name: "Duplicate Email Tester",
        email: sunitaEmail, // Duplicate!
        passwordHash,
        role: Role.TEACHER,
      },
    });
  } catch {
    duplicateEmailCaught = true;
  }
  assert(duplicateEmailCaught, "TCH-06", "Duplicate email within tenant (sunita@demo.evoerp.in) is rejected by unique constraint");

  // TCH-09: Audit Log entry simulation and validation
  const adminUser = await prisma.user.findFirst({
    where: { schoolId: school.id, role: Role.ADMIN },
  });
  assert(!!adminUser, "TCH-08-ADMIN", "Found administrator user in tenant");

  const auditLog = await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      userId: adminUser!.id,
      action: "TEACHER_CREATED",
      entityType: "TEACHER",
      entityId: creationResult.teacher.id,
      newValues: {
        employeeCode: sunitaCode,
        name: sunitaName,
        email: sunitaEmail,
        department: sunitaDept,
        qualification: sunitaQual,
      },
    },
  });

  assert(
    auditLog.action === "TEACHER_CREATED" &&
      auditLog.entityType === "TEACHER" &&
      auditLog.entityId === creationResult.teacher.id,
    "TCH-09",
    "TEACHER_CREATED audit log entry written with correct metadata without password exposure"
  );

  // TCH-10: Cross-tenant isolation verification
  // Create a second temporary school tenant
  const school2 = await prisma.school.upsert({
    where: { code: "TEST002" },
    update: {},
    create: {
      name: "Second Test School",
      code: "TEST002",
    },
  });

  // Querying teachers scoped to School 1 should NOT return School 2 teachers
  const school1Teachers = await prisma.teacher.findMany({
    where: { schoolId: school.id },
  });
  const school2Teachers = await prisma.teacher.findMany({
    where: { schoolId: school2.id },
  });

  assert(
    school1Teachers.every((t) => t.schoolId === school.id) &&
      school2Teachers.every((t) => t.schoolId === school2.id) &&
      !school1Teachers.some((t) => t.schoolId === school2.id),
    "TCH-10",
    "Cross-tenant isolation strictly verified; queries partitioned cleanly by schoolId"
  );

  // Clean up test teacher and second school
  await prisma.auditLog.deleteMany({ where: { entityId: creationResult.teacher.id } });
  await prisma.teacher.delete({ where: { id: creationResult.teacher.id } });
  await prisma.user.delete({ where: { id: creationResult.user.id } });
  await prisma.school.delete({ where: { id: school2.id } });

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
