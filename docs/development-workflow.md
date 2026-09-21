# EvoERP — Development Workflow

## Branches

- `main` — stable
- `develop` — integration
- `feature/<name>` — feature work
- `fix/<name>` — bug fixes

## Feature Flow

Requirements
→ design
→ issue/task
→ branch
→ implementation
→ tests
→ PR/review
→ merge
→ staging
→ acceptance
→ release

## Commit Style

Use clear messages such as:
- `feat(attendance): add attendance session creation`
- `fix(fees): prevent duplicate payment`
- `docs(api): document student endpoints`

## Code Review Checklist

- requirement satisfied
- permissions checked
- tenant isolation checked
- validation present
- tests present
- no secrets
- no unnecessary dependency
- docs updated

## AI-Assisted Development Rule

AI may assist with implementation, tests, refactoring and documentation, but every generated change must be reviewed against:
- requirements
- architecture
- security
- data model
- acceptance criteria
