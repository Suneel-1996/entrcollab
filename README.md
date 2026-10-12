# EntrCollab

Mobile-first collaboration platform. TASK-001 implements only its engineering foundation; product features and pending policies remain out of scope.

## Prerequisites

Node 24 (see `.nvmrc`), npm 11, Docker with Compose, and Git. Use the existing checkout in isolated cloud tasks; a Git worktree is unnecessary.

## Install and validate

Run from the repository root:

```sh
npm ci
test -e apps/api/.env || cp apps/api/.env.example apps/api/.env
npm run db:generate
npm run db:validate
docker compose up -d --wait db
npm run db:deploy
npm run lint
npm run typecheck
npm test
npm run test:db
EXPO_NO_TELEMETRY=1 npm run build
```

The sample database credentials are for local development only. PostgreSQL is bound to loopback and its Compose volume survives container restarts. Stop with `docker compose down`; adding `-v` deletes local database data. No product tables or migrations are introduced; Prisma generation uses its supported `--allow-no-models` option. `db:deploy` validates the migration deployment path; future approved domain tasks supply migrations.

## Run

```sh
npm run dev:api
# In another terminal:
npm run dev:mobile
```

The API reads `apps/api/.env` because its workspace command runs there. It defaults to loopback port 3000. `GET /api/v1/health` returns `200 {"status":"ok"}` for liveness; `GET /api/v1/health/ready` queries PostgreSQL and returns 200 when available or `503 {"status":"unavailable"}` without database details. Both endpoints are intentionally public, contain no personal data, and perform no writes. Other routes return 404. Invalid configuration prevents startup.

Expo displays a foundation screen only. Use Expo Go or development tooling compatible with SDK 57; native device/simulator testing requires a device or emulator and is separate from the CI bundle export. For a physical device, localhost refers to the device: any future API connectivity must use a reachable development host and an explicit API bind address. Never put secret keys in `EXPO_PUBLIC_*` variables. The mobile env example documents future public configuration; the scaffold makes no API calls.

## Verification and CI

Unit/HTTP tests cover health success, database failure, unsupported routes/methods, and configuration rejection. The separate database integration test requires a real running PostgreSQL instance. `npm run build` compiles the API and exports both Android and iOS JS bundles; it does not produce signed native binaries. GitHub Actions runs the same checks with a PostgreSQL service and Gitleaks scans repository history. No authentication or permission model is introduced, so authorization/concurrency feature tests belong to later approved tasks.

See `docs/architecture/`, `tasks/`, and `prompts/CODING_AGENT_RULES.md` for boundaries and the owner acceptance process.

Cloud environment: allow `binaries.prisma.sh` for Prisma engine downloads and keep checksum/TLS verification enabled. Set `npm_config_cache=/workspace/.npm` and `EXPO_NO_TELEMETRY=1` when the default home directory is read-only. See [TASK-001 report](docs/TASK-001-report.md) for verification and dependency-audit limitations.
