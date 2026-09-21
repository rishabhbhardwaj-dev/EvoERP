# EvoERP — Testing Strategy

## 1. Test Levels

### Unit
Business logic and utilities.

### Integration
API + database + authorization.

### End-to-End
Critical user workflows.

### Acceptance
Mentor-approved module acceptance criteria.

## 2. Critical End-to-End Flows

1. Admin login
2. Create school/user
3. Create student
4. Assign class/section
5. Teacher marks attendance
6. Parent views attendance
7. Create fee invoice
8. Record payment
9. Generate receipt
10. Enter exam marks
11. Parent views grades

## 3. Security Tests

- cross-tenant access attempts
- unauthorized role access
- invalid IDs
- privilege escalation
- session handling

## 4. Regression

Every completed sprint/module should preserve previously working core workflows.

## 5. Definition of Done

Code + validation + permissions + persistence + tests + documentation + reviewed UI states.
