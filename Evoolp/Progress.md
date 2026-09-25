# EvoERP — Progress

## Current Phase: 1 — Foundation

## Done

### Session 2026-09-22
- [x] Read Project_Brief.md and all docs/ (architecture, database, requirements, etc.)
- [x] Folder structure finalized: EvoERP/ root → Evoolp/ (code + briefs), docs/, reference/
- [x] Next.js 15 initialized — App Router, TypeScript (strict), Tailwind CSS, src/ dir
- [x] Prisma schema written (prisma/schema.prisma):
  - School, User (Role enum: ADMIN/TEACHER/STUDENT/PARENT), Student, Teacher,
    Class, Section, Subject, Enrollment, AuditLog
  - NextAuth adapter tables: Account, Session, VerificationToken
  - Every tenant model has schoolId (multi-tenancy rule)
  - Indian fields: admissionNumber (unique per school), category (General/SC/ST/OBC),
    rteCandidate (RTE 25% reservation)
  - Indexes + per-school unique constraints per docs/database.md
  - Indian fiscal year (April–March) documented
- [x] Core libs written (src/lib/):
  - prisma.ts — Prisma client singleton
  - tenant.ts — getSchoolId() / requireTenant() / requireRole() + getFiscalYear() (Apr–Mar)
  - audit.ts — logAudit(userId, action, entityType, entityId, oldValues, newValues) + diffChanges()
  - auth.ts — NextAuth v5: credentials provider + Prisma adapter, JWT with schoolId/role
  - nav.ts — role-based sidebar menu config
  - validations/auth.ts — Zod schemas (login, register)
- [x] src/types/next-auth.d.ts — session typing (id, schoolId, role)
- [x] Tenant middleware (src/middleware.ts) — extracts schoolId from session,
  sets x-school-id / x-user-id / x-user-role headers, redirects to /login
- [x] UI shell: root layout, dashboard layout (sidebar + header + breadcrumbs),
  role-based sidebar (Admin/Teacher/Student/Parent menus), dashboard page
- [x] Login page + login form (react-hook-form + Zod)
- [x] Seed script (prisma/seed.ts) — demo school + 1 admin, 1 teacher, 1 student,
  1 parent + class/section/subject/enrollment demo data
- [x] docker-compose.yml (PostgreSQL 16 + app), Dockerfile (multi-stage), .env.example

## In Progress
- [ ] npm install — interrupted 4x by npm `edgesOut` bug + session restarts;
  partial install done (561 packages extracted). Deps still pending in package.json:
  prisma, @prisma/client, next-auth, @auth/prisma-adapter, zod, react-hook-form,
  @hookform/resolvers, recharts, bcryptjs, tsx

## Next Up
1. Finish dependency install (--legacy-peer-deps workaround; pnpm fallback)
2. Install shadcn/ui (Button, Input, Label, Breadcrumb already referenced in code)
3. `npx prisma generate`
4. Initial migration — `npx prisma migrate dev --name init`
   (embedded user-space PostgreSQL on the dev box; real DB via docker-compose)
5. `npx prisma db seed`
6. `npm run build` verification
7. Manual smoke test: login page → dashboard with role-based sidebar

## Blocked
(none)

## Notes
- Dev machine has no Docker/Postgres — migration runs against an embedded
  PostgreSQL instance; production/local setup uses docker-compose.yml
- npm 10.9.8 bug: `Cannot read properties of null (reading 'edgesOut')` during
  install — workaround: `--legacy-peer-deps`
- Password policy in seed: demo users use `Password123!` (bcrypt hashed)
- Phase 2 backlog hint: Student/Teacher CRUD, classes, attendance, exams
