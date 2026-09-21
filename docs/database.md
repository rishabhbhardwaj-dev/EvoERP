# EvoERP — Database Design

## 1. Database

**PostgreSQL** is the current proposal.

## 2. Multi-Tenant Strategy

Initial proposal:
- Shared database
- Tenant/school identifier on tenant-owned rows
- Strict server-side tenant scoping
- PostgreSQL Row-Level Security can be evaluated for defense in depth

## 3. Core Entities

### Tenant
- id
- name
- code
- domain/subdomain
- status
- created_at

### User
- id
- tenant_id
- name
- email/username
- password/auth reference
- status
- created_at

### Role
- id
- name
- tenant/system scope

### Permission
- id
- resource
- action
- scope

### Student
- id
- tenant_id
- admission_number
- name
- date_of_birth
- gender
- contact fields
- status

### Parent
- id
- tenant_id
- name
- contact fields

### StudentParent
- student_id
- parent_id
- relationship

### Teacher
- id
- tenant_id
- user_id
- employee_code
- department

### Class
- id
- tenant_id
- name
- academic_year_id

### Section
- id
- tenant_id
- class_id
- name

### Subject
- id
- tenant_id
- name
- code

### Enrollment
- student_id
- class_id
- section_id
- academic_year_id

### AttendanceSession
- id
- tenant_id
- class_id
- section_id
- date
- subject_id
- marked_by

### AttendanceRecord
- id
- session_id
- student_id
- status

### Exam
- id
- tenant_id
- name
- term
- academic_year_id

### ExamResult
- id
- tenant_id
- exam_id
- student_id
- subject_id
- marks
- grade

### FeeStructure
- id
- tenant_id
- class_id
- name
- amount
- due rules

### Invoice
- id
- tenant_id
- student_id
- invoice_number
- total
- due_date
- status

### Payment
- id
- tenant_id
- invoice_id
- amount
- method
- reference
- paid_at

### Notice
- id
- tenant_id
- title
- body
- audience
- published_at

### AuditLog
- id
- tenant_id
- actor_user_id
- action
- entity_type
- entity_id
- metadata
- created_at

## 4. Indexing Principles

At minimum consider indexes on:
- tenant_id
- tenant_id + date
- tenant_id + status
- admission_number within tenant
- invoice_number within tenant
- foreign-key columns

## 5. Constraints

- Foreign keys must enforce valid relationships.
- Unique identifiers should be scoped appropriately to a tenant.
- Money should use safe numeric/decimal types.
- Audit-sensitive records must not be silently hard-deleted.

## 6. Later Extensions

- HR/payroll entities
- inventory
- transport
- hostel
- library integration references
- LMS integration mapping
- AI document embeddings

## 7. Open Questions

- RLS mandatory or optional?
- Separate school DB/schema at scale?
- Soft delete policy?
- Audit retention period?
