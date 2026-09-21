# EvoERP — Architecture

## 1. Architecture Goal

Deliver a maintainable, modular ERP quickly enough for the 8-week internship while leaving room for future integrations and scale.

## 2. Initial Architecture Proposal

Use a **modular monolith** for the EvoERP core.

```text
Web Client
   |
Next.js Web App
   |
REST API
   |
+-----------------------------+
| EvoERP Modular Backend      |
|                             |
| Auth / RBAC                 |
| Tenant / School             |
| Student / Teacher           |
| Academic                    |
| Attendance                  |
| Exams                       |
| Fees                        |
| Parent                      |
| Notifications               |
| Reports                     |
| Audit                       |
+--------------+--------------+
               |
          PostgreSQL
               |
       Object/File Storage

External integrations:
- Moodle
- FET / timetable engine
- Koha
- Analytics/BI
- Future AI/RAG
```

## 3. Why Modular Monolith

- Faster to develop and debug.
- Easier local setup.
- Lower deployment overhead.
- Shared transactions and database are simpler.
- Modules can still have clear boundaries.

Microservices are a later option, not an MVP requirement.

## 4. Proposed Core Stack — Draft

- Frontend: Next.js + TypeScript
- UI: Tailwind CSS + shadcn/ui
- Backend: Node.js + TypeScript
- API: REST
- Database: PostgreSQL
- ORM: Prisma or Drizzle — **mentor approval required**
- Validation: Zod
- Auth: mature authentication solution — **exact choice pending**
- Storage: local in development; S3-compatible storage for production when needed
- Payments: Razorpay
- Charts: Recharts
- Containerization: Docker

## 5. Tenant Resolution

Tenant can be resolved from a trusted subdomain/domain mapping or authenticated tenant context. Client-provided tenant IDs must never be trusted without server-side authorization.

## 6. Module Boundaries

Each module should own:
- business rules
- API handlers/services
- validation
- database access layer
- permissions
- UI routes/components
- tests

## 7. Integration Boundary

External OSS systems should communicate through well-defined adapters/services rather than being copied into the EvoERP codebase.

## 8. Architecture Decisions Still Requiring Mentor Approval

- Exact backend framework
- ORM
- Authentication provider
- Deployment target
- Tenant isolation model
- Which integrations must be operational in the 8-week release
