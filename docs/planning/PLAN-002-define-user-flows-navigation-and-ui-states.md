# PLAN-002 — Define user flows navigation and UI states

**Status:** Profile onboarding/edit flow approved 15 October 2026; other product flows remain pending.

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

See [mobile flow contract](../mobile/TASK-004-profile-flow.md) and [TASK-004 report](../TASK-004-report.md). Approval is limited to profile onboarding/editing and its loading/error/retry states; idea/discovery/join/messaging/milestone flows are not approved by this record.
