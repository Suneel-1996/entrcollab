# TASK-002 account lifecycle and deferred policies

## Implemented rules

| State/event | Behavior |
| --- | --- |
| First verified approved-provider login | Provision one internal application identity keyed by verified Supabase subject. No email-based matching. |
| Returning login | Reuse identity; never overwrite account status or deletion timestamp. |
| Active account | `/auth/me` allowed after fresh JWT verification and database lookup. |
| Suspended account | All `/auth/me` access denied (403), independent of valid JWT/client metadata. No automatic reactivation. |
| Non-null deletionRequestedAt | Reversible access hold: deny (403). No deletion job, retention deadline or irreversible removal is created. |
| Sign-out | Clear this device's session and attempt revocation of this provider session; other devices unchanged. Existing JWTs can live until expiry. |
| Restart/expiry | Restore from secure storage and revalidate; refresh via Supabase; failed/expired authentication is not shown as authenticated. |

Suspension/hold changes are administrative database operations only, outside public API access. Operators must obtain owner authorization, identify the internal account and record the reason externally before making a reversible state change. This task does not create an admin endpoint, audit retention policy or self-service recovery/deletion flow.

## Linking deferred

No `linkIdentity`, email merge or cross-provider linking flow is implemented. The mapping is by trusted provider subject, never a client-supplied ID or email. Tokens declaring multiple providers are denied until policy approval. Supabase may perform its own automatic same-email linking; this provider behavior is not an application-approved merge policy. Review provider controls before enabling another sign-in method for an existing tester. Already minted tokens can retain older provider metadata until expiry. No application data is automatically merged, moved or deleted.

## Deletion deferred

Permanent account deletion, retention periods, identity reuse, erasure coordination with Supabase, and cancellation/recovery windows require owner approval. The optional deletion timestamp is only a reversible access hold. No `deleteUser`, cascade erasure, scheduled deletion or client-triggered delete endpoint exists.

## Recovery deferred where undecided

A normal Google login/session refresh is supported. Loss of provider access must go through the provider's established recovery process; the app must not reassign a subject based on an email claim or support request. Emergency application suspension can stop application access while an authorized operator handles provider-session revocation. Reinstatement, changing an identity's provider subject, linking another provider, and reversing a deletion hold require a separately approved policy and identity-verification procedure. No automatic account recovery, password reset or account reassignment is introduced.
