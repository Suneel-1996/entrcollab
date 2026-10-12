# TASK-001 dependency security review

**Review date:** 12 October 2026. **Decision status:** recommendations only; owner approval pending. **Scope:** TASK-001 security review only. Base commit `7972e634bd87a2c090cbdb30ffc8c39b1612e77d`.

## Recommendation

Accept the engineering foundation for **restricted development only**, subject to explicit owner approval of the temporary exceptions below. Do not record a clean audit or production security approval. Revisit these exceptions within 30 days (11 November 2026), or before deployment, signing/update verification, accepting untrusted build/configuration inputs, or adding code that reaches the affected APIs, whichever comes first. If these conditions cannot be maintained, defer acceptance and prioritize remediation.

No directly exploitable path was identified in the current application's health endpoints or static mobile screen. That is a scoped reachability finding, not proof the dependencies are harmless. Metro/Expo/Prisma tooling still has real attack surfaces when supplied malicious patterns, configuration or cryptographic material. No dependency versions, overrides, application behavior or security gates were changed in this review. No `npm audit fix` or forced/major upgrade was run. No push, merge or TASK-002 work occurred.

## Fresh audit results and evidence

| Audit command (repository root) | Exit | High | Moderate | Critical | Total affected package entries |
| --- | --- | --- | --- | --- | --- |
| `npm --cache /workspace/.npm audit --json` | 1 | 18 | 7 | 0 | 25 |
| `npm --cache /workspace/.npm audit --omit=dev --json` | 1 | 18 | 7 | 0 | 25 |

Exit 1 here means vulnerabilities were reported; both commands returned valid complete audit responses. Neither result is a passing security gate. There are **four underlying advisories**, not 25 independent vulnerabilities: npm propagates findings to packages that depend on affected libraries, including dependency cycles between React Native/Metro packages.

Complete, unmodified responses are saved in [audit-full.json](security/TASK-001/audit-full.json) and [audit-production.json](security/TASK-001/audit-production.json). [Metadata](security/TASK-001/audit-metadata.json) records the UTC timestamp, commands, exit codes, baseline commit, tool versions and lockfile SHA-256. Both stderr streams were empty.

Additional evidence:

- [Dependency paths](security/TASK-001/dependency-paths.json): all 25 findings, representative workspace paths, and flattened/deduplicated `npm explain <package> --json` graph (49 nodes, 102 edges). Includes dependency types and constraints. [Prisma explanation](security/TASK-001/explain-deepmerge-ts.json) preserves the full optional-peer chain.
- [Registry metadata](security/TASK-001/registry-metadata.json): current releases and parent dependency constraints, queried with `npm --cache /workspace/.npm view <package> version dependencies engines --json`.
- Saved advisory text: [B](security/TASK-001/GHSA-vfj7-8cjw-p6xm.txt), [D](security/TASK-001/GHSA-ggr8-5vv4-36mx.txt), [F](security/TASK-001/GHSA-86w9-cpqp-85rv.txt), [U](security/TASK-001/GHSA-w5hq-g745-h8pq.txt). Source URLs are included. GitHub's API endpoint returned HTTP 403; the public advisory pages were accessible and used instead.
- [API runtime evidence](security/TASK-001/api-runtime-evidence.json) and [mobile bundle evidence](security/TASK-001/mobile-bundle-evidence.json) support the exposure assessment below.

## Underlying vulnerability table

Severity below follows npm's audit classification. CVSS values on the public advisory pages can differ; they do not alter the recorded npm counts.

| ID | Package / installed version | Advisory and CVE | Severity | Affected versions | Fixed version | Current dependency path / classification |
| --- | --- | --- | --- | --- | --- | --- |
| B | `braces@3.0.3` | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), CVE-2026-93687 | High | `<=3.0.3` | None published/listed; latest checked is 3.0.3 | mobile → expo → @expo/metro → metro-file-map → micromatch → braces. Production dependency graph; actual use is Metro build/watch tooling. |
| D | `deepmerge-ts@7.1.5` | [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), CVE-2026-40345 | High | `<8.0.0` | 8.0.0 (latest 8.0.2); major upgrade | api → prisma → @prisma/config → deepmerge-ts. Prisma is a declared dev dependency **and** optional peer of production @prisma/client; retained in production audit as devOptional. Actual use is CLI configuration. |
| F | `node-forge@1.4.0` | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), CVE-2026-85393 | High | `<=1.4.0` | None published/listed; latest checked is 1.4.0 | mobile → expo → @expo/cli → node-forge; also via @expo/code-signing-certificates. Production dependency graph; actual use is development/signing/certificate tooling. |
| U | `uuid@7.0.3` | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), CVE-2026-41907 | Moderate | `<11.1.1`; also `>=12.0.0 <12.0.1` and `>=13.0.0 <13.0.1` | 11.1.1 / 12.0.1 / 13.0.1 on respective lines; all major jumps from 7 | mobile → expo → @expo/config-plugins → xcode → uuid. Production dependency graph; native project generation tooling. |

