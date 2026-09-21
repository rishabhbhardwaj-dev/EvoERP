# EvoERP — API Design

## 1. API Style

REST API with JSON requests/responses.

Base path:

`/api/v1`

## 2. Conventions

- Authentication required except public auth endpoints.
- Server derives tenant context from authenticated session/domain.
- Never accept an arbitrary tenant_id from the client as an authority.
- Return consistent validation and error formats.
- Use pagination for large collections.
- Use ISO-8601 timestamps.
- Use stable resource IDs.

## 3. Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": {}
  }
}
```

## 4. Authentication

Planned endpoints:
- POST `/auth/login`
- POST `/auth/logout`
- POST `/auth/refresh` (if applicable)
- GET `/auth/me`

Exact authentication flow depends on the selected auth solution.

## 5. Users & Roles

- GET `/users`
- POST `/users`
- GET `/users/:id`
- PATCH `/users/:id`
- DELETE `/users/:id`
- GET `/roles`
- PUT `/users/:id/roles`

## 6. Students

- GET `/students`
- POST `/students`
- GET `/students/:id`
- PATCH `/students/:id`
- DELETE `/students/:id`

Filters:
- class
- section
- status
- search

## 7. Teachers

- GET `/teachers`
- POST `/teachers`
- GET `/teachers/:id`
- PATCH `/teachers/:id`

## 8. Classes / Sections / Subjects

- GET `/classes`
- POST `/classes`
- GET `/sections`
- POST `/sections`
- GET `/subjects`
- POST `/subjects`

## 9. Attendance

- POST `/attendance/sessions`
- POST `/attendance/sessions/:id/records`
- GET `/attendance`
- GET `/students/:id/attendance-summary`

## 10. Exams

- GET `/exams`
- POST `/exams`
- POST `/exams/:id/results`
- GET `/exams/:id/results`
- GET `/students/:id/report-card`

## 11. Fees

- GET `/fee-structures`
- POST `/fee-structures`
- GET `/invoices`
- POST `/invoices`
- GET `/invoices/:id`
- POST `/payments`
- GET `/payments/:id/receipt`

## 12. Notices

- GET `/notices`
- POST `/notices`
- PATCH `/notices/:id`
- DELETE `/notices/:id`

## 13. API Quality Requirements

For every endpoint document:
- purpose
- actor/permission
- request schema
- response schema
- validation
- errors
- pagination/filtering
- audit requirements

## 14. Future Integration Endpoints

Separate adapters should be created for:
- Moodle
- Koha
- FET
- Metabase
- payment providers
- notification providers
