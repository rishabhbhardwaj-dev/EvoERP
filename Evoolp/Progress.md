# EvoERP — Project Progress & Current State

> **Purpose:** Single source of truth for the **current project state**.
> For detailed technical implementation history, architecture notes, and changelogs, refer to `Evoolp/docs/PHASE_2_MODULE_1_CHANGELOG.md`.

---

## 1. Current State Overview

* **Current Phase:** Phase 3 — Finance Management (Stage 1 Complete) / Phase 2 Extension (My Attendance Complete)
* **Active Branch:** `evoerp-foundation-fixes` (Tracking: `origin/evoerp-foundation-fixes`)
* **Current HEAD Commit:** `2f63a30`
* **Working Tree:** Clean (0 uncommitted changes)
* **Workspace:** `D:\Dekstop\EvoERP`
* **Environment:** Next.js 15.5.25 App Router, React 19, TypeScript 5.9.3 (strict), Prisma 6.19.3, NextAuth v5 beta
* **Database:** PostgreSQL 16 Alpine container (`evoolp-db-1`) on port 5432 in WSL2

---

## 2. Module Status Summary

| Phase | Module | Stage | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | Foundation | Full | **COMPLETE** | Auth, Sessions, Tenant isolation, Multi-tenant DB, UI Shell, Role dashboard |
| **Phase 2** | Module 1 — Classes & Sections | Full | **COMPLETE** | `/dashboard/classes` & `/dashboard/sections`, mutations, guards, verified & pushed |
| **Phase 2** | Module 2 — Students | Stage 1 | **COMPLETE** | Directory, Admission dialog, Atomic Student+Enrollment transaction, RBAC, Audit log |
| **Phase 2** | Module 2 — Students | Stage 2 | **COMPLETE** | Profile Detail Sheet, Edit Student, Section Transfer, Status Lifecycle, Safe Deletion |
| **Phase 2** | Module 3 — Teachers | Stage 1 | **COMPLETE** | Directory, Onboarding modal, Atomic User+Teacher transaction, Unique employeeCode, RBAC, Audit log |
| **Phase 2** | Module 3 — Teachers | Stage 2 | **COMPLETE** | Profile Detail Sheet, Edit Staff, Status Deactivation, Safe Deletion, diff audit logs |
| **Phase 2** | Module 4 — Subjects | Stage 1 | **COMPLETE** | Subject Catalog Directory, Create modal, code normalization, tenant isolation, RBAC, Audit log |
| **Phase 2** | Module 4 — Subjects | Stage 2 | **COMPLETE** | Subject Detail Dossier, Edit modal, Safe Deletion with confirmation & snapshot |
| **Phase 2** | Module 5 — Attendance | Stage 1 | **COMPLETE** | Daily Register, bulk marking, P/A/L/E/H states, 48h teacher guard, atomic upsert |
| **Phase 2** | Module 5 — Attendance | Stage 2 | **COMPLETE** | Monthly matrix, CBSE 75% defaulters card, attendance workspace, CSV export, student dossier integration |
| **Phase 2** | Module 5 — Attendance | Extension | **COMPLETE** | Student & Parent portal at `/dashboard/my-attendance`, ward switcher, CBSE 75% badge, history register |
| **Phase 2** | Module 6 — Exams / Marks / Grades | Stage 1 | **COMPLETE** | Exam lifecycle, CBSE 8-tier grading, roll-call marks entry, zero-result delete guard, audit logging |
| **Phase 2** | Module 6 — Exams / Marks / Grades | Stage 2 | **COMPLETE** | Student/Parent scorecard at /dashboard/my-grades, multi-child switcher, student dossier integration, RFC-4180 CSV export, print layout, CBSE 8-tier analytics card, on-demand term aggregation |
| **Phase 2** | Module 7 — Report Cards | Stage 1 | **COMPLETE** | Single-student report card compilation, cycle isolation by examIds, CBSE grades, attendance integration, RBAC, A4 print layout, verified & pushed |
| **Phase 2** | Module 7 — Report Cards | Stage 2 | **COMPLETE** | Batch printing, cohort summary CSV export, persistent teacher remarks, co-scholastic grades, multi-term annual compilation, dedicated print root architecture |
| **Phase 3** | Finance Management | Stage 1 | **COMPLETE** | Fee Categories, Master Fee Structures, Concessions & Cohort Allocation UI at `/dashboard/fees` (Commit `2f63a30`) |
| **Phase 3** | Finance Management | Stage 2 | **DEFERRED** | Blueprint preserved for post-delivery continuation; deferred for current delivery window |


---

## 3. Current Verified Features

The following features have been implemented and verified via TypeScript checks (`tsc --noEmit`), production build (`npm run build`), database transaction validation scripts, and automated browser runtime smoke tests:

1. **Phase 1 Foundation:**
   * Multi-tenant PostgreSQL database with `schoolId` indexing and composite unique keys.
   * Authentication and session persistence (NextAuth v5 beta with JWT strategy and bcrypt verification).
   * Stable role-based dashboard shell (`ADMIN`, `TEACHER`, `STUDENT`, `PARENT`) with Indian fiscal year display (`Apr–Mar`).
   * Tenant context resolution via server-side `requireTenant()`.

