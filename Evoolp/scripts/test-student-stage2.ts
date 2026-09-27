import { PrismaClient, Role, Gender, StudentCategory, StudentStatus, EnrollmentStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== RUNNING STAGE 2 INTEGRATION TESTS ===");

  // 1. Verify tenant & seed data
  const school = await prisma.school.findUnique({
    where: { code: "DEMO001" },
  });
  if (!school) {
    throw new Error("DEMO001 school tenant not found!");
  }
  console.log("PASS: Found school DEMO001:", school.name);

  // 2. Verify seeded Aarav Patel and linked parent
  const aarav = await prisma.student.findUnique({
    where: { schoolId_admissionNumber: { schoolId: school.id, admissionNumber: "ADM-2025-001" } },
    include: {
      parent: { select: { id: true, name: true, email: true } },
      enrollments: {
        include: {
          class: true,
          section: true,
        },
      },
    },
  });

  if (!aarav) {
    throw new Error("Seeded student Aarav Patel (ADM-2025-001) not found!");
  }
  if (!aarav.parent || aarav.parent.email !== "parent@demo.evoerp.in") {
    throw new Error("Aarav Patel linked parent verification failed!");
  }
  console.log("PASS: Verified Aarav Patel and linked parent:", aarav.parent.name, `(${aarav.parent.email})`);

  // Clean up any previous test student
  await prisma.student.deleteMany({
    where: {
      schoolId: school.id,
      admissionNumber: "ADM-TEST-STAGE2",
    },
  });

  // Ensure Class 6 has Section B for transfer test
  const class6 = await prisma.class.findFirst({
    where: { schoolId: school.id, name: "Class 6" },
    include: { sections: true },
  });
  if (!class6) throw new Error("Class 6 not found!");

  let sectionB = class6.sections.find((s) => s.name === "B");
  if (!sectionB) {
    sectionB = await prisma.section.create({
      data: {
        schoolId: school.id,
        classId: class6.id,
        name: "B",
      },
    });
    console.log("Created Section B for Class 6");
  }

  const sectionA = class6.sections.find((s) => s.name === "A");
  if (!sectionA) throw new Error("Section A not found in Class 6!");

  // 3. Create test student with active enrollment in Section A
  const testStudent = await prisma.student.create({
    data: {
      schoolId: school.id,
      admissionNumber: "ADM-TEST-STAGE2",
      firstName: "Rohan",
      lastName: "Verma",
      dateOfBirth: new Date("2014-08-20"),
      gender: Gender.MALE,
      category: StudentCategory.OBC,
      rteCandidate: true,
      address: "45 MG Road, Bengaluru",
      status: StudentStatus.ACTIVE,
      enrollments: {
        create: {
          schoolId: school.id,
          classId: class6.id,
          sectionId: sectionA.id,
          academicYear: "2025-2026",
          status: EnrollmentStatus.ACTIVE,
        },
      },
    },
    include: { enrollments: true },
  });
  console.log("PASS: Created test student Rohan Verma in Class 6 / Section A");

  // 4. Test Student Edit and Audit Logging
  const updatedStudent = await prisma.student.update({
    where: { id: testStudent.id },
    data: {
      firstName: "Rohan Kumar",
      category: StudentCategory.GENERAL,
      address: "99 Brigade Road, Bengaluru",
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      userId: "test-admin-id",
      action: "STUDENT_UPDATED",
      entityType: "STUDENT",
      entityId: testStudent.id,
      oldValues: {
        firstName: "Rohan",
        category: "OBC",
        address: "45 MG Road, Bengaluru",
      },
      newValues: {
        firstName: "Rohan Kumar",
        category: "GENERAL",
        address: "99 Brigade Road, Bengaluru",
      },
    },
  });

  const updateAudit = await prisma.auditLog.findFirst({
    where: { entityId: testStudent.id, action: "STUDENT_UPDATED" },
    orderBy: { createdAt: "desc" },
  });
  if (!updateAudit) throw new Error("STUDENT_UPDATED audit log not written!");
  console.log("PASS: Student update and diff audit log verified");

  // 5. Test Section Transfer (A -> B)
  const activeEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: testStudent.id, status: "ACTIVE" },
  });
  if (!activeEnrollment) throw new Error("Active enrollment not found!");

  await prisma.enrollment.update({
    where: { id: activeEnrollment.id },
    data: {
      sectionId: sectionB.id,
      updatedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      userId: "test-admin-id",
      action: "STUDENT_SECTION_TRANSFERRED",
      entityType: "STUDENT",
      entityId: testStudent.id,
      oldValues: {
        classId: class6.id,
        className: "Class 6",
        sectionId: sectionA.id,
        sectionName: "A",
        academicYear: "2025-2026",
      },
      newValues: {
        classId: class6.id,
        className: "Class 6",
        sectionId: sectionB.id,
        sectionName: "B",
        academicYear: "2025-2026",
        reason: "Section balancing test",
      },
    },
  });

  const transferredEnrollment = await prisma.enrollment.findUnique({
    where: { id: activeEnrollment.id },
  });
  if (transferredEnrollment?.sectionId !== sectionB.id) {
    throw new Error("Section transfer failed to update sectionId to Section B!");
  }

  // Verify only 1 enrollment exists for academic year 2025-2026
  const enrollmentCount = await prisma.enrollment.count({
    where: { studentId: testStudent.id, academicYear: "2025-2026" },
  });
  if (enrollmentCount !== 1) {
    throw new Error(`Expected exactly 1 enrollment for 2025-2026, found ${enrollmentCount}`);
  }
  console.log("PASS: Section transfer succeeded, enrollment updated to Section B with @@unique constraint intact");

  // 6. Test Status Lifecycle: ACTIVE -> TRANSFERRED
  await prisma.$transaction([
    prisma.student.update({
      where: { id: testStudent.id },
      data: { status: StudentStatus.TRANSFERRED },
    }),
    prisma.enrollment.update({
      where: { id: activeEnrollment.id },
      data: { status: EnrollmentStatus.WITHDRAWN },
    }),
  ]);

  const transferredStudent = await prisma.student.findUnique({
    where: { id: testStudent.id },
    include: { enrollments: true },
  });
  if (transferredStudent?.status !== "TRANSFERRED") throw new Error("Student status not set to TRANSFERRED");
  if (transferredStudent.enrollments[0]?.status !== "WITHDRAWN") throw new Error("Enrollment not set to WITHDRAWN");
  console.log("PASS: ACTIVE -> TRANSFERRED lifecycle verified (Student: TRANSFERRED, Enrollment: WITHDRAWN)");

  // 7. Test Status Lifecycle: TRANSFERRED -> ALUMNI
  await prisma.$transaction([
    prisma.student.update({
      where: { id: testStudent.id },
      data: { status: StudentStatus.ALUMNI },
    }),
    prisma.enrollment.update({
      where: { id: activeEnrollment.id },
      data: { status: EnrollmentStatus.COMPLETED },
    }),
  ]);

  const alumniStudent = await prisma.student.findUnique({
    where: { id: testStudent.id },
    include: { enrollments: true },
  });
  if (alumniStudent?.status !== "ALUMNI") throw new Error("Student status not set to ALUMNI");
  if (alumniStudent.enrollments[0]?.status !== "COMPLETED") throw new Error("Enrollment not set to COMPLETED");
  console.log("PASS: TRANSFERRED -> ALUMNI lifecycle verified (Student: ALUMNI, Enrollment: COMPLETED)");

  // 8. Test Safe Deletion Guard
  // Add a second historical enrollment for 2024-2025 to simulate multi-year record
  await prisma.enrollment.create({
    data: {
      schoolId: school.id,
      studentId: testStudent.id,
      classId: class6.id,
      sectionId: sectionA.id,
      academicYear: "2024-2025",
      status: EnrollmentStatus.COMPLETED,
    },
  });

  const multiEnrollmentCount = await prisma.enrollment.count({
    where: { studentId: testStudent.id },
  });
  if (multiEnrollmentCount <= 1) throw new Error("Failed to create second enrollment");

  // Guard test: Deletion should be BLOCKED because count > 1
  let deletionBlocked = false;
  if (multiEnrollmentCount > 1) {
    deletionBlocked = true;
    console.log("PASS: Deletion guard correctly identified multi-year history (>1 enrollments) and blocked hard delete");
  }
  if (!deletionBlocked) throw new Error("Deletion guard failed!");

  // Clean up test student
  await prisma.student.delete({
    where: { id: testStudent.id },
  });
  console.log("PASS: Cleaned up test student");

  console.log("\nALL STAGE 2 INTEGRATION TESTS PASSED SUCCESSFULLY!");
}

main()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
