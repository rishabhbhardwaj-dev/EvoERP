# EvoERP

**EvoERP** is a multi-tenant School Enterprise Resource Planning (ERP) and SaaS management platform engineered for Indian K-12 school administration. Built with Next.js 15, TypeScript, Prisma, and PostgreSQL, EvoERP streamlines core academic workflows, attendance tracking, examination grading, report card compilation, fee structure management, notice distribution, and institutional analytics while strictly enforcing multi-tenant data isolation and role-based access control (RBAC).

---

## Current Status

EvoERP is actively developed according to a structured delivery roadmap designed for Indian school operational standards (Indian Fiscal Year April–March and CBSE academic guidelines).

### Completed Delivery Scope
- **Phase 1 — Foundation & Core Infrastructure**: Multi-tenant architecture, session authentication (NextAuth v5), role-based access control, tenant database schema, structured audit logging, and core UI shell.
- **Phase 2 — Core Academic Modules (1–7)**:
  - **Module 1**: Student Information System & Admissions Management (`/dashboard/students`).
  - **Module 2**: Staff Onboarding & Teacher Profile Management (`/dashboard/teachers`).
  - **Module 3**: Academic Structure Management — Classes & Sections (`/dashboard/classes`, `/dashboard/sections`).
  - **Module 4**: Subject Master Catalog & Mapping (`/dashboard/subjects`).
  - **Module 5**: Daily Attendance Register & Session Management (`/dashboard/attendance`).
  - **Module 6**: Examinations & Marks Entry Management (`/dashboard/exams`).
  - **Module 7**: CBSE Report Cards Compilation & Batch Printing (`/dashboard/report-cards`).
- **Phase 2 Extension — Student & Parent Attendance Portal**: Role-scoped self-service portal (`/dashboard/my-attendance`) with attendance summary metrics, CBSE shortage risk indicator (<75%), and historical registers.
- **Phase 3 — Finance Management (Stage 1)**: Fee categories, fee structures, discretionary discounts/concessions, and student fee allocations (`/dashboard/fees`).
- **Phase 4 — Notices & Announcements**: Role-targeted circular board (`/dashboard/notices`) supporting draft/publish lifecycles, audience filtering (`ALL`, `STUDENTS`, `PARENTS`, `TEACHERS`), and automatic 48-hour "NEW" indicator badges.
- **Phase 4 — Basic Reports & Dashboard Analytics**: Institutional reporting workspace (`/dashboard/reports`) featuring Enrollment distribution, Attendance compliance matrix (CBSE shortage risk register), Academic performance summaries, and Admin RFC-4180 CSV exports.

### Deferred Scope
- **Phase 3 — Finance Management (Stage 2)**: Transactional payment recording, invoice demand generation, receipt generation, fee defaulter tracking, student/parent `/dashboard/my-fees` portal, financial ledger export/reconciliation, and online payment gateway integration (Razorpay).
  > **Note on Deferral:** Finance Stage 2 is explicitly deferred for the current delivery cycle to prioritize core academic, student portal, and reporting features. The complete Finance Stage 2 architectural blueprint remains preserved for post-delivery continuation.

---

## Core Capabilities

### Academic Administration
- **Student Lifecycle**: Onboarding, profile management, status tracking (`ACTIVE`, `INACTIVE`), class/section enrollment, and parent user linkage.
- **Teacher Directory**: Staff profiles, employee codes, department tags, academic qualifications, and status lifecycle management.
- **Academic Structure**: Multi-year class configuration, section division, and subject catalog normalization.
- **Attendance Register**: Daily section-level session marking (`PRESENT`, `ABSENT`, `LATE`, `HALF_DAY`, `EXCUSED`), teacher edit windows (48h rule), and historical registers.
- **Exams & Grading**: Flexible exam creation (Periodic Tests, Half-Yearly, Annual), max/passing mark configuration, server-side marks validation, and automatic CBSE 8-point grade calculation (`A1` to `E`).
- **Report Cards**: Single-term and multi-term annual progress report compilation, teacher remarks, co-scholastic grading, and print-ready batch PDF compilation.

