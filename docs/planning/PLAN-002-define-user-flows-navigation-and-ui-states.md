# PLAN-002 — Define user flows navigation and UI states

**Status:** Profile onboarding/edit and narrow TASK-008 owner idea flow approved 15 October 2026; other product flows remain pending.

## Objective
Document onboarding, idea creation, two-way discovery, join requests, messaging and milestones with loading/error/empty/offline states.

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

## Approved TASK-004 profile flow

Owner explicitly approved: after sign-in, users without a profile see private-by-default setup; existing users see their profile with Edit and Sign out. Successful Save opens the summary. Cancelling dirty edits requires discard confirmation. This adds no discovery or completion-based restriction on future features. TASK-002 live-login limitations remain documented.

See [mobile flow contract](../mobile/TASK-004-profile-flow.md) and [TASK-004 report](../TASK-004-report.md). Approval is limited to profile onboarding/editing and its loading/error/retry states; discovery/join/messaging/milestone flows remain unapproved. The later narrow idea flow approval is recorded below.

## Approved TASK-008 owner idea flow

Owner explicitly approved Profile/My Ideas navigation, owner-only paginated idea list/detail, private draft creation/editing, Save opening detail, and confirmations before publishing, archiving, sharing publications or discarding dirty changes. Archives stay read-only; no discovery, public links or DELETE. The PRIVATE/MEMBERS lifecycle and backend authorization remain unchanged. See [mobile flow/recovery contract](../mobile/TASK-008-idea-flow.md). This does not approve TASK-009 or any broader product flow.
