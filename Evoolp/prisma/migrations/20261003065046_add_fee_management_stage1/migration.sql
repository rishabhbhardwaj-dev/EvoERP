-- CreateEnum
CREATE TYPE "FeeCategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FeeStructureStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FeeFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "FeeAllocationStatus" AS ENUM ('ASSIGNED', 'WAIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "FeeCategory" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "status" "FeeCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "academicYear" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "FeeStructureStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeStructureItem" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "feeCategoryId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "frequency" "FeeFrequency" NOT NULL,
    "dueMonth" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeStructureItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeDiscount" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "isRteDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "FeeCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFeeItem" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "feeStructureItemId" TEXT,
    "feeCategoryId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "dueDate" DATE,
    "grossAmount" DECIMAL(10,2) NOT NULL,
    "discountId" TEXT,
    "discountAmount" DECIMAL(10,2) NOT NULL,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "remarks" TEXT,
    "status" "FeeAllocationStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFeeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeeCategory_schoolId_idx" ON "FeeCategory"("schoolId");

-- CreateIndex
CREATE INDEX "FeeCategory_schoolId_status_idx" ON "FeeCategory"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FeeCategory_schoolId_code_key" ON "FeeCategory"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FeeCategory_schoolId_name_key" ON "FeeCategory"("schoolId", "name");

-- CreateIndex
CREATE INDEX "FeeStructure_schoolId_idx" ON "FeeStructure"("schoolId");

-- CreateIndex
CREATE INDEX "FeeStructure_schoolId_classId_academicYear_idx" ON "FeeStructure"("schoolId", "classId", "academicYear");

-- CreateIndex
CREATE INDEX "FeeStructure_schoolId_status_idx" ON "FeeStructure"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructure_schoolId_classId_sectionId_academicYear_name_key" ON "FeeStructure"("schoolId", "classId", "sectionId", "academicYear", "name");

-- CreateIndex
CREATE INDEX "FeeStructureItem_schoolId_idx" ON "FeeStructureItem"("schoolId");

-- CreateIndex
CREATE INDEX "FeeStructureItem_feeStructureId_idx" ON "FeeStructureItem"("feeStructureId");

-- CreateIndex
CREATE INDEX "FeeStructureItem_feeCategoryId_idx" ON "FeeStructureItem"("feeCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructureItem_feeStructureId_feeCategoryId_key" ON "FeeStructureItem"("feeStructureId", "feeCategoryId");

-- CreateIndex
CREATE INDEX "FeeDiscount_schoolId_idx" ON "FeeDiscount"("schoolId");

-- CreateIndex
CREATE INDEX "FeeDiscount_schoolId_status_idx" ON "FeeDiscount"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FeeDiscount_schoolId_code_key" ON "FeeDiscount"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FeeDiscount_schoolId_name_key" ON "FeeDiscount"("schoolId", "name");

-- CreateIndex
CREATE INDEX "StudentFeeItem_schoolId_idx" ON "StudentFeeItem"("schoolId");

-- CreateIndex
CREATE INDEX "StudentFeeItem_schoolId_studentId_academicYear_idx" ON "StudentFeeItem"("schoolId", "studentId", "academicYear");

-- CreateIndex
CREATE INDEX "StudentFeeItem_schoolId_academicYear_idx" ON "StudentFeeItem"("schoolId", "academicYear");

-- CreateIndex
CREATE INDEX "StudentFeeItem_studentId_status_idx" ON "StudentFeeItem"("studentId", "status");

-- CreateIndex
CREATE INDEX "StudentFeeItem_enrollmentId_idx" ON "StudentFeeItem"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFeeItem_schoolId_studentId_academicYear_feeCategoryI_key" ON "StudentFeeItem"("schoolId", "studentId", "academicYear", "feeCategoryId", "feeStructureItemId");

-- AddForeignKey
ALTER TABLE "FeeCategory" ADD CONSTRAINT "FeeCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructureItem" ADD CONSTRAINT "FeeStructureItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructureItem" ADD CONSTRAINT "FeeStructureItem_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructureItem" ADD CONSTRAINT "FeeStructureItem_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "FeeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeDiscount" ADD CONSTRAINT "FeeDiscount_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeItem" ADD CONSTRAINT "StudentFeeItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeItem" ADD CONSTRAINT "StudentFeeItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeItem" ADD CONSTRAINT "StudentFeeItem_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeItem" ADD CONSTRAINT "StudentFeeItem_feeStructureItemId_fkey" FOREIGN KEY ("feeStructureItemId") REFERENCES "FeeStructureItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeItem" ADD CONSTRAINT "StudentFeeItem_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "FeeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeItem" ADD CONSTRAINT "StudentFeeItem_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "FeeDiscount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeItem" ADD CONSTRAINT "StudentFeeItem_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "CoScholasticEntry_schoolId_studentId_academicYear_term_activity" RENAME TO "CoScholasticEntry_schoolId_studentId_academicYear_term_acti_key";
