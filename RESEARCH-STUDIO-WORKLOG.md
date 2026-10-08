# Research Studio development work log

## 2026-10-08 integration check
- Review branch verified at `bd532021256505a3bae7c50c7bbd675d166a2075` (one documentation/artifact-workflow commit after private-journal-backup base `615485fa7c0e47fa6303230df025b882a5fe83fb`). The Research Studio interface has **not** been committed.
- Existing v10.1.6 private backup PR #8 remains open; no merge or production deploy authorized.
- Review ZIP contains 8 changed files (`index.html`, `studio.js`, `studio.css`, `sw.js`, `package.json`, `test/studio.cjs`, `test/studio-browser.cjs`, `RESEARCH-STUDIO-REVIEW.md`). Local review files require transfer to this branch before exact-commit CI.
- The build environment cannot reach github.com by DNS and the GitHub connector cannot access local ZIP bytes; do not claim integration complete until files are actually committed, reviewed, and tests rerun against new head.
- Owner/provider configuration required to complete real optional account login and cross-device account sync. Device-local private Research Check-in journal remains excluded.
- Do not merge main, publish Pages, change Worker/DNS, or modify production without explicit approval.

## 2026-10-08 source integration
- Resumed from exact branch head `816f5de546478bf34bd76137611f8c4f0bef1634` using the attached `StrikeQuests-Research-Studio-v10.2-REVIEW(1).zip`.
- Repository transport is available in this session; the earlier transfer blocker is resolved. Integrated the eight UI/document/test files and eleven packaged browser-suite navigation adaptations. The underlying private journal and research implementation is unchanged from the verified private-journal-backup base.
- Preserved guest-only account status, private notes/provenance, append-only backup imports and public-summary isolation. No authentication or cloud provider was configured.
- `npm test` passed, including 30 Studio logic checks and 48 private journal backup checks. Updated the real offline browser regression to verify the Studio shell assets as well as the existing provider/query exclusions.
- Extended the existing branch-only workflow to run core, journal, Studio, tap and motion checks on the exact pushed commit in Chromium and WebKit, with synthetic screenshot artifacts. There are no deploy jobs or write permissions in that workflow.
- Local browser installation failed; exact-commit hosted browser validation and screenshot inspection are still required before claiming review readiness.
- User instruction remains: continue on `feat/research-studio`, without merging or deploying. PR #8, main, production, Worker and DNS remain unchanged.

## Hosted integration fixes
- Initial integrated commit `1ab9972f33b5851cf704eb4b625b6a7b74d82969` passed hosted Node checks and all 18 Research Check-in plus 14 journal-backup browser workflows in Chromium/WebKit. The real offline reload check caught anchor-bearing navigation missing the app-shell cache allowlist.
- Normalize only URL fragments when matching and writing shell cache entries. Query strings, credential-bearing requests and provider URLs remain excluded. All 15 service-worker checks pass, including anchor navigation and both Studio assets.
- Preserve full-width mobile scenario prices so large values retain the existing 32px minimum and do not compete with labels for horizontal space.
- Run every legacy browser suite before reporting the combined core result, so an early failure cannot hide other integration problems.
- Add bounded, synthetic-only screenshot evidence to hosted Studio logs with SHA256 and exact commit identifiers, in addition to the screenshot artifacts. Hosted checks must be rerun against these fixes.

## 2026-10-08 supplemental offline regression coverage
- Observed concurrent head `4d0071b19b862746ae9191ba5aec51c3b87a04d7` after a guarded update of an older candidate did not succeed. Preserved its service-worker fix, mobile typography, workflow and screenshot evidence changes; did not force-push or apply the superseded candidate.
- Extended, rather than replaced, the existing 15 service-worker assertions. The full local `npm test` passed with 41 cache checks (26 additional), 30 Studio logic checks, 48 private journal backup checks and all existing Node suites. New cases check canonical online/offline keys for both shell paths and all five destinations and reject query-bearing, provider, non-shell and POST requests.
- Added ten real-browser offline reload cases (five destinations at `/` and `/index.html`) plus a cache-unchanged assertion to `test/browser-flows.cjs`. These are new, unverified browser cases until the resulting exact-head CI completes; the original failing reload assertion is retained.
- Local system Chromium refuses loopback navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. No bypass was attempted. Earlier in this session the isolated inline fixture harness passed 36 Studio browser checks at 320/390/1440px, and its 390px Home screenshot was inspected. That run used an available Playwright 1.57 beta adapter and in-memory storage, not Safari, a physical iPhone, or the real offline service worker.
- No application source, private records, credentials, live-provider quota, account configuration, production, backend, DNS or other branches were changed by this supplemental test update. Authentication and cloud sync remain unimplemented/unverified.

