# EvoERP — Open-Source Evaluation

## Purpose

Record the open-source systems that EvoERP will study, integrate, or selectively reuse.

This document must be updated only after checking current official repositories/documentation and licenses.

## Decision Categories

- **INTEGRATE** — use as a separate system/service through a supported interface.
- **REUSE COMPONENT** — reuse a library/component where license and architecture permit.
- **STUDY ONLY** — use for workflows, data-model ideas, UX patterns and edge cases.
- **DEFER** — useful later, not required for the 8-week release.
- **AVOID** — poor fit, unacceptable licensing, stale project, or excessive integration cost.

## Initial Candidate Register

| Project | Area | Initial role | Evidence to verify |
|---|---|---|---|
| ERPNext / Frappe Education | ERP / education | Study | Repo, docs, release/activity, license |
| Fedena | School ERP | Study | Repo health, license, workflow relevance |
| OpenSIS | SIS | Study | Current status, license, data model |
| Moodle | LMS | Possible integration | API/plugin model, license, deployment |
| OrangeHRM | HR/Payroll | Study / possible integration | Current repo, modules, licensing |
| Koha | Library | Possible integration | API, deployment, licensing |
| FET | Timetable | Study / possible service | CLI/API/integration practicality |
| Metabase / Superset | Analytics | Possible integration | Embedding, license, deployment |
| Keycloak / mature auth | IAM/RBAC | Evaluate | Complexity vs MVP benefit |
| Ollama + RAG tooling | AI | Future integration | Model support, deployment, licensing |

## Evaluation Fields

For every serious candidate record:
- Canonical official repository
- Official documentation
- License
- Current maintenance/activity
- Recent meaningful release/update
- Language/framework
- Database
- Architecture
- Relevant modules
- Extension/plugin mechanism
- APIs/integration options
- Deployment complexity
- Documentation quality
- Community/ecosystem
- EvoERP fit
- Decision
- Reason
- Risks

## Important

Do not copy source code into EvoERP until the licensing and technical fit are reviewed in the dedicated license decision process.
