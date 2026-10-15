# TASK-009 — Idea visibility verification contract

## Authoritative policy and backlog interpretation

TASK-009 was explicitly authorized on 15 October 2026 after TASK-008. PLAN-003 / ADR-004 and the TASK-007 API approval govern its generic backlog wording about private/unlisted/public and unpublished records. The actual approved enum is PRIVATE/MEMBERS; lifecycle is DRAFT/PUBLISHED/ARCHIVED. Public/unlisted and unpublish/restore/delete are unapproved and tested as rejected or absent. DRAFT is never-published state, not an invented unpublish operation. This verification adds no policy or product feature.

## Read matrix

All callers must have a verified issuer/signature/audience/unexpired access token and an active, non-held application identity. An invalid/anonymous caller receives 401; a suspended/deletion-held caller receives 403 before record visibility is evaluated.

| Record | Active non-held owner | Other active signed-in user, active non-held owner | Anonymous |
| --- | --- | --- | --- |
| DRAFT / PRIVATE | Full owner DTO | Generic 404 | 401 |
| DRAFT / MEMBERS | Full owner DTO | Generic 404 | 401 |
| PUBLISHED / PRIVATE | Full owner DTO | Generic 404 | 401 |
| PUBLISHED / MEMBERS | Full owner DTO | Member DTO | 401 |
| ARCHIVED / PRIVATE | Full owner DTO, read-only | Generic 404 | 401 |
| ARCHIVED / MEMBERS | Full owner DTO, read-only | Generic 404 | 401 |

A suspended/deletion-held owner makes every record inaccessible to other callers; the owner is denied as a restricted caller. No JWT metadata/header/query parameter can override that database state. Hidden existing IDs and missing UUIDs have the same body/status. Read permission never grants write permission.

Owner DTO fields: id, ownerId, title, summary, description, neededSkills, tags, status, visibility, createdAt, updatedAt, publishedAt, archivedAt. Member DTO omits status, visibility and archivedAt. Neither exposes account/provider/email/hold/token fields. Successful reads/lists have Cache-Control no-store. This is not a guarantee against a recipient retaining previously seen content.

## Endpoint and pagination boundaries

`GET /ideas` lists only the caller's records across all states and visibility preferences, including status filters and every cursor page. It is never member discovery. An active member with no owned records gets an empty list even when another owner has shared publications. A cross-owner cursor is rejected; a forged caller-scoped cursor position still cannot remove the SQL owner predicate. Owner/visibility/search hints are rejected list queries. Two independent signed-in readers exercise the same record-read boundary.

All six routes require valid authentication. Another caller cannot PUT/publish/archive any of these records, including readable shared publications, and receives the same generic 404 as a missing target. Spoofed owner/admin metadata and user-ID headers do not authorize a mutation; token query parameters do not replace the Authorization header.

Explicit sharing withdrawal and archive revoke subsequent member requests after the change commits, including requests with a previously seen ETag or If-None-Match `*`. Archive retains owner content/history and is terminal. Never-published MEMBERS drafts and directly archived drafts are hidden. No public/unlisted sharing, UNPUBLISHED enum, unpublish/restore/share action, PATCH or DELETE interface is added.

## Test inventory and reproduction

New `apps/api/test/idea-visibility.database.test.ts` contains seven HTTP/JWT/Prisma/PostgreSQL tests:

1. Six record combinations × owner/two independent members/anonymous; exact DTOs, no-store and uniform hidden responses.
2. Three caller states × three owner states × six record combinations (54 member cases), plus owner reads/lists; stale already-issued tokens cannot reactivate accounts or change stored idea state.
3. All/state-filtered owner paging with one-row pages, empty other-owner list, cross-owner and forged-position cursors and rejected query hints.
4. Non-owner mutation denial in every state/visibility, even with spoofed provider-signed metadata; query/header identity hints never override verified subject; no persisted changes.
5. Publication preference, sharing withdrawal/re-enable, archive and direct draft archive; subsequent conditional reads deny both independent members while owner content/history remains.
6. Rejection/absence of public/unlisted/unpublished and unsupported actions/methods, with unchanged row/count assertions.
7. Missing/malformed/expired/wrong-signature/wrong-issuer/wrong-audience credentials across all six endpoints; unchanged row/count and sensitive-error/log assertions.

Run `docker compose up -d --wait db`, `npm run db:generate` if dependencies/client are not ready, `npm run db:deploy`, then `npm run test:db`. The API workspace script registers the new file so existing CI executes it. Targeted command: `npm exec -w @entrcollab/api -- tsx --test test/idea-visibility.database.test.ts`.

The test application runs real Nest controllers, authorization/verifier/services, Prisma and local PostgreSQL. ES256 keys/JWKS are ephemeral local mocks, and provider URLs use `.invalid`; no live provider credentials are required. Randomized subject-scoped fixtures are removed after tests; cleanup is not a product deletion behavior. Existing TASK-007 concurrency/archive regression and failure mapping tests remain part of the complete suite.

## Limits and unchanged gates

In-flight reads may finish using a visibility state observed before a later change commits. Tests assert subsequent-request revocation, not retroactive cancellation or recall. Paging is not a snapshot, and mutations keep existing last-serialized-write semantics. No live Google/device/production claim is made. TASK-001 audit findings remain visible and restricted-development controls remain in force; the proposed exception is still PENDING APPROVAL. No deployment, signing, paid service, public beta, TASK-010 or privacy/team/AI policy approval is implied.

See [TASK-009 report](../TASK-009-report.md) for exact executed checks and remaining limitations.
