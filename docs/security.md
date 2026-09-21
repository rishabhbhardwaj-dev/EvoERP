# EvoERP — Security

## 1. Authentication

Use a mature authentication mechanism. Do not implement password storage or session security from scratch unless required by the selected auth solution.

## 2. Authorization

Implement RBAC at the API/service layer. UI visibility is not a security boundary.

## 3. Tenant Isolation

Every tenant-scoped operation must verify the authenticated user's tenant context server-side.

## 4. Input Validation

Validate all external input with shared schemas.

## 5. Sensitive Data

- Do not log passwords, tokens, payment secrets, or sensitive student data unnecessarily.
- Encrypt secrets using environment/secret-management mechanisms.
- Apply least privilege to database and external integrations.

## 6. Audit Logging

Record sensitive actions such as:
- role changes
- grade changes
- fee adjustments
- payment changes
- student record changes
- permission changes

## 7. Web Security

- HTTPS in production
- Secure cookies/session settings
- CSRF strategy appropriate to auth architecture
- Rate limiting on sensitive endpoints
- Secure headers
- File upload validation

## 8. Backups

Document:
- frequency
- retention
- restore procedure
- ownership/access
