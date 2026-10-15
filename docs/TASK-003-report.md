# TASK-003 — Profile domain and APIs completion report

Date: 15 October 2026 (Asia/Kolkata). Branch: `task-003-profile-domain`, based on TASK-002 follow-up commit `f8ba3a66cb1f2b277f18befe5c017eb5bd829ae0`.

**Status: implementation and applicable automated/database validation complete; awaiting owner review and acceptance.** The owner explicitly authorized TASK-003 and approved its recommended profile policy/fields, including development with mocked authentication while TASK-002 live-login blockers remain documented. This does not retroactively mark TASK-002 fully validated. No push, merge, deployment, paid service, public beta, release signing or TASK-004 work was performed.

## Implementation and approved policy

- Profile domain: display name, bio, skills, interests and availability, with independent PRIVATE/MEMBERS visibility. All fields default private; only an active verified owner edits. Only active signed-in users can read explicitly shared fields on active targets. Anonymous access and indexing remain disabled; email/provider identifiers stay private.
- APIs: GET `/api/v1/profiles/me`, PUT `/api/v1/profiles/me`, GET `/api/v1/profiles/:userId`. Ownership is derived from existing AuthService verification, never a body identifier. No profile list, mobile UI, discovery, AI, account deletion or retention behavior was added.
- Strict server validation rejects unknown keys, ownership/status injection, nulls/wrong types, invalid visibility, overlong text/lists, duplicate normalized tags and disallowed controls. PUT is full replacement: omitted optional content clears and omitted visibility becomes PRIVATE. Documentation makes this behavior explicit.
- Member output is an explicit allowlist of shared fields plus application UUID; no hidden-field placeholders, visibility settings, timestamps, provider identifiers or account-state internals. Private, missing, suspended and deletion-held targets produce identical generic 404 responses. Suspended/deletion-held callers receive existing 403 behavior. Database failures are generic 503. Successful responses use Cache-Control no-store.
- PostgreSQL: additive profile enum/table/PK/FK migration `202610150001_profiles`, per-field private defaults, one profile per application identity and timestamps. ON DELETE RESTRICT prevents unintended identity removal; it does not define a deletion workflow. No existing identity rows are changed by migration.
- Atomic replacement locks/rechecks the owner row in a transaction, then upserts. Concurrent creation yields one row; replacements cannot mix fields. Last serialized write wins; no optimistic version/If-Match behavior is claimed.

Policy approval is recorded in [PLAN-003](planning/PLAN-003-define-profile-and-idea-visibility-model.md), [ADR-003](architecture/ADR-003-profile-visibility.md) and the decision register. Only the profile portion of PLAN-003 is approved; idea visibility remains pending. [API documentation](profiles/TASK-003-api.md) contains request/response, validation, privacy and concurrency contracts.

## Commands and results

Commands ran from `/workspace/entrcollab`, using the existing Node 24/npm environment and local PostgreSQL 17 development database. No new dependency or environment variable was needed; package scripts now include profile tests. Dependencies/lockfile were not changed.

| Command | Result |
| --- | --- |
| `npm --cache /workspace/.npm run db:generate` | PASS; Prisma 6.19.3 generated profile types/client. |
| `docker compose up -d --wait db` | PASS; PostgreSQL healthy. |
| `npm --cache /workspace/.npm exec -w @entrcollab/api -- prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` | Initial FAIL: Prisma requires a shadow-database URL for migration-directory diff. No verification bypass or destructive retry. |
| `npm --cache /workspace/.npm exec -w @entrcollab/api -- prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > apps/api/prisma/migrations/202610150001_profiles/migration.sql` | PASS; generated additive SQL against the existing TASK-002 schema, inspected before deployment. |
| `npm run db:validate` | PASS. |
| `npm run db:deploy` | PASS; migration applied; repeated deployment reports no pending migrations. |
| `npm exec -w @entrcollab/api -- prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` | PASS; no schema difference. |
| `npm run lint` | PASS, zero warnings. |
| `npm run typecheck` | PASS, API/mobile. |
| `npm test` | PASS, 45 API + 27 mobile tests. |
| `npm run test:db` | PASS, 3 database tests. |
| `CI=1 EXPO_NO_TELEMETRY=1 npm run build` | PASS; compiled API and Android/iOS Hermes exports. No native device build or signing. |
| `npm --cache /workspace/.npm audit --json` | FAIL security gate, exit 1; 18 high / 7 moderate affected entries. Complete output retained. |
| `npm --cache /workspace/.npm audit --omit=dev --json` | FAIL security gate, exit 1; same 18 high / 7 moderate. Complete output retained. |
| `docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.24.3 dir /repo --redact --exit-code 1` | PASS; no secrets detected in working files. |
| `git diff --check` | PASS for tracked edits before staging. Generated, already-applied migration SQL retains Prisma's trailing blank line, which yields a staged whitespace warning; SQL is unchanged. |

Exported Hermes bytecode was disassembled for each `platform` in `android ios` with `node_modules/hermes-compiler/hermesc/linux64-bin/hermesc -b -dump-bytecode apps/mobile/dist/_expo/static/js/$platform/*.hbc > /tmp/task003-bundle-text/$platform.txt`, then scanned with `docker run --rm -v /tmp/task003-bundle-text:/scan zricethezav/gitleaks:v8.24.3 dir /scan --redact --exit-code 1`: PASS, no detected leaks. Public Supabase configuration is intentionally bundle-visible; no privileged secret belongs there. Secret scanners have detection limits.