2. **Classes & Sections Management (Module 1):**
   * Standards management at `/dashboard/classes` and divisions directory at `/dashboard/sections`.
   * Academic year filtering (default `"ALL"` for seeded demo data discoverability) and name search.
   * Class creation modal with initial sections generation; standalone and contextual section creation.
   * Duplicate class/section prevention per tenant/parent class.
   * Active-enrollment deletion protection guards preventing database cascade or orphan states.
   * Strict server-side RBAC: `ADMIN` mutations; `TEACHER` clean read-only view.

3. **Student Directory & Admission (Module 2 — Stage 1):**
   * Student roster at `/dashboard/students` resolving previous 404 stub with HTTP 200.
   * Summary metric cards: Total Students, Active Students, RTE 25% Quota Candidates, Reserved Category (OBC/SC/ST).
   * Interactive directory table with real-time search (name, admission number) and multi-filters (Academic Year, Class, Category, RTE Quota, Status).
   * Student admission dialog (`CreateStudentDialog`) with cascading Class $\rightarrow$ Section selection and real-time validation.
   * Indian demographic support: Category selection (`GENERAL`, `SC`, `ST`, `OBC`), RTE 25% quota flag, bounded Date of Birth (1900–2100).
   * Atomic `Student + Enrollment` creation in a single Prisma transaction (`prisma.$transaction`).
   * Strict tenant isolation: `schoolId` derived strictly from server session; duplicate admission number rejection per school.
   * Server-side RBAC: `ADMIN` admission privileges; `TEACHER` view rendered in strict read-only mode (`Admit Student` button omitted).
   * Structured audit logging: `STUDENT_ADMITTED` event logged in `AuditLog` table on successful admission.

4. **Student Profile, Edit, Transfer & Lifecycle (Module 2 — Stage 2):**
   * **360-Degree Profile Sheet (`StudentDetailSheet`):** Slide-over sheet triggered from the directory table rows (`View` button or row click) displaying student identity, status badge, age computation, Indian demographic indicators (Category, RTE 25% quota), residential address, linked parent details (`Suresh Patel`, `parent@demo.evoerp.in`), active placement, and chronological enrollment history.
   * **Student Profile Edit (`EditStudentDialog` & `updateStudent`):** Modal dialog allowing administrators to update demographic fields (`firstName`, `lastName`, `dateOfBirth`, `gender`, `category`, `rteCandidate`, `address`) while strictly keeping institutional identifiers (`id`, `schoolId`, `admissionNumber`) immutable. Employs `diffChanges()` to record field-level deltas in `AuditLog` under `STUDENT_UPDATED`.
   * **Section Transfer Workflow (`TransferSectionDialog` & `transferStudentSection`):** Controlled intra-class section re-allocations (Section A $\rightarrow$ Section B) maintaining the `@@unique([studentId, academicYear])` composite constraint without duplicate rows, updating the active `Enrollment` record, and emitting `STUDENT_SECTION_TRANSFERRED` audit logs with reason tracking.
   * **Status Lifecycle Transitions (`ChangeStatusDialog` & `changeStudentStatus`):** Clean state transitions (`ACTIVE` $\rightarrow$ `TRANSFERRED` / `ALUMNI`, or re-activation) automatically synchronizing active `Enrollment.status` (`WITHDRAWN`, `COMPLETED`, `ACTIVE`) with `STUDENT_STATUS_CHANGED` audit trails.
   * **Safe Deactivation & Deletion Guards (`DeleteStudentDialog` & `deleteStudent`):** Application-level barriers blocking destructive hard-deletions on multi-year student history (`_count.enrollments > 1`), promoting soft transitions and logging pre-deletion snapshots under `STUDENT_DELETED`.
   * **Teacher Read-Only View:** Verified that teachers receive a clean read-only view with all mutation action triggers (`Edit Profile`, `Transfer Section`, `Change Status`, `Delete`) completely omitted from the DOM.
   * **Quality & Test Verification:**
     * `tsc --noEmit`: 0 TypeScript errors across codebase.
     * `npm run build`: Successful build; dynamic route `ƒ /dashboard/students` (13.2 kB).
     * Database transaction script (`scripts/test-student-stage2.ts`): Verified student edit, diff audit logging, section transfer, status lifecycle transitions, and deletion guards against PostgreSQL container in WSL2.
     * Automated browser tests: Verified full admin flows (profile inspection, edit, transfer, status update) and teacher read-only view in Chromium.

5. **Teacher Directory & Onboarding (Module 3 — Stage 1):**
   * Staff directory at `/dashboard/teachers` resolving previous 404 stub with HTTP 200.
   * Summary metric cards: Total Teachers, Active Staff, Inactive Staff, Departments count.
   * Interactive directory table (`TeacherTable`) with real-time search (name, email, employee code) and multi-filtering (Department, Account Status).
   * Discoverability: Seeded demo teacher `Ravi Kumar` (`TCH-001`, `Mathematics`, `M.Sc, B.Ed`, `teacher@demo.evoerp.in`) immediately discoverable.
   * Staff onboarding modal (`CreateTeacherDialog`) with React Hook Form + Zod resolver (`createTeacherSchema`).
   * Credential provisioning: Admin-configured initial password (min 8 chars) hashed with `bcryptjs` (salt rounds 10); plaintext passwords and password hashes are never exposed in client payloads or audit logs.
   * Atomic `User + Teacher` creation inside `prisma.$transaction`.
   * Multi-tenant data integrity: `schoolId` derived exclusively from server session; duplicate `employeeCode` (`@@unique([schoolId, employeeCode])`) and duplicate `email` (`@@unique([schoolId, email])`) strictly rejected per school tenant.
   * Server-side RBAC: `ADMIN` onboarding privileges; non-admin mutations rejected.
   * Structured audit logging: `TEACHER_CREATED` event written to `AuditLog` table on onboarding without credential exposure.
   * Quality & Test Verification:
     * `tsc --noEmit`: 0 TypeScript errors across codebase.
     * `npm run build`: Successful build; dynamic route `ƒ /dashboard/teachers` (6.01 kB).
     * Integration test script (`scripts/test-teacher-stage1.ts`): Verified tenant isolation, seeded `Ravi Kumar`, atomic creation, bcrypt password hashing, duplicate employeeCode/email rejections, and audit log generation against PostgreSQL container in WSL2 (9 / 9 tests passed).

