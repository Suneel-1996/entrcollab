# TASK-002 — Identity and authentication integration

**Status:** Explicitly authorized; implementation in review on `task-002-supabase-auth`. See [report](../docs/TASK-002-report.md).
**Prerequisites:** PLAN-004, TASK-001

## Objective and in-scope work
Implement Supabase Auth Free and Google OAuth with Expo S256 PKCE, secure session storage/restoration/sign-out, development-only email OTP, NestJS JWT validation and GET /api/v1/auth/me, minimal Prisma identity/account state, mocked-provider tests and migration validation. See ADR-002 and docs/auth for the approved contracts.

## Out of scope
All other backlog tasks, unapproved architecture decisions, autonomous AI membership decisions, unapproved product features and unrelated refactors. For TASK-002: no profiles, ideas, discovery, messaging, payments, notifications, AI, permanent deletion or cross-provider linking. No paid services, deployment, release signing, public beta or TASK-003.

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
