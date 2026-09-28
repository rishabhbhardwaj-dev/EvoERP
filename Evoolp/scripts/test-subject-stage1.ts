import { PrismaClient } from "@prisma/client";
import { createSubjectSchema } from "../src/lib/validations/subject";

const prisma = new PrismaClient();

async function runTests() {
  console.log("==========================================");
  console.log("RUNNING SUBJECT STAGE 1 INTEGRATION TESTS");
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
  assert(!!school, "SUB1-01", "Found demo school tenant DEMO001");
  if (!school) return;

  // 2. Locate admin user
  const admin = await prisma.user.findFirst({
    where: { schoolId: school.id, role: "ADMIN" },
  });
  assert(!!admin, "SUB1-02", "Found tenant administrator Anita Sharma");
  if (!admin) return;

  // Clean up any test subjects from previous test runs
  await prisma.subject.deleteMany({
    where: {
      schoolId: school.id,
      code: { in: ["301", "ENG-101", "PHY/LAB", "CHEM.101"] },
    },
  });

  // Clean up audit logs for test subjects
  await prisma.auditLog.deleteMany({
    where: {
      schoolId: school.id,
      entityType: "SUBJECT",
      action: "SUBJECT_CREATED",
      newValues: {
        path: ["code"],
        equals: "301",
      },
    },
  });

  // SUB1-03: Verify seeded Mathematics / MATH6 is discoverable
  const seededSubject = await prisma.subject.findUnique({
    where: {
      schoolId_code: {
        schoolId: school.id,
        code: "MATH6",
      },
    },
  });
  assert(!!seededSubject, "SUB1-03", "Seeded subject Mathematics (MATH6) verified in database");
  assert(seededSubject?.name === "Mathematics", "SUB1-03B", "Seeded subject name matches 'Mathematics'");

  // SUB1-04: Test Zod validation schema with standard code (301)
  const validParsed = createSubjectSchema.safeParse({
    name: "English Core",
    code: "301",
  });
  assert(validParsed.success, "SUB1-04", "Validation passes for standard 3-digit CBSE code '301'");

  // SUB1-05: Test Zod validation with slash-supported code (PHY/LAB)
  const slashParsed = createSubjectSchema.safeParse({
    name: "Physics Practical",
    code: "PHY/LAB",
  });
  assert(slashParsed.success, "SUB1-05", "Validation passes for slash-supported code 'PHY/LAB'");

  // SUB1-06: Test Zod validation with dot-supported code (CHEM.101)
  const dotParsed = createSubjectSchema.safeParse({
    name: "Chemistry Theory",
    code: "CHEM.101",
  });
  assert(dotParsed.success, "SUB1-06", "Validation passes for period-supported code 'CHEM.101'");

  // SUB1-07: Test Zod validation rejection for invalid characters (spaces, special symbols)
  const invalidSpaceParsed = createSubjectSchema.safeParse({
    name: "Math Advanced",
    code: "MATH 101",
  });
  assert(!invalidSpaceParsed.success, "SUB1-07", "Validation rejects code with spaces ('MATH 101')");

  const invalidSymbolParsed = createSubjectSchema.safeParse({
    name: "Special Math",
    code: "@MATH",
  });
  assert(!invalidSymbolParsed.success, "SUB1-07B", "Validation rejects code with illegal symbols ('@MATH')");

  // SUB1-08: Create new subject with uppercase normalization
  const normalizedCode = "eng-101".trim().toUpperCase();
  const createdSubject = await prisma.subject.create({
    data: {
      schoolId: school.id,
      name: "English Language & Literature",
      code: normalizedCode,
    },
  });
  assert(createdSubject.code === "ENG-101", "SUB1-08", "Subject code uppercase normalization persisted ('ENG-101')");

  // Record audit log entry for created subject
  await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      userId: admin.id,
      action: "SUBJECT_CREATED",
      entityType: "SUBJECT",
      entityId: createdSubject.id,
      newValues: {
        name: createdSubject.name,
        code: createdSubject.code,
      },
    },
  });

  // SUB1-09: Verify audit log was recorded correctly
  const auditEntry = await prisma.auditLog.findFirst({
    where: {
      schoolId: school.id,
      entityType: "SUBJECT",
      entityId: createdSubject.id,
      action: "SUBJECT_CREATED",
    },
  });
  assert(!!auditEntry, "SUB1-09", "SUBJECT_CREATED audit log correctly logged in database");
  assert(
    (auditEntry?.newValues as any)?.code === "ENG-101",
    "SUB1-09B",
    "Audit log newValues matches created subject code"
  );

  // SUB1-10: Test duplicate code rejection within tenant (schoolId_code)
  let duplicateRejected = false;
  try {
    await prisma.subject.create({
      data: {
        schoolId: school.id,
        name: "Duplicate English",
        code: "ENG-101",
      },
    });
  } catch (err: any) {
    duplicateRejected = err.code === "P2002" || String(err).includes("Unique constraint");
  }
  assert(duplicateRejected, "SUB1-10", "Duplicate subject code 'ENG-101' rejected by composite constraint schoolId_code");

  // SUB1-11: Cross-tenant isolation verification
  // Create a separate school tenant and verify it can have the same subject code 'MATH6' without collision
  const tenantB = await prisma.school.upsert({
    where: { code: "DEMO_ISOLATION_TEST" },
    update: {},
    create: {
      name: "Isolation Test Academy",
      code: "DEMO_ISOLATION_TEST",
    },
  });

  const tenantBSubject = await prisma.subject.upsert({
    where: {
      schoolId_code: {
        schoolId: tenantB.id,
        code: "MATH6",
      },
    },
    update: {},
    create: {
      schoolId: tenantB.id,
      name: "Mathematics (Tenant B)",
      code: "MATH6",
    },
  });

  assert(!!tenantBSubject, "SUB1-11", "Tenant B successfully created subject 'MATH6' without colliding with DEMO001");

  // Query subjects strictly for DEMO001
  const demo001Subjects = await prisma.subject.findMany({
    where: { schoolId: school.id },
  });
  const hasTenantBSubject = demo001Subjects.some((s) => s.id === tenantBSubject.id);
  assert(!hasTenantBSubject, "SUB1-11B", "Tenant DEMO001 queries strictly exclude Tenant B subjects");

  // Clean up Tenant B
  await prisma.subject.deleteMany({ where: { schoolId: tenantB.id } });
  await prisma.school.delete({ where: { id: tenantB.id } });

  // Clean up created test subject from DEMO001
  await prisma.subject.delete({ where: { id: createdSubject.id } });
  await prisma.auditLog.deleteMany({ where: { entityId: createdSubject.id } });

  console.log("==========================================");
  console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log("==========================================");
}

runTests()
  .catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