6. **Teacher Profile, Edit, Status Lifecycle & Safe Deletion (Module 3 — Stage 2):**
   * **360-Degree Profile Sheet (`TeacherDetailSheet`):** Slide-over sheet triggered from the directory table rows (`View` button or row click) displaying teacher initials avatar, full name, institutional email, status badge, employee code, department, academic qualifications, joining date, and administrative action triggers.
   * **Staff Profile Edit (`EditTeacherDialog` & `updateTeacher`):** Modal dialog with React Hook Form + Zod validation (`updateTeacherSchema`) enabling administrators to update teacher name, department (with datalist suggestions), and qualifications. Keeps institutional identifiers (`id`, `schoolId`, `employeeCode`, `email`) strictly immutable. Uses `diffChanges()` to record old vs. new values in `AuditLog` under `TEACHER_UPDATED`.
   * **Status Lifecycle Management (`ChangeTeacherStatusDialog` & `toggleTeacherStatus`):** Dialog for transitioning accounts between `ACTIVE` and `INACTIVE` with optional administrative reason tracking. Modifies `User.status` in an atomic transaction and writes `TEACHER_STATUS_CHANGED` audit records.
   * **Safe Deactivation & Deletion (`DeleteTeacherDialog` & `deleteTeacher`):** Modal prioritizing deactivation over deletion, requiring explicit typing of employee code to confirm. Captures pre-deletion staff snapshot into `AuditLog` (`TEACHER_DELETED`) and atomically removes both `Teacher` and `User` records in `prisma.$transaction`.
   * **Table & Page Integration:** Row click handler and explicit "View" action button in `TeacherTable`, dynamic status pill styling, and pass-through of `userRole` from server context.
   * **Quality & Test Verification:**
     * `tsc --noEmit`: 0 TypeScript errors across codebase.
     * `npm run build`: Clean production build; dynamic route `ƒ /dashboard/teachers` (7.2 kB).
     * Database integration test script (`scripts/test-teacher-stage2.ts`): Verified seeded teacher retrieval, edit diff calculation, status toggle (`ACTIVE` $\rightarrow$ `INACTIVE` $\rightarrow$ `ACTIVE`), safe deletion snapshot, atomic cascade cleanup, cross-tenant isolation, and zero password/hash exposure (13 / 13 tests passed).
     * Automated browser tests: Verified slide-over sheet inspection, profile edit, status deactivation with reason, reactivation, onboarding, and deletion flow in Chromium.

7. **Subject Directory & Master Catalog Onboarding (Module 4 — Stage 1):**
   * Catalog route at `/dashboard/subjects` resolving previous 404 stub with HTTP 200.
   * Summary metric cards: Total Subjects, Unique Subject Codes, CBSE Standard Codes, Recent Additions.
   * Interactive directory table (`SubjectTable`) with real-time search (name, code), client-side sorting (code, name, date), and badge formatting.
   * Seeded discoverability: Seeded subject `Mathematics` (`MATH6`) immediately discoverable in catalog.
   * Subject creation modal (`CreateSubjectDialog`) with React Hook Form + Zod resolver (`createSubjectSchema`) and CBSE standard quick suggestions.
   * Robust code validation & normalization: Trimmed, uppercase-normalized, supporting alphanumeric codes, hyphens, underscores, slashes, and periods (`/^[A-Za-z0-9\-_/.]{1,20}$/`).
   * Multi-tenant data integrity: `schoolId` derived exclusively from server session; duplicate code rejection per school tenant (`@@unique([schoolId, code])`).
   * Server-side RBAC: `ADMIN` creation privileges; `TEACHER` clean read-only view (`Add Subject` button omitted).
   * Structured audit logging: `SUBJECT_CREATED` event written to `AuditLog` table on subject addition.
   * Quality & Test Verification:
     * `tsc --noEmit`: 0 TypeScript errors across codebase.
     * `npm run build`: Successful build; dynamic route `ƒ /dashboard/subjects` (5.39 kB).
     * Integration test script (`scripts/test-subject-stage1.ts`): 15 / 15 tests passed in WSL2.
     * Automated browser tests: Verified admin flow (catalog inspection, add subject with suggestion, real-time search and clear) and teacher read-only view.

