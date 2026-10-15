# TASK-003 profile API and privacy contract

All routes are under `/api/v1`, require a verified Supabase bearer access token, and reuse TASK-002 issuer/signature/audience/expiry/provider and current application-account checks. No caller identity comes from a request body. Restricted development only; no mobile profile UI (TASK-004), discovery, AI processing or anonymous access is implemented.

| Route | Behavior |
| --- | --- |
| GET `/profiles/me` | Full owner profile and visibility settings; 404 until created. No implicit creation. |
| PUT `/profiles/me` | Atomic full replacement/upsert for the verified owner; 200 with owner representation on creation and update. |
| GET `/profiles/:userId` | Active member sees only fields explicitly marked MEMBERS on an active target account. For self, returns owner representation. No listing endpoint. |

## Input

JSON object only, with `displayName` required. Omitted bio/availability become empty strings and omitted skills/interests become empty arrays on each replacement. Omitted visibility settings become PRIVATE; clients must send every setting they intend to preserve. This deliberately fails closed instead of retaining a previously shared setting accidentally. Nulls, unexpected fields (including userId/ownerId/status/roles/provider identifiers), wrong types and unknown visibility values are rejected with generic 400.

| Field | Limits |
| --- | --- |
| displayName | Trimmed string, 1–80 Unicode code points. |
| bio | Trimmed string, 0–2000 code points; line breaks allowed. |
| skills, interests | Each at most 20 trimmed nonempty strings, 1–50 code points each; duplicates after NFKC/lowercase normalization rejected. No taxonomy is invented. |
| availability | Trimmed free text, 0–200 code points. No scheduling/availability semantics implied. |
| visibility | Optional object with only displayName/bio/skills/interests/availability keys, each PRIVATE or MEMBERS. Defaults private. |

Disallowed control characters are rejected. Content is stored as text, not HTML; clients must render as text, never execute it. Standard Nest/Express request-body size limits apply. Lengths and normalization are server-validated. Example request uses fictional data only:

```json
{
  "displayName": "Example builder",
  "bio": "Interested in climate projects.",
  "skills": ["TypeScript"],
  "interests": ["Climate"],
  "availability": "Weekends",
  "visibility": { "displayName": "MEMBERS", "skills": "MEMBERS" }
}
```

Owner response includes `userId`, all five fields, nested `visibility`, `createdAt` and `updatedAt`. Another signed-in user receives only `userId`, `displayName` and `skills` for this example. Hidden fields are absent rather than null/redacted values. No visibility settings, timestamps, email/provider identifiers, account status or other private fields appear in member projections. Public API output uses an explicit allowlist, not object spreading from ORM records. All successful routes return Cache-Control no-store.

## Authorization and errors

Missing/invalid/expired bearer tokens: 401. Suspended or deletion-held caller: 403. Malformed target UUID/invalid input: 400. Missing profile, entirely private target, suspended target and deletion-held target: generic 404 with message Profile not found. Database failure: generic 503 with message Service unavailable. No profile payload, token or underlying DB error is logged by the module. Existing authentication failures retain the TASK-002 contract.

A private profile cannot be discovered through this API; guessing a known UUID does not reveal hidden values. A visible profile discloses its owner-selected fields to any active signed-in member. Do not present this as a blocking/connection relationship policy: those features are future tasks and not implemented. Member identity/email/name must never override backend visibility decisions.

## Persistence and concurrency

Profile primary key is an application user UUID, with a unique one-to-one FK to ApplicationUser and ON DELETE RESTRICT. Fields have per-column PRIVATE defaults, plus timestamps; no provider credentials or extra contact information are stored. The additive migration creates only a profile table, visibility enum, PK/FK; it does not alter existing identity data or drop tables. Prisma supplies updatedAt; writes outside Prisma must supply it explicitly. SQL arrays use Prisma's generated PostgreSQL representation.

PUT runs in a transaction, locks the owner identity row, rechecks ACTIVE/no deletion hold and upserts the entire profile. This serializes concurrent first creation and replacements, prevents duplicate ownership and mixed field updates, and coordinates against account-status updates on that row. Last serialized valid replacement wins; there is no optimistic version/If-Match API. GET checks account state per request; in-flight reads may finish if an administrator changes state after the check. There is no automatic profile publishing, profile deletion, retention job or account-reactivation behavior.

For local setup, reuse existing Node 24/PostgreSQL instructions, then run `npm run db:generate`, `npm run db:validate`, `npm run db:deploy`, and `npm run test:db`. No new environment variables, service subscriptions or network destinations are required. Live authentication still requires TASK-002's approved Google/provider/API/device configuration.
