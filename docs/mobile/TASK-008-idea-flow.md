# TASK-008 mobile idea flow

Owner approved this narrow flow on 15 October 2026: Profile/My Ideas navigation; owner-only paginated idea list/detail; private draft creation/editing; Save opens detail; confirmation before publishing, archiving, sharing a publication or discarding unsaved changes. Archives are read-only. This approval excludes discovery, public links and DELETE.

## Navigation and privacy

Profile remains the initial signed-in screen, including setup when no profile exists. My Ideas remains accessible without completing a profile. Switching tabs clears the unmounted screen's local draft after a discard confirmation when dirty. Sign-out also confirms dirty changes. Authentication revalidation hides the entire workspace and its confirmation modal; only the same still-valid account can resume it. Logout, access denial, account change and a fresh login create a new workspace, clearing private screen state. Late controller responses cannot resurrect an unmounted screen.

My Ideas loads only `GET /api/v1/ideas` for the verified owner; optional state filters, Load more and Refresh use opaque cursors. Pages merge by ID; refresh/filter changes reset paging. There is no member search, public/direct-link reader, arbitrary owner input or profile-completion gate. Status plus effective audience appears on list/detail; draft/archive always say Only you even when their stored preference is MEMBERS.

## Editing and lifecycle

- New idea starts PRIVATE/DRAFT. Only title is required. Summary, description, needed skills and tags remain optional. Limits match TASK-007; tags/skills are individual entries, never comma-split or silently dropped.
- Save sends the entire content/visibility contract and opens the server-confirmed detail. It never publishes. Editing drafts/publications preserves all fields/settings. Full replacements use the API's last serialized write semantics; there is no optimistic version conflict detection across devices.
- Sharing toggle means “Share with signed-in members when published.” A draft stays owner-only. Publishing requires a modal naming its actual private/member audience and preserves visibility. Saving a MEMBERS publication (including changes to already shared content) requires confirmation. Making a publication private takes effect on Save; previously read copies cannot be recalled.
- Archive confirmation explains terminal read-only, owner-only state. Archive retains data; it is not deletion. Archived records have no Edit, Publish, Restore or Delete control.
- Dirty cancel, tab navigation, hardware back and sign-out require confirmation. Busy saves/actions block additional writes and navigation; two confirmation presses cannot enqueue duplicate actions. Android back and modal dismissal cancel appropriately. Drafts are memory-only; process termination can lose unsaved work. No offline queue/autosave is added.

## Recovery contract

Local validation identifies field errors before sending. Loading, empty list, generic errors and explicit retry controls are visible. Tokens, raw server errors, IDs, cursors and endpoint URLs are not rendered or logged. Unknown provider/server columns are discarded; malformed/other-owner DTOs fail closed.

401/403 clears screen data and invalidates the local session. A missing detail hides the prior record. Failed edits preserve local draft data; except for a validation 400, a fresh saved-state read is required before another mutation. Reload discards a dirty draft only after confirmation.

A failed/timed-out/malformed-success create may already have committed because POST has no idempotency key. Save is disabled; Check My Ideas opens the unfiltered owner list while retaining the draft. The user can inspect for a saved copy or explicitly acknowledge duplicate risk before returning to submit the draft again. No automatic create retry, title-based deduplication or silent deletion occurs. Opening a found copy requires discarding the pending local draft. Failed publish/archive may also have committed: actions/editing remain disabled until a fresh detail read establishes state.

## Validation limits and manual development checklist

Pure model/client/controller/authenticated transport tests use mocked responses, and existing HTTP/JWT/PostgreSQL tests exercise the unchanged server contract. Android/iOS export checks establish bundling only. No emulator/device or native UI interaction runner is available here; screen-reader focus, native Alerts, hardware back, keyboard/layout and device taps still require a restricted development device.

When approved development authentication and a reachable API are configured, check on Android and iOS: initial profile/setup; tab navigation without a completed profile; private create/detail/edit; field and empty-entry errors; member/private publish confirmation/cancel; shared publication edits and withdrawal; archive confirmation/read-only; multi-page filters/refresh; dirty discard/back/sign-out; background/foreground revalidation; account switch; simulated offline/timeout save uncertainty and reload recovery. Use development accounts only. Never add credentials to this document or commit.

TASK-002 live-provider configuration/native-login limits and TASK-001 dependency/security exception conditions remain. No production readiness, beta, paid service, deployment or release signing is authorized.
