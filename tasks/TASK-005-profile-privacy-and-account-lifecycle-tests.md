# TASK-005 — Profile privacy and account lifecycle tests

**Status:** Explicitly authorized and started on `task-005-profile-privacy-lifecycle`; existing-contract integration coverage added. PLAN-007-dependent policy cases remain pending.
**Prerequisites:** TASK-003, TASK-004, PLAN-007

## Objective and in-scope work
Test account lifecycle and profile privacy across actors and states.

## Out of scope
All other backlog tasks, unapproved architecture decisions, autonomous AI membership decisions, unapproved product features and unrelated refactors. For TASK-005: no new product features, irreversible deletion/recovery/linking behavior, invented retention/consent/hosting/AI policy, or TASK-006 scope.

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

## Current coverage and prerequisite gap

See [coverage matrix](../docs/privacy/TASK-005-coverage.md) and [progress report](../docs/TASK-005-report.md). TASK-003/004 are merged into main, but native/live authentication limitations remain documented. PLAN-007 is still pending; no policy approval is inferred from task execution or tests.
