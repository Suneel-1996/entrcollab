# TASK-004 — Mobile profile and onboarding report

Date: 15 October 2026 (Asia/Kolkata). Branch: `task-004-mobile-profile-onboarding`, based on TASK-003 `4bb15093e8edc93f65e8d8d697fc151b63ef8118`.

**Status: implementation and applicable automated validation complete; owner review and native-device validation pending.** Owner explicitly requested TASK-004 and approved the narrow setup/summary/edit/sign-out flow. No push, merge, deployment, signing, paid services, public beta or TASK-005 work was performed.

## Implemented scope

- After verified sign-in, GET owner profile. A 404 opens private-by-default setup; other failures show a retry state. Returning users see their owner summary with Edit and Sign out. Saving opens the server-confirmed summary.
- Scrollable form with required display name and optional bio, skills, interests and availability. Skills/interests use add/remove inputs, preserving valid existing multiline/comma-containing entries. Inline bounds/control/duplicate validation matches TASK-003; invalid saves focus the first invalid input where available. Server validation remains authoritative.
- Independent sharing switches for each field, off for new profiles and restored exactly when editing. Every PUT includes all fields and visibility values; omitted values cannot accidentally clear unrelated sharing settings. Clear private/member labels, loading/saving/error states, explicit unsaved-change indication and saved confirmation.
- Cancel and dirty-form sign-out ask before discarding edits. Android hardware back in an existing-profile edit uses the same confirmation, and saving intercepts back. No skip behavior, discovery or future-feature profile-completion gate is added.
- Profile client/controller and authenticated transport keep tokens out of UI/profile state, use the fixed configured owner endpoint, reject expired/missing sessions and account changes during token retrieval, validate expected internal user ID, ignore unexpected response columns and map raw errors to generic messages.
- Duplicate submissions are blocked; failed/ambiguous saves preserve the draft for explicit retry or confirmed reload. Auth denial clears private state and only requests logout for the matching active account. Late async responses after unmount/sign-out cannot repopulate the old screen. Temporary auth revalidation hides content/accessibility while retaining the same account's in-memory draft; logout/error/account change or re-login gets a new screen key.
- No persistent draft/profile cache, analytics, profile/token logging, backend changes, migrations, dependencies or lockfile changes. Existing authentication and backend visibility/account-state enforcement remain authoritative.

[Approved flow and manual device checklist](mobile/TASK-004-profile-flow.md). Profile-only PLAN-002 approval is recorded in the planning document and decision register; the other product flows remain undecided.

## Commands and observed results

Working directory `/workspace/entrcollab`; existing Node 24/npm environment and PostgreSQL 17 local service. Full results are recorded in [validation.json](security/TASK-004/validation.json).

| Command | Result |
| --- | --- |
| `npm --cache /workspace/.npm run test -w @entrcollab/mobile` | PASS, 51 mobile tests, including 24 new profile tests. |
| `npm run lint` | PASS, zero warnings. Repeated after the final UI change. |
| `npm run typecheck` | PASS, API/mobile; repeated after final UI change. |
| `npm test` | PASS, 45 API + 51 mobile tests. |
| `npm run db:validate` | PASS; no schema changes. |
| `npm run db:deploy` | Initial FAIL while PostgreSQL was stopped, schema engine could not connect. |
| `npm exec -w @entrcollab/api -- prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` | Initial FAIL while PostgreSQL was stopped. |
| `npm run test:db` | Initial FAIL while PostgreSQL was stopped; not presented as passing. |
| `docker compose up -d --wait db` | PASS; started retained local PostgreSQL service, healthy. No volume/data reset. |
| `npm run db:deploy` (retry) | PASS, no pending migrations. |
| `npm exec -w @entrcollab/api -- prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` (retry) | PASS, no schema difference. |
| `npm run test:db` (retry) | PASS, all 3 PostgreSQL tests. |
| `CI=1 EXPO_NO_TELEMETRY=1 npm run build` | PASS, API build and Android/iOS Hermes exports; repeated after final UI change. No signing/native device build. |
| `npm --cache /workspace/.npm audit --json` | FAIL security gate, exit 1: existing 18 high / 7 moderate affected entries. |
| `npm --cache /workspace/.npm audit --omit=dev --json` | FAIL security gate, exit 1: same 18 high / 7 moderate. |
| `docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.24.3 dir /repo --redact --exit-code 1` | PASS, no detected working-file leaks. |
| `git diff --check` | PASS. |

Final mobile Hermes bytecode was disassembled for `platform=android` and `platform=ios` with `node_modules/hermes-compiler/hermesc/linux64-bin/hermesc -b -dump-bytecode apps/mobile/dist/_expo/static/js/$platform/*.hbc > /tmp/task004-bundle-text/$platform.txt`, then scanned with `docker run --rm -v /tmp/task004-bundle-text:/scan zricethezav/gitleaks:v8.24.3 dir /scan --redact --exit-code 1`: PASS, no detected leaks. Public Supabase configuration remains intentionally extractable from bundles; no privileged credential was added. Secret scanners cannot prove every secret absent.

