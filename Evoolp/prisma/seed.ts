import { PrismaClient, Role, Gender, StudentCategory } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // Demo school (tenant root)
  const school = await prisma.school.upsert({
    where: { code: "DEMO001" },
    update: {},
    create: {
      name: "EvoERP Demo School",
      code: "DEMO001",
      address: "123 MG Road, Bengaluru, Karnataka 560001",
      phone: "+91 80 4000 1234",
      email: "office@demo.evoerp.in",
    },
  });

  // Users: one admin, one teacher, one student, one parent
  const admin = await prisma.user.upsert({
    where: { schoolId_email: { schoolId: school.id, email: "admin@demo.evoerp.in" } },
    update: {},
    create: {
      schoolId: school.id,
      name: "Anita Sharma",
      email: "admin@demo.evoerp.in",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const teacherUser = await prisma.user.upsert({
    where: { schoolId_email: { schoolId: school.id, email: "teacher@demo.evoerp.in" } },
    update: {},
    create: {
      schoolId: school.id,
      name: "Ravi Kumar",
      email: "teacher@demo.evoerp.in",
      passwordHash,
      role: Role.TEACHER,
    },
  });

  const parentUser = await prisma.user.upsert({
    where: { schoolId_email: { schoolId: school.id, email: "parent@demo.evoerp.in" } },
    update: {},
    create: {
      schoolId: school.id,
      name: "Suresh Patel",
      email: "parent@demo.evoerp.in",
      passwordHash,
      role: Role.PARENT,
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { schoolId_email: { schoolId: school.id, email: "student@demo.evoerp.in" } },
    update: {},
    create: {
      schoolId: school.id,
      name: "Aarav Patel",
      email: "student@demo.evoerp.in",
      passwordHash,
      role: Role.STUDENT,
    },
  });

  // Teacher profile
  await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      schoolId: school.id,
      userId: teacherUser.id,
      employeeCode: "TCH-001",
      department: "Mathematics",
      qualification: "M.Sc, B.Ed",
    },
  });

  // Student profile (Indian fields: admissionNumber, category, rteCandidate)
  const student = await prisma.student.upsert({
    where: { schoolId_admissionNumber: { schoolId: school.id, admissionNumber: "ADM-2025-001" } },
    update: {},
    create: {
      schoolId: school.id,
      userId: studentUser.id,
      parentUserId: parentUser.id,
      admissionNumber: "ADM-2025-001",
      firstName: "Aarav",
      lastName: "Patel",
      dateOfBirth: new Date("2014-06-15"),
      gender: Gender.MALE,
      category: StudentCategory.GENERAL,
      rteCandidate: false,
    },
  });

  // Class + Section + Subject + Enrollment
  const schoolClass = await prisma.class.upsert({
    where: { schoolId_name_academicYear: { schoolId: school.id, name: "Class 6", academicYear: "2025-2026" } },
    update: {},
    create: {
      schoolId: school.id,
      name: "Class 6",
      academicYear: "2025-2026",
    },
  });

  let section = await prisma.section.findFirst({
    where: { classId: schoolClass.id, name: "A" },
  });
  if (!section) {
    section = await prisma.section.create({
      data: { schoolId: school.id, classId: schoolClass.id, name: "A" },
    });
  }

  await prisma.subject.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "MATH6" } },
    update: {},
    create: { schoolId: school.id, name: "Mathematics", code: "MATH6" },
  });

  await prisma.enrollment.upsert({
    where: { studentId_academicYear: { studentId: student.id, academicYear: "2025-2026" } },
    update: {},
    create: {
      schoolId: school.id,
      studentId: student.id,
      classId: schoolClass.id,
      sectionId: section.id,
      academicYear: "2025-2026",
    },
  });

  console.log("Seed complete:", {
    school: school.code,
    users: [admin.email, teacherUser.email, studentUser.email, parentUser.email],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
