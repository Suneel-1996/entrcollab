# TASK-001 proposed security exception

**Record ID:** TASK-001-SEC-EX-001

**Status:** PENDING APPROVAL

**Proposed on:** 12 October 2026 (Asia/Kolkata)

**Proposed maximum period:** 30 calendar days

**Expiry:** 11 November 2026, 00:00 Asia/Kolkata (fixed end date; no automatic extension)

**Effective date:** Not effective until explicit owner approval is recorded below. Approval after the proposed date shortens the available period; it does not move expiry.

**Scope:** Suneel-1996/entrcollab, TASK-001 engineering foundation and the dependency versions listed below.

## Permission boundary

If approved, this exception permits **restricted development only**, including local development and isolated CI validation of the TASK-001 foundation. It **does not authorize deployment, release signing, production use, a public beta, distribution of release artifacts, or starting TASK-002**. It does not grant merge approval or waive any required security check.

This record is only a proposal. Creating, committing, pushing or opening a pull request for it does not constitute owner approval. Audit findings must remain visible; do not suppress or relabel the failing audits as passed.

## Basis and exposure

See [security review](TASK-001-security-review.md) and [complete audit evidence](security/TASK-001/audit-full.json). Both full and production-only audits report 18 high and 7 moderate affected package entries, tracing to the four advisories below. Package versions and lockfile identity are captured in [audit metadata](security/TASK-001/audit-metadata.json).

No directly exploitable path was identified in the current health-only API or static mobile screen. API module-load checks did not load affected packages, and mobile source maps excluded the four vulnerable libraries. Framework packages with inherited findings remain in the mobile bundle. These are scoped observations, not proof of absence across unexercised paths, native code or future features. Build and development tooling retains real exposure to malicious inputs.

## Advisories and proposed compensating controls

| Advisory / CVE | Package and severity | Exposure and residual risk | Mandatory conditions for the proposed exception | Remediation / verification |
| --- | --- | --- | --- | --- |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) / CVE-2026-93687 | braces 3.0.3; High | Expo/Metro → file mapping → micromatch → braces. Deeply nested malicious glob patterns can exhaust the stack and stop a bundler/build process. No current API accepts patterns; vulnerable code is absent from the exported app JS. | Use reviewed, trusted build/glob configuration. Keep Metro on loopback/private development access; do not expose it publicly. Run untrusted changes in isolated CI without deployment/signing credentials; never feed user-supplied patterns into this toolchain under this exception. | No published patched version was found. Track upstream; apply a compatible fix when available and rerun audit, lint/type/tests and Android/iOS exports. |
| [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) / CVE-2026-40345 | deepmerge-ts 7.1.5; High | Prisma config merger can exhaust the stack on matching recursive object graphs. Plain JSON alone cannot create the required cycles. Current API uses fixed SQL and no config merge. Prisma is a dev dependency and optional peer of production @prisma/client, so the production-only audit retains it. | Limit use to reviewed local CLI configuration; no untrusted executable config/plugins, remote configuration or request-driven merges. Isolate CLI execution from production data and credentials. | Fixed in 8.0.0, outside the current parent's exact pin. Prefer a supported Prisma update; any major override needs separate approval and config, generation, schema/migration, DB, API and live-health regression checks. |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) / CVE-2026-85393 | node-forge 1.4.0; High | Expo CLI/certificate tooling has RSA PKCS#1 v1.5 verification weakness for crafted material with low-exponent keys. Current workflow exports unsigned development bundles and has no application verification endpoint. Future signing/verification would change exposure materially. | No release signing, update verification, untrusted certificate/signature processing or reliance on this library as a trust boundary. Do not inject release/signing credentials into development or untrusted CI jobs. | No published patched version was found. Require an upstream patch or separately reviewed verification implementation before signing/verification workflows. Add cryptographic regression checks; a mobile export alone is insufficient. |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) / CVE-2026-41907 | uuid 7.0.3; Moderate | Expo native-project tooling → xcode → uuid. Advisory concerns v3/v5/v6 methods with invalid caller-provided output buffers. Current xcode path uses v4 without a buffer, so the affected call shape was not found. | Keep current reviewed UUID use; no affected methods with user-controlled buffer sizes/offsets. Reassess before any new direct UUID usage or native-project tooling change. | Fixed lines include 11.1.1, 12.0.1 and 13.0.1, all major changes from 7. Prefer a parent update. Any override requires separate approval and native project-generation/export checks. |

The 25 inherited package findings and their dependency paths are mapped to these four decisions in the security review. Approval must cover all four rows explicitly or identify exclusions. No safe compatible update that removes the remaining advisories was established in that review.

## Control verification and early termination

The controls above are **conditions to be verified and maintained**, not a claim that all are already enforced by repository code. The owner must assign a responsible maintainer and confirm the controls before activating this exception.

The exception ends at expiry or earlier if any control cannot be maintained, dependency/input/network trust boundaries change, a relevant exploit becomes reachable, or deployment/signing/production use is proposed. Stop the affected workflow and reopen security review in those cases. Re-audit when an upstream patch is available and before expiry. No automatic renewal, suppression, forced downgrade or unapproved major upgrade is permitted.

On expiry, stop relying on this exception. Remediate and verify, or obtain a newly reviewed exception before continuing the affected workflow. This record does not declare TASK-001 security acceptance complete while approval is pending.

## Owner decision

| Field | Value |
| --- | --- |
| Owner / risk approver name | PENDING — not supplied |
| Decision | PENDING APPROVAL |
| Approved advisory identifiers | PENDING — must name all approved GHSA identifiers or explicit exclusions |
| Approval date/time (Asia/Kolkata) | PENDING |
| Effective date/time | PENDING; cannot precede explicit approval |
| Fixed expiry | 11 November 2026, 00:00 Asia/Kolkata |
| Responsible maintainer | PENDING — owner to assign |
| Compensating controls verified by / date | PENDING |
| Approval evidence (PR review/comment or signed record) | PENDING |
| Additional restrictions / exclusions | PENDING |

Proposer recommendation: approve only the bounded restricted-development exception if every required condition is acceptable and verified. Otherwise reject/defer and authorize targeted remediation. **This proposal itself grants no exception.**
