# TASK-007 — Idea lifecycle API report

Date: 15 October 2026 (Asia/Kolkata). Branch: `task-007-idea-lifecycle-apis`, from merged main `3a3d42e7bd28137ef44b27e3afac6ef7feb97c39`.

**Status: approved API scope implemented and applicable automated/database validation complete; owner review pending.** TASK-007 is local only; no push, merge, deployment, signing, paid service, public beta or TASK-008 work.

## TASK-006 push and merge

Pushed `task-006-idea-project-domain` at `85299570d69fb18a2aba88bdecf0274c51535cdc`, opened [PR #5](https://github.com/Suneel-1996/entrcollab/pull/5), waited for successful push/PR validate and secrets jobs, and merged through the ordinary merge command pinned to that head SHA. Confirmed merge `3a3d42e7bd28137ef44b27e3afac6ef7feb97c39`. No check bypass/admin override. Existing policy/live/native limitations remain documented.

## Approved scope and resulting behavior

Owner explicitly approved owner-only create/list/edit, visibility-aware single reads and explicit publish/archive. Drafts/publications are editable; archives are read-only. Title required, other approved content optional. Publishing preserves visibility; permanent DELETE remains unavailable. This approved clarification governs the original generic CRUD wording.

Implemented six authenticated routes under `/api/v1`: POST `/ideas` (201); GET `/ideas` (owner-only bounded list); GET `/ideas/:id`; PUT `/ideas/:id` (full replacement); POST `/ideas/:id/publish`; POST `/ideas/:id/archive` (200). No discovery/member directory, mobile UI, PATCH, restore/unpublish, ownership transfer, hard deletion, team/join behavior or AI.

- Reuse verified Supabase issuer/signature/audience/expiry/provider and application identity through AuthService. Caller ownership/status never comes from client fields or metadata. Repository rechecks account state inside every transaction.
- Strict allowlisted content validation, required normalized title, bounded text/arrays, duplicate normalization, PRIVATE defaults, rejected nulls/unsupported controls/isolated surrogates and rejected owner/state/timestamp injection. Full PUT clears omitted optional fields and resets omitted visibility PRIVATE; clients must send what they intend to retain.
- Owner/member DTOs are explicit allowlists. Private draft/publication, archives, restricted owners and missing IDs share a generic 404 for other readers. Non-owner mutations also return generic 404 even when the publication is readable. No nested owner account/provider subject/email/status/hold/token is returned. Successful responses use no-store.
- DRAFT→PUBLISHED, DRAFT/PUBLISHED→ARCHIVED only. Repeated/terminal transitions and archive edits return 409. Publication never implicitly shares; archives remain owner-only regardless of stored sharing preference.
- Owner-only bounded keyset list, default 20/max 50; optional state filter and strict cursor validation/binding. Cursor is untrusted paging position, not authorization or a secret. No arbitrary owner query or global record lookup for cursor resolution.
- Transactional owner/target row locks and expected-status write predicates enforce current state under concurrent operations. Generic database errors become 503 without raw details.

Full [API contract](ideas/TASK-007-api.md) describes requests, projections, validation, errors, pagination and concurrency. Owner API approval is recorded in the task and decision register; TASK-006 policy remains unchanged.

## Concurrency regression found and fixed before commit

Initial full suite passed with 135 tests. Final review added a coordinated independent-writer regression: another PostgreSQL transaction locks/archives the record while publication is in flight. The pre-fix implementation locked only the owner row and reproduced an incorrect publication success (200 instead of expected 409), overwriting terminal archive state.

Fixed by locking the owned target row before reading its current state and adding owner/current-status predicates to updates. The regression now passes with 409 and preserved archive history. This was an uncommitted TASK-007 defect; no failing version was pushed/merged. No assertion was disabled or weakened. Final lint/typecheck/full tests/DB tests/API build were rerun after this source change.

## Exact commands and results

All commands from `/workspace/entrcollab`, existing Node 24/npm/PostgreSQL 17 development environment.

| Command | Result |
| --- | --- |
| `docker compose up -d --wait db` | PASS, retained local service healthy. |
| `npm run lint` | PASS, zero warnings; final rerun after row-lock fix. |
| `npm run typecheck` | PASS, API/mobile; final rerun after fix. |
| `npm test` | PASS, 56 API + 51 mobile tests on final source. |
| `npm run db:validate` | PASS, no schema changes. |
| `npm run db:deploy` | PASS, no pending migrations. |
| `npm exec -w @entrcollab/api -- prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` | PASS, no schema drift. TASK-006 CHECK semantics also remain covered by DB tests. |
| `npm run test:db` | PASS, 29 database tests on final source. |
| `npm --cache /workspace/.npm exec -w @entrcollab/api -- tsx --test --test-name-pattern='competing database writer' test/idea-api.database.test.ts` | Before fix FAIL exit 1, observed 200 vs expected 409. After fix PASS exit 0, one targeted regression test. |
| `CI=1 EXPO_NO_TELEMETRY=1 npm run build` | PASS, API build and Android/iOS Hermes exports before the API-only row-lock fix; mobile source unchanged afterwards. |
| `npm run build -w @entrcollab/api` | PASS on final source after row-lock fix. |
| `npm --cache /workspace/.npm audit --json` | FAIL security gate exit 1: existing 18 high / 7 moderate affected entries. Full fresh output saved. |
| `npm --cache /workspace/.npm audit --omit=dev --json` | FAIL security gate exit 1: same 18 high / 7 moderate. Full fresh output saved. |
| `docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.24.3 dir /repo --redact --exit-code 1` | PASS, no detected working-file leaks. |
| `git diff --check` | PASS. |

Mobile bytecode was disassembled for Android and iOS with `node_modules/hermes-compiler/hermesc/linux64-bin/hermesc -b -dump-bytecode <platform-hbc-path>` into `/tmp/task007-bundle-text/{android,ios}.txt`, checking each command and nonempty output. `docker run --rm -v /tmp/task007-bundle-text:/scan zricethezav/gitleaks:v8.24.3 dir /scan --redact --exit-code 1` passed with no detected leaks. Public Supabase configuration remains intentionally bundle-visible; no privileged secret was added. Scanner detection limits remain.

[Machine-readable validation](security/TASK-007/validation.json), complete audit JSON/metadata and scan logs are retained under `docs/security/TASK-007/`.

## Tests and live backend evidence

**136 tests passed, zero failures/skips**: 56 API, 51 mobile, 29 PostgreSQL. New TASK-007 tests: 5 input/service tests plus 13 integrated HTTP/JWT/Prisma/PostgreSQL tests. Providers use ephemeral ES256 keys/local test JWKS, not live Supabase/Google credentials. Randomized fixtures are cleaned up only within their subjects/owners; cleanup is not a product deletion feature.

Coverage includes all six routes' missing auth; valid owned authoring/read/full replacement; bounds/normalization/null/type/identity/state/time injection; exact read matrix/projections and sharing withdrawal; archived immutability/no restore/delete; owner-only listing and denied non-owner writes with spoofed user metadata; suspended/held caller/owner and stale pre-transaction auth state; invalid/expired/wrong signature/issuer/audience tokens and sensitive-error/log checks; generic database failure mapping across operations; one-success/seven-conflict publication race; archive races with publication/editing; competing database writer regression; bounded pages/status filters, owner isolation and malformed/cross-scope cursors.

Started final compiled backend using `NODE_USE_ENV_PROXY=1 HOST=127.0.0.1 PORT=3007 npm --cache /workspace/.npm run start -w @entrcollab/api`. Node fetch observed health/readiness 200, existing auth/me/profile/me without tokens 401, and every new idea route without tokens 401. This verifies final compiled module wiring and preserved health/security boundaries. Successful authenticated behavior is demonstrated through the real HTTP/database integration harness with mocked signing keys, not a real Google account.

## Security, cost and remaining limits

- Existing 18 high/7 moderate audit entries remain unsuppressed, from the same TASK-001 four advisories. No dependency/lockfile changes, force fixes, major upgrades or new risk acceptance. Restricted-development compensating controls and the PENDING APPROVAL exception remain in force. New content is bounded plain JSON/text; no untrusted glob/config merge, certificate signing or caller-controlled UUID output-buffer use was introduced.
- No new subscription, service, env requirement or network destination. Supabase Free remains approved. No purchases, deployment, production use, public beta, release signing or mobile idea UI.
- Owner writes serialize on parent and target rows. This favors correctness over throughput; content replacements use last serialized valid write wins, without optimistic versions. Paging is not a snapshot under concurrent edits. Member reads may finish after a later owner state/visibility change; subsequent reads observe the committed restriction.
- No API DELETE/erasure workflow, restore/unpublish, team/join policy, AI processing or PLAN-007 retention/consent/region/logging policy is invented. An archive retains data and is terminal/read-only under the approved scope, not a permanent-deletion implementation.
- TASK-002 real-provider/native authentication and TASK-004 native interactions remain unverified as documented; this task did not recheck dashboard credentials/configuration or claim real Google validation. Mocked cryptographic/HTTP/database tests do not establish production readiness.

## Commit and next step

TASK-007 local branch `task-007-idea-lifecycle-apis`; exact SHA supplied in the handoff or `git log -1 --format=%H -- docs/TASK-007-report.md`. No push/merge of TASK-007. Stop for owner review; TASK-008 requires separate authorization.

## Files changed

- `README.md`
- `apps/api/package.json`
- `apps/api/src/app.module.ts`
- `apps/api/src/ideas/idea.controller.ts`
- `apps/api/src/ideas/idea.input.ts`
- `apps/api/src/ideas/idea.module.ts`
- `apps/api/src/ideas/idea.repository.ts`
- `apps/api/src/ideas/idea.service.ts`
- `apps/api/test/idea-api.database.test.ts`
- `apps/api/test/idea.input.test.ts`
- `docs/TASK-007-report.md`
- `docs/architecture/DECISIONS_REGISTER.md`
- `docs/ideas/TASK-007-api.md`
- `docs/security/TASK-007/audit-full.json`
- `docs/security/TASK-007/audit-metadata.json`
- `docs/security/TASK-007/audit-production.json`
- `docs/security/TASK-007/bundle-secret-scan.txt`
- `docs/security/TASK-007/repository-secret-scan.txt`
- `docs/security/TASK-007/validation.json`
- `tasks/README.md`
- `tasks/TASK-007-idea-lifecycle-apis.md`
