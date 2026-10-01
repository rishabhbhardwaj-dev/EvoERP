# EvoERP — Project Progress & Current State

> **Purpose:** Single source of truth for the **current project state**.
> For detailed technical implementation history, architecture notes, and changelogs, refer to `Evoolp/docs/PHASE_2_MODULE_1_CHANGELOG.md`.

---

## 1. Current State Overview

* **Current Phase:** Phase 2 — Academic Core
* **Active Branch:** `evoerp-foundation-fixes` (Tracking: `origin/evoerp-foundation-fixes`)
* **Current HEAD Commit:** `40182d6`
* **Working Tree:** Clean (0 uncommitted changes, verified 2026-10-01)
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
| **Phase 2** | Module 6 — Exams / Marks / Grades | Stage 1 | **COMPLETE** | Exam lifecycle, CBSE 8-tier grading, roll-call marks entry, zero-result delete guard, audit logging |
| **Phase 2** | Module 6 — Exams / Marks / Grades | Stage 2 | **NOT IMPLEMENTED** | Student/Parent grade portal, term aggregation, report card feeds |
| **Phase 2** | Module 7 — Report Cards | — | **NOT IMPLEMENTED** | Term Report Card generation |

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

---

## 4. Current Incomplete Work (Future Scope)

### Future Phase 2 Modules
* Module 6: Exams / Marks / Grades — Stage 2 (`/dashboard/my-grades`, parent portal, term aggregation, report card feeds)
* Module 7: Report Cards — Term Report Card generation

---

## 5. Next Development Target

* **Target:** **Phase 2 — Module 6 — Exams / Marks / Grades — Stage 2**
* **Primary Scope:**
  1. Student / Parent grade view (`/dashboard/my-grades`).
  2. Term marks aggregation, grade point averages, and class rank computations.
  3. Student dossier (`StudentDetailSheet`) academic marks & grade tab integration.
  4. CSV / printable exam report exports.