## Test evidence

**75 tests passed, zero failures/skips** (45 API, 27 mobile, 3 PostgreSQL). New profile tests account for 16 API tests plus 1 database test; existing TASK-001/TASK-002 suites remain passing.

Profile API tests use the real AuthService/controller/service with mocked provider verification and identity/profile persistence. They cover missing/invalid auth across every route; private defaults; normalized create/return/replace; absent profiles; all-private/missing indistinguishability; each field's allowlisted member projection; owner-only metadata; immediate sharing withdrawal; ID/role/status/unknown-field injection; invalid types/nulls/visibility/limits/control characters/duplicate tags; accepted Unicode boundaries; suspended/deletion-held callers; generic database errors without sensitive response/log leakage; invalid target identifiers.

The PostgreSQL repository test uses randomized fixtures and real migration/model queries. It runs 12 concurrent first writes, checks one row and unmixed field values, validates uniqueness/FK restrictions, filters suspended/deletion-held targets, rejects writes under either restriction, confirms replacement/private defaults and timestamps, and removes only its own fixture. Existing identity concurrency and unreachable-database tests also pass. Test cleanup is not a product deletion feature.

Machine-readable [validation results](security/TASK-003/validation.json), [audit metadata](security/TASK-003/audit-metadata.json), complete audit JSON and secret-scan logs are retained in `docs/security/TASK-003/`.

## Running compiled backend checks

Started `NODE_USE_ENV_PROXY=1 PORT=3004 npm --cache /workspace/.npm run start -w @entrcollab/api`. Node's startup proxy flag preserves the existing managed HTTPS proxy behavior. Node fetch requests exercised the compiled module wiring:

| Request | Observed |
| --- | --- |
| GET `/api/v1/health` | 200 |
| GET `/api/v1/health/ready` | 200 |
| GET `/api/v1/auth/me`, no token | 401 |
| GET `/api/v1/profiles/me`, no token | 401 |
| PUT `/api/v1/profiles/me`, JSON displayName, no token | 401 |
| GET `/api/v1/profiles/11111111-1111-4111-8111-111111111111`, no token | 401 |

Successful authenticated profile behavior was exercised through mocked-provider HTTP tests and real-database repository tests, not a real Google account. No live tokens or OTP messages were created.

## Security, cost and remaining limitations

- Full/production audit counts remain 18 high/7 moderate, tracing to the same four TASK-001 advisories: GHSA-vfj7-8cjw-p6xm, GHSA-ggr8-5vv4-36mx, GHSA-86w9-cpqp-85rv and GHSA-w5hq-g745-h8pq. No dependency changes, force fixes, major upgrades, suppression or new risk acceptance. Existing proposed exception remains PENDING APPROVAL and restricted-development controls remain in force. See [TASK-001 review](TASK-001-security-review.md).
- No subscription/service/network-destination additions or purchases. Supabase Free remains the approved provider; public endpoints cannot confirm project billing settings. No deployment/signing/public beta/production use is authorized.
- TASK-002 real Google sign-in, native callback/storage/session checks and a successful real-token `/auth/me` remain unverified because Google was disabled and supplied API configuration invalid at the last check. This task uses the explicitly approved mocked development boundary; it does not resolve or hide those blockers. See [TASK-002 report](TASK-002-report.md).
- UUIDs are not treated as authorization. Member sharing grants access to any active signed-in user, not a future team/connection relationship. Blocking, discovery, public/unlisted/idea visibility, mobile profile UI, retention and irreversible deletion policies remain outside TASK-003.
- Reads check account state at request time; a state change during an in-flight read does not retroactively cancel it. Writes additionally recheck/lock the owner identity. Concurrent writes deliberately use last serialized replacement wins. There is no optimistic-edit conflict UI or cache/index to invalidate.
- SQL migration was inspected as additive and applied only to the local development database; owner acceptance is not implied. Diff review excludes generated bundles, node_modules, `.env` files, unrelated product changes and credentials.

## Commit and next step

Changes are local on `task-003-profile-domain`. Obtain the implementation/report commit with `git log -1 --format=%H -- docs/TASK-003-report.md`; the exact SHA is returned in the handoff. The branch also contains the initial contract-proposal commit `248dda4`. Stop for owner review; no push, merge or TASK-004 without further authorization.

## Files changed

- `README.md`
- `apps/api/package.json`
- `apps/api/prisma/migrations/202610150001_profiles/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/profiles/profile.controller.ts`
- `apps/api/src/profiles/profile.input.ts`
- `apps/api/src/profiles/profile.module.ts`
- `apps/api/src/profiles/profile.repository.ts`
- `apps/api/src/profiles/profile.service.ts`
- `apps/api/test/profile.database.test.ts`
- `apps/api/test/profile.test.ts`
- `docs/TASK-003-report.md`
- `docs/architecture/ADR-003-profile-visibility.md`
- `docs/architecture/DECISIONS_REGISTER.md`
- `docs/planning/PLAN-003-define-profile-and-idea-visibility-model.md`
- `docs/profiles/TASK-003-api.md`
- `docs/proposals/TASK-003-profile-contract.md`
- `docs/security/TASK-003/audit-full.json`
- `docs/security/TASK-003/audit-metadata.json`
- `docs/security/TASK-003/audit-production.json`
- `docs/security/TASK-003/bundle-secret-scan.txt`
- `docs/security/TASK-003/repository-secret-scan.txt`
- `docs/security/TASK-003/validation.json`
- `tasks/TASK-003-profile-domain-and-apis.md`
