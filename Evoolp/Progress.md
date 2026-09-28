# EvoERP — Project Progress & Current State

> **Purpose:** Single source of truth for the **current project state**.
> For detailed technical implementation history, architecture notes, and changelogs, refer to `Evoolp/docs/PHASE_2_MODULE_1_CHANGELOG.md`.

---

## 1. Current State Overview

* **Current Phase:** Phase 2 — Academic Core
* **Active Branch:** `evoerp-foundation-fixes` (Tracking: `origin/evoerp-foundation-fixes`)
* **Current HEAD Commit:** `cfcab80`
* **Working Tree:** Clean (0 uncommitted changes, verified 2026-09-28)
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
| **Phase 2** | Module 4 — Subjects | Stage 2 | **NOT IMPLEMENTED** | Subject Detail Dossier, Edit modal, Safe Deletion with confirmation & snapshot |
| **Phase 2** | Module 5 — Attendance | — | **NOT IMPLEMENTED** | Daily Student Attendance workflow |
| **Phase 2** | Module 6 — Exams / Marks / Grades | — | **NOT IMPLEMENTED** | CBSE Assessment cycles & Marks entry |
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
     * Integration test script (`scripts/test-subject-stage1.ts`): 15 / 15 tests passed in WSL2 (tenant isolation, seeded math, normalization, validation variations, duplicate rejection, cross-tenant isolation, audit log).
     * Automated browser tests: Verified admin flow (catalog inspection, add subject with suggestion, real-time search and clear) and teacher read-only view.

---

## 4. Current Incomplete Work (Future Scope)

### Future Phase 2 Modules
* Module 4: Subjects Stage 2 (`/dashboard/subjects`) — Detail Dossier Sheet, Edit, Safe Deletion
* Module 5: Attendance (`/dashboard/attendance`, `/dashboard/my-attendance`) — Daily Student Attendance workflow
* Module 6: Exams / Marks / Grades (`/dashboard/exams`, `/dashboard/my-grades`) — CBSE Assessment cycles & Marks entry
* Module 7: Report Cards — Term Report Card generation

---

## 5. Next Development Target

* **Target:** **Phase 2 — Module 4 — Subjects Management (Stage 2)**
* **Primary Scope:**
  1. 360-degree slide-over dossier (`SubjectDetailSheet`).
  2. Subject profile edit modal (`EditSubjectDialog`) with `diffChanges()` audit logging (`SUBJECT_UPDATED`).
  3. Safe deletion dialog (`DeleteSubjectDialog`) with code typing confirmation and pre-deletion snapshot in `AuditLog` (`SUBJECT_DELETED`).
  4. Interactive table row click integration to open detail sheet.



