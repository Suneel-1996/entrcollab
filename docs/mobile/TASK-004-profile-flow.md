# TASK-004 — Mobile profile setup and editing

Owner approved the narrow onboarding/navigation flow on 15 October 2026. This implements the profile portion of PLAN-002 only; discovery, ideas, messaging and milestones remain separate decisions/tasks.

## Screens and transitions

| Situation/action | Screen/result |
| --- | --- |
| Signed out | Existing Google/development-OTP authentication screen. |
| Session restoring/revalidating | Loading indicator; profile contents hidden from display/accessibility. |
| Authenticated, owner profile GET returns 404 | Empty setup form; every sharing switch off. No profile is created until Save. |
| Authenticated, existing profile | Owner summary with Edit and Sign out. Private and member fields are labelled. |
| Edit | Full form prefilled with every field and sharing setting. |
| Save | Validate locally, then send one authenticated full replacement; disable editing/repeated submission until completion. |
| Successful save | Display normalized server-confirmed owner summary and saved confirmation. |
| Cancel editing | Return to saved summary; dirty edits require explicit discard confirmation. |
| Android hardware back while editing an existing profile | Same cancel/discard flow; back during saving is intercepted. No custom back navigation on setup/summary. |
| Sign out with dirty form | Confirm discard, then existing secure sign-out flow. |
| Load failure | Retry screen; a network/503 failure never becomes an empty onboarding form. |
| Save failure/network interruption | Keep draft in memory; explain save could not be confirmed and allow retry or confirmed reload. A timeout may occur after server commit. |
| 401/403 | Clear profile/draft and request sign-out only for the same active account. |
| Logout/access error/account change | Unmount/clear the previous private screen; late async results cannot repopulate it. Same-account re-login also gets a new screen key. |

No skip policy, public beta, discovery screen, profile completion percentage or future-feature access gate is added. No mobile member-directory view is in TASK-004. Auth remains authoritative; client state never bypasses backend account/visibility checks.

## Form and privacy

Display name is required (1–80 Unicode code points). Bio (0–2000), availability (0–200), skills and interests (up to 20 entries each, 1–50 per entry) are optional. Tags use individual add/remove inputs, preserving existing multiline/comma-containing backend entries. Empty tag inputs must be filled or removed. Normalized duplicate tags are rejected. Client validation follows TASK-003 bounds/control-character rules; server validation remains authoritative.

Each field has an independent “Share with signed-in members” switch. All start off for a new profile; editing preserves all existing switches. Every PUT sends all five values and all five visibility settings because the server performs full replacement. Turning one switch off does not accidentally reset another. Owners can see their own private values. Sharing means any active signed-in member, not a future team/connection relationship.

Profile and drafts remain in memory only. No AsyncStorage, SecureStore profile cache, persistent draft, analytics payload or profile/token logging was added. Unsaved changes are lost on process exit or an authentication error/sign-out. Transient auth revalidation hides the screen but preserves its in-memory draft for the same account; account switches/re-login cannot reuse it. In-flight writes may finish on the backend after the screen closes; the client ignores late results and does not claim server cancellation.

## Accessibility and error handling

Scrollable form, keyboard avoidance, multiline inputs, descriptive input/switch/add/remove labels, dynamic text scaling, inline validation text, first-invalid-input focus and polite loading/error announcements are implemented. Visibility is conveyed by text as well as switches. Summary text is selectable and rendered as text, never HTML. Layout uses a maximum content width for larger displays, with stacked cards and wrapping headings.

No raw HTTP/provider errors, access tokens, email allowlists or private server columns are displayed. API failures are mapped to generic states. No connectivity subscription is added: offline/network states are detected when requests fail. There is no offline save queue or automatic background retry; writes require an explicit user action.

## Transport and configuration

The profile client calls only the configured `/api/v1/profiles/me` GET/PUT using the current Supabase access token, retrieved at request time from the existing SDK. It verifies the active application account before and after asynchronous token retrieval, rejects expired/missing sessions, and never sends a client owner ID. The native fetch wrapper retains the ten-second timeout. Successful owner responses must match the expected internal application user ID; only allowlisted profile fields enter UI state. No credentials or redirect/API URLs are invented.

TASK-002 configuration blockers still apply: last check found Google disabled and invalid mobile API URL. Correct provider/API settings and a native development build are needed for real-device validation. No Expo Go auth flow, deployment, release signing or paid upgrade is authorized.

## Validation boundaries and manual device checklist

Automated tests exercise real profile client/controller/transport with mocked HTTP/provider state, plus the existing backend and PostgreSQL suites. Android/iOS exports validate bundling, not native taps/layout/keyboard/accessibility or actual Google sign-in. No React Native device renderer/simulator is installed in this cloud, so native UI interaction is unverified.

On an authorized native development build with valid development settings:

1. Sign in with an approved tester; verify first-time private setup and returning-user summary.
2. Enter invalid limits/duplicates; confirm errors, scrolling and first-invalid focus with screen reader and large text.
3. Add/remove skills/interests, change sharing, save, restart and verify the persisted server values/settings.
4. Edit and cancel; test discard/keep-editing, Android hardware back and dirty-form sign-out.
5. Test offline load/save, server rejection, retry and reload after an ambiguous save; ensure no false success or silent data loss.
6. Trigger session refresh while editing, then sign out/change account; confirm private data is hidden/cleared and cannot reappear.

See the [TASK-004 report](../TASK-004-report.md) for actual executed commands and results. TASK-001 restricted-development controls and pending dependency exceptions remain in force; no push/merge/TASK-005 without further owner authorization.
