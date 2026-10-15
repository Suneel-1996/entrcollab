# TASK-008 — Owner mobile idea authoring

Date: 15 October 2026. Branch: `task-008-mobile-ideas`, from merged main `f2760ddc1f83696e631fe3c9d4c50c4f3c940d23`.

**Status: approved mobile scope implemented; automated validation passed; native device interaction/live Google login remain unverified. Owner review pending.** TASK-008 is committed locally only. No push/merge of this task, deployment, signing, purchase, public beta or TASK-009 work.

## TASK-007 handoff

Pushed `task-007-idea-lifecycle-apis` at `da80405e7c1ef41178dbbadef7aa763f08777026`, opened [PR #6](https://github.com/Suneel-1996/entrcollab/pull/6), observed successful validate/secrets checks on push and PR, and merged through the normal merge command pinned to that head. Confirmed merge commit `f2760ddc1f83696e631fe3c9d4c50c4f3c940d23`. No admin/check bypass. TASK-008 branched from the freshly fetched merged main, not the stale local tracking ref.

## Implementation and approved policy

Owner explicitly approved Profile/My Ideas navigation; owner-only paginated list/detail; private draft creation/editing; Save opening detail; confirmations before publish/archive/sharing a publication/dirty discard; read-only archives. Discovery, public links and DELETE remain excluded.

- Added an authenticated workspace preserving initial profile setup/summary. Both tabs remain available without requiring profile completion. Tab changes guard dirty drafts; unmounted screens clear their memory. Existing session gate hides the whole workspace during revalidation and resets it on logout/account change/re-login. Workspace sign-out callbacks are bound to their account and mounted lifetime.
- Added owner idea list, All/Draft/Published/Archived filters, empty/loading/error/refresh/Load more states, owner detail and full-contract create/edit forms. Skills/tags remain individual entries. Local limits, Unicode/control validation and normalized duplicate checks match TASK-007. Drafts start PRIVATE and saving never publishes.
- Published member-visible edits require explicit confirmation; publish confirms effective audience and keeps visibility; archive confirms terminal read-only/private state. Only current server-confirmed state drives controls. No archive restore, unpublish, erasure or unapproved identity/team behavior.
- Added a fixed-route authenticated transport through the existing secure Supabase session and bounded fetch. Tokens are never component state, navigation parameters or logs. It rechecks authenticated account and expiry after token retrieval. Owner DTO validation rejects wrong-owner, malformed/member-only responses and copies only allowlisted fields.
- Controller blocks duplicate writes/confirmation, ignores responses after disposal and clears private data on 401/403. Generic failures never expose server details. Ambiguous creation disables resubmission until the user checks My Ideas and explicitly acknowledges duplicate risk; local draft remains available. Ambiguous updates/actions require a fresh saved-state read before more mutations. Dirty reload/discard is confirmed. There are no automatic POST retries, background queues, optimistic state claims or persistent drafts.

[Flow and recovery contract](mobile/TASK-008-idea-flow.md) includes manual development checks. PLAN-002, task index, decision register and README record the limited approval. No API/database/schema/dependency/lockfile/environment changes were needed.

## Regression found during final review

The initial transport used `URLSearchParams.size`. Node supports it, but the installed native `whatwg-url-without-unicode` polyfill does not. A targeted test using that actual dependency reproduced loss of status/cursor query parameters (exit 1). Replaced the check with `toString()` and a nonempty-string test. The regression and final full suite pass; API/mobile type checks, lint and both exports were rerun. No failed version was committed/pushed and no assertion was weakened.

## Exact commands and results

Commands ran from `/workspace/entrcollab` using the existing Node 24/PostgreSQL 17 environment. Machine-readable results, complete audit output, check logs and scans are under [security/TASK-008](security/TASK-008/validation.json).

| Command | Result |
| --- | --- |
| `docker compose up -d --wait db` | PASS, local PostgreSQL healthy. |
| `npm run lint` | PASS, zero warnings, final source. |
| `npm run typecheck` | PASS, API/mobile, final source. |
| `npm test` | PASS, 56 API + 71 mobile tests, final source. |
| `npm run db:validate` | PASS. |
| `npm run db:deploy` | PASS, three existing migrations, none pending. |
| `npm exec -w @entrcollab/api -- prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` | PASS, no drift. |
| `npm run test:db` | PASS, 29 existing PostgreSQL/HTTP authorization/lifecycle tests. Backend unchanged. |
| `CI=1 EXPO_NO_TELEMETRY=1 npm run build` | PASS, API build and Android/iOS Hermes exports, final source. |
| `npm exec -w @entrcollab/mobile -- tsx --test --test-name-pattern='native URLSearchParams' test/ideas.test.ts` | Before fix FAIL, 1 reproduced regression; included in passing final suite after fix. |
| `npm --cache /workspace/.npm audit --json` | FAIL security gate, exit 1: existing 18 high / 7 moderate. |
| `npm --cache /workspace/.npm audit --omit=dev --json` | FAIL security gate, exit 1: same 18 high / 7 moderate. |
| `docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.24.3 dir /repo --redact --exit-code 1` | PASS, no detected working-file leaks. |
| `docker run --rm -v /tmp/task008-bundle-text:/scan zricethezav/gitleaks:v8.24.3 dir /scan --redact --exit-code 1` | PASS, no detected leaks in disassembled Android/iOS exports. |
| `git diff --check` and staged diff check | PASS. |

Hermes command for each final platform export: `node_modules/hermes-compiler/hermesc/linux64-bin/hermesc -b -dump-bytecode <platform-hbc-path>`, with successful exit and nonempty output checked before scanning. Generated binaries/build output remain ignored and uncommitted. Scanner results have detection limits; public mobile configuration is intentionally bundle-visible.

Started compiled backend with `NODE_USE_ENV_PROXY=1 HOST=127.0.0.1 PORT=3008 npm --cache /workspace/.npm run start -w @entrcollab/api`. Node fetch asserted health/readiness 200; auth/me/profile/me and all six idea routes returned 401 without tokens. [Smoke results](security/TASK-008/backend-smoke.json) preserve methods, paths, expected/actual status. Stopped the backend process started for this check. Successful authenticated behavior is covered by existing HTTP/JWT/PostgreSQL tests with mocked signing keys; this is not a real Google account login.

## Tests and limits

**156 tests passed; zero failures/skips on final source: API 56, mobile 71, database 29.** Twenty new mobile tests cover private defaults/validation, Unicode/polyfill compatibility, create/edit/detail, owner DTO isolation/allowlisting, publication sharing confirmation/cancel/double-submit, archive immutability, pagination/dedup/filter reset/retry/malformed cursors, ambiguous creates/updates/actions, draft retention, 401/403 clearing, missing details, stale responses/unmount and authenticated fixed-route token/expiry/account checks. Existing auth/profile and real server/database checks remain green.

No Android emulator/device, iOS simulator or native interaction runner is available (`adb`/`xcrun` absent). Automated controller/transport tests and exports do not establish screen-reader focus, Alert/back/keyboard/layout behavior or real device taps. The flow contract lists required manual restricted-development checks. No rendered UI test suite was added.

TASK-002 real Google/native configuration validation remains a blocker for a live signed-in device demonstration; this task did not recheck or invent project credentials, provider configuration, redirect URI or a reachable development API URL. Mocked tests are not claimed as live integration. Supabase billing plan cannot be verified from these checks; Free-only and no-purchase rules remain.

## Residual security/operational risks

- Fresh full/production audits have the same four underlying advisories as TASK-001/TASK-007 (braces GHSA-vfj7-8cjw-p6xm, deepmerge-ts GHSA-ggr8-5vv4-36mx, node-forge GHSA-86w9-cpqp-85rv, uuid GHSA-w5hq-g745-h8pq). Findings are unsuppressed; no force fix, major upgrade or new dependency. The proposed TASK-001 exception remains **PENDING APPROVAL**, expiring 11 November 2026; merges do not grant it approval. Restricted development controls remain mandatory. No deployment, release signing, public beta or production use is authorized.
- Drafts are memory-only and can be lost on process termination. Uncertain POST outcomes can create duplicates if the user explicitly chooses to resubmit after review; server idempotency keys are not part of the approved API. No silent deduplication/deletion is invented.
- Content updates remain last serialized write wins across devices. Pagination is not a frozen snapshot under concurrent edits; refresh resets it. No automatic retry/offline writes. Requests accepted by the server before sign-out can complete; clearing local state does not roll back committed server writes. Already seen shared content cannot be recalled.
- Linking, permanent deletion/retention, team/join, discovery, AI, production and other open policies remain deferred. TASK-009 was not started.

## Commit and review

Local branch `task-008-mobile-ideas`. The exact implementation SHA is supplied in the handoff; recover it with `git log -1 --format=%H -- docs/TASK-008-report.md`. No push/merge of TASK-008. Stop and await owner review and approval.

## Files changed

- `README.md`
- `apps/mobile/App.tsx`
- `apps/mobile/src/Workspace.tsx`
- `apps/mobile/src/auth/native.ts`
- `apps/mobile/src/ideas/IdeaScreen.tsx`
- `apps/mobile/src/ideas/client.ts`
- `apps/mobile/src/ideas/controller.ts`
- `apps/mobile/src/ideas/model.ts`
- `apps/mobile/src/ideas/transport.ts`
- `apps/mobile/src/navigation.ts`
- `apps/mobile/src/profiles/ProfileScreen.tsx`
- `apps/mobile/test/ideas.test.ts`
- `docs/TASK-008-report.md`
- `docs/architecture/DECISIONS_REGISTER.md`
- `docs/mobile/TASK-008-idea-flow.md`
- `docs/planning/PLAN-002-define-user-flows-navigation-and-ui-states.md`
- `docs/security/TASK-008/audit-full.json`
- `docs/security/TASK-008/audit-metadata.json`
- `docs/security/TASK-008/audit-production.json`
- `docs/security/TASK-008/backend-smoke.json`
- `docs/security/TASK-008/build.txt`
- `docs/security/TASK-008/bundle-scan.txt`
- `docs/security/TASK-008/database.txt`
- `docs/security/TASK-008/drift.txt`
- `docs/security/TASK-008/lint.txt`
- `docs/security/TASK-008/migrations.txt`
- `docs/security/TASK-008/repository-scan.txt`
- `docs/security/TASK-008/schema.txt`
- `docs/security/TASK-008/tests.txt`
- `docs/security/TASK-008/types.txt`
- `docs/security/TASK-008/validation.json`
- `tasks/README.md`
- `tasks/TASK-008-idea-creation-and-detail-mobile-ui.md`
