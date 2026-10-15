# PLAN-003 — Define profile and idea visibility model

**Status:** Profile policy and initial idea/project model/visibility/lifecycle approved by owner on 15 October 2026. Public/unlisted access is not authorized.

## Objective
Approve public/private/unlisted fields, access matrix, indexing and deletion implications.

## Deliverables
- Explicit decision with rationale and alternatives.
- Role/visibility/state matrices where applicable.
- Security, privacy, accessibility, cost and beta implications.
- Updated PRD, ADR and decision register after approval.
- Testable acceptance criteria for dependent tasks.

## Execution rules
Inspect current PRD and architecture, identify unresolved assumptions, present options, obtain explicit owner approval, then record the decision. Do not implement product features in this planning task.

## Completion report
Decision; alternatives; owner approval; files changed; remaining risks; dependent tasks unblocked.

## Approved profile decision

The owner explicitly approved the recommended policy and fields in response to the TASK-003 clarification: private-by-default display name, bio, skills, interests and availability; only active authenticated owners edit; active signed-in users read only fields explicitly marked visible. Anonymous access and indexing stay disabled. Email/provider identifiers remain private. TASK-002 live-login blockers remain documented while development uses mocked authentication.

See [ADR-003](../architecture/ADR-003-profile-visibility.md) and the [profile API contract](../profiles/TASK-003-api.md). This approval covers profile visibility only; no idea visibility, retention, permanent deletion, AI use or cross-provider linking policy is implied.

## Approved TASK-006 idea/project decision

Owner explicitly approved the recommended single IdeaProject model with owner, title, summary, description, needed skills/tags and timestamps. Lifecycle: DRAFT → PUBLISHED → ARCHIVED; DRAFT → ARCHIVED also allowed. PRIVATE/MEMBERS visibility defaults private. Drafts and archives are owner-only; published records may be read by active signed-in users only when explicitly shared. Caller and owner must be active and not deletion-held. Publication never implicitly shares a record.

No anonymous/public/unlisted access, restore/unpublish, team-role/join-request behavior or permanent deletion is authorized. PLAN-005/007 decisions remain pending. See [ADR-004](../architecture/ADR-004-idea-project-domain.md), [domain contract](../ideas/TASK-006-domain.md) and [report](../TASK-006-report.md). TASK-006 is schema/policy definitions only; APIs belong to TASK-007 and require separate authorization.