F is an incomplete fix for earlier CVE-2026-33894; the current finding is CVE-2026-85393. U concerns API methods v3/v5/v6 with caller-provided buffers, not the package's major-version number.

## Every npm audit finding

`mobile` = `@entrcollab/mobile`; `api` = `@entrcollab/api`. P = in production dependency graph/audit; DO = declared development dependency and/or devOptional through production optional peer, also present in production audit. Neither label by itself proves runtime exploitability. For inherited rows, advisory IDs refer to the underlying table; npm does not identify a separate CVE or independent fixed package version. The fixed-version column states the remedy available for that dependency chain. Every high row maps to a specific recommendation in the decision section.

| Package | Installed | Severity | npm affected range | Underlying advisory IDs | Fixed version / chain remedy | Representative dependency path | Dependency class / exposure | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@expo/cli` | 57.0.28 | High | `<=0.0.0-canary-20231123-1b19f96-4 \|\| >=0.0.1-canary-20231125-d600e44` | B, F, U | No independent patched release established; B: unpatched, F: unpatched, U: needs uuid 11.1.1+ | mobile → expo → @expo/cli | P; CLI + bundled require shim | R-B, R-F, R-U |
| `@expo/code-signing-certificates` | 0.0.6 | High | `*` | F | No independent patched release established; F: unpatched | mobile → expo → @expo/cli → @expo/code-signing-certificates | P; build/development tooling | R-F |
| `@expo/config` | 57.0.10 | Moderate | `<=0.0.1-canary-20240418-8d74597 \|\| >=3.3.23-alpha.0` | U | No independent patched release established; U: needs uuid 11.1.1+ | mobile → expo → @expo/config | P; build/development tooling | R-U |
| `@expo/config-plugins` | 57.0.10 | Moderate | `*` | U | No independent patched release established; U: needs uuid 11.1.1+ | mobile → expo → @expo/config-plugins | P; build/development tooling | R-U |
| `@expo/inline-modules` | 0.1.7 | Moderate | `>=0.0.2-canary-20260409-6fc2991` | U | No independent patched release established; U: needs uuid 11.1.1+ | mobile → expo → @expo/cli → @expo/inline-modules | P; build/development tooling | R-U |
| `@expo/local-build-cache-provider` | 57.0.8 | Moderate | `*` | U | No independent patched release established; U: needs uuid 11.1.1+ | mobile → expo → @expo/local-build-cache-provider | P; build/development tooling | R-U |
| `@expo/metro` | 56.0.2 | High | `*` | B | No independent patched release established; B: unpatched | mobile → expo → @expo/metro | P; build/development tooling | R-B |
| `@expo/metro-config` | 57.0.13 | High | `<=0.0.1-canary-20240418-8d74597 \|\| >=0.1.49-alpha.0` | B, U | No independent patched release established; B: unpatched, U: needs uuid 11.1.1+ | mobile → expo → @expo/metro-config | P; build/development tooling | R-B, R-U |
| `@expo/prebuild-config` | 57.0.17 | Moderate | `*` | U | No independent patched release established; U: needs uuid 11.1.1+ | mobile → expo → @expo/cli → @expo/prebuild-config | P; build/development tooling | R-U |
| `@prisma/config` | 6.19.3 | High | `6.13.0-dev.1 - 8.1.0-dev.4` | D | No independent patched release established; D: needs deepmerge-ts 8+ | api → prisma → @prisma/config | DO; Prisma config/CLI | R-D |
| `@react-native/community-cli-plugin` | 0.86.3 | High | `*` | B | No independent patched release established; B: unpatched | mobile → react-native → @react-native/community-cli-plugin | P; build/development tooling | R-B |
| `@react-native/virtualized-lists` | 0.86.3 | High | `>=0.85.0-nightly-20260108-1236b6be4` | B | No independent patched release established; B: unpatched | mobile → react-native → @react-native/virtualized-lists | P; framework runtime, tooling advisory | R-B |
| `braces` | 3.0.3 | High | `*` | B | None published | mobile → expo → @expo/metro → metro-file-map → micromatch → braces | P; build/development tooling | R-B |
| `deepmerge-ts` | 7.1.5 | High | `<8.0.0` | D | 8.0.0 (major) | api → prisma → @prisma/config → deepmerge-ts | DO; Prisma config/CLI | R-D |
| `expo` | 57.0.27 | High | `>=45.0.0-beta.1` | B, F, U | No independent patched release established; B: unpatched, F: unpatched, U: needs uuid 11.1.1+ | mobile → expo | P; framework runtime, tooling advisory | R-B, R-F, R-U |
| `metro` | 0.84.5 | High | `>=0.71.0` | B | No independent patched release established; B: unpatched | mobile → expo → @expo/metro → metro | P; build/development tooling | R-B |
| `metro-config` | 0.84.5 | High | `>=0.71.0` | B | No independent patched release established; B: unpatched | mobile → expo → @expo/metro → metro-config | P; build/development tooling | R-B |
| `metro-file-map` | 0.84.5 | High | `*` | B | No independent patched release established; B: unpatched | mobile → expo → @expo/metro → metro-file-map | P; build/development tooling | R-B |
| `metro-transform-worker` | 0.84.5 | High | `>=0.71.0` | B | No independent patched release established; B: unpatched | mobile → expo → @expo/metro → metro-transform-worker | P; build/development tooling | R-B |
| `micromatch` | 4.0.8 | High | `>=0.2.0` | B | No independent patched release established; B: unpatched | mobile → expo → @expo/metro → metro-file-map → micromatch | P; build/development tooling | R-B |
| `node-forge` | 1.4.0 | High | `*` | F | None published | mobile → expo → @expo/cli → node-forge | P; build/development tooling | R-F |
| `prisma` | 6.19.3 | High | `6.13.0-dev.1 - 8.1.0-dev.4` | D | No independent patched release established; D: needs deepmerge-ts 8+ | api → prisma | DO; Prisma config/CLI | R-D |
| `react-native` | 0.86.3 | High | `>=0.73.0-nightly-20230506-1af868c52` | B | No independent patched release established; B: unpatched | mobile → react-native | P; framework runtime, tooling advisory | R-B |
| `uuid` | 7.0.3 | Moderate | `<11.1.1` | U | 11.1.1 (major from 7) | mobile → expo → @expo/config-plugins → xcode → uuid | P; build/development tooling | R-U |
| `xcode` | 3.0.1 | Moderate | `>=0.9.2` | U | No independent patched release established; U: needs uuid 11.1.1+ | mobile → expo → @expo/config-plugins → xcode | P; build/development tooling | R-U |

## Production audit interpretation and current reachability

The full and production-only responses have identical findings. The mobile manifest declares Expo/React Native as production dependencies; those packages bring their Node CLI/build tools along. Prisma is explicitly a dev dependency, but `@prisma/client` declares optional peer `prisma: "*"`; the lockfile marks Prisma/config/deepmerge as `devOptional`. `npm explain deepmerge-ts --json` shows both chains. It would be incorrect to call these findings absent from production installs merely because their current usage is tooling. A separate pruned deployment artifact has not been designed or tested in TASK-001.

**API:** source review found only public GET liveness/readiness handlers; readiness executes fixed `SELECT 1`, with no request-controlled glob, merge, signature or UUID operations. A compiled API instance on port 3002 returned 200 and exactly `{"status":"ok"}` for both endpoints. None of the 25 flagged packages appeared in CommonJS `require.cache` after those requests. This trace covers those exercised paths only; it does not prove absence from unexecuted/dynamically loaded/native code or from disk. The temporary instance was stopped after evidence collection.

**Mobile:** source review found a static foundation screen with no external data or API calls. Fresh Android and iOS exports with source maps succeeded. Neither source map contains `braces`, `deepmerge-ts`, `node-forge` or `uuid`. Framework packages `expo`, `react-native` and `@react-native/virtualized-lists` are present. One `@expo/cli` file is also present: `build/metro-require/require.js`, a bundle module-loader shim, not the vulnerable signing/glob code. An audit finding against a parent package therefore does not establish that its vulnerable dependency is in the shipped JS. Source-map inspection is evidence for these exports, not a native binary/supply-chain security proof.

**B — build/watch denial of service:** Metro file-map calls `micromatch.some(relativePath, globs, ...)` (`node_modules/metro-file-map/src/watchers/common.js:23`). A malicious deeply nested pattern can exhaust the parser stack. Here patterns come from trusted tooling/configuration; there is no application route supplying them. A crafted build configuration or dependency can still crash CI or a developer bundler. Repository write access is not the only future concern if code later accepts user-defined glob patterns. No claim is made that exposing Metro to arbitrary networks is safe.

**D — config merge denial of service:** `@prisma/config/dist/index.js:892` imports deepmerge as the c12 configuration merger. Exploitation requires recursive object graphs at matching paths in both merged inputs; plain JSON cannot create those references on its own. TASK-001 uses `schema.prisma` and env settings, with no custom Prisma JS/TS config or request-to-configuration bridge. Malicious executable config/plugins could trigger CLI failure; an ordinary health request cannot create the required input.

**F — signature verification integrity:** Expo's certificate helper calls `certificate.verify(certificate)` and `certificate.publicKey.verify(...)` (`@expo/code-signing-certificates/build/main.js:176,203`). The advisory requires attacker-crafted signature/DigestAlgorithm material and low-exponent RSA keys. The foundation exports unsigned JS bundles and has no certificate-upload, signing, update-verification or application RSA endpoint. This limits current exposure but cannot justify trusting this dependency for future signing. No cryptographic exploit was attempted.

**U — narrower than installed-version finding:** xcode's `lib/pbxProject.js:89` uses `uuid.v4()` with no output buffer. The advisory specifically concerns v3/v5/v6 methods with invalid caller-provided buffer bounds; that affected call shape was not found in this path. Residual risk returns if a different dependency uses the affected methods or UUID calls change.

## Update candidates and safe changes

| Candidate | Evidence and compatibility | Recommendation |
| --- | --- | --- |
| braces 3.0.3 → later patch/minor | Registry latest remains 3.0.3; micromatch 4.0.8 is current and requires `^3.0.3`. | No available safe version update eliminates B. Track upstream patch; rerun Metro exports and audits when published. |
| node-forge 1.4.0 → later compatible release | Registry latest remains 1.4.0. | No available safe update eliminates F. Do not invent a fixed version or downgrade to another vulnerable release. |
| @expo/code-signing-certificates 0.0.6 → 0.0.7 | 0.0.7 still requires node-forge `^1.4.0`; it is not a security fix for F. Under 0.0.x even patch-looking version changes need contract review. | Do not change it solely to reduce these findings; it would not do so. |
| Prisma 6.19.3 → later 6.x | 6.19.3 is the latest 6.x line checked; @prisma/config still pins deepmerge-ts exactly `7.1.5`. Prior 6.19.0 → 6.19.3 already removed the Effect finding. | No further supported Prisma 6 patch found that removes D. |
| deepmerge-ts 7.1.5 → 8.0.0+ | Fixed in 8; latest 8.0.2. Parent exact pin would require an override or a parent release adopting it. | Major override requires approval and config/API regression testing. Prefer upstream Prisma-compatible adoption. Not applied. |
| uuid 7.0.3 → 11.1.1+ | xcode 3.0.1 is latest checked, requires `^7.0.3`; Expo/config-plugin current versions still use xcode. | Major override requires approval and iOS project-generation tests. Prefer an updated xcode/Expo dependency chain. Not applied. |
| Forced npm fixes | Audit suggests Expo 44.0.6 / Prisma 6.12.0, downgrading accepted toolchains rather than providing a compatible patch. | Reject automatic forced fix. No `npm audit fix --force`, major upgrade or downgrade was run. |

**Result:** no verified non-breaking dependency update currently eliminates a remaining advisory. No package.json or lockfile change is proposed in this review. Packaging build tools outside the eventual runtime image can reduce installed exposure, but that is a future tested packaging change, not a reason to relabel this audit as passed.

## Recommended decisions for every remaining high finding

These are proposed exceptions, **not granted risk acceptance**. The owner must decide. Each of the 18 high rows above maps to R-B, R-D, R-F or their combination; R-U also covers inherited moderate findings. Accepting a parent package requires accepting every applicable underlying decision.

| Decision | High package entries covered | Proposed action and residual risk | Expiry / verification |
| --- | --- | --- | --- |
| R-B | braces, micromatch, metro-file-map, metro, metro-config, metro-transform-worker, @expo/metro, @expo/metro-config, @expo/cli, expo, @react-native/community-cli-plugin, react-native, @react-native/virtualized-lists | Temporarily accept only for trusted-config development/builds. Keep Metro loopback/private; treat untrusted PR/config/dependency content as untrusted code and execute in isolated CI without deployment credentials. Track an upstream braces fix. Build/watch process denial of service remains possible; do not accept for a feature that parses user-supplied patterns. These operational conditions must be maintained; this review does not claim all are enforced by repository configuration. | Review by 11 November 2026 or before changing input/network trust boundaries. After a compatible fix, repeat audit, lint/type/tests and both mobile exports. |
| R-D | deepmerge-ts, @prisma/config, prisma | Temporarily accept CLI-only use with reviewed config and no remote/untrusted executable Prisma config. Current health API does not merge input. Prefer a Prisma-compatible upstream patch adopting the fix; request approval before testing a major override. A malicious local configuration can still crash tool execution. | Same expiry; reopen before custom Prisma config/plugins or runtime merge usage. After remediation run generation, schema/migration checks, DB test, API type/build and healthy/unavailable live checks. |
| R-F | node-forge, @expo/code-signing-certificates, @expo/cli, expo | Temporarily accept only for the current unsigned foundation development workflow. **Do not accept for release signing or untrusted signature/certificate verification.** Require a patched upstream library or separately reviewed verification implementation before those workflows. Keep signing credentials out of untrusted builds. Potential signature-integrity impact remains in tooling if malicious material reaches affected verification. | Same expiry or before signing/update verification, whichever is earlier. Validate cryptographic regression cases and build tooling after an approved fix; mobile export alone cannot validate this repair. |
| R-U | No additional high root finding; propagated through @expo/cli/expo as well as moderate config/xcode entries | Document current non-reachability: xcode calls unaffected v4 without buffers. Accept temporarily with parent-update tracking; do not use affected methods with attacker-controlled bounds. Avoid an unnecessary unapproved major override. | Same expiry or before adding UUID buffer use; after remediation test native project generation and Expo export. |

Final recommendation: approve these limited development exceptions only if their boundaries are acceptable; otherwise keep TASK-001 security acceptance pending and authorize targeted remediation experiments. This review does not authorize deployment, subsequent tasks or suppression of audit findings.

## Checks performed and change scope

- Full and production-only fresh audits: both FAIL (exit 1), 25 findings each; complete JSON retained.
- Source/dependency trace for all 25 entries and public advisory review: complete. Versions/fixes are as observed on the review date.
- Compiled API loaded on temporary port 3002; real liveness and PostgreSQL readiness requests: PASS (2/2). Recorded module-load evidence. This did not change the application.
- `EXPO_NO_TELEMETRY=1 CI=1 npm --cache /workspace/.npm exec -w @entrcollab/mobile -- expo export --platform android --platform ios --source-maps --output-dir /tmp/task001-security-mobile`: PASS for both platforms. Source-map hashes/counts recorded; generated maps/binaries remain outside the repository.
- No approved dependency changes were needed or made, so a post-change lint/unit/full regression rerun is not applicable. The runtime and export checks above were performed to assess exposure, not represented as remediation tests.
- `git diff --check`: PASS. Security review documents/evidence only; package manifests, lockfile and application source unchanged. Audit exit failures remain explicit.

This review and `docs/security/TASK-001/` evidence are prepared for owner review alongside the [proposed 30-day exception](TASK-001-security-exception.md), which is PENDING APPROVAL. The owner authorized committing and pushing TASK-001 documentation and opening a PR; that authorization does not accept the security exception or authorize a merge or TASK-002.