Started compiled backend with `NODE_USE_ENV_PROXY=1 PORT=3005 npm --cache /workspace/.npm run start -w @entrcollab/api`. Node fetch requests to `http://127.0.0.1:3005/api/v1/health`, `/health/ready`, `/auth/me` and `/profiles/me` returned 200, 200, 401 and 401 respectively without a token. This verifies preserved backend wiring/health, not successful real-provider login.

## Test evidence

**99 tests passed, zero failures/skips** after service startup: 45 API, 51 mobile, 3 PostgreSQL. Existing TASK-001/002/003 tests remain passing.

The 24 new mobile tests exercise production profile model/client/controller/transport/gate modules with mocked HTTP/provider state. They cover first-time 404/private defaults; local validation/no premature write; successful normalized creation/summary; returning-user edit/cancel; complete visibility preservation; clearing optional values and withdrawing sharing; duplicate/length/control/Unicode and multiline tag boundaries; dirty-state tracking; network/400/500/503 save failures and retries without lost drafts or leaked raw errors; load failure versus missing profile; 401/403 cleanup; blocked double submission/editing during save; stale load/save results; disposal cleanup; other-account/malformed response rejection; ignored private server columns; failed PUT versus GET 404; exact authenticated owner requests without client user IDs; signed-out/expired/revalidation/account-switch rejection; hiding/reusing the same screen only during transient auth revalidation; and a fresh screen after logout/error/same-account re-login.

These are not rendered React Native interaction tests. Typecheck and platform exports validate component compilation/bundling. Android emulator/adb and iOS xcrun were not available in this cloud; no device tap, keyboard, screen-reader, layout or native-back interaction is claimed as verified.

## Privacy, security, cost and remaining limitations

- Profile/drafts live in memory only; logout/access error/account switch clears them. Unsaved changes are lost if the process exits. An already-submitted PUT may commit after a network timeout or screen closure; errors say save was not confirmed and offer explicit retry/reload. No offline queue or silent background write.
- Client validation and sharing controls cannot grant access. TASK-003 authentication/account-state/visibility checks remain on the server. Only owner profiles are requested; there is no anonymous/member-directory/discovery API client or new permissions policy.
- No new services, subscriptions, dependencies, network domains, privileged keys or signing credentials. Supabase Free remains the approved plan. No purchase, deployment, public beta, production use or release signing is authorized.
- Full/production audit counts remain 18 high / 7 moderate from TASK-001's same four root advisories: GHSA-vfj7-8cjw-p6xm, GHSA-ggr8-5vv4-36mx, GHSA-86w9-cpqp-85rv, GHSA-w5hq-g745-h8pq. Complete fresh JSON/metadata is retained under docs/security/TASK-004. No force fix, major upgrade, audit suppression or new risk acceptance; the existing exception remains PENDING APPROVAL. Restricted-development controls remain in force.
- TASK-002 live Google authentication/native session validation remains blocked by last-observed Google-disabled/provider and invalid API configuration. This task did not invent credentials/URLs, mutate provider settings or send OTP messages. See [TASK-002 report](TASK-002-report.md). Real-device profile calls with an actual development session remain unverified until that configuration is fixed.
- Native form interaction/accessibility/layout must be checked with the documented device checklist. Owner acceptance is still required. No claim that TASK-002 live blockers or TASK-004 native validation were resolved by mocked tests or exports.

## Commit and next step

Local implementation on `task-004-mobile-profile-onboarding`; exact SHA supplied in the handoff. To identify the report's commit: `git log -1 --format=%H -- docs/TASK-004-report.md`. Nothing pushed or merged. Stop for owner review; no TASK-005 without further authorization.

## Files changed

- `README.md`
- `apps/mobile/App.tsx`
- `apps/mobile/src/auth/native.ts`
- `apps/mobile/src/profiles/ProfileScreen.tsx`
- `apps/mobile/src/profiles/client.ts`
- `apps/mobile/src/profiles/controller.ts`
- `apps/mobile/src/profiles/model.ts`
- `apps/mobile/src/profiles/session-gate.ts`
- `apps/mobile/src/profiles/transport.ts`
- `apps/mobile/test/profile.test.ts`
- `docs/TASK-004-report.md`
- `docs/architecture/DECISIONS_REGISTER.md`
- `docs/mobile/TASK-004-profile-flow.md`
- `docs/planning/PLAN-002-define-user-flows-navigation-and-ui-states.md`
- `docs/security/TASK-004/audit-full.json`
- `docs/security/TASK-004/audit-metadata.json`
- `docs/security/TASK-004/audit-production.json`
- `docs/security/TASK-004/bundle-secret-scan.txt`
- `docs/security/TASK-004/repository-secret-scan.txt`
- `docs/security/TASK-004/validation.json`
- `tasks/README.md`
- `tasks/TASK-004-mobile-profile-and-onboarding.md`