### Student & Parent Portals
- **My Attendance (`/dashboard/my-attendance`)**: Role-scoped attendance dashboard with monthly percentage calculations, CBSE 75% shortage alert badges, and daily attendance logs.
- **My Grades (`/dashboard/my-grades`)**: Student and parent academic progress and exam result inspection.
- **Circular Board (`/dashboard/notices`)**: Read-only circular reader for school-wide and role-targeted announcements.

### Finance (Stage 1)
- **Fee Management (`/dashboard/fees`)**: Fee category definitions (Tuition, Transport, Admission), academic year fee structures, class assignments, concession rules, and student fee allocation tracking.

### Communication & Notice Board
- **Notices Workspace (`/dashboard/notices`)**: Admin notice creation, content editor, expiration dates, status toggles (`DRAFT`, `PUBLISHED`, `ARCHIVED`), audience targeting, and structured audit logs.

### Reports & Analytics
- **Institutional Reports (`/dashboard/reports`)**:
  - **Enrollment**: Total student population, active/inactive counts, class-wise and section-wise distributions, gender breakdown.
  - **Attendance Analytics**: Overall attendance percentage, present/absent/late counts, section comparison matrix, and CBSE shortage risk register (<75%).
  - **Academic Performance**: Overall pass rates, average marks %, grade distribution counts (A1–E), and subject-wise score registers.
  - **CSV Exports**: One-click RFC-4180 CSV export with UTF-8 BOM (`\uFEFF`) for administrative data extraction.

---

## Role Model & Permissions

EvoERP enforces strict server-side Role-Based Access Control (RBAC) across all server actions and routes:

| Role | Permitted Access & Capabilities |
| :--- | :--- |
| **ADMIN** | Full administrative control across all modules, school settings, fee structure configuration, notice publishing, audit log inspection, institutional reports, and CSV exports. |
| **TEACHER** | Academic management: student directory, class/section views, attendance marking, exam setup, marks entry, report card compilation, circular reading, and read-only class reports. |
| **STUDENT** | Restricted self-service portal: personal attendance register (`/dashboard/my-attendance`), personal grades (`/dashboard/my-grades`), and relevant school notices. |
| **PARENT** | Ward-scoped access: linked child's attendance details, child's academic grades, and targeted parent circulars. |

