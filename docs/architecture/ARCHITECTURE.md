# Architecture baseline

- Mobile: React Native, Expo, TypeScript.
- API: NestJS modular monolith, TypeScript, versioned REST `/api/v1`.
- Database: PostgreSQL and Prisma; Redis only where justified.
- Messaging: authenticated WebSocket transport when messaging is implemented.
- AI: OpenAI API calls server-side only; validate outputs; explicit user confirmation before consequential writes.
- CI: lint, typecheck, tests, build, secret scanning and migration validation.
- Security: server-side authorization, input validation, least privilege, visibility enforcement, audit and retention policies.

Do not choose unspecified identity, hosting, visibility, retention, messaging or notification policies without an approved ADR.
