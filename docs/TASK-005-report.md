# TASK-005 — Privacy and lifecycle test progress report

Date: 15 October 2026 (Asia/Kolkata). Branch: `task-005-profile-privacy-lifecycle`, created from merged main `47e1842af81baf623ce6f0e968c11ae34e414093`.

**Status: started; existing approved-contract integration coverage complete. Partial against the broader PLAN-007 prerequisite, which remains pending owner policy decisions.** No retention, permanent deletion, recovery/linking, region, consent or AI data-handling policy is invented or marked approved.

## TASK-004 push and merge

Pushed `task-004-mobile-profile-onboarding` at `448d8818c0aee5e7e0376af7697682c178fa7b35`, opened [PR #3](https://github.com/Suneel-1996/entrcollab/pull/3) and verified push/PR validate and secrets checks all passed. Confirmed PR #3 MERGED at `47e1842af81baf623ce6f0e968c11ae34e414093`; the merge command reported it was already merged. No admin override or check bypass was used. Branch-protection metadata could not be read by the integration (HTTP 403); normal PR checks and merged state were accessible and verified. Native/live validation limitations and existing failing dependency audits remain documented; merge is not a deployment or risk-exception approval.

## New coverage

Added 10 database-backed HTTP integration tests to `apps/api/test/lifecycle.database.test.ts`, automatically included by the existing CI `npm run test:db` step through its workspace script. Real NestJS controllers/AuthService/ProfileService, real local ES256 JWT verification, Prisma and PostgreSQL run together. Only provider key issuance is mocked with ephemeral signing keys; no live Supabase/Google credentials, messages or outbound authentication requests are used.

Coverage: all 32 per-field visibility combinations checked by two active members; exact member projections and owner settings; 3×3 caller/target ACTIVE/SUSPENDED/deletion-hold matrix; missing/restricted-target indistinguishability; sharing withdrawal; old valid tokens/user metadata unable to reactivate restricted accounts or mutate profiles; ownership/status injection; invalid/missing/expired/wrong issuer/audience/signature/anonymous tokens; 12 concurrent first HTTP logins producing one identity without an implicit profile; absent unapproved deletion/recovery/linking routes; hold data preserved during requests; linked-provider rejection before provisioning; equal-email distinct subjects remaining separate; and generic sensitive-output/log checks.

Randomized fixture subjects are created through authenticated HTTP. Cleanup deletes only those subjects/profiles; administrative status writes and cleanup are test setup, not a public account-deletion/reinstatement policy. The test server uses a loopback ephemeral port; it is not deployed or publicly exposed. Concurrent requests use an already-listening server to avoid test-harness listener warnings.

See [coverage matrix and explicit gaps](privacy/TASK-005-coverage.md).

## Exact commands and outcomes

Commands ran in `/workspace/entrcollab` with existing Node 24/npm/PostgreSQL 17 tooling.

| Command | Result |
| --- | --- |
| `docker compose up -d --wait db` | PASS, retained development database healthy. |
| `npm --cache /workspace/.npm run typecheck -w @entrcollab/api` | Initial FAIL from two test-harness typing issues (supertest body typed unknown and assertion narrowing); corrected test types only. Final retry PASS. |
| `npm run lint` | PASS, zero warnings. |
| `npm run typecheck` | PASS, API and mobile. |
| `npm test` | PASS, 45 API + 51 mobile tests. |
| `npm run db:validate` | PASS. |
| `npm run db:deploy` | PASS, no pending migrations. |
| `npm exec -w @entrcollab/api -- prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` | PASS, no schema drift. |
| `npm run test:db` | PASS, 13 database tests including 10 new cross-actor/lifecycle HTTP tests. |
| `npm run build -w @entrcollab/api` | PASS. |
| `docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.24.3 dir /repo --redact --exit-code 1` | PASS, no detected working-file leaks. |
| `git diff --check` | PASS. |

**109 tests passed, zero failures/skips.** A preceding database preflight passed 12 tests before the same-email test was added; the final 13-test run includes it and has no concurrent-server listener warning. [Machine-readable evidence](security/TASK-005/validation.json) preserves the final command exit codes.

No mobile source, backend product source, schema, migrations, dependencies or lockfile changed. Android/iOS exports were not rerun for this test-only branch; TASK-004 push/PR CI exports passed on the merged foundation. No claim that device UI or live provider tests were run. Dependency audits were not rerun because dependency/lockfile inputs are unchanged; [TASK-004 full/production audit evidence](security/TASK-004/audit-metadata.json) remains visible with 18 high/7 moderate findings. No suppression or new risk acceptance.

## Remaining decisions and limits

PLAN-007 is still pending: retention/erasure deadlines, consent, hosting/data region, backup deletion, model/embedding handling and audit-log retention cannot receive policy-specific acceptance tests until approved. Permanent account deletion, recovery/reassignment and identity linking remain deferred. A deletion timestamp is tested only as an access hold; fixture persistence is not an approved indefinite-retention rule.

TASK-002 real Google/native session checks and TASK-004 device interactions remain unverified as documented. These tests add integrated development evidence, not production/provider/consent compliance assurance. Existing TASK-001 restricted-development controls and pending security exception remain in force. No paid service, deployment, release signing, public beta, production use or TASK-006 work was performed.

## Files and commit

Changed: API test script; new lifecycle integration test; README/task index; TASK-005 task record; PLAN-007 status explanation (still pending); coverage matrix; this report and validation evidence. No product feature code changed.

TASK-005 changes are committed locally on its dedicated branch; exact SHA supplied in the handoff (or `git log -1 --format=%H -- docs/TASK-005-report.md`). This branch has not been pushed or merged. Next: owner review of test coverage and PLAN-007 decisions before policy-specific expansion. TASK-006 requires separate authorization.
