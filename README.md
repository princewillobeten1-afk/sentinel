# Project Sentinel

## Infrastructure

### Docker

- `Dockerfile` builds a production-ready image
- `.dockerignore` excludes local artifacts
- `docker-compose.yml` starts the app with a local Postgres service
- `docker-compose.dev.yml` starts the app in hot-reload development mode

### Local development

1. Copy `.env.local.example` to `.env.local`
2. Set `DATABASE_URL` and secrets
3. Run locally:
   - `npm install`
   - `npm run dev`

### CI/CD

GitHub Actions workflow is configured in `.github/workflows/ci.yml`.
It installs dependencies, runs `npm run lint`, and builds the app.

### Environment separation

- `.env.local` for local environment variables
- `.env.production` for production secrets
- `docker-compose.yml` uses production-style values
- `docker-compose.dev.yml` uses development values and mounts source code

### Secrets handling

- Do not commit `.env.local` or `.env.production`
- Use GitHub Secrets for CI/CD values such as `DATABASE_URL` and `AUTH_JWT_SECRET`
- Use a secrets manager in production (AWS Secrets Manager, Azure Key Vault, etc.)

### Health checks

- `GET /api/v1/health` returns uptime and status
- Docker `HEALTHCHECK` probes `/api/v1/health`

### Observability

- `lib/server/logger.ts` centralizes structured logs
- errors are captured and returned in `lib/server/api.ts`
- the app emits JSON logs with timestamps and severity levels