## Render-position integration fix
- Preserved the concurrent supplemental offline-coverage commit `f9c29bb349dd710da91654630180830bd96585c3` and based this change on it without overwriting its tests or work log.
- Hosted commit `4d0071b19b862746ae9191ba5aec51c3b87a04d7` passed all 72 Studio checks, 18 Research Check-in workflows and 14 journal-backup workflows in Chromium/WebKit. The real offline reload passed after fragment normalization. All 34 research-guidance and 18 companion-placement browser checks also passed.
- Decoded eight bounded Studio screenshots and verified their byte counts, SHA256 hashes and exact commit metadata. Inspected the 390px Home, desktop Home and 320px WebKit Research Brief; navigation and readable evidence cards fit the intended design.
- A 320px large-price scenario assertion highlighted remaining rendering and width requirements. Navigation now finishes pending Studio cards before positioning or focusing a destination. The large-price fixture waits for rendered layout before measuring; its size, overflow and above-navigation assertions are unchanged.
- Added a real scenario-shortcut assertion at every Studio engine/viewport combination, checking unchanged research values and slider visibility after rendering. The resulting 78 Studio browser cases require hosted validation on this commit. Cancelled older motion/tap jobs do not count as complete validation.

## Decimal-price mobile refinement
- Commit `c16b41b25c70756a0d7605d85a17a252c62fd8e6` passed all 78 Studio browser cases, 41 Node cache checks, and the 21 UI/PWA, 34 guidance, 18 companion, 18 check-in and 14 backup browser workflows. Its motion and tap jobs completed successfully. The stricter existing decimal-price layout check still failed at 320px after rendering settled.
- Refined mobile scenario padding, heading margin, number line height and responsive font sizing while retaining the 32px minimum, full-width values and existing assertions. Expanded the Studio shortcut case to use a large reference, a 1200 change and a 0.5 increment so decimal precision is exercised in both engines.
- Added a bounded, commit-identified scenario screenshot and geometry diagnostics to the existing core workflow. These use only synthetic Manual-mode test inputs; no real journal, provider or account data is captured.
- Hosted checks must verify this refinement before review readiness is claimed. No merge, deployment or account/backend configuration is authorized by this work.

## Complete-amount visual refinement
- All core regressions passed at `f1bec56b3e7bf7629e01d19a9977e608a3b90d2c`, including all 33 next-build cases, the decimal-price visibility assertion, offline restoration and retained source/privacy behavior. The 78 Studio cases and all journal workflows passed again.
- Visual inspection of the commit-identified 320px scenario screenshot caught a trailing decimal digit wrapping below the high scenario. Preserved the 32px minimum while widening the price area and requiring complete amounts on one line.
- Both the existing 320/360/390px value matrix and the Chromium/WebKit Studio precision case now check wrapping as well as overflow, readability and control visibility. No earlier behavior/privacy assertion was weakened.
- Final checks and screenshot inspection must use the resulting exact commit. Prior passes are evidence for prior source; authentication, real-device testing and release authorization are separate.

## Review requirements
1. Inspect hosted tests and mobile/desktop evidence for the new exact commit, repair remaining regressions, and record verified results. Packaging success and local Node checks are not review readiness.
2. Configure the approved Supabase Free development-only project after the owner completes the connection gate below. No fake login; authentication and sync remain separate verification gates.
3. Real-device Safari/installed-PWA verification and any production release remain separate owner review steps.

## 2026-10-08 owner approval: Supabase development only
- The owner explicitly approved Supabase Free for a separate development-only login and sync project. This resolves provider selection and development-project authorization in the earlier entries; do not ask for that approval again.
- No paid services, billing upgrades, production changes or uploads/merges of existing guest records are authorized. The existing public market-data backend, Worker, DNS, CNAME and main branch remain out of scope.
- Discovery returned Supabase available but not installed/connected. Presented its connection prompt for the owner to complete secure sign-in. No Supabase organization/project was inspected or created, no authentication settings or database policies were applied, and no user records were uploaded. Connection is the current owner-action blocker; approval is not connection or completed setup.
- Once connected, inspect current organizations, subscription plans and projects before creating anything. Use a verified Free organization with available free-project capacity. Supabase billing is organization-based, so do not create a supposedly free project in a paid organization. Do not pause/delete unrelated projects or upgrade billing to make room. Proposed project name: `strikequests-auth-dev` (not created).
- Account scope remains watchlists, saved analyses, appearance preferences and research milestones. Keep Continue as guest prominent, keep guest/account data isolated, and require previewed consent before guest migration. Do not silently overwrite or upload guest records.
- Private Research Check-in reflections must remain device-local, excluded from account sync and public sharing, with private export/import preserved. Never request passwords, API keys, service-role credentials or recovery tokens in chat or put them in source, logs, screenshots, exports or shares.
- Required verification after implementation: actual provider sign-in, sign-out, recovery, denied cross-user reads/writes, guest isolation and migration cancellation/duplicates/conflicts. Sync requires separate persistence and two-device tests. Use labeled synthetic records only; guest/design readiness is not an authentication-enabled release.
- A stale work-log update was rejected; re-read and preserved the concurrent decimal-price refinement before appending this approval. This is a documentation-only update: application code and tests are unchanged, no new tests were executed in this approval session, and no completion claim is made. The commit requests skipped CI rather than replacing the substantive validation run.
