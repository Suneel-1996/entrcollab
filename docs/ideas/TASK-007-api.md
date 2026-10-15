# TASK-007 — Authenticated idea lifecycle API

Owner approved this narrow API scope on 15 October 2026. All routes require the existing verified Supabase bearer access token and active/non-held application identity. No client owner/status/role is trusted. The approved TASK-006 model/read policy remains authoritative. Restricted development only; no mobile idea UI, discovery, team/join behavior, AI, irreversible delete, deployment, release signing or paid service.

## Routes under /api/v1

| Method / path | Success | Contract |
| --- | --- | --- |
| POST `/ideas` | 201 | Create a DRAFT owned by the verified caller. PRIVATE default; explicit MEMBERS is stored but draft remains owner-only. |
| GET `/ideas` | 200 | Bounded owner-only list `{items, nextCursor}`. This is not a member directory/discovery endpoint. |
| GET `/ideas/:id` | 200 | Owner representation or explicit published/member projection according to the read policy. |
| PUT `/ideas/:id` | 200 | Owner full replacement of content/visibility on DRAFT/PUBLISHED. ARCHIVED is read-only. |
| POST `/ideas/:id/publish` | 200 | DRAFT→PUBLISHED; set server publication time, preserve selected visibility. |
| POST `/ideas/:id/archive` | 200 | DRAFT/PUBLISHED→ARCHIVED; set server archive time, preserve prior publication time if any. |

No DELETE, PATCH, transfer, restore or unpublish route. Permanent erasure/retention policy is deferred. Archive does not delete content or enable restoration. Repeated publish/archive is a 409 conflict, not a second lifecycle event; POST create is not idempotent and each valid request creates a distinct record. No per-owner idea quota is invented.

## Create/replace body

Only `title`, `summary`, `description`, `neededSkills`, `tags`, `visibility` are accepted. Full replacement requires title; omitted optional text/lists clear, and omitted visibility becomes PRIVATE. Clients must send every value they intend to keep. No publication content gate beyond a valid required title is added; other content remains optional per owner approval.

| Field | Validation |
| --- | --- |
| title | Required trimmed string, 1–120 Unicode code points. |
| summary | Trimmed string, 0–280 code points; default empty. |
| description | Trimmed string, 0–5000 code points; default empty. |
| neededSkills, tags | Each up to 20 trimmed nonempty strings, 1–50 code points per entry; duplicates after NFKC/lowercase normalization rejected; default empty arrays. |
| visibility | PRIVATE or MEMBERS only; default PRIVATE. |

Nulls/wrong types, unknown keys, unsupported controls and isolated UTF-16 surrogates are rejected. Line breaks/tabs in plain text remain supported. Content is JSON/plain text, never executed as HTML; future clients must render as text. Body ownerId/id/status/role/nested owner/timestamps are rejected rather than silently applied. Publishing/archiving accepts an absent body or `{}` only; client timestamps/visibility cannot be smuggled into actions.

Example body uses fictional content:

```json
{
  "title": "Local repair network",
  "summary": "Help neighbours repair useful things.",
  "description": "Looking for collaborators to test a small pilot.",
  "neededSkills": ["TypeScript"],
  "tags": ["Circular economy"],
  "visibility": "PRIVATE"
}
```

Publishing this example keeps it PRIVATE. Members can read a published record only after explicit MEMBERS selection on create or replacement. Editing a publication can change content or withdraw sharing without changing publication history. Archives remain owner-only regardless of stored visibility.

## Response projections and authorization

Owner response: id, ownerId, title, summary, description, neededSkills, tags, status, visibility, createdAt, updatedAt, publishedAt, archivedAt. Dates serialize as ISO strings/null. Member response: id, ownerId, title, summary, description, neededSkills, tags, createdAt, updatedAt, publishedAt only. No nested owner account, provider subject, email, account status, deletion timestamp, token or internal ORM columns are serialized.

All successful routes use Cache-Control no-store. Missing/inaccessible ideas share generic 404, including a private draft/publication, any archive, restricted owner, missing ID or non-owned mutation. A user able to read a published member record still cannot edit/publish/archive it. Anonymous/invalid/expired tokens return 401; suspended/deletion-held caller returns 403. Invalid body/query/UUID returns 400. Invalid owner lifecycle state or edit of an archive returns 409. Underlying database errors/timeouts return generic 503 with no raw details. Existing authentication/JWKS failure responses remain unchanged.

## Owner list and pagination

Only optional `status`, `limit` and `cursor` query keys are accepted. `status` is DRAFT/PUBLISHED/ARCHIVED. `limit` defaults to 20 and is an integer string 1–50; arrays, duplicates and other filter/owner/sort keys are rejected. Result order is updatedAt DESC, id DESC. `nextCursor` is null when no further row is observed; otherwise pass it unchanged on the next request with the same status filter.

Cursor is bounded base64url JSON containing version, caller scope, filter and timestamp/UUID position. Timestamp must be canonical ISO (years 1970–9999) and ID a UUID. It is not encrypted, signed or an authorization credential. Strict scope validation and server-derived SQL ownerId prevent cross-owner access even if a client fabricates positions. No cursor row is fetched outside that owner scope. No total count, offset, arbitrary owner query, public list, search or discovery is exposed.

Pagination is not a frozen snapshot: concurrent edits can reorder records between pages. Clients can restart paging to refresh. Full content replacements use last serialized valid write wins, with no optimistic version/If-Match interface. These are explicit development contracts, not claims of snapshot or revision-based conflict protection.

## Transaction and race semantics

Every repository operation rechecks the caller's database state inside its transaction. Reads hold a SHARE lock on the caller identity row; writes hold UPDATE. Content and lifecycle writes for a given owner serialize on that identity row, then lock the owned target row before reading its current state and use expected-status update predicates, so stale initial auth checks cannot bypass a committed restriction and competing publish/archive/edit requests cannot resurrect an archive.

A repeated concurrent publish has one success and conflicts for the rest. A publish/archive race either publishes then archives, or archives the draft and denies later publication. An edit/archive race either edits before archival, or rejects the edit after archival. Lifecycle fields and content update atomically. An administrative state change waits for an already-locked owner operation or commits first and causes the subsequent operation to deny. Target-row locking also coordinates with independent database writers: a committed archive cannot be overwritten from an older in-flight publication read. The owner lock covers all API writes by an owner, a deliberate simple development tradeoff rather than a high-throughput design.

Member target owner/state/visibility is checked at database read time and again through the shared policy. A state/visibility change after an in-flight read may not retroactively cancel its response; the next request observes the committed restriction. Already-issued access JWTs retain TASK-002's expiry/revocation limits, but application suspension/hold is rechecked per request/transaction.

## Setup and verification

No new environment variables, dependencies or migration. Use the existing generation/schema/migration commands and TASK-006 constraints. `npm test` covers input/service behavior; `npm run test:db` includes real HTTP/JWT/Prisma/PostgreSQL tests. Test JWTs use ephemeral local keys, not live provider credentials. Tests delete only randomized fixtures; no product deletion feature is implied.

See [TASK-007 report](../TASK-007-report.md) for actual commands, results, security findings and live/native limitations. TASK-008/mobile idea UI and policy-dependent retention/team/AI features require further owner authorization.
