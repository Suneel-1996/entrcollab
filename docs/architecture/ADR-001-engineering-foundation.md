# ADR-001: Engineering foundation implementation

Date: 2026-10-12
Status: Implemented under owner authorization for TASK-001; pending final task acceptance.

## Context and decision

The approved architecture uses Expo React Native TypeScript, NestJS, PostgreSQL and Prisma. Use npm workspaces (`apps/mobile`, `apps/api`) with one lockfile, Node 24, Expo SDK 57 template-compatible versions, NestJS 11, PostgreSQL 17 and Prisma 6.19.3. Prisma 6 retains the established datasource/client setup without requiring adapter configuration. No product schema is defined yet.

Compose provides a local development database; GitHub Actions supplies an isolated database for validation. Separate public liveness and database readiness endpoints under `/api/v1/health` avoid exposing internal details. TypeScript compilation plus Expo iOS/Android exports validate buildability without selecting hosting or signing infrastructure.

## Alternatives and consequences

Separate repositories and a larger orchestration tool add overhead for two applications; npm workspaces are sufficient. Native cloud builds require deployment/signing choices and are deferred. Authentication, hosting, visibility, retention and all product policies remain undecided. Database migrations will be introduced with approved domain models, not fabricated for the foundation.

Prisma was updated from 6.19.0 to compatible patch 6.19.3 during final validation, resolving the transitive Effect advisory. Remaining upstream tooling advisories are recorded in the TASK-001 report; this record does not imply security risk acceptance.
