# PLAN-003 — Define profile and idea visibility model

**Status:** Profile policy and fields approved by owner on 15 October 2026; idea visibility remains pending.

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
