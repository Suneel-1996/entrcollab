# ADR-002: Supabase authentication for restricted development

Status: Provider and initial methods explicitly authorized by owner in TASK-002; implementation submitted for review. Permanent deletion, recovery/reassignment and cross-provider linking remain unresolved.

Use Supabase Auth Free with Google OAuth and a development-only email OTP path. Use Expo's system browser and S256 PKCE, per-attempt callback correlation, platform secure storage and a client session manager. Use NestJS/jose to verify asymmetric JWTs from the configured Supabase issuer/audience/JWKS. PostgreSQL/Prisma owns a minimal application identity and enforces ACTIVE/SUSPENDED/deletion-hold state independently of client claims.

No application passwords, service-role key, Google secret or email-based identity merge. No paid upgrade, deployment, release signing or public beta. The dedicated branch is based on conditionally accepted foundation commit `44b6d8ff4f84820c6f7c440f4ebc5f17d208fcf6`; TASK-001's PR was open at branch creation, so planning-only main was not used as the foundation.

Alternatives: proprietary paid identity services were not selected; implicit OAuth exposes bearer credentials in redirects and is rejected; legacy shared-secret HS256 validation would require a privileged shared secret and is not enabled. JWT verification avoids a provider round-trip on every request but has bounded revocation delay until expiry. Database account suspension remains enforceable per request.

See [setup/API contract](../auth/TASK-002-authentication.md), [lifecycle decisions](../auth/TASK-002-account-lifecycle.md), [cost limits](../auth/TASK-002-cost-controls.md), and the [completion report](../TASK-002-report.md). These documents distinguish implemented behavior from live setup not yet validated.
