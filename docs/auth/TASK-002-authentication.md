# TASK-002 authentication: development setup and API contract

## Approved boundary

Supabase Auth Free, Google OAuth, Expo React Native, NestJS and PostgreSQL/Prisma are authorized for restricted development. No paid plan, production deployment, release signing, public beta, permanent account deletion or cross-provider linking is authorized. Keep TASK-001's compensating controls; its security exception is not silently marked approved by this implementation.

## Configuration

Provide these values in environment settings (or ignored local `.env` files). No real values belong in Git. An Expo public key is intentionally extractable from the app; it must be a Supabase **publishable** key or legacy **anon** key, never service-role/secret. Google client secrets belong only in Supabase's Google provider settings.

| Variable | Consumer | Meaning |
| --- | --- | --- |
| `SUPABASE_URL` | NestJS | Exact HTTPS Supabase project origin. Issuer and JWKS are derived from it, never from untrusted JWT headers. |
| `AUTH_EMAIL_OTP_ENABLED` | NestJS | `false` by default; `true` only for controlled development OTP testing. Rejected with NODE_ENV=production. |
| `AUTH_DEV_EMAIL_ALLOWLIST` | NestJS | Comma-separated tester addresses. Required/nonempty when OTP is enabled. Never return this list to clients. |
| `EXPO_PUBLIC_SUPABASE_URL` | Mobile | Same project origin as the API. |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Mobile | Public publishable/anon key only. Privileged key formats/roles are rejected. |
| `EXPO_PUBLIC_AUTH_REDIRECT_URI` | Expo config/mobile | Exact owner-approved native callback URI; no default or guessed URI. Its scheme is registered at native build time. |
| `EXPO_PUBLIC_API_URL` | Mobile | Authorized reachable HTTPS API base ending `/api/v1`; HTTP allowed only for loopback local testing. |
| `EXPO_PUBLIC_ENABLE_EMAIL_OTP` | Mobile | `false` by default; UI switch only, not an authorization control. Server controls remain authoritative. |

A missing Supabase origin leaves `/auth/me` unavailable (503 for a syntactically valid bearer token) while health endpoints still work. Invalid supplied security configuration fails closed. The mobile app displays a configuration-unavailable screen when configuration is absent/invalid. Do not replace missing values with fabricated credentials or callback URIs.

The current cloud requires `NODE_USE_ENV_PROXY=1` on the **Node process startup environment** for outbound JWKS fetches through the managed HTTPS proxy. This uses the approved proxy and preserves TLS validation. Python's HTTP client honoring the proxy does not prove Node fetch works. Allow the exact project hostname and `binaries.prisma.sh`; do not use a global network wildcard or disable TLS verification.

## Provider setup and live-validation gate

1. Owner confirms the project is on **Supabase Free**, with no paid add-ons or upgrades. Public Auth settings cannot verify billing plan.
2. Enable Google in Supabase using the owner's Google OAuth client. Copy the actual Supabase callback URL shown in its dashboard into Google's authorized redirect settings. Configure Google OAuth consent/testing users for this restricted development project. No Google secret is needed in the API or mobile app.
3. Register the approved native callback in Supabase redirect settings. The client adds a cryptographically random `auth_attempt` query parameter for application callback correlation. Allow that query-bearing callback on the approved **exact scheme/host/path**, using an owner-reviewed narrowly scoped pattern if Supabase requires it. Do not add broad origin/path wildcards. A bare callback allowlist may not match query-bearing callbacks; verify on the development device. No unknown callback or allowlist pattern is silently invented by this code.
4. Use Supabase asymmetric signing keys (ES256 or RS256) exposed by its JWKS endpoint. Legacy HS256 shared-secret mode is deliberately not supported. No service-role JWT is accepted.
5. Configure provider registration controls for development testers only. Mobile UI hiding is not a provider-side control: the publishable key permits direct Auth API calls. Supabase email signups being enabled does not make email externally approved. Keep email OTP off in this app/API; restrict/disable unapproved provider signups in the dashboard. Before any email pilot, obtain approved email-delivery and registration policies.
6. Use a native **development build**, with the approved scheme compiled in, not Expo Go. `expo-dev-client` and SecureStore/WebBrowser plugins are included. On an authorized local SDK/device machine, `npm exec -w @entrcollab/mobile -- expo run:android` creates a local debug build; iOS requires local macOS tooling. No cloud build purchase, release signing or deployment is part of this task. Then run `npm run dev:mobile -- --dev-client --localhost` as appropriate for the device's network. Do not expose Metro publicly.
7. A physical phone's localhost is the phone, not the API machine. Use an already authorized reachable HTTPS development API, or an appropriate loopback mapping/simulator on a local development machine. This repository does not provision or publish an external API endpoint.
8. Verify Google sign-in, cancel, restart/restore, refresh/expiry and sign-out on that build, then confirm `/auth/me`. Live email tests can send messages and require approved tester addresses and delivery configuration. No live email was sent by automated tests.

