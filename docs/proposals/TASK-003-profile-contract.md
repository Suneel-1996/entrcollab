# TASK-003 profile contract proposal

Status: Recommended profile policy and fields APPROVED by owner on 15 October 2026. Historical proposal retained; ADR-003 and docs/profiles/TASK-003-api.md define the implemented contract. TASK-002 acceptance and idea visibility are not implied.

TASK-003 execution was explicitly requested. Its prerequisite PLAN-003 remains pending and the architecture rules prohibit choosing unspecified visibility policies. TASK-002 implementation is locally committed; successful live Google/native validation remains blocked by provider/API configuration. Development can use mocked authentication if the owner accepts proceeding with that limitation.

## Recommended narrow policy

Profiles start private. Only an active authenticated owner can create/update their profile. Other active authenticated users can read only fields the owner has explicitly marked visible to signed-in users. Anonymous profile access, search/indexing, AI use and public URLs are disabled. Email, authentication identifiers and account-state internals are never profile fields. No idea visibility decision is included in this proposal.

Proposed editable fields: display name, bio, skills, interests and availability. Each field has PRIVATE or MEMBERS visibility, default PRIVATE. Publishing one field does not publish any other field. Owners always receive their own fields and visibility settings. Readers never receive private field values or visibility metadata. No visible fields means a generic 404 for other users. Missing, suspended or deletion-held target identities also return generic 404; suspended/deletion-held callers are denied by existing authentication checks.

Alternative: implement owner-only persistence/APIs and defer all shared reads. This avoids deciding member visibility now but would leave sharing for a later approved change.

## Proposed API and persistence

- GET /api/v1/profiles/me: current owner's full profile, or 404 when not created.
- PUT /api/v1/profiles/me: atomic full replacement/upsert with server-derived owner ID; no owner/user ID accepted in the body. New private defaults cannot be bypassed by omitted visibility values.
- GET /api/v1/profiles/:userId: authenticated member projection only under the approved policy; UUID is an application identity, never a provider subject. No enumeration/list endpoint.
- One profile per application user, database unique foreign key, timestamps and explicit per-field visibility. No email/password/token storage; no profile deletion endpoint, cascade deletion policy or retention decision invented.
- Strict input validation: reject unknown fields/visibility keys and non-string values; trim text; bounded lengths/list counts; reject blank list entries and duplicate normalized entries. Proposed limits: display name 1–80, bio 0–2000, skills/interests at most 20 entries of 1–50, availability 0–200 characters. These are implementation safeguards, not a taxonomy or matching algorithm.
- Generic 400/401/403/404/503 responses; Cache-Control no-store. No profile bodies, bearer tokens or personal fields logged.

## Implementation/validation plan after decision

Create a profile module reusing AuthService for verified identity and current account-state enforcement. Export AuthService from AuthModule without changing its existing endpoint contract. Add an additive Prisma migration and review its SQL. Avoid mobile changes (TASK-004), discovery, indexing, ideas and unrelated features.

Test owner isolation, invalid/unknown input, private defaults, field projection, anonymous/invalid/suspended access, missing/restricted target indistinguishability, concurrent first creation, atomic updates and database failures. Use mocked provider validation and real PostgreSQL repository tests. Run lint, typecheck, full tests, migration/schema/drift checks, API build, Android/iOS exports, dependency audits and secret scans. Preserve failing dependency audit evidence and restricted-development controls. Commit only on task-003-profile-domain; do not push, merge, deploy or start TASK-004.

## Decision required

Owner selected “Approve the recommended policy and fields.” Recorded in PLAN-003 and ADR-003 before implementing dependent profile behavior.
