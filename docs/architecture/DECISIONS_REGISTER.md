# Architecture decision register

## Accepted baselines
- Mobile-first Expo + React Native + TypeScript.
- NestJS modular monolith with PostgreSQL + Prisma.
- Global English-first product; small balanced beta cohort.
- AI-enhanced, human-decided collaboration; backend-enforced rules.
- Request-to-join with owner/team accept or decline.
- Balanced quality/cost posture.

## Pending gates
- OPEN-001: Supabase Free/Google and development OTP approved for TASK-002; linking, permanent deletion and recovery/reassignment policies remain open (PLAN-004 / ADR-002).
- OPEN-002: profile fields/private defaults (ADR-003) and initial PRIVATE/MEMBERS idea/project lifecycle/visibility (ADR-004) approved 15 October 2026. Anonymous/public/unlisted access remains unauthorized.
- OPEN-003: messaging eligibility (PLAN-006)
- OPEN-004/005: roles and join workflow semantics (PLAN-005)
- OPEN-007: notifications and preferences
- OPEN-008/009: privacy, retention, AI data handling (PLAN-007)
- Hosting/deployment, analytics, beta release and app store requirements.

Record rationale, alternatives, approval date and consequences in ADRs before implementing dependent features.

## Foundation implementation record
- [ADR-001](ADR-001-engineering-foundation.md): TASK-001 tooling and development layout; final owner acceptance pending.

- [ADR-002](ADR-002-supabase-development-auth.md): explicitly authorized restricted-development authentication; implementation and live validation subject to owner review.

- [ADR-003](ADR-003-profile-visibility.md): owner-approved profile field visibility, implemented in TASK-003; final task acceptance pending.

- PLAN-002 profile scope: setup-on-first-profile, owner summary/edit/sign-out and confirmed dirty-edit discard approved 15 October 2026 for TASK-004; other navigation/product flows remain pending.

- [ADR-004](ADR-004-idea-project-domain.md): single IdeaProject aggregate, private default, draft/published/archive lifecycle and owner/member read policy approved for TASK-006. No idea APIs or team/join policies implied.

- TASK-007 API scope approved 15 October 2026: owner create/list/full update on drafts/publications, archives read-only, visibility-aware single reads, explicit publish/archive preserving visibility. Permanent DELETE/restore/unpublish remain excluded; no PLAN-005/007 approval implied.

- TASK-008 mobile scope approved 15 October 2026: Profile/My Ideas navigation, owner-only list/detail/create/edit, private drafts, confirmed publish/archive/member-sharing/discard; archives read-only. See [PLAN-002](../planning/PLAN-002-define-user-flows-navigation-and-ui-states.md) and [flow contract](../mobile/TASK-008-idea-flow.md). No discovery, public links, DELETE or TASK-009 authorization.
