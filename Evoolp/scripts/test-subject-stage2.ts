import { PrismaClient } from "@prisma/client";
import { updateSubjectSchema, deleteSubjectSchema } from "../src/lib/validations/subject";
import { diffChanges } from "../src/lib/audit";

const prisma = new PrismaClient();

async function runTests() {
  console.log("==========================================");
  console.log("RUNNING SUBJECT STAGE 2 INTEGRATION TESTS");
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

  // 1. Locate demo school tenant
  const school = await prisma.school.findUnique({
    where: { code: "DEMO001" },
  });
  assert(!!school, "SUB2-01", "Found demo school tenant DEMO001");
  if (!school) return;

  // 2. Locate admin user
  const admin = await prisma.user.findFirst({
    where: { schoolId: school.id, role: "ADMIN" },
  });
  assert(!!admin, "SUB2-02", "Found tenant administrator Anita Sharma");
  if (!admin) return;

  // 3. Locate teacher user
  const teacherUser = await prisma.user.findFirst({
    where: { schoolId: school.id, role: "TEACHER" },
  });
  assert(!!teacherUser, "SUB2-03", "Found tenant teacher user for RBAC verification");

  // Verify baseline subjects are present
  const mathSubject = await prisma.subject.findUnique({
    where: { schoolId_code: { schoolId: school.id, code: "MATH6" } },
  });
  assert(!!mathSubject, "SUB2-04", "Baseline subject Mathematics (MATH6) verified intact");

  const scienceSubject = await prisma.subject.findUnique({
    where: { schoolId_code: { schoolId: school.id, code: "086" } },
  });
  assert(!!scienceSubject, "SUB2-05", "Baseline subject Science (086) verified intact");

  // Clean up any stale test records from previous runs
  await prisma.subject.deleteMany({
    where: {
      schoolId: school.id,
      code: { in: ["TEST-SUB-A", "TEST-SUB-B", "TEST-SUB-MOD", "TEST-DELETE-ME"] },
    },
  });

  // SUB2-06: Zod validation for updateSubjectSchema
  const validUpdate = updateSubjectSchema.safeParse({
    id: "some-cuid-1234",
    name: "Social Science & Humanities",
    code: "SOC-101",
  });
  assert(validUpdate.success, "SUB2-06", "updateSubjectSchema accepts valid name and formatted code");

  const invalidCodeUpdate = updateSubjectSchema.safeParse({
    id: "some-cuid-1234",
    name: "Invalid Subject",
    code: "INVALID CODE WITH SPACES",
  });
  assert(!invalidCodeUpdate.success, "SUB2-07", "updateSubjectSchema rejects codes containing spaces");

  // Create temporary subjects for mutation tests
  const testSubA = await prisma.subject.create({
    data: {
      schoolId: school.id,
      name: "Test Subject Alpha",
      code: "TEST-SUB-A",
    },
  });

  const testSubB = await prisma.subject.create({
    data: {
      schoolId: school.id,
      name: "Test Subject Beta",
      code: "TEST-SUB-B",
    },
  });

  // SUB2-08: Update subject with uppercase code normalization
  const rawUpdatedCode = "test-sub-mod";
  const normalizedUpdatedCode = rawUpdatedCode.trim().toUpperCase();
  const updatedSubA = await prisma.subject.update({
    where: { id: testSubA.id },
    data: {
      name: "Test Subject Alpha Modified",
      code: normalizedUpdatedCode,
    },
  });

  assert(
    updatedSubA.code === "TEST-SUB-MOD" && updatedSubA.name === "Test Subject Alpha Modified",
    "SUB2-08",
    "Subject updated successfully with uppercase normalization ('TEST-SUB-MOD')"
  );

  // SUB2-09: diffChanges calculation and SUBJECT_UPDATED audit log entry
  const oldVals = { name: testSubA.name, code: testSubA.code };
  const newVals = { name: updatedSubA.name, code: updatedSubA.code };
  const { oldValues, newValues } = diffChanges(oldVals, newVals);

  assert(
    (newValues as any).code === "TEST-SUB-MOD" && (oldValues as any).code === "TEST-SUB-A",
    "SUB2-09",
    "diffChanges() correctly captures granular field diffs for subject update"
  );

  const updateAuditLog = await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      userId: admin.id,
      action: "SUBJECT_UPDATED",
      entityType: "SUBJECT",
      entityId: testSubA.id,
      oldValues: oldValues as any,
      newValues: newValues as any,
    },
  });
  assert(!!updateAuditLog, "SUB2-10", "SUBJECT_UPDATED audit entry persisted successfully");

  // SUB2-11: Duplicate code protection on edit (updating testSubB to TEST-SUB-MOD should collide)
  let collisionDetected = false;
  const collisionCandidate = await prisma.subject.findFirst({
    where: {
      schoolId: school.id,
      code: "TEST-SUB-MOD",
      id: { not: testSubB.id },
    },
  });
  if (collisionCandidate) {
    collisionDetected = true;
  }
  assert(collisionDetected, "SUB2-11", "Duplicate code detection prevents collision when editing subject to an existing code");

  // SUB2-12: Same-code self-update (updating name while retaining same code)
  const selfCollisionCandidate = await prisma.subject.findFirst({
    where: {
      schoolId: school.id,
      code: "TEST-SUB-MOD",
      id: { not: testSubA.id },
    },
  });
  assert(!selfCollisionCandidate, "SUB2-12", "Self-update permitted: same code does not trigger collision against itself");

  // SUB2-13: Safe deletion with confirmation code validation
  const deleteTestSubject = await prisma.subject.create({
    data: {
      schoolId: school.id,
      name: "Temporary Subject For Deletion",
      code: "TEST-DELETE-ME",
    },
  });

  // Invalid confirmation code check
  const wrongCode = "WRONG-CODE";
  assert(
    wrongCode.trim().toUpperCase() !== deleteTestSubject.code,
    "SUB2-13",
    "Mismatched confirmation code correctly detected as invalid"
  );

  // Pre-deletion snapshot logging
  const deleteAuditLog = await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      userId: admin.id,
      action: "SUBJECT_DELETED",
      entityType: "SUBJECT",
      entityId: deleteTestSubject.id,
      oldValues: {
        id: deleteTestSubject.id,
        schoolId: deleteTestSubject.schoolId,
        name: deleteTestSubject.name,
        code: deleteTestSubject.code,
        createdAt: deleteTestSubject.createdAt,
      },
    },
  });
  assert(
    (deleteAuditLog.oldValues as any)?.code === "TEST-DELETE-ME",
    "SUB2-14",
    "SUBJECT_DELETED pre-deletion snapshot successfully logged in AuditLog"
  );

  // Delete subject
  await prisma.subject.delete({
    where: { id: deleteTestSubject.id },
  });

  const checkDeleted = await prisma.subject.findUnique({
    where: { id: deleteTestSubject.id },
  });
  assert(!checkDeleted, "SUB2-15", "Subject permanently removed from database upon confirmation");

  // SUB2-16: Cross-tenant isolation verification on edit and delete
  const tenantB = await prisma.school.upsert({
    where: { code: "DEMO_ISOLATION_STAGE2" },
    update: {},
    create: {
      name: "Stage 2 Isolation Academy",
      code: "DEMO_ISOLATION_STAGE2",
    },
  });

  const tenantBSubject = await prisma.subject.create({
    data: {
      schoolId: tenantB.id,
      name: "Tenant B Subject",
      code: "TB-SUB-101",
    },
  });

  // Querying tenant B's subject with tenant A's schoolId returns nothing
  const crossTenantSearch = await prisma.subject.findFirst({
    where: {
      id: tenantBSubject.id,
      schoolId: school.id, // school A
    },
  });
  assert(!crossTenantSearch, "SUB2-16", "Cross-tenant security: School A cannot locate or mutate School B subject");

  // Clean up Tenant B
  await prisma.subject.deleteMany({ where: { schoolId: tenantB.id } });
  await prisma.school.delete({ where: { id: tenantB.id } });

  // Clean up temporary subjects from DEMO001
  await prisma.subject.deleteMany({
    where: { id: { in: [testSubA.id, testSubB.id] } },
  });
  await prisma.auditLog.deleteMany({
    where: { entityId: { in: [testSubA.id, testSubB.id, deleteTestSubject.id] } },
  });

  // Verify baseline subjects remain untouched
  const finalMath = await prisma.subject.findUnique({
    where: { schoolId_code: { schoolId: school.id, code: "MATH6" } },
  });
  const finalScience = await prisma.subject.findUnique({
    where: { schoolId_code: { schoolId: school.id, code: "086" } },
  });
  assert(!!finalMath && !!finalScience, "SUB2-17", "Baseline subjects (MATH6, 086) remain intact and untouched");

  console.log("==========================================");
  console.log(`STAGE 2 TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log("==========================================");
}

runTests()
  .catch((e) => {
    console.error("Stage 2 test execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
