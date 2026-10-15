# TASK-009 — Idea visibility enforcement verification

Date: 15 October 2026 (Asia/Kolkata). Branch: `task-009-idea-visibility-tests`, based on merged main `2727c95a2e0937a40be9892bb96fdfd5f352087c`.

**Status: approved-policy verification complete; owner acceptance pending.** Seven new real HTTP/JWT/Prisma/PostgreSQL tests passed with the full 163-test suite. No application behavior changes were needed. TASK-009 is committed locally only; no push/merge, deployment, release signing, paid service, public beta or TASK-010 work.

## TASK-008 push/merge

Pushed `task-008-mobile-ideas` at `be90cd3536436b2c097cdbad34965a98b6336a48`, opened [PR #7](https://github.com/Suneel-1996/entrcollab/pull/7), observed successful validate/secrets jobs for both push and PR, and merged using the ordinary merge command pinned to the head SHA. Confirmed merge commit `2727c95a2e0937a40be9892bb96fdfd5f352087c`. No admin/check bypass. Created TASK-009 branch from freshly fetched merged main.

## Scope and findings

The owner authorized completion of TASK-009. Its original generic public/unlisted/unpublished wording does not supersede the approved PLAN-003 / ADR-004 policy. Verification covers PRIVATE/MEMBERS × DRAFT/PUBLISHED/ARCHIVED and confirms unsupported public/unlisted/unpublish/restore/delete interfaces remain rejected or absent. No new policy was invented or implemented.

Added `apps/api/test/idea-visibility.database.test.ts` and registered it in the existing API `test:db` script, which the current CI already runs. The new suite uses the real Nest controllers, auth/token verifier, services, repositories, Prisma and local PostgreSQL. It uses ephemeral local ES256 keys/JWKS and fictional `.invalid` provider configuration, not live credentials. Randomized subject-scoped fixture cleanup touches only test data and is not a product deletion feature.

Coverage:

- Full six-combination read matrix for owner, two independent active members and anonymous callers; exact owner/member projections, successful no-store responses and identical hidden/missing error bodies.
- Caller/owner ACTIVE/SUSPENDED/HOLD combinations across all six record combinations (54 member cases), plus owner read/list checks. Already-issued JWTs do not reactivate restricted identities or alter stored idea state.
- Owner-only all/status-filtered lists and every one-row cursor page, empty other-owner lists even when shared publications exist, cross-owner cursor rejection and forged caller-scoped foreign-row positions unable to bypass SQL ownership. Rejected query hints do not create discovery.
- Non-owner PUT/publish/archive denial for every state/visibility, including readable publications, with metadata/header/query spoof attempts and unchanged database assertions.
- Explicit sharing withdrawal/re-enable, published archive and direct draft archive. Both members lose subsequent conditional GET access, including a prior ETag or If-None-Match `*`; archives preserve owner content/history.
- PUBLIC/UNLISTED/UNPUBLISHED, unpublish/restore/share action, PATCH and DELETE rejection/absence with unchanged rows/counts.
- Missing/malformed/expired/wrong-signature/wrong-issuer/wrong-audience credentials on all six endpoints, no writes, generic error responses and no tokens/provider subjects/private content in collected logs.

Existing TASK-007 serialization/archive races, independent-writer regression, validation and database-failure mapping remain green. Existing mobile auth/profile/idea recovery tests remain green. See [matrix, boundary contract and test inventory](ideas/TASK-009-visibility-verification.md).

## Exact commands and results

Executed from `/workspace/entrcollab`, Node 24, local PostgreSQL 17. [Machine-readable results](security/TASK-009/validation.json), command logs, complete audits and scan evidence are retained under `docs/security/TASK-009/`.

| Command | Result |
| --- | --- |
| `npm exec -w @entrcollab/api -- tsx --test test/idea-visibility.database.test.ts` | Initial attempt FAIL exit 1: seven beforeEach fixture logins returned 503 while PostgreSQL was stopped (`docker compose ps` showed no running service). After starting DB and applying migration checks: PASS, seven tests, zero failures/skips. No product fix or assertion change. |
| `docker compose up -d --wait db` | PASS, development database healthy. |
| `npm run db:deploy` | PASS, three existing migrations, none pending. Rerun in final verification. |
| `npm run db:validate` | PASS. |
| `npm exec -w @entrcollab/api -- prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` | PASS, no schema drift. |
| `npm run lint` | PASS, zero warnings. |
| `npm run typecheck` | PASS, API and mobile. |
| `npm test` | PASS, 56 API + 71 mobile tests. |
| `npm run test:db` | PASS, 36 PostgreSQL/HTTP tests, including seven new TASK-009 tests and existing races. |
| `CI=1 EXPO_NO_TELEMETRY=1 npm run build` | PASS, API build and Android/iOS Hermes exports. No signing or deployment. |
| `npm --cache /workspace/.npm audit --json` | FAIL security gate exit 1: existing 18 high / 7 moderate affected entries. Complete fresh output saved. |
| `npm --cache /workspace/.npm audit --omit=dev --json` | FAIL security gate exit 1: same 18 high / 7 moderate. Complete fresh output saved. |
| `docker run --rm -v /workspace/entrcollab:/repo zricethezav/gitleaks:v8.24.3 dir /repo --redact --exit-code 1` | PASS, no detected working-file secrets. |
| `docker run --rm -v /tmp/task009-bundle-text:/scan zricethezav/gitleaks:v8.24.3 dir /scan --redact --exit-code 1` | PASS, no detected secrets in disassembled Android/iOS bundles. |
| `git diff --check` and staged diff check | PASS. |

Each final platform export was disassembled with `node_modules/hermes-compiler/hermesc/linux64-bin/hermesc -b -dump-bytecode <platform-hbc-path>` into `/tmp/task009-bundle-text/{android,ios}.txt`, asserting successful exit and nonempty output before scanning. Exported binaries are ignored, not committed. Public mobile configuration is intentionally bundle-visible; scanners have detection limits.

**Final tests: 163 passed, zero failed/skipped (56 API, 71 mobile, 36 database).** The new HTTP server uses localhost/ephemeral ports and mocked signing keys with a real development database; this is live local HTTP/database validation, not live Supabase/Google login.

## Security, cost and residual limits

- Existing four underlying advisories remain unsuppressed: braces GHSA-vfj7-8cjw-p6xm; deepmerge-ts GHSA-ggr8-5vv4-36mx; node-forge GHSA-86w9-cpqp-85rv; uuid GHSA-w5hq-g745-h8pq. Both fresh audits retain 18 high/7 moderate affected entries. No dependency/lockfile changes, force fix or major upgrade. TASK-001 proposed exception remains **PENDING APPROVAL**, expiry 11 November 2026; push/merge does not approve it. Restricted-development controls remain mandatory; no production/release/signing/public-beta authorization.
- No schema, migration, runtime application logic, mobile feature, env requirement, network destination or service subscription change. Supabase Free-only/no-purchase restrictions remain. CI automatically includes the new test file through the existing script; TASK-009 itself has not been pushed or run in remote CI.
- Tests verify the current contract; they do not prove absence of every vulnerability. In-flight reads may finish from visibility state observed before a later change commits. Subsequent reads enforce the committed restriction; previously seen content cannot be recalled. Paging is not a frozen snapshot. Existing last-serialized-write semantics remain.
- TASK-002 live Google/native configuration and TASK-008 native interaction limitations remain; no device/emulator/live-provider validation was claimed or performed in this verification task. No production-readiness claim. Public/unlisted/unpublish/restore/erasure, retention, identity linking, team/join and AI policies remain deferred.

## Commit and review

Local branch `task-009-idea-visibility-tests`. Exact commit SHA is supplied in the handoff or `git log -1 --format=%H -- docs/TASK-009-report.md`. No push/merge of TASK-009. Stop and await owner review; TASK-010 was not started.

## Files changed

- `README.md`
- `apps/api/package.json`
- `apps/api/test/idea-visibility.database.test.ts`
- `docs/TASK-009-report.md`
- `docs/architecture/DECISIONS_REGISTER.md`
- `docs/ideas/TASK-009-visibility-verification.md`
- `docs/planning/PLAN-003-define-profile-and-idea-visibility-model.md`
- `docs/security/TASK-009/audit-full.json`
- `docs/security/TASK-009/audit-metadata.json`
- `docs/security/TASK-009/audit-production.json`
- `docs/security/TASK-009/build.txt`
- `docs/security/TASK-009/bundle-scan.txt`
- `docs/security/TASK-009/database.txt`
- `docs/security/TASK-009/drift.txt`
- `docs/security/TASK-009/lint.txt`
- `docs/security/TASK-009/migrations.txt`
- `docs/security/TASK-009/repository-scan.txt`
- `docs/security/TASK-009/schema.txt`
- `docs/security/TASK-009/tests.txt`
- `docs/security/TASK-009/types.txt`
- `docs/security/TASK-009/validation.json`
- `tasks/README.md`
- `tasks/TASK-009-idea-visibility-enforcement-tests.md`
