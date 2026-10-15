# TASK-004 — Mobile profile and onboarding

**Status:** Explicitly authorized; narrow profile flow approved 15 October 2026. Implementation and automated validation complete; owner review pending on `task-004-mobile-profile-onboarding`.
**Prerequisites:** TASK-003, PLAN-002

## Objective and in-scope work
Implement Expo onboarding and profile edit screens with validation and error states.

## Out of scope
All other backlog tasks, unapproved architecture decisions, autonomous AI membership decisions, unapproved product features and unrelated refactors. For TASK-004: no backend domain changes, member directory/discovery, ideas, messaging, payments, notifications, AI, permanent deletion or TASK-005 scope.

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

## Approved flow and report

See [profile flow](../docs/mobile/TASK-004-profile-flow.md) and [report](../docs/TASK-004-report.md). PLAN-002 approval is limited to this profile flow; existing TASK-002 live-validation limitations remain documented.
