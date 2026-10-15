# TASK-006 — Idea/project domain model report

Date: 15 October 2026 (Asia/Kolkata). Branch: `task-006-idea-project-domain`, based on merged main `0e9e78101742debe0a2c958358703e62800a8ec5`.

**Status: approved domain scope implemented and applicable automated/database validation complete; owner review pending.** No idea endpoints, mobile screens or TASK-007 work was started. TASK-006 has not been pushed/merged, deployed or signed.

## TASK-005 push and merge

Pushed `task-005-profile-privacy-lifecycle` at `0b4627b77f4cf3ca430385c1e0b9cde9312a0b87`, opened [PR #4](https://github.com/Suneel-1996/entrcollab/pull/4), waited for successful push/PR validate and secrets checks, then merged with the ordinary merge command pinned to that head SHA. Confirmed main merge `0e9e78101742debe0a2c958358703e62800a8ec5`. No admin override/check bypass. TASK-005's PLAN-007 coverage gaps remain documented; merge does not approve missing privacy/retention policies.

## Approved model and implementation

The owner explicitly approved the proposed single IdeaProject model and narrow policy: owner, title, summary, description, needed skills/tags, timestamps; DRAFT→PUBLISHED→ARCHIVED, also DRAFT→ARCHIVED; PRIVATE/MEMBERS visibility, private by default. Drafts/archives remain owner-only. Publication grants member reading only when explicitly shared, with active/non-held caller and owner. No anonymous/public/unlisted access, restoration/unpublish, team/join behavior or irreversible deletion.

- Prisma: IdeaProject with UUID PK, required owner application UUID FK, bounded text columns, empty skill/tag defaults, status/visibility enums and timestamps. ApplicationUser has the inverse relation. Multiple records per owner are allowed; no arbitrary quota or separate Project/team entity.
- Additive migration `202610150002_idea_project`: creates enums/table/PK, owner FK with RESTRICT, two composite indexes and hand-reviewed CHECKs. No existing identity/profile column or data is dropped/rewritten. Applied only to the local development database.
- Database constraints reject blank title, oversized text (column bounds), null/multidimensional/oversized or null-containing lists, inconsistent state/date shapes and publication/archive times preceding creation or each other. Per-entry text validation/deduplication belongs to the future API layer; not falsely claimed as a database CHECK.
- Indexes: ownerId/status/updatedAt DESC/id DESC, and status/visibility/updatedAt DESC/id DESC. These support future scoped reads; no search/discovery pipeline or permission behavior is created by an index.
- Pure reusable read/transition definitions: active owner-only transitions, exact approved state graph, private publication unchanged, archives masked from other readers, chronological transition timestamps and no mutation of the original record. Inputs must come from verified server identity and persisted account/record state.
- No runtime idea API/service is exposed or wired into NestJS. SQL CHECKs validate records, not actor permissions or historical state transitions; TASK-007 must enforce the policy and atomic expected-state writes at its service boundary. This report does not claim completed HTTP authorization for an endpoint that does not exist.

Recorded approval in [PLAN-003](planning/PLAN-003-define-profile-and-idea-visibility-model.md), [ADR-004](architecture/ADR-004-idea-project-domain.md) and decision register. [Domain contract](ideas/TASK-006-domain.md) describes fields, state/read matrices, constraints, indexes and future-service requirements.

## Exact commands and results

Working directory `/workspace/entrcollab`, existing Node 24/npm and local PostgreSQL 17 development service. No new dependencies, credentials, environment variables or network destinations.

| Command | Result |
| --- | --- |
| `npm --cache /workspace/.npm run db:generate` | PASS, Prisma 6.19.3 client/types regenerated. |
| `docker compose up -d --wait db` | PASS, retained database healthy. |
| `npm --cache /workspace/.npm run db:deploy` before adding the migration | PASS, existing baseline migrations up to date. |
| `npm --cache /workspace/.npm exec -w @entrcollab/api -- prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > apps/api/prisma/migrations/202610150002_idea_project/migration.sql` | PASS, generated additive DDL; then added/reviewed named CHECK constraints before applying. |
| `npm run db:validate` | PASS. |
| `npm run db:deploy` | PASS, new migration applied; repeated deployment reports no pending migrations. |
| `npm exec -w @entrcollab/api -- prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` | PASS, no Prisma-representable schema difference. CHECK semantics additionally tested directly. |
| `npm run lint` | PASS, zero warnings. |
| `npm run typecheck` | PASS, API/mobile. |
| `npm test` | PASS, 51 API + 51 mobile tests. |
| `npm run test:db` | Initial preflight FAIL because the test expected a known Prisma wrapper for a correctly rejected CHECK violation. Corrected the assertion to require the actual PostgreSQL 23514 CHECK error surfaced by Prisma 6.19.3; no production constraint/assertion was removed. Final PASS, 16 database tests. |
| `npm run build -w @entrcollab/api` | PASS. |
| `docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.24.3 dir /repo --redact --exit-code 1` | PASS, no detected working-file leaks. |
| `git diff --check` | PASS. |

Machine-readable [validation evidence](security/TASK-006/validation.json) records final command exit codes. No mobile source/dependency changed, so Android/iOS exports were not rerun for this domain-only task; TASK-005 push/PR CI exports passed on its merged foundation. No native-device/live-provider checks are claimed.

## Test evidence

**118 tests passed, zero failures/skips**: 51 API, 51 mobile, 16 PostgreSQL. New TASK-006 coverage is 6 domain tests + 3 database tests; existing TASK-001 through TASK-005 suites remain passing.

Domain tests cover the exact graph; owner/member/anonymous read matrix across states/visibility and active/suspended/deletion-held actors/owners; active-owner-only transitions; denied same-state/restore/unpublish; publication without implicit sharing; preserving publication history on archive; owner-only archived reads; invalid transition times; and unchanged original records on denied operations.

PostgreSQL tests verify default DRAFT/PRIVATE, generated IDs, empty optional fields/lists, timestamp fields, owner FK/RESTRICT and index definitions from pg_indexes. Negative tests require actual SQL errors for invalid state/date/text/list shapes, including raw SQL null-array/null-element attempts; rejected updates leave the valid row intact. Positive fixtures persist private publication, explicit sharing, archive visibility masking, preserved timestamps and direct draft archival using the shared policy definitions.

Tests create randomized fixture owners/records and remove only those fixtures. They do not define a public deletion or account-reinstatement workflow, contact Google/Supabase or store real credentials. Policies are tested as definitions, not falsely described as a production API integration.

## Security, cost and remaining gates

- No paid service, deployment, signing, public beta or production use. Existing TASK-001 restricted-development controls and pending exception remain in force.
- Dependency/lockfile inputs are unchanged; audits were not rerun. Existing [TASK-004 full/production audit evidence](security/TASK-004/audit-metadata.json) remains visible with 18 high/7 moderate affected entries from the same four advisories. No suppression, force fix, major upgrade or new risk acceptance.
- SQL CHECKs are migration-only additions not fully represented by Prisma schema diff. Future migrations must preserve them; direct negative tests are required because a clean Prisma diff alone is insufficient. Direct privileged SQL can still make historical transitions outside the allowed graph while keeping a valid row; actor/transition enforcement belongs in future services.
- PLAN-005 team/join permissions and PLAN-007 retention/deletion/consent/region/AI policies remain pending. Foreign-key RESTRICT protects integrity; it does not settle retention or erasure. No ideas API, AI, embedding, team membership, ownership transfer or recovery behavior was invented.
- TASK-002 real-provider/native authentication and TASK-004 device checks remain unverified as previously documented. This task did not recheck provider/dashboard configuration or claim those blockers resolved. They do not require fabricated credentials for schema/policy development.

## Commit and next step

Local changes on `task-006-idea-project-domain`; exact SHA supplied in the handoff, or `git log -1 --format=%H -- docs/TASK-006-report.md`. Nothing on this task was pushed or merged. Stop for owner review. TASK-007 requires separate authorization.

## Files changed

- `README.md`
- `apps/api/package.json`
- `apps/api/prisma/migrations/202610150002_idea_project/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/ideas/idea-project.policy.ts`
- `apps/api/test/idea-project.database.test.ts`
- `apps/api/test/idea-project.test.ts`
- `docs/TASK-006-report.md`
- `docs/architecture/ADR-004-idea-project-domain.md`
- `docs/architecture/DECISIONS_REGISTER.md`
- `docs/ideas/TASK-006-domain.md`
- `docs/planning/PLAN-003-define-profile-and-idea-visibility-model.md`
- `docs/security/TASK-006/repository-secret-scan.txt`
- `docs/security/TASK-006/validation.json`
- `tasks/README.md`
- `tasks/TASK-006-idea-and-project-domain-model.md`
