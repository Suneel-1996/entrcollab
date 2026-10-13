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
- OPEN-002: profile and idea visibility (PLAN-003)
- OPEN-003: messaging eligibility (PLAN-006)
- OPEN-004/005: roles and join workflow semantics (PLAN-005)
- OPEN-007: notifications and preferences
- OPEN-008/009: privacy, retention, AI data handling (PLAN-007)
- Hosting/deployment, analytics, beta release and app store requirements.

Record rationale, alternatives, approval date and consequences in ADRs before implementing dependent features.

## Foundation implementation record
- [ADR-001](ADR-001-engineering-foundation.md): TASK-001 tooling and development layout; final owner acceptance pending.

- [ADR-002](ADR-002-supabase-development-auth.md): explicitly authorized restricted-development authentication; implementation and live validation subject to owner review.
