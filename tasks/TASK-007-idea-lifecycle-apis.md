# TASK-007 — Idea lifecycle APIs

**Status:** Explicitly authorized; narrow API/editing scope approved 15 October 2026. Implementation and applicable validation complete; owner review pending on `task-007-idea-lifecycle-apis`.
**Prerequisites:** TASK-006

## Objective and in-scope work
Create authenticated idea create/read/full-update and publish/archive endpoints with authorization/lifecycle checks. Permanent DELETE remains excluded under the owner-approved scope.

## Out of scope
All other backlog tasks, unapproved architecture decisions, autonomous AI membership decisions, unapproved product features and unrelated refactors. For TASK-007: no permanent DELETE, restore/unpublish, mobile idea UI (TASK-008), discovery/member directory, team/join features, AI, paid services, deployment or signing.

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

## Approved API scope

Owner approved owner-only create/list/edit, visibility-aware single reads and explicit publish/archive. Drafts/publications may be edited; archives are read-only. Title is required and other approved content optional. Publishing preserves selected visibility. See [API contract](../docs/ideas/TASK-007-api.md) and [report](../docs/TASK-007-report.md).
