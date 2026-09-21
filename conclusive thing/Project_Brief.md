# EvoERP — Project Brief

## What This Is
School ERP for Indian K-12 schools. Multi-tenant SaaS — one codebase, many schools.
Each school's data is isolated by schoolId.

## Tech Stack
Next.js 15 (App Router) + TypeScript + Prisma + PostgreSQL + NextAuth.js
Tailwind CSS + shadcn/ui + React Hook Form + Zod + Recharts
Docker for deployment. GitHub Actions for CI/CD.

## Rules
1. Every Prisma model includes schoolId (multi-tenancy).
2. Every API route checks user's schoolId and role.
3. Use shadcn/ui components. Don't build custom buttons/inputs.
4. Use Zod for all validation.
5. TypeScript strict. No `any`.
6. Indian fiscal year: April to March.

## Roles
ADMIN — full access, manage everything, view all reports
TEACHER — mark attendance, enter marks, view assigned classes
STUDENT — view own attendance, grades, fees, notices
PARENT — view linked child's attendance, grades, fees

## Indian-Specific
Student.admissionNumber (unique per school)
Student.category (General/SC/ST/OBC)
Student.rteCandidate (boolean, RTE 25% reservation)
ExamResult.grade (CBSE: A1/A2/B1/B2/C1/C2/D/E)
Payment.method (CASH/ONLINE/CHEQUE/UPI)
Fee.frequency (MONTHLY/QUARTERLY/ANNUAL/ONE_TIME)

## Phases
Phase 1: Auth, RBAC, tenant, users, audit, DB, UI shell
Phase 2: Students, teachers, classes, sections, subjects, attendance, exams, marks, grades, report cards
Phase 3: Fee structure, invoices, payments, receipts
Phase 4: Parent portal, notices, dashboards, reports
Phase 5+: Timetable, HR/payroll, compliance, notifications, analytics