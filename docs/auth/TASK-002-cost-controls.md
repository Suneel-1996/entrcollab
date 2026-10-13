# TASK-002 zero-subscription-cost controls

Supabase **Free only** is approved. No plan changes, purchases, paid SMTP, paid custom domains, paid compute, cloud builds, release signing, deployment or public beta is authorized. The API uses only public JWKS; mobile uses a publishable/anon key. No service-role key or paid identity service is needed.

Public provider endpoints do not expose billing-plan confirmation. The owner must confirm Free in the dashboard before live testing; no assertion that billing settings were inspected is made here.

## Provider limits checked 13 October 2026

Official references: [Supabase pricing](https://supabase.com/pricing), [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits), [default email/SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Limits are provider-controlled and can change; confirm them in the project dashboard before extending development use.

- Free lists 50,000 monthly active users, 500 MB database size, shared CPU/500 MB RAM, 5 GB egress plus 5 GB cached egress, 1 GB file storage, and at most 2 active projects.
- Free projects pause after one week of inactivity. Expect cold/unavailable development services and generic retry states; do not buy an upgrade to bypass a pause without approval.
- Default Supabase SMTP only sends to pre-authorized project-team addresses, is currently limited to 2 messages per hour, and has no delivery/uptime SLA. It is not approved external-user email delivery. OTP requests also have provider resend/rate limits; do not repeatedly send real emails while debugging.
- Google OAuth requires an owner-configured OAuth client/consent screen and authorized testing users. Consent verification, testing restrictions and provider quotas can limit sign-in. No paid Google service is required by this implementation, and none was enabled.
- JWKS results are cached with a bounded lifetime and timeout to reduce network calls. No token introspection request is sent on every API call; application account state is checked in PostgreSQL.
- Automated tests use mocked providers/local ephemeral signing keys and send no OTP messages. Session refresh and live sign-ins use provider quota only when a development account is explicitly tested.

Both email-OTP switches remain off unless intentionally enabled. Enabling the mobile switch alone cannot grant API access. Even with both switches and a tester allowlist, configure provider-side signup/email restrictions because the public key can call Supabase directly. External users remain unapproved until delivery and registration policies are approved.

Track MAUs, storage/egress and email rate limits in the dashboard. Stop/limit testing if limits are reached; request owner approval rather than enabling billing. Existing dependency audit findings remain visible and their restricted-development compensating controls remain applicable.
