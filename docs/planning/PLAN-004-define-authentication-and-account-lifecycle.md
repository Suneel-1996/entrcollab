# PLAN-004 — Define authentication and account lifecycle

**Status:** Supabase Free, Google OAuth and restricted development email OTP approved by explicit owner authorization for TASK-002. Linking, permanent deletion and account reassignment/recovery policies remain pending.

## Objective
Select auth provider and specify session expiry, refresh, recovery, deactivation and deletion.

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

## Approved implementation boundary

See [ADR-002](../architecture/ADR-002-supabase-development-auth.md) and [account lifecycle](../auth/TASK-002-account-lifecycle.md). Sign-in, refresh/restoration and current-session sign-out are authorized; provider selection does not authorize irreversible lifecycle actions or production use.
