# TASK-008 — Idea creation and detail mobile UI

**Status:** Explicitly authorized 15 October 2026; approved owner mobile flow implemented, validation and owner review recorded in docs/TASK-008-report.md. Final owner acceptance pending.
**Prerequisites:** TASK-007

## Objective and in-scope work
Build mobile create/edit/view idea flows with user confirmation and robust error handling.

## Out of scope
All other backlog tasks, unapproved architecture decisions, autonomous AI membership decisions, unapproved product features and unrelated refactors. For TASK-001 specifically: no auth, profiles, ideas, discovery, matching, messaging, payments, notifications or AI features.

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

## Approved scope clarification

Profile/My Ideas navigation; owner-only paginated list/detail; private draft creation/editing; Save opens detail; confirmations for publish/archive/member-sharing of a publication/dirty discard. Archives are read-only. No discovery, public links, DELETE or subsequent-task work. See [flow contract](../docs/mobile/TASK-008-idea-flow.md) and [report](../docs/TASK-008-report.md).