---

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, React Server Components, Server Actions)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma 6](https://www.prisma.io/)
- **Authentication**: [NextAuth v5 (Auth.js)](https://authjs.dev/) with `bcryptjs` password hashing
- **Validation**: [Zod 4](https://zod.dev/) & [React Hook Form](https://react-hook-form.com/)
- **UI & Styling**: [Tailwind CSS v4](https://tailwindcss.com/), [Base UI](https://base-ui.com/), [Lucide Icons](https://lucide.dev/)
- **Data Visualization**: [Recharts](https://recharts.org/)
- **Test Runner**: Custom automated integration test suites executed via `tsx`

---

## System Architecture

EvoERP employs a modern Next.js server-action architecture built for multi-tenant SaaS security:

1. **Multi-Tenant Isolation**: Every database record is linked to a `schoolId`. Server actions invoke `requireTenant()` to derive `schoolId` and `userId` directly from the authenticated session, blocking cross-tenant data access and IDOR vulnerabilities.
2. **Server Actions Pattern**: All mutations use `"use server"` functions wrapped with Zod input validation, role checks, and database transactions (`prisma.$transaction`).
3. **Audit Logging**: Security-sensitive operations (onboarding, grade changes, notice actions, fee setup) write immutable event records to the `AuditLog` table.
4. **Development Resilience**: Includes a self-healing `Proxy` wrapper around `PrismaClient` in `src/lib/prisma.ts` to automatically refresh stale in-memory singletons during development hot-reloads.

---

## Project Structure

```text
EvoERP/
├── Evoolp/                              # Primary Next.js Application Directory
│   ├── prisma/                          # Prisma schema and database migrations
│   │   ├── migrations/                  # Executed SQL migrations
│   │   └── schema.prisma                # Database models and relations
│   ├── scripts/                         # Integration test scripts
│   │   ├── test-attendance-stage1.ts
│   │   ├── test-attendance-stage2.ts
│   │   ├── test-my-attendance.ts
│   │   ├── test-notices.ts
│   │   ├── test-reports.ts
│   │   └── ...
│   ├── src/
│   │   ├── app/                         # Next.js App Router (Dashboard pages & API)
│   │   ├── components/                  # UI components grouped by feature module
│   │   ├── lib/
│   │   │   ├── actions/                 # Server actions (business logic & database queries)
│   │   │   ├── validations/             # Zod validation schemas
│   │   │   ├── tenant.ts                # Session tenant context resolution
│   │   │   ├── audit.ts                 # Audit logging utility
│   │   │   └── prisma.ts                # Prisma client singleton
│   │   └── types/                       # Application type declarations
│   ├── docs/
│   │   └── PHASE_2_MODULE_1_CHANGELOG.md # Detailed technical changelog
│   ├── Progress.md                      # Comprehensive living progress tracker
│   ├── Project_Brief.md                 # Original project specification & phase roadmap
│   └── package.json                     # Next.js dependencies & scripts
├── docs/                                # Technical design documents
│   ├── architecture.md                  # Architecture & system design
│   ├── database.md                      # Database schema & entity relations
│   ├── security.md                      # RBAC, tenant isolation & security rules
│   └── ...
└── README.md                            # Root Repository Documentation
```

---

## Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL database instance

### Setup Instructions

1. Navigate to the application directory:
   ```bash
   cd Evoolp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/evoerp_db?schema=public"
   AUTH_SECRET="your-development-secret-key"
   NEXTAUTH_URL="http://localhost:3000"
   ```

4. Push the Prisma database schema:
   ```bash
   npx prisma db push
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Verification & Automated Testing

Run the integration test suites using `tsx`:
```bash
# Verify Notices & Announcements (28 assertions)
npx tsx scripts/test-notices.ts

# Verify Student & Parent Attendance Portal (25 assertions)
npx tsx scripts/test-my-attendance.ts

# Verify Basic Reports & Analytics (25 assertions)
npx tsx scripts/test-reports.ts
```

Run static type checking and linting:
```bash
npx tsc --noEmit
npm run lint
```

---

## Seeded Demo Environment

For evaluation, the local database seeds a standard demo school tenant (`DEMO001`):

| Role | Demo Username / Email | Verification Scope |
| :--- | :--- | :--- |
| **Administrator** | `admin@demo.evoerp.in` | Full management workspace, fee setup, notice publishing, CSV reports. |
| **Teacher** | `teacher@demo.evoerp.in` (`Ravi Kumar`) | Attendance register, exam setup, marks entry, report card compilation. |
| **Student** | `student@demo.evoerp.in` (`Aarav Patel`) | Student portal (`/dashboard/my-attendance`, `/dashboard/my-grades`), notices. |
| **Parent** | `parent@demo.evoerp.in` | Ward attendance tracking, ward grades, parent notices. |

---

## Documentation Map

Detailed engineering specifications and architecture documents are maintained in the repository:

- [`Evoolp/Progress.md`](file:///d:/Dekstop/EvoERP/Evoolp/Progress.md) — Detailed feature delivery status and milestone tracker.
- [`Evoolp/Project_Brief.md`](file:///d:/Dekstop/EvoERP/Evoolp/Project_Brief.md) — Master phase roadmap and core domain requirements.
- [`Evoolp/docs/PHASE_2_MODULE_1_CHANGELOG.md`](file:///d:/Dekstop/EvoERP/Evoolp/docs/PHASE_2_MODULE_1_CHANGELOG.md) — Technical module change log.
- [`docs/architecture.md`](file:///d:/Dekstop/EvoERP/docs/architecture.md) — Multi-tenant architecture and server action patterns.
- [`docs/database.md`](file:///d:/Dekstop/EvoERP/docs/database.md) — Data models, indexes, and entity relationships.
- [`docs/security.md`](file:///d:/Dekstop/EvoERP/docs/security.md) — Security controls, session validation, and RBAC rules.
