# EvoERP — Requirements

## 1. Project Overview

EvoERP is planned as a school-focused ERP for Indian K-12 institutions. The mentor blueprint covers a much broader long-term product; this file defines the **8-week delivery scope** and should be updated after mentor approval.

## 2. Objectives

- Provide a unified school management platform.
- Centralize student, teacher, academic, attendance and fee workflows.
- Support multiple schools through tenant isolation.
- Provide role-based access.
- Provide a consistent web experience across administrative and parent/teacher workflows.
- Use mature open-source systems selectively to avoid unnecessary reinvention.

## 3. Target Roles

Initial roles:
- Super Admin / System Admin
- School Admin
- Teacher
- Accountant
- Parent
- Student

Additional roles can be enabled later.

## 4. Delivery Scope Classification

### Native EvoERP — target for the 8-week build
- Authentication
- RBAC
- School/Tenant management
- User management
- Student management
- Teacher/staff profiles
- Class and section management
- Subject management
- Attendance
- Exams and marks
- Grade/report-card basics
- Fee structure
- Fee invoices
- Payment records
- Fee receipts
- Parent portal
- Notices/announcements
- Basic dashboards and reports
- Audit logging

### Integration / extension candidates
- LMS: Moodle
- Timetable generation: FET or equivalent
- Library: Koha
- Analytics/BI: Metabase or Superset
- AI/RAG: later, using a separate service

### Lightweight / optional during the 8-week period
- Basic HR
- Basic payroll
- Basic inventory
- Basic transport
- Basic hostel

### Explicitly deferred unless the mentor requires them
- Full enterprise LMS
- Full accounting suite
- Advanced predictive analytics
- Full AI assistant
- Theme marketplace
- Plugin marketplace
- Full government automation
- Complex transport/hostel systems

## 5. Functional Requirement Format

Every feature must record:
- ID
- Actor
- Requirement
- Preconditions
- Main flow
- Alternative/error flows
- Priority
- Acceptance criteria
- Dependencies

## 6. Non-Functional Requirements

- Responsive web interface
- Tenant data isolation
- Role-based authorization
- Auditability for sensitive actions
- Validation on client and server
- Secure password/session handling
- Database backups
- Error logging
- Consistent API contracts
- Usable performance for the MVP scale

## 7. Multi-Tenancy

All tenant-owned data should be associated with a school/tenant identifier. The exact enforcement method must be finalized in `database.md` and `architecture.md`.

## 8. Compliance

The system should retain the data needed for relevant Indian school reporting and generate export/report structures where feasible. Exact regulatory fields and workflows must be validated against current official requirements before implementation.

## 9. Out of Scope for the First Delivery

See the deferred list above. Any new feature added during the 8-week period must be approved as a scope change.

## 10. Acceptance Principle

A module is not "complete" because its pages exist. It is complete when its workflow, permissions, validation, persistence, error handling, tests, and basic documentation are working.
