# TASK-003 — Profile domain and APIs

**Status:** Explicitly authorized; profile policy/fields approved 15 October 2026. Implementation and automated/database validation complete; owner review pending on `task-003-profile-domain`; TASK-002 live-login limitations remain documented.
**Prerequisites:** TASK-002, PLAN-003

## Objective and in-scope work
Create validated profile persistence, field visibility and authenticated profile APIs.

## Out of scope
All other backlog tasks, unapproved architecture decisions, autonomous AI membership decisions, unapproved product features and unrelated refactors. For TASK-003: no mobile profile UI (TASK-004), discovery/indexing, ideas, messaging, notifications, payments, AI, permanent deletion or unrelated authentication features.

## Implementation procedure
1. Inspect the actual repository, PRD, architecture, ADRs and accepted code. Preserve existing work.
2. Check prerequisites; stop and ask rather than inventing provider, privacy, permission or lifecycle rules.
3. Plan exact files, APIs, migrations and test coverage. Implement this task only.
4. Enforce authorization and state transitions on the server. Validate all inputs and minimize sensitive logging.
5. Add positive, negative, authorization and relevant concurrency tests.
6. Run available lint, typecheck, tests and builds; verify migrations when applicable.
7. Update API contracts, docs and decision records. Review the final diff for scope creep and secrets.
8. Report results and stop for explicit owner acceptance before another task.

## Acceptance criteria
- The stated scope is implemented and demonstrably works.
- Prerequisites and relevant approved decisions are respected.
- Relevant automated tests cover success, invalid input, permission denial and edge cases.
- No secrets or unnecessary personal data are exposed.
- Commands actually run and their outcomes are reported, including failures.
- Documentation matches the implementation; no unrelated features added.
- Owner has reviewed the report and explicitly accepted the task.

## Completion report template
**Status:** Complete / Partial / Blocked

**Files changed:**

**Implementation summary:**

**Commands and results:**

**Tests and results:**

**Security/privacy/cost checks:**

**Known issues or decisions required:**

**Commit SHA:**

**Next step:** Stop and await owner approval.

## Approved contract

See [ADR-003](../docs/architecture/ADR-003-profile-visibility.md), [API contract](../docs/profiles/TASK-003-api.md), and [completion report](../docs/TASK-003-report.md). PLAN-003 profile scope was explicitly approved; idea visibility remains pending.