## OAuth and session behavior

Supabase owns Google OAuth/provider state and token issuance. The mobile app uses Supabase's PKCE flow, Expo platform CSPRNG/SHA-256, and an external system-browser auth session. Plain PKCE is rejected before browser launch. An additional random one-use `auth_attempt` is bound to the exact callback and a five-minute local attempt. Codes, duplicate state/code fields, callback mismatches, fragments, provider errors and replay are rejected. The SDK flow ID captured at initiation selects the persisted verifier; an optional callback flow ID must match but is never trusted to choose a different verifier. The SDK does not append that parameter by default; an integration test covers the actual default.

Session and PKCE state use iOS Keychain/Android-backed Expo SecureStore exclusively. Large session JSON is encoded/chunked with a manifest and serialized writes; all pieces remain in secure storage. No AsyncStorage/plaintext fallback is used. iOS uses WHEN_UNLOCKED_THIS_DEVICE_ONLY. Native plugins configure backup exclusions. Device-level storage/keystore behavior still requires device testing. On iOS, keychain data can survive reinstall; do not treat uninstall as a guaranteed logout. Interrupted writes may leave encrypted unreachable chunks until app storage cleanup; they are not used as a valid session. A storage deletion failure is shown as an error rather than a successful logout.

The SDK restores/refreshes sessions, with auto-refresh enabled only while active. The session manager rechecks `/auth/me` after restoration, refresh and foreground entry. Its expiry timer leaves the authenticated UI even if no provider event arrives. Only the API's internal identity is displayed as authenticated; a locally stored provider user ID is not trusted. Cancellation and failures use generic messages, with no raw provider payload/token shown. Interrupted browser authentication after process termination must be retried; only completed sessions are restored. Deep links received outside the active browser attempt are not exchanged.

Sign-out uses `scope: local` (current Supabase session), stops refresh and clears local SDK secure storage. Remote revocation failure is reported separately while local logout still completes if storage deletion succeeds. In-flight `/me` responses cannot restore the UI after logout. Other devices are not signed out. An already issued access JWT remains valid until expiry unless the application account is suspended; local JWT verification is not instant provider-session revocation. Configure a short project access-token lifetime appropriate to development (for example the documented default one hour) and review changes explicitly; this code does not change provider settings.

## API contract

`GET /api/v1/auth/me` requires exactly one Bearer JWT. The backend verifies issuer, asymmetric signature against the configured JWKS, required subject/issued-at/expiry/audience, expiry/not-before, authenticated role, nonanonymous status and UUID subject. Supported signing algorithms are ES256/RS256 only. The JWT never selects a remote key URL. Remote JWKS uses a five-second timeout, cooldown and bounded cache; routine key rotation is supported by the resolver. Network/key-service failure returns a generic 503.

Verified provider metadata must indicate a single approved provider. Google is allowed; email requires OTP AMR, the server development flag and the server tester allowlist. Password/unknown/linked-provider sessions are denied. Signed provider metadata is distinct from user-editable `user_metadata`, which is never used for authorization. Application status is read from PostgreSQL on each request; client IDs/roles/status are ignored.

| Outcome | HTTP | Body / notes |
| --- | --- | --- |
| Active verified identity | 200 | `{id, status: "ACTIVE", createdAt, updatedAt}`; internal UUID, ISO timestamps; `Cache-Control: no-store`. No provider subject, email or token returned. |
| Missing/malformed/invalid/expired token | 401 | Nest error envelope with `message: "Unauthorized"`. |
| Suspended account, deletion hold, disallowed provider/linking/OTP | 403 | Error envelope with `message: "Access denied"`. |
| Database unavailable | 503 | `message: "Service unavailable"`; no DB error/details. |
| Auth config/JWKS unavailable | 503 | `message: "Authentication unavailable"`. |

First use provisions an `ApplicationUser` using only verified `sub`. Returning users reuse the same internal ID. A unique PostgreSQL constraint and race-safe upsert/P2002 lookup handle concurrent first sign-ins. An upsert never resets status or deletion state. Health endpoints retain the TASK-001 contract and remain public.

## Identity schema and migration review

`ApplicationUser`: internal UUID primary key, unique UUID providerSubject, ACTIVE/SUSPENDED enum, timestamptz createdAt/updatedAt, nullable deletionRequestedAt. No provider password, refresh/access token, email profile, OAuth secret or application role is stored. The migration `202610120001_application_identity` only creates the enum/table/unique index; it drops no data. UUID defaults/updatedAt are generated by Prisma; callers bypassing Prisma must explicitly supply those values. Review is an implementation-level SQL inspection, not an assertion of owner approval.

Apply `npm run db:generate`, `npm run db:validate`, `npm run db:deploy`; repeated deployment is idempotent. `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` checks actual schema agreement. The database test provisions 20 concurrent attempts and asserts one row/internal ID, uniqueness enforcement and unchanged suspended/deletion-hold state. It deletes only its randomized test fixture during cleanup; there is no product deletion endpoint.
