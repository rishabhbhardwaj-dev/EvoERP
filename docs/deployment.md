# EvoERP — Deployment

## Environments

- Local development
- Staging/demo
- Production

## Local

Recommended:
- Node.js
- PostgreSQL
- Docker as needed
- `.env` from `.env.example`

## Production

Initial deployment should prefer a simple managed/VPS setup rather than a complex Kubernetes architecture.

Expected components:
- Web frontend
- API
- PostgreSQL
- object/file storage when needed
- reverse proxy/HTTPS
- backup process

## CI/CD

Initial pipeline:
1. install
2. lint
3. type-check
4. tests
5. build
6. deploy staging
7. manual production approval

## Backups

Document:
- DB backup frequency
- storage backup
- restore verification
- retention

## Monitoring

At minimum:
- application errors
- uptime
- DB health
- storage usage
- failed jobs
