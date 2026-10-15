# TASK-005 — Privacy and lifecycle coverage matrix

Status: existing approved-contract coverage added; PLAN-007-dependent cases remain pending. Execution was explicitly authorized on 15 October 2026. No new lifecycle/privacy policy is approved by writing tests.

## Test boundary

`apps/api/test/lifecycle.database.test.ts` combines real NestJS HTTP controllers/services, real ES256 JWT verification with an ephemeral local test JWKS, Prisma repositories and PostgreSQL. It binds a loopback ephemeral port for concurrent requests; it does not contact Supabase/Google or use live credentials. Each test creates randomized provider subjects through `/auth/me` and deletes only its own fixture rows afterwards. Administrative status writes are fixture setup, not public admin/recovery behavior.

| Existing contract | Coverage |
| --- | --- |
| Per-field PRIVATE/MEMBERS | All 32 combinations for all five fields, checked by two independent active members. Exact response projection and owner settings asserted. |
| Owner-only private data | Owner sees full data; member gets only explicitly shared fields and application UUID, without provider subject, visibility metadata or private server columns. |
| Caller/target state | 3×3 ACTIVE/SUSPENDED/deletion-hold matrix: restricted caller 403; active caller with restricted target 404 indistinguishable from missing profile. |
| Withdrawn sharing | Next member request denies access after sharing becomes private; data remains in owner's profile and successful response has no-store header. |
| Returning old token/status spoofing | Existing valid JWT and signed user_metadata cannot bypass suspension/hold, reset account status or mutate the profile. |
| Client identity/status injection | Body userId/ownerId/providerSubject/status/role rejected, PUT to another user's path absent, other owner's persisted values unchanged. |
| Authentication rejection | Missing/malformed, expired, wrong signature/issuer/audience and anonymous credentials reject owner/member reads and writes. |
| Concurrent first login | Twelve concurrent HTTP requests produce one application identity and no automatic profile. |
| Deferred account operations | Linking/recovery/deletion routes are absent; deletion timestamp is an access hold, not erasure. Fixture-only cleanup is not a product deletion flow. |
| Provider linking/email collision | Multiple-provider tokens denied before provisioning; identical email claims on separate subjects do not merge accounts or transfer profile access. |
| Sensitive output/logs | Private sentinels and ephemeral tokens absent from denied responses/logs; member responses assert exact visible allowlist. |

Existing TASK-002 tests retain session restoration/sign-out/expiry and generic database/JWKS failure coverage. TASK-003 tests retain unique ownership/FK/atomic-write and restricted-target persistence coverage. TASK-004 tests retain in-memory draft clearing, stale-response rejection and account-switch transport rejection. These are reused, not counted as new TASK-005 tests.

## Unresolved PLAN-007 cases — not claimed as verified

- Retention deadlines and automatic erasure: no approved durations or deletion job. A held fixture remains stored during requests; this does not authorize indefinite retention.
- Permanent deletion, provider/database erasure coordination, cancellation and recovery windows: deferred, no invented implementation.
- Hosting/storage region, backups and retention across backups: no approved provider/region or retention policy; no deployment performed.
- Consent scope, embeddings/model-provider data handling and AI logging: no AI processing or policy is approved/implemented here.
- Audit-log retention and admin recovery verification: no policy or new administration endpoint.
- Native-device storage/UI and real Google-provider lifecycle: existing TASK-002/004 limitations remain; mocked-provider/integration tests do not replace these checks.

PLAN-007 must be approved before policy-specific acceptance tests can be defined. TASK-005 remains partial against that broader prerequisite; no TASK-006 authorization is implied. Existing TASK-001 restricted-development controls, pending security exception and no-deployment/no-signing/no-paid-service boundaries remain in force.
