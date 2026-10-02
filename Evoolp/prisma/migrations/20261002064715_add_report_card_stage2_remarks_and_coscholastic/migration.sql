-- CreateTable
CREATE TABLE "ReportCardRemark" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "cycleKey" TEXT NOT NULL,
    "cycleName" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCardRemark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoScholasticEntry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "remarks" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoScholasticEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportCardRemark_schoolId_academicYear_cycleKey_idx" ON "ReportCardRemark"("schoolId", "academicYear", "cycleKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardRemark_schoolId_studentId_academicYear_cycleKey_key" ON "ReportCardRemark"("schoolId", "studentId", "academicYear", "cycleKey");

-- CreateIndex
CREATE INDEX "CoScholasticEntry_schoolId_academicYear_term_idx" ON "CoScholasticEntry"("schoolId", "academicYear", "term");

-- CreateIndex
CREATE UNIQUE INDEX "CoScholasticEntry_schoolId_studentId_academicYear_term_activity_key" ON "CoScholasticEntry"("schoolId", "studentId", "academicYear", "term", "activity");

-- AddForeignKey
ALTER TABLE "ReportCardRemark" ADD CONSTRAINT "ReportCardRemark_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardRemark" ADD CONSTRAINT "ReportCardRemark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardRemark" ADD CONSTRAINT "ReportCardRemark_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticEntry" ADD CONSTRAINT "CoScholasticEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticEntry" ADD CONSTRAINT "CoScholasticEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticEntry" ADD CONSTRAINT "CoScholasticEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