8. **Subject Profile, Edit & Safe Deletion (Module 4 — Stage 2):**
   * **360-Degree Detail Dossier (`SubjectDetailSheet`):** Slide-over sheet triggered by row click or explicit "View" action button displaying subject name, code, CBSE vs. Institutional classification indicator, record UUID, creation date, and last-updated timestamp.
   * **Subject Profile Edit (`EditSubjectDialog` & `updateSubject`):** Modal dialog with React Hook Form + Zod validation (`updateSubjectSchema`) enabling administrators to update subject name and code. Auto-normalizes code to uppercase. Includes collision protection blocking updates to duplicate codes across the school while permitting same-code self-updates. Employs `diffChanges()` to record field-level deltas in `AuditLog` under `SUBJECT_UPDATED`.
   * **Safe Deletion Flow (`DeleteSubjectDialog` & `deleteSubject`):** Permanent deletion modal requiring explicit confirmation by typing the subject's exact code. Permanently delete button remains disabled until exact code matches. Writes a full pre-deletion snapshot (`id`, `name`, `code`, `schoolId`, `createdAt`) into `AuditLog` under `SUBJECT_DELETED` before deleting record.
   * **Teacher Read-Only View:** Strict read-only enforcement: Teachers can view the full subject catalog and open detail sheets, while `Edit Details` and `Delete Subject` mutation controls are completely absent from the DOM.
   * **Quality & Test Verification:**
     * `tsc --noEmit`: 0 TypeScript compilation errors.
     * `npm run build`: Clean production build; dynamic route `ƒ /dashboard/subjects` (5.95 kB).
     * Integration test script (`scripts/test-subject-stage2.ts`): 17 / 17 tests passed in WSL2 (seeded retrieval, update normalization, diff audit logging, duplicate collision prevention, same-code self-update, confirmation code validation, pre-deletion snapshot, cross-tenant protection, and baseline data preservation).
     * Automated browser runtime verification: Fully verified in Chromium for both Admin (sheet inspection, edit, duplicate rejection, safe deletion with confirmation typing) and Teacher (read-only sheet, absent mutation controls, search, and sorting).

