# ADR-003 — Private-by-default profile fields

Status: Accepted policy, 15 October 2026; TASK-003 implementation subject to owner review.

The owner explicitly requested TASK-003 and then approved the recommended policy and fields: display name, bio, skills, interests and availability, private by default; active signed-in users may read only fields explicitly shared by their active owner. Anonymous access and indexing remain disabled. Authentication email/provider identifiers remain private. Development proceeds with mocked authentication while TASK-002 live checks remain blocked.

## Decision and consequences

Use per-field PRIVATE/MEMBERS settings rather than one public-profile switch. Only verified, active owners can create/replace profiles; application identities, account status and visibility are enforced by the backend. Other readers receive an allowlisted projection with only visible fields and internal application user ID. Entirely private/missing/restricted-target profiles yield the same generic 404. No endpoint lists profiles. An authenticated caller accessing their own UUID receives the owner view.

Alternative considered: owner-only profiles, with sharing deferred. It was offered explicitly; the owner approved private defaults with opt-in member sharing instead. Public/unlisted URLs, discovery/indexing and AI use are not approved. Existing TASK-001 restricted-development controls remain in force. No deployment, production use, beta, release signing or paid services are authorized.

Persistence has one profile per identity. Full replacement is atomic, serialized on the owner row, and resets omitted visibility settings to PRIVATE. Concurrent valid writes use last-serialized-write wins; optimistic version conflict resolution is not added. Foreign-key RESTRICT prevents accidental identity removal while a profile exists; this is a database integrity safeguard, not an approved account-deletion workflow. Retention, permanent deletion, idea visibility and lifecycle linking decisions remain deferred.

See [API contract](../profiles/TASK-003-api.md), [PLAN-003](../planning/PLAN-003-define-profile-and-idea-visibility-model.md), and [report](../TASK-003-report.md).
