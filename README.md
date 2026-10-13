# EntrCollab

Mobile-first collaboration platform. TASK-001 provides its engineering foundation. TASK-002 adds restricted-development authentication; other product features and unresolved lifecycle policies remain out of scope.

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

The sample database credentials are for local development only. PostgreSQL is bound to loopback and its Compose volume survives container restarts. Stop with `docker compose down`; adding `-v` deletes local database data. TASK-002 adds the minimal ApplicationUser identity table and a reviewed migration. `db:deploy` applies pending migrations; never reset or drop an existing database during setup.

## Run

```sh
npm run dev:api
# In another terminal:
npm run dev:mobile
```

The API reads `apps/api/.env` because its workspace command runs there. It defaults to loopback port 3000. `GET /api/v1/health` returns `200 {"status":"ok"}` for liveness; `GET /api/v1/health/ready` queries PostgreSQL and returns 200 when available or `503 {"status":"unavailable"}` without database details. Both endpoints are intentionally public, contain no personal data, and perform no writes. Other routes return 404. Invalid configuration prevents startup.

Expo displays Google sign-in and, only when enabled, development email OTP. See [authentication setup](docs/auth/TASK-002-authentication.md) for configuration, native development builds and callback allowlisting. Use a native development build compatible with SDK 57 (custom OAuth callbacks require more than Expo Go); native device/simulator testing requires a device or emulator and is separate from the CI bundle export. For a physical device, localhost refers to the device: any future API connectivity must use a reachable development host and an explicit API bind address. Never put secret keys in `EXPO_PUBLIC_*` variables. The mobile env example names required public configuration; authenticated requests call /api/v1/auth/me.

## Verification and CI

Unit/HTTP tests cover health success, database failure, unsupported routes/methods, and configuration rejection. The separate database integration test requires a real running PostgreSQL instance. `npm run build` compiles the API and exports both Android and iOS JS bundles; it does not produce signed native binaries. GitHub Actions runs the same checks with a PostgreSQL service and Gitleaks scans repository history. TASK-002 includes verified-token, account-state and concurrent identity-provisioning tests. All automated provider operations are mocked; live settings and device validation are reported separately.

See `docs/architecture/`, `tasks/`, and `prompts/CODING_AGENT_RULES.md` for boundaries and the owner acceptance process.

Cloud environment: allow `binaries.prisma.sh` for Prisma engine downloads and keep checksum/TLS verification enabled. Set `npm_config_cache=/workspace/.npm` and `EXPO_NO_TELEMETRY=1` when the default home directory is read-only. See [TASK-001 report](docs/TASK-001-report.md) for verification and dependency-audit limitations.

TASK-002: [report](docs/TASK-002-report.md), [authentication contract](docs/auth/TASK-002-authentication.md), [lifecycle policies](docs/auth/TASK-002-account-lifecycle.md), [Free-plan controls](docs/auth/TASK-002-cost-controls.md). In this cloud, start the API with `NODE_USE_ENV_PROXY=1 npm run dev:api` so Node honors the managed HTTPS proxy.