9. **Daily Attendance Register & Multi-Tenant Bulk Marking (Module 5 — Stage 1):**
   * Attendance register workspace at `/dashboard/attendance` resolving previous 404 stub with HTTP 200.
   * Summary metric cards: Today's Overall Attendance %, Registers Marked, Pending Registers, Absentees Today.
   * Class and Section cascading selectors with dynamic division population and date selector (Today, Yesterday, date input).
   * Interactive student roll call table with one-click bulk status setters ("All Present", "All Absent") and individual status toggles (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`, `HALF_DAY`).
   * Optional student remarks input (e.g. "Mild fever", "Medical leave") and section session notes.
   * Non-destructive Prisma migration (`20260930084346_add_attendance_management`) creating `AttendanceStatus` enum, `AttendanceSession`, and `AttendanceRecord` tables.
   * Multi-tenant composite unique constraints: `@@unique([schoolId, classId, sectionId, date])` preventing duplicate registers, and `@@unique([sessionId, studentId])` preventing duplicate student records.
   * Atomic `prisma.$transaction` handling session upsert + record synchronization.
   * RBAC & Historical Security: Teachers can mark/edit attendance for today and yesterday ($\le 48\text{h}$); older historical dates display a Read-Only lock banner and require an Administrator.
   * Structured audit logging: `ATTENDANCE_MARKED` and `ATTENDANCE_UPDATED` events written to `AuditLog` table with attendance breakdown metrics.
   * Quality & Test Verification:
     * `tsc --noEmit`: 0 TypeScript compilation errors.
     * `npm run build`: Clean production build; dynamic route `ƒ /dashboard/attendance` (12.6 kB).
     * Integration test script (`scripts/test-attendance-stage1.ts`): 24 / 24 tests passed in WSL2.
     * Runtime HTTP smoke tests (`scripts/test-attendance-runtime.ts`): 16 / 16 tests passed against live server on port 3000.
     * Regression tests: 39 / 39 tests passed across Subjects, Teachers, and Students.

10. **Historical Monthly Attendance Matrix, Analytics & CBSE 75% Defaulters (Module 5 — Stage 2):**
    * **Historical / Monthly Attendance Matrix (`AttendanceMonthlyMatrix`):** Full calendar-month matrix grid rendering days 1 through $N$ with day-of-week abbreviations, weekend indicators, and interactive status codes (`P`, `A`, `L`, `E`, `H`).
    * **No-Session Date Clarity:** Unmarked dates without sessions clearly distinguished from marked absences with neutral dashes and explanatory tooltips.
    * **CBSE 75% Defaulter Detection (`AttendanceDefaultersCard`):** Automated calculation of effective attendance percentage ($P=1.0, L=1.0, H=0.5, A=0, E=0$) and automatic identification of students falling below the mandatory CBSE 75% examination threshold, with rich empty states for 100% compliant cohorts.
    * **Attendance Analytics Dashboard:** Class attendance rate, total working sessions, active student count, and category/status distribution breakdown.
    * **Student Profile Dossier Integration (`StudentDetailSheet`):** Compact Attendance Summary embedded directly into the 360-degree student slide-over sheet displaying cumulative rate %, working days, present/absent counts, CBSE compliance pill, and recent session logs.
    * **Export & Print Ready:**
      * RFC-4180 compliant CSV export with tenant-scoped download (`exportMonthlyAttendanceCsv`).
      * Clean print-friendly view with official institutional report header, hidden navigation/controls, and high-contrast `@media print` styling (`window.print()`).
    * **Multi-View Workspace (`AttendanceWorkspace`):** Instant client-side tab switching between "Daily Register" and "Monthly Matrix & Analytics" with deep-link URL parameter support (`?view=monthly`).
    * **Quality & Test Verification:**
      * `tsc --noEmit`: 0 TypeScript compilation errors.
      * Stage 2 Integration test script (`scripts/test-attendance-stage2.ts`): 30 / 30 tests passed in WSL2.
      * Stage 1 Regression test script (`scripts/test-attendance-stage1.ts`): 24 / 24 tests passed in WSL2.
      * Full Phase 2 regression suites: 39 / 39 tests passed across Subjects (17), Teachers (13), and Students (9).
      * Runtime HTTP smoke tests: 16 / 16 passed against live server on port 3000.
      * Zero schema migrations needed; baseline data completely preserved.

11. **Exams / Marks / Grades Lifecycle & Assessment (Module 6 — Stage 1):**
    * **Multi-Tenant Exam Schema (`Exam` & `ExamResult`):**
      * `ExamType` enum (`PERIODIC_TEST`, `HALF_YEARLY`, `ANNUAL`, `PRACTICE`) and CBSE 8-tier `GradeLabel` enum (`A1`, `A2`, `B1`, `B2`, `C1`, `C2`, `D`, `E`).
      * Decimal precision (`Decimal(6,2)`) for `maxMarks`, `passingMarks`, and `marksObtained`.
      * Composite tenant indexing and unique compound constraint on `(schoolId, classId, sectionId, subjectId, academicYear, name)`.
      * Unique constraint on `(examId, studentId)` for atomic upsert of student marks.
    * **CBSE Scholastic Grade Scale:**
      * Server-side computation: A1 (91–100%), A2 (81–90%), B1 (71–80%), B2 (61–70%), C1 (51–60%), C2 (41–50%), D (33–40%), E (<33%).
      * Automated `percentage` rounding and `isPassing` evaluation against administrator-configured `passingMarks`.
    * **Server Actions & Mutations (`src/lib/actions/exams.ts`):**
      * `createExam`: ADMIN only; enforces `passingMarks <= maxMarks`, validates class/section/subject ownership, duplicate exam name protection, logs `EXAM_CREATED`.
      * `updateExam`: ADMIN only; allows updating name, examDate, notes; logs `EXAM_UPDATED` with field-level diffs.
      * `deleteExam`: ADMIN only; hard delete protected by zero-result guard; captures complete pre-deletion security snapshot in `EXAM_DELETED` audit log.
      * `getExamsForSection` & `getExamDetail`: Accessible by ADMIN and TEACHER roles with tenant isolation.
      * `saveExamResults`: Accessible by ADMIN and TEACHER; validates active enrollments; atomic transaction upsert; privacy-preserving aggregate audit logging (`EXAM_RESULTS_SAVED`).
    * **UI Pages & Components:**
      * `/dashboard/exams`: 4 KPI summary cards (Total Exams, Marks Entered, Pending Entry, Overall Pass Rate), Class/Section workspace switcher, client-side search & exam type filters.
      * `/dashboard/exams/[examId]`: Roll-call marks entry table, real-time client preview of percentage/grade/status, optional remarks, and atomic save.
      * `CreateExamDialog` & `DeleteExamDialog`: Role-gated modals adhering strictly to project design system (native selects, `DialogTrigger` with `render` prop).
    * **Quality & Test Verification:**
      * `tsc --noEmit`: 0 TypeScript compilation errors.
      * Migration `20261001060815_add_exam_management` applied and verified.
      * Stage 1 Integration test script (`scripts/test-exam-stage1.ts`): 54 / 54 test assertions passed in WSL2.
      * Phase 2 Regression suites: Attendance Stage 2 (30/30), Attendance Stage 1 (24/24), Subjects Stage 2 (17/17), Teachers Stage 2 (13/13), Students Stage 2 (All pass).
      * Baseline demo data (DEMO001, Aarav Patel, Class 6, Section A, Mathematics) completely preserved with zero dangling test records.

12. **Exams / Marks / Grades — Student/Parent Scorecard, Analytics & Export (Module 6 — Stage 2):**
    * **Student & Parent Scorecard Portal (`/dashboard/my-grades` & `student-grades-view.tsx`):**
      * Role-gated route for `STUDENT` and `PARENT` users with automated session context resolution.
      * Student views strictly their own results; cross-student grade viewing blocked.
      * Parent views linked children with multi-child selector dropdown and automatic default child selection; unlinked child access denied.
      * Academic year and exam type filters with real-time recalculation of scores and averages.
      * 4 Cumulative KPI cards: Exams Taken, Overall Average %, Passed count, Failed count.
      * Subject performance scorecard table displaying Subject, Exam Name, Exam Type, Date, Max Marks, Marks Obtained, Percentage, Grade badge (`A1`..`E`), and Result status (`Pass` / `Fail`).
    * **Student Detail Sheet Integration (`StudentDetailSheet`):**
      * Embedded "Academic Performance & Grades" summary card directly in the 360-degree student slide-over sheet.
      * Displays cumulative average %, exams taken count, pass/fail breakdown, and recent exam results list.
    * **Cohort Exam Performance Analytics (`ExamAnalyticsCard`):**
      * Embedded on `/dashboard/exams/[examId]` detail page for staff (`ADMIN` and `TEACHER`).
      * Computes total appeared count, class average marks, class average percentage, highest mark, lowest mark, and pass percentage.
      * Grade distribution bar breakdown for all 8 CBSE scholastic tiers (`A1`, `A2`, `B1`, `B2`, `C1`, `C2`, `D`, `E`).
    * **Exam Result CSV Export (`exportExamResultsCsv`):**
      * Server-side RFC-4180 compliant CSV export generating student roll call with Roll No, Admission No, Student Name, Gender, Marks Obtained, Max Marks, Percentage, Grade, Status, and Remarks.
      * Strictly staff-only (`ADMIN`, `TEACHER`); denied to `STUDENT` and `PARENT`.
      * Emits `EXAM_RESULTS_EXPORTED` audit log with privacy-preserving aggregate metadata only (zero student marks logged).
    * **Print-Friendly Institutional Result Sheet:**
      * Clean institutional result layout with school name, address, exam details, class/section info, and table of results.
      * Official signature blocks for Subject Teacher, Class Teacher, and Principal.
      * High-contrast `@media print` styling hiding action buttons, headers, and navigation during `window.print()`.
    * **Quality & Test Verification:**
      * `tsc --noEmit`: 0 TypeScript compilation errors.
      * Stage 2 Integration test script (`scripts/test-exam-stage2.ts`): 53 / 53 test assertions passed in WSL2.
      * Full Phase 2 regression suites: 147 assertions/checkpoints passed across Exams Stage 1 (54/54 assertions), Attendance Stage 2 (30/30 assertions), Attendance Stage 1 (24/24 assertions), Subjects Stage 2 (17/17 assertions), Teachers Stage 2 (13/13 assertions), Students Stage 2 (9/9 checkpoints).
      * Zero Prisma schema changes and zero database migrations required.
      * Baseline demo data completely preserved with zero dangling test records.

13. **Report Cards — Compilation, Exam Cycle Isolation & Printing (Module 7 — Stage 1):**
    * **Dynamic Single-Student Compilation (`getStudentReportCard`):**
      * Pure on-demand synthesis computing subject marks, percentages, CBSE grades, pass/fail status, attendance metrics, and grand totals without redundant stored tables.
    * **Explicit Exam-Cycle Discovery & Isolation (`getAvailableExamCyclesForSection`):**
      * Discovers distinct evaluation cycles by grouping exams matching `schoolId + classId + sectionId + academicYear` by `name + examType`.
      * Uses explicit `examIds` array to strictly isolate exam cycles, preventing cross-cycle contamination (e.g. Periodic Test 1 vs Periodic Test 2).
      * Duplicate Subject Protection: Rejects any attempt combining multiple exams for the same subject within a single report card.
    * **Attendance Denominator & History Integration:**
      * Derives `totalClassSessions` strictly from `AttendanceSession` record count for the class/section/academicYear (not student attendance rows).
      * Computes `attendedDays` using standard CBSE status weights: `PRESENT` = 1.0, `LATE` = 1.0, `HALF_DAY` = 0.5, `ABSENT` = 0.0, `EXCUSED` = 0.0.
      * Evaluates CBSE mandatory 75% attendance threshold (`isCompliant`) and handles partial attendance history gracefully.
    * **Demographic Mapping & Schema Fidelity:**
      * Aligned strictly with Student schema: uses `admissionNumber` as primary identifier, Sr. No. ordinal index instead of unsupported `rollNumber`, and maps category, date of birth, and institutional header.
    * **Academic Calculations & CBSE Grading:**
      * Preserves exact `Decimal(6,2)` precision, rounds percentages to 2 decimal places using `roundTo()`, and reuses synchronous pure `computeGrade()` utility for 8-tier CBSE grades (`A1`..`E`).
      * CBSE Pass/Fail Rules: Requires passing all individual subjects and overall percentage $\ge 33.0\%$. Flags failed subjects with count and names list. Evaluates unappeared absent students as 0 marks, grade `E`, and display status `ABSENT` (`AB`).
    * **Multi-Tier Role-Based Access Control (RBAC):**
      * `ADMIN`: Tenant-wide report card generation and viewing for any student.
      * `TEACHER`: Tenant-wide read-only report card inspection.
      * `STUDENT`: Strict own-card access only (`userId` match) integrated into `/dashboard/my-grades`.
      * `PARENT`: Access strictly limited to linked active children with multi-child switching; unlinked student access blocked.
      * Multi-tenant isolation strictly verified; cross-tenant queries return null / unauthorized.
    * **Privacy-Preserving Audit Trail:**
      * Logs `REPORT_CARD_VIEWED` and `REPORT_CARD_PRINTED` (`recordReportCardPrintAudit`) in `AuditLog`.
      * Logs aggregate metadata only (`studentId`, `academicYear`, `cycleName`, `examCount`); zero raw marks or grades logged.
    * **UI Pages & Institutional Printable Report Card:**
      * `/dashboard/report-cards`: Class/section filter bar, dynamic cycle selector, overview KPI cards, and interactive student roster table (`StudentRosterList`) with evaluation readiness status badges (`READY`, `PARTIAL`, `NO MARKS`).
      * Modal & Print Preview (`ReportCardModal`, `PrintableReportCard`): Pixel-perfect A4 portrait layout with school crest, student demographics, scholastic achievement table, attendance summary with CBSE 75% indicator, CBSE grading scale legend, official signatures (Class Teacher, Principal), and native print trigger with `@media print` styling.
      * Student/Parent Integration (`student-grades-view.tsx`): "View Full Report Card" preview modal integrated into `/dashboard/my-grades`.
    * **Quality & Test Verification:**
      * `tsc --noEmit`: 0 TypeScript errors across codebase.
      * ESLint: 0 errors, 0 warnings across all implementation and test files.
      * `npm run build`: Successful production build; dynamic route `ƒ /dashboard/report-cards` (3.58 kB).
      * Stage 1 Integration test script (`scripts/test-report-card-stage1.ts`): 50 / 50 test assertions passed in WSL2.
      * Full Phase 2 regression suites: 200 / 200 assertions passed across prior suites (Exams S2: 53/53, Exams S1: 54/54, Attendance S2: 30/30, Attendance S1: 24/24, Subjects S2: 17/17, Teachers S2: 13/13, Students S2: 9/9).
      * Zero Prisma schema changes and zero database migrations required.
      * Baseline demo data completely preserved with zero dangling test records.

14. **Report Cards Stage 2 — Batch Printing, Cohort CSV Export, Persistent Remarks, Co-Scholastic Grades & Multi-Term Annual Compilation (Module 7 — Stage 2):**
    * **Delivered Scope:**
      1. Shared 7-query batched report-card data engine (`getBatchReportCardData`).
      2. Pure in-memory report-card compilation (`compileReportCardData`).
      3. Batch continuous A4 printing (`BatchPrintableReportCards`, `BatchReportCardModal`).
      4. Cohort report-card CSV export (`exportClassReportCardSummaryCsv`).
      5. Persistent teacher remarks (`ReportCardRemark`, `saveTeacherRemark`, `getTeacherRemarksForSection`).
      6. Co-scholastic activities & discipline grades (`CoScholasticEntry`, `saveCoScholasticGrades`, `getCoScholasticForSection`).
      7. Multi-term weighted annual compilation (`getMultiTermReportCard`, `MultiTermModal`).
      8. Staff RBAC + strict tenant isolation.
      9. Metadata-only audit logging (`BATCH_REPORT_CARDS_PRINTED`, `REPORT_CARDS_EXPORTED`, `TEACHER_REMARK_UPDATED`, `CO_SCHOLASTIC_RECORDED`).
      10. Dedicated print-only root (`#report-card-print-root`) and final A4 print-layout/pagination architecture.
    * **Dedicated Print Architecture & Layout Defect Resolution:**
      * Separated screen preview (`print:hidden` inside modal) from print document.
      * Rendered print document to a dedicated top-level portal (`<div id="report-card-print-root">`) directly attached to `document.body`.
      * Eliminates Base UI / Radix dialog transforms, positioning locks, modal scrollbars, and `sm:max-w-sm` container clipping from the print rendering tree.
      * Enforces print-safe A4 portrait dimensions (210mm × 297mm; content box margins `8mm 6mm`, usable height `281mm`).
      * Compact print density (~528px card height vs ~1062px available height) guarantees single-page retention per student with zero page splitting.
      * Continuous batch printing wraps each card in `.report-card-page` with `break-inside: avoid` and inter-card `break-after: page`, achieving clean 2-page print layout for 2-student batches without cross-card bleed or trailing blank pages.
    * **Quality & Test Verification:**
      * `tsc --noEmit`: 0 TypeScript errors across codebase.
      * Targeted ESLint: 0 errors, 0 warnings across all implementation and test files.
      * `npm run build`: Successful production build; static page generation (16/16) complete.
      * Stage 2 Integration test suite (`scripts/test-report-card-stage2.ts`): 52 / 52 test assertions passed in WSL2.
      * Stage 1 Integration test suite (`scripts/test-report-card-stage1.ts`): 50 / 50 test assertions passed in WSL2.
      * Previous Phase 2 regression suites: 200 / 200 assertions passed across Modules 2–6.
      * Cumulative passing assertions: 302 / 302 passed across all modules.
      * Database test cleanup: 0 dangling temporary test rows.
    * **Manual Browser Verification Completed:**
      * Admin login: PASS
      * Single-student report card view: PASS
      * Single-student A4 print preview: PASS
      * Two-student batch print preview: PASS
      * Teacher remarks modal save & persistence after reopening: PASS
      * Co-scholastic grades modal save & persistence after reopening: PASS
      * CSV export and spreadsheet inspection: PASS
      * Annual Multi-Term weighted compilation (40% PT1 + 60% Annual): PASS
      * Correct annual subject-level weighted results: PASS
    * **Development & Testing Environment Note:**
      * Windows Next.js development process communicates with PostgreSQL running inside WSL2 Docker container (`evoolp-db-1`).
      * When WSL2 suspends or goes idle, `localhost:5432` can become temporarily unreachable during browser NextAuth callbacks (`PrismaClientInitializationError: Can't reach database server at localhost:5432`).
      * Diagnosed as a local WSL2 environment/networking lifecycle note, not an EvoERP application defect.

15. **Finance Management — Fee Masters, Fee Structures, Concessions & Cohort Allocation (Phase 3 — Stage 1):**
    * **Delivered Scope:**
      * Fee Category Master (`FeeCategory` model, CRUD server actions, code uppercase normalization, unique code/name per school, safe deletion protection blocking deletion of referenced categories).
      * Master Fee Structures (`FeeStructure` and `FeeStructureItem` models, multi-line item builder supporting amounts, frequencies `MONTHLY`/`QUARTERLY`/`ANNUAL`/`ONE_TIME`, due months, class/section targeting, and structure archiving).
      * Fee Discount & Concession Policies (`FeeDiscount` model, `PERCENTAGE` and `FIXED_AMOUNT` types, percentage bounds $\le 100$, fixed amount $\ge 0$, and default RTE candidate 100% waiver designation).
      * Cohort Fee Allocation Engine (`allocateFeesToCohort` server action, active enrollment resolution, Decimal-safe arithmetic, automatic RTE candidate waiver detection, master item duplicate allocation skipping, and aggregate `FEE_ITEMS_ALLOCATED` audit logging).
      * Student Fee Allocation Read View (`getStudentFeeItemsForClass` server action, per-student gross, discount, net amounts, and status badges `ASSIGNED` / `WAIVED` / `CANCELLED`).
      * Role-Based Access Model: `ADMIN` full mutation access; `TEACHER` clean read-only visibility at `/dashboard/fees`; `STUDENT` and `PARENT` strictly server-gated away from `/dashboard/fees`.
      * Financial Snapshot & Decimal Security: Immutable `StudentFeeItem` financial amounts (`grossAmount`, `discountAmount`, `netAmount`) using `Prisma.Decimal` (zero floating-point math); updates to master fee structures or discount policies never retroactively mutate previously allocated student fee item snapshots.
    * **Automated Verification:**
      * Integration Test Suite (`scripts/test-fee-stage1.ts`): 56 / 56 test assertions passed in WSL2.
      * `npx tsc --noEmit`: 0 TypeScript errors across codebase.
      * Targeted ESLint: 0 errors, 0 warnings across all Finance validation, server action, and UI files.
      * Database test cleanup: Temporary test records completely removed; baseline academic demo data remained 100% intact.
    * **Actual Manual Browser Verification Performed:**
      1. ADMIN successfully created 3 fee categories: Tuition Fee (`TUIT`), Development Fee (`DEV`), Examination Fee (`EXAM`).
      2. ADMIN successfully created 1 master fee structure for Class 6 Section A (Academic Year 2025-2026): Tuition Fee ₹3,000, Development Fee ₹2,000, Examination Fee ₹500.
      3. ADMIN successfully created 1 RTE 100% Waiver discount policy (`RTE100`, percentage 100, RTE default enabled).
      4. ADMIN successfully executed first cohort allocation for Class 6 Section A (2 enrolled students, 6 newly allocated `StudentFeeItem` records, total net payable ₹5,500; RTE candidate student received 100% waiver with ₹0 net payable and `WAIVED` status).
      5. ADMIN repeated the same cohort allocation for Class 6 Section A (0 newly allocated items, 6 skipped as already allocated; duplicate protection verified).
      6. ADMIN edited the master fee structure (changed Tuition master amount to ₹5,000, structure total became ₹7,500; previously allocated student Tuition snapshots remained ₹3,000; snapshot immutability verified).
      7. ADMIN attempted to delete the referenced Tuition Fee category (deletion correctly blocked by backend guard; UI explained reference in structures/items and recommended deactivation).
      8. TEACHER manually accessed `/dashboard/fees` (Finance page loaded successfully, existing fee data visible, mutation controls omitted, Fee Categories readable).
    * **Actual Navigation Behavior:**
      * `/dashboard/fees` is exposed to `ADMIN` (full mutation access) and `TEACHER` (read-only visibility).
      * `STUDENT` and `PARENT` are server-gated away from `/dashboard/fees`.
      * `/dashboard/my-fees` is NOT exposed yet in Stage 1.

16. **My Attendance — Student & Parent Personal Portal (Module 5 Extension):**
    * **Delivered Scope:**
      * Student/Parent read-only attendance portal at `/dashboard/my-attendance`.
      * Parent multi-child ward switcher dropdown allowing seamless switching between linked active wards.
      * Summary metric cards: Overall Attendance Rate %, Total Working Sessions, Attended Days Count ($P + L + 0.5 \times H$), Present Count, Absent Count, Exceptions breakdown (Late, Half-Day, Excused).
      * CBSE 75% examination eligibility pill badge ("CBSE Compliant" vs "Shortage Risk").
      * Attendance History Register table listing session date, day of week, class & section, status badge (`PRESENT`, `ABSENT`, `LATE`, `HALF_DAY`, `EXCUSED`), and teacher remarks.
      * Month filter dropdown for filtering attendance logs by month.
      * Server action `getMyAttendance()` and validation schema `myAttendanceQuerySchema`.
      * Strict security & tenant isolation: session `userId` / `parentUserId` resolved server-side via `requireTenant()`; client `studentId` parameters strictly verified against parent ownership to prevent IDOR.
    * **Automated Verification:**
      * Integration Test Suite (`scripts/test-my-attendance.ts`): 25 / 25 test assertions passed in WSL2.
      * Static Type Check: `npx tsc --noEmit` $\rightarrow$ 0 TypeScript errors across codebase.
      * Targeted ESLint: 0 errors, 0 warnings across all attendance files.
      * Attendance Stage 1 & Stage 2 Regression suites: 54 / 54 tests passed (zero regression).

---

## 4. Current Incomplete Work (Future Scope)

* **Phase 3 Stage 2 Deferred Scope:** Payment transactions, invoicing/demands, payment receipts / PDF generation, defaulter tracking, late fees, student/parent `/dashboard/my-fees` portal, financial CSV export/reconciliation, and online payment processing (Razorpay).
* **Note on Deferral:** Finance Stage 2 is explicitly deferred for the current delivery cycle (October 10–12, 2026 delivery window) to prioritize low-risk student portal features. The complete Finance Stage 2 blueprint remains preserved for continuation post-delivery.

---

## 5. Next Development Target

* **Target:** **Phase 3 — Finance Management (Stage 2 Continuation) / Additional Student Portals**
* **Status:** Phase 3 Finance Stage 1 (Commit `2f63a30`) and Phase 2 Module 5 Extension (My Attendance) are COMPLETE. All Finance Stage 1 demo data remains preserved.
