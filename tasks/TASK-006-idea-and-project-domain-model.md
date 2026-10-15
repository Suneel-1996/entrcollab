# TASK-006 — Idea and project domain model

**Status:** Explicitly authorized; model/visibility/lifecycle approved 15 October 2026. Implementation and applicable validation complete; owner review pending on `task-006-idea-project-domain`.
**Prerequisites:** TASK-003, PLAN-003

## Objective and in-scope work
Add idea/project Prisma schema, migrations, indexes and lifecycle state definitions.

## Out of scope
All other backlog tasks, unapproved architecture decisions, autonomous AI membership decisions, unapproved product features and unrelated refactors. For TASK-006: no idea HTTP APIs (TASK-007), mobile UI, discovery/indexing pipeline, AI, team roles/join behavior, restore/unpublish or permanent deletion.

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

See [ADR-004](../docs/architecture/ADR-004-idea-project-domain.md), [domain contract](../docs/ideas/TASK-006-domain.md), and [report](../docs/TASK-006-report.md). PLAN-003 initial idea scope is approved; PLAN-005/007 and live/native validation limitations remain documented.
