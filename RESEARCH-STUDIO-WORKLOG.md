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

## Remaining review
1. Inspect hosted tests and mobile/desktop evidence for the integrated commit, repair any regressions, and record verified results.
2. Keep authentication and cross-device sync separate until provider selection and owner authorization; no fake login.
3. Real-device Safari/installed-PWA verification and any production release remain separate owner review steps.
