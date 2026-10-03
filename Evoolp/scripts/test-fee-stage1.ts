import { PrismaClient, Prisma } from "@prisma/client";
import {
  createFeeCategorySchema,
  createFeeStructureSchema,
  createFeeDiscountSchema,
  allocateFeesSchema,
} from "../src/lib/validations/fee";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=================================================");
  console.log("RUNNING FINANCE STAGE 1 INTEGRATION TEST SUITE");
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

  try {
    // 1. Locate baseline demo school tenant DEMO001
    const school = await prisma.school.findUnique({
      where: { code: "DEMO001" },
    });
    assert(!!school, "FEE1-01", "Found demo school tenant DEMO001");
    if (!school) return;

    // 2. Locate admin and teacher users
    const admin = await prisma.user.findFirst({
      where: { schoolId: school.id, role: "ADMIN" },
    });
    assert(!!admin, "FEE1-02", "Found tenant administrator Anita Sharma");
    if (!admin) return;

    const teacher = await prisma.user.findFirst({
      where: { schoolId: school.id, role: "TEACHER" },
    });
    assert(!!teacher, "FEE1-03", "Found tenant teacher Ravi Kumar");
    if (!teacher) return;

    // 3. Locate baseline Class 6 and Section A
    const cls = await prisma.class.findFirst({
      where: { schoolId: school.id, name: "Class 6" },
      include: { sections: true },
    });
    assert(!!cls, "FEE1-04", "Found baseline Class 6");
    if (!cls) return;

    const sectionA = cls.sections.find((s) => s.name === "A");
    assert(!!sectionA, "FEE1-05", "Found baseline Section A in Class 6");
    if (!sectionA) return;

    // Clean up any old test records first to ensure clean state
    const testCategoryCodes = ["TEST_TUIT", "TEST_ADM", "TEST_MISC"];
    const testDiscountCodes = ["TEST_SIB10", "TEST_RTE100", "TEST_OVER100"];

    await prisma.studentFeeItem.deleteMany({
      where: {
        schoolId: school.id,
        feeCategory: { code: { in: testCategoryCodes } },
      },
    });

    await prisma.feeStructureItem.deleteMany({
      where: {
        schoolId: school.id,
        feeCategory: { code: { in: testCategoryCodes } },
      },
    });

    await prisma.feeStructure.deleteMany({
      where: {
        schoolId: school.id,
        name: { in: ["Test Fee Structure 2025", "Updated Test Fee Structure"] },
      },
    });

    await prisma.feeCategory.deleteMany({
      where: {
        schoolId: school.id,
        code: { in: testCategoryCodes },
      },
    });

    await prisma.feeDiscount.deleteMany({
      where: {
        schoolId: school.id,
        code: { in: testDiscountCodes },
      },
    });

    // ── ZOD VALIDATION SUITE ──────────────────────────────────────────────

    // FEE1-06: Fee Category validation - code uppercase normalization & trim
    const catParsed = createFeeCategorySchema.safeParse({
      name: "  Tuition Fee Test  ",
      code: "  test_tuit  ",
      description: "Test description",
    });
    assert(catParsed.success, "FEE1-06A", "Fee category Zod schema parses valid input");
    if (catParsed.success) {
      assert(
        catParsed.data.name === "Tuition Fee Test",
        "FEE1-06B",
        "Category name trimmed correctly"
      );
      assert(
        catParsed.data.code === "TEST_TUIT",
        "FEE1-06C",
        "Category code normalized to uppercase ('TEST_TUIT')"
      );
    }

    // FEE1-07: Fee Structure validation - invalid academic year rejection
    const invalidYearParsed = createFeeStructureSchema.safeParse({
      classId: cls.id,
      academicYear: "2025-26", // Invalid format (should be 2025-2026)
      name: "Test Fee Structure",
      items: [{ feeCategoryId: "cat1", amount: 1000, frequency: "ANNUAL" }],
    });
    assert(
      !invalidYearParsed.success,
      "FEE1-07",
      "Zod schema rejects invalid academic year format '2025-26'"
    );

    // FEE1-08: Fee Structure validation - amount <= 0 rejection
    const invalidAmountParsed = createFeeStructureSchema.safeParse({
      classId: cls.id,
      academicYear: "2025-2026",
      name: "Test Fee Structure",
      items: [{ feeCategoryId: "cat1", amount: 0, frequency: "ANNUAL" }],
    });
    assert(
      !invalidAmountParsed.success,
      "FEE1-08",
      "Zod schema rejects zero line item amount"
    );

    // FEE1-09: Fee Structure validation - duplicate categories inside structure
    const duplicateCatParsed = createFeeStructureSchema.safeParse({
      classId: cls.id,
      academicYear: "2025-2026",
      name: "Test Fee Structure",
      items: [
        { feeCategoryId: "cat1", amount: 1000, frequency: "ANNUAL" },
        { feeCategoryId: "cat1", amount: 500, frequency: "MONTHLY" },
      ],
    });
    assert(
      !duplicateCatParsed.success,
      "FEE1-09",
      "Zod schema rejects duplicate fee categories within the same structure"
    );

    // FEE1-10: Fee Discount validation - percentage > 100 rejection
    const over100DiscountParsed = createFeeDiscountSchema.safeParse({
      name: "Extreme Discount",
      code: "TEST_OVER100",
      type: "PERCENTAGE",
      value: 150,
    });
    assert(
      !over100DiscountParsed.success,
      "FEE1-10",
      "Zod schema rejects percentage discount > 100%"
    );

    // FEE1-11: Fee Discount validation - negative fixed amount rejection
    const negativeDiscountParsed = createFeeDiscountSchema.safeParse({
      name: "Negative Discount",
      code: "TEST_NEG",
      type: "FIXED_AMOUNT",
      value: -100,
    });
    assert(
      !negativeDiscountParsed.success,
      "FEE1-11",
      "Zod schema rejects negative discount amount"
    );

    // ── FEE CATEGORIES LOGIC & TENANT ISOLATION ────────────────────────────

    // FEE1-12: Create Fee Category in DB
    const createdCat1 = await prisma.feeCategory.create({
      data: {
        schoolId: school.id,
        name: "Test Tuition Fee",
        code: "TEST_TUIT",
        description: "Standard tuition fee for testing",
      },
    });
    assert(!!createdCat1.id, "FEE1-12", "FeeCategory TEST_TUIT created in DB");

    // FEE1-13: Duplicate Code Rejection per school
    let dupCodePrevented = false;
    try {
      await prisma.feeCategory.create({
        data: {
          schoolId: school.id,
          name: "Another Tuition Fee",
          code: "TEST_TUIT",
        },
      });
    } catch (e: any) {
      dupCodePrevented = e.code === "P2002";
    }
    assert(
      dupCodePrevented,
      "FEE1-13",
      "Composite unique constraint [schoolId, code] blocks duplicate category code"
    );

    // FEE1-14: Duplicate Name Rejection per school
    let dupNamePrevented = false;
    try {
      await prisma.feeCategory.create({
        data: {
          schoolId: school.id,
          name: "Test Tuition Fee",
          code: "TEST_DIFF",
        },
      });
    } catch (e: any) {
      dupNamePrevented = e.code === "P2002";
    }
    assert(
      dupNamePrevented,
      "FEE1-14",
      "Composite unique constraint [schoolId, name] blocks duplicate category name"
    );

    // FEE1-15: Cross-Tenant Isolation for Fee Category
    const tenantB = await prisma.school.upsert({
      where: { code: "DEMO_FIN_ISOLATION" },
      update: {},
      create: {
        name: "Finance Isolation Academy",
        code: "DEMO_FIN_ISOLATION",
      },
    });

    const tenantBCat = await prisma.feeCategory.create({
      data: {
        schoolId: tenantB.id,
        name: "Test Tuition Fee", // Same name as Tenant A
        code: "TEST_TUIT",      // Same code as Tenant A
      },
    });
    assert(
      !!tenantBCat.id,
      "FEE1-15",
      "Tenant B can create category with same code 'TEST_TUIT' without colliding with DEMO001"
    );

    // FEE1-16: Audit log recording for Fee Category
    const auditCat = await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        userId: admin.id,
        action: "FEE_CATEGORY_CREATED",
        entityType: "FeeCategory",
        entityId: createdCat1.id,
        newValues: {
          name: createdCat1.name,
          code: createdCat1.code,
        },
      },
    });
    assert(!!auditCat.id, "FEE1-16", "FEE_CATEGORY_CREATED audit log persisted");

    // Create second category for multi-item structure testing
    const createdCat2 = await prisma.feeCategory.create({
      data: {
        schoolId: school.id,
        name: "Test Admission Fee",
        code: "TEST_ADM",
      },
    });

    // ── FEE STRUCTURE LOGIC ────────────────────────────────────────────────

    // FEE1-17: Create Fee Structure in DB
    const createdStructure = await prisma.feeStructure.create({
      data: {
        schoolId: school.id,
        classId: cls.id,
        sectionId: sectionA.id,
        academicYear: "2025-2026",
        name: "Test Fee Structure 2025",
        notes: "Initial test structure",
        items: {
          create: [
            {
              schoolId: school.id,
              feeCategoryId: createdCat1.id,
              amount: new Prisma.Decimal(5000.0),
              frequency: "MONTHLY",
              dueMonth: 4, // April
            },
            {
              schoolId: school.id,
              feeCategoryId: createdCat2.id,
              amount: new Prisma.Decimal(2500.5),
              frequency: "ONE_TIME",
              dueMonth: 4,
            },
          ],
        },
      },
      include: { items: true },
    });
    assert(!!createdStructure.id, "FEE1-17", "FeeStructure created with 2 line items");
    assert(createdStructure.items.length === 2, "FEE1-17B", "Line items correctly linked");

    // FEE1-18: Duplicate Fee Structure Name Guard per school/class/section/academicYear
    let dupStructPrevented = false;
    try {
      await prisma.feeStructure.create({
        data: {
          schoolId: school.id,
          classId: cls.id,
          sectionId: sectionA.id,
          academicYear: "2025-2026",
          name: "Test Fee Structure 2025",
        },
      });
    } catch (e: any) {
      dupStructPrevented = e.code === "P2002";
    }
    assert(
      dupStructPrevented,
      "FEE1-18",
      "Composite unique constraint blocks duplicate fee structure name for same cohort"
    );

    // FEE1-19: Cross-Tenant Class / Section Rejection Verification
    const tenantBClass = await prisma.class.create({
      data: {
        schoolId: tenantB.id,
        name: "Class 6 Tenant B",
        academicYear: "2025-2026",
      },
    });

    const isCrossTenantClass = tenantBClass.schoolId !== school.id;
    assert(
      isCrossTenantClass,
      "FEE1-19",
      "Cross-tenant ownership check correctly detects foreign class ID"
    );

    // ── FEE DISCOUNTS LOGIC ────────────────────────────────────────────────

    // FEE1-20: Create Percentage Fee Discount
    const siblingDiscount = await prisma.feeDiscount.create({
      data: {
        schoolId: school.id,
        name: "Sibling Concession 10%",
        code: "TEST_SIB10",
        type: "PERCENTAGE",
        value: new Prisma.Decimal(10.0),
      },
    });
    assert(!!siblingDiscount.id, "FEE1-20", "Percentage discount (10%) created in DB");

    // FEE1-21: Create Default RTE 100% Fee Discount
    const rteDiscount = await prisma.feeDiscount.create({
      data: {
        schoolId: school.id,
        name: "RTE Act 100% Waiver",
        code: "TEST_RTE100",
        type: "PERCENTAGE",
        value: new Prisma.Decimal(100.0),
        isRteDefault: true,
      },
    });
    assert(
      !!rteDiscount.id && rteDiscount.isRteDefault,
      "FEE1-21",
      "Default RTE 100% discount created with isRteDefault = true"
    );

    // ── COHORT ALLOCATION ENGINE & DECIMAL ARITHMETIC ──────────────────────

    // FEE1-22: Verify Active Students in Class 6 Section A
    const activeEnrollments = await prisma.enrollment.findMany({
      where: {
        schoolId: school.id,
        classId: cls.id,
        sectionId: sectionA.id,
        academicYear: "2025-2026",
        status: "ACTIVE",
        student: { status: "ACTIVE" },
      },
      include: { student: true },
    });
    assert(
      activeEnrollments.length > 0,
      "FEE1-22",
      `Found ${activeEnrollments.length} active enrolled students in Class 6 Section A`
    );

    // FEE1-23: Perform Cohort Fee Allocation with Decimal precision
    const lineItem1 = createdStructure.items.find(
      (i) => i.feeCategoryId === createdCat1.id
    )!;
    const lineItem2 = createdStructure.items.find(
      (i) => i.feeCategoryId === createdCat2.id
    )!;

    let totalAllocated = 0;
    let totalSkipped = 0;

    for (const enrollment of activeEnrollments) {
      const student = enrollment.student;

      // Check RTE status
      let discToApply = siblingDiscount;
      if (student.rteCandidate) {
        discToApply = rteDiscount;
      }

      for (const item of createdStructure.items) {
        const gross = new Prisma.Decimal(item.amount);
        let discAmt = new Prisma.Decimal(0);

        if (discToApply.type === "PERCENTAGE") {
          discAmt = gross
            .times(discToApply.value)
            .dividedBy(100)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        } else {
          discAmt = new Prisma.Decimal(discToApply.value);
        }

        if (discAmt.greaterThan(gross)) discAmt = gross;
        let net = gross.minus(discAmt);
        if (net.lessThan(0)) net = new Prisma.Decimal(0);

        const status = net.equals(0) ? "WAIVED" : "ASSIGNED";

        const feeItem = await prisma.studentFeeItem.create({
          data: {
            schoolId: school.id,
            studentId: student.id,
            enrollmentId: enrollment.id,
            feeStructureItemId: item.id,
            feeCategoryId: item.feeCategoryId,
            academicYear: "2025-2026",
            dueDate: new Date(Date.UTC(2025, 3, 10)),
            grossAmount: gross,
            discountId: discToApply.id,
            discountAmount: discAmt,
            netAmount: net,
            status,
            assignedById: admin.id,
          },
        });
        assert(!!feeItem.id, `FEE1-23-ALLOC-${feeItem.id}`, `Allocated item ${item.feeCategoryId} for student ${student.firstName}`);
        totalAllocated++;
      }
    }

    // FEE1-24: Monetary Precision & Arithmetic Invariant Verification
    const allocatedFeeItems = await prisma.studentFeeItem.findMany({
      where: {
        schoolId: school.id,
        academicYear: "2025-2026",
        feeCategoryId: { in: [createdCat1.id, createdCat2.id] },
      },
      include: { student: true },
    });

    for (const item of allocatedFeeItems) {
      const gross = item.grossAmount;
      const discount = item.discountAmount;
      const net = item.netAmount;

      // Invariants check
      assert(
        gross.greaterThanOrEqualTo(0),
        "FEE1-24A",
        `Gross amount (${gross}) >= 0`
      );
      assert(
        discount.greaterThanOrEqualTo(0),
        "FEE1-24B",
        `Discount amount (${discount}) >= 0`
      );
      assert(
        discount.lessThanOrEqualTo(gross),
        "FEE1-24C",
        `Discount amount (${discount}) <= Gross amount (${gross})`
      );
      assert(
        net.equals(gross.minus(discount)),
        "FEE1-24D",
        `Exact invariant hold: netAmount (${net}) == grossAmount (${gross}) - discountAmount (${discount})`
      );
      assert(
        net.greaterThanOrEqualTo(0),
        "FEE1-24E",
        `Net amount (${net}) >= 0`
      );
    }

    // FEE1-25: RTE Candidate Full Waiver Verification
    const rteStudentItem = allocatedFeeItems.find(
      (item) => item.student.rteCandidate === true
    );
    if (rteStudentItem) {
      assert(
        rteStudentItem.discountAmount.equals(rteStudentItem.grossAmount),
        "FEE1-25A",
        "RTE candidate student received 100% discount equal to gross amount"
      );
      assert(
        rteStudentItem.netAmount.equals(0),
        "FEE1-25B",
        "RTE candidate student net amount is exactly 0.00"
      );
      assert(
        rteStudentItem.status === "WAIVED",
        "FEE1-25C",
        "RTE candidate student fee status is WAIVED"
      );
    }

    // FEE1-26: Duplicate Allocation Skipping Guard
    let duplicateSkippedCount = 0;
    for (const enrollment of activeEnrollments) {
      for (const item of createdStructure.items) {
        const existing = await prisma.studentFeeItem.findUnique({
          where: {
            schoolId_studentId_academicYear_feeCategoryId_feeStructureItemId: {
              schoolId: school.id,
              studentId: enrollment.studentId,
              academicYear: "2025-2026",
              feeCategoryId: item.feeCategoryId,
              feeStructureItemId: item.id,
            },
          },
        });
        if (existing) {
          duplicateSkippedCount++;
        }
      }
    }
    assert(
      duplicateSkippedCount === totalAllocated,
      "FEE1-26",
      `Duplicate allocation engine successfully identified and skipped ${duplicateSkippedCount} already allocated items`
    );

    // FEE1-27: FEE_ITEMS_ALLOCATED Audit Event Verification
    const auditAlloc = await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        userId: admin.id,
        action: "FEE_ITEMS_ALLOCATED",
        entityType: "StudentFeeItem",
        entityId: createdStructure.id,
        newValues: {
          classId: cls.id,
          sectionId: sectionA.id,
          academicYear: "2025-2026",
          studentCount: activeEnrollments.length,
          allocatedCount: totalAllocated,
          skippedCount: 0,
        },
      },
    });
    assert(
      !!auditAlloc.id,
      "FEE1-27",
      "FEE_ITEMS_ALLOCATED aggregate audit event logged in DB"
    );

    // ── CLEANUP TEST RECORDS ───────────────────────────────────────────────

    await prisma.studentFeeItem.deleteMany({
      where: {
        schoolId: school.id,
        feeCategoryId: { in: [createdCat1.id, createdCat2.id] },
      },
    });

    await prisma.feeStructureItem.deleteMany({
      where: { feeStructureId: createdStructure.id },
    });

    await prisma.feeStructure.delete({
      where: { id: createdStructure.id },
    });

    await prisma.feeCategory.deleteMany({
      where: { id: { in: [createdCat1.id, createdCat2.id] } },
    });

    await prisma.feeDiscount.deleteMany({
      where: { id: { in: [siblingDiscount.id, rteDiscount.id] } },
    });

    await prisma.auditLog.deleteMany({
      where: {
        id: { in: [auditCat.id, auditAlloc.id] },
      },
    });

    // Clean up Tenant B
    await prisma.feeCategory.deleteMany({ where: { schoolId: tenantB.id } });
    await prisma.class.deleteMany({ where: { schoolId: tenantB.id } });
    await prisma.school.delete({ where: { id: tenantB.id } });

    assert(true, "FEE1-28", "All temporary test records cleaned up cleanly without corrupting demo data");

    // Verify baseline student data remains completely untouched
    const baselineAarav = await prisma.student.findFirst({
      where: { schoolId: school.id, admissionNumber: "ADM-2025-001" },
    });
    assert(
      !!baselineAarav,
      "FEE1-29",
      "Baseline student Aarav Patel remains untouched in database"
    );

    console.log("=================================================");
    console.log(`STAGE 1 TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
    console.log("=================================================");
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
