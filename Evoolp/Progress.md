# EvoERP — Project Progress & Current State

> **Purpose:** Single source of truth for the **current project state**.
> For detailed technical implementation history, architecture notes, and changelogs, refer to `Evoolp/docs/PHASE_2_MODULE_1_CHANGELOG.md`.

---

## 1. Current State Overview

* **Current Phase:** Phase 2 — Academic Core
* **Active Branch:** `evoerp-foundation-fixes` (Tracking: `origin/evoerp-foundation-fixes`)
* **Current HEAD Commit:** `e28a447`
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
| **Phase 2** | Module 3 — Teachers | — | **NOT IMPLEMENTED** | Teacher Directory & Staff Profiles |
| **Phase 2** | Module 4 — Subjects | — | **NOT IMPLEMENTED** | Subject Catalog & Class Assignment |
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

---

## 4. Current Incomplete Work (Future Scope)

### Future Phase 2 Modules
* Module 3: Teachers (`/dashboard/teachers`)
* Module 4: Subjects (`/dashboard/subjects`)
* Module 5: Attendance (`/dashboard/attendance`, `/dashboard/my-attendance`)
* Module 6: Exams / Marks / Grades (`/dashboard/exams`, `/dashboard/my-grades`)
* Module 7: Report Cards

---

## 5. Next Development Target

* **Target:** **Phase 2 — Module 3 — Teachers Management**
* **Primary Scope:**
  1. Teachers Directory route at `/dashboard/teachers`.
  2. Teacher profile creation & staff record onboarding.
  3. Employee code uniqueness per school tenant.
  4. Class teacher assignment & subject specialization mappings.
  5. Teacher directory filters (Department, Status, Search).


