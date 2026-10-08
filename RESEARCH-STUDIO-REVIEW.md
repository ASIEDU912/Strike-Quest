# StrikeQuests Research Studio — v10.2.0 review package

**Status: guest-first prototype for review. NOT published or merged.** October 8, 2026.

This review builds on the separate `feat/private-journal-backup` review (PR #8, commit `615485fa7c0e47fa6303230df025b882a5fe83fb`) and integrates the Research Studio UI on `feat/research-studio`. The private backup implementation is unchanged. Production remains at v10.1.5; this branch is not merged or deployed. The attached review bundle supplies the UI and navigation adaptations; the branch adds exact-commit CI and updates the offline-shell regression for the two new assets.

## Working features in this prototype

- Mobile-first Home with Lumi, research shortcuts and saved research resume.
- Five-button navigation: Home, Research, Watchlist, Saved, Quests; Settings stays in the header.
- Research screen with existing instrument search, seasonality, 52-week context and Low/Mid/High hypothetical scenarios. Existing inputs and saved records stay authoritative.
- Source-identified historical chart when current displayed data exactly match stored dated history; no invented series in Manual mode. Demo charts are labeled synthetic.
- Deterministic Research Brief with uncertainty and source caveats; no AI provider or automated trading advice.
- What's New panel with review-vs-release labels; grouped Settings; optional local nickname and quiet appearance mode.
- Transparent guest-only account status. No fake working sign-in, no cloud sync, and no automatic journal upload.
- All pre-existing private Research Check-in and pending private backup/restore workflows remain in this build.

## Verification and release requirements

- Exact-commit GitHub-hosted Chromium/WebKit verification is required for UI changes. The branch-only `Research Studio review` workflow runs core, private journal, Studio, tap and motion checks and saves synthetic screenshots together with their commit identifier. Results belong to their tested commit; consult its Actions run and the work log. No job publishes the app.
- Real login and cloud sync remain unconfigured. The owner approved Supabase Free for a separate development-only project; its secure connection and verified Free organization/capacity are still pending. No paid services, production changes or uploads of existing guest records are authorized. Account work requires access isolation, sign-in/out/recovery and previewed, consented migration tests. Private Research Check-in remains device-local and excluded from account sync.
- Owner preview/approval followed by a separate, explicitly authorized production merge and deployment.

## Hosted integration evidence

Tested source: `98287b4c9062556d4be7a191878d636604e2dd4d` on `feat/research-studio`. [Exact-commit Actions run](https://github.com/ASIEDU912/Strike-Quest/actions/runs/37816736175). All six jobs passed: source packaging, core, journal, Studio, interaction and motion. The subsequent results-documentation commit changes only Markdown; application and test source are identical to this verified commit.

- **104 Studio browser checks** passed in Chromium and WebKit at 320, 390, 768 and 1440px. Navigation preserves exact inputs, private records and XP; source-aware charts and briefs do not invent Manual history; settings and updates retain their privacy and focus behavior.
- Core checks passed, including **41 service-worker cache checks**, **21 browser UI/PWA flows**, **33 next-build**, **34 research-guidance** and **18 companion-placement** browser checks. Both shell paths restore all five destinations offline. Provider URLs, query strings and non-shell requests stay excluded from the app-shell cache.
- **18 Research Check-in** checks and **14 private journal-backup workflows** passed in both engines. No journal implementation was changed by the Studio integration.
- **78 interaction checks** across 50 host/stage combinations and **46 temporal motion checks** passed in Chromium/WebKit, including reduced-motion, pause/collapse and cosmetic responses without research or storage changes.
- Verified byte counts, SHA256 hashes and exact commit identifiers for twelve Studio screenshots and the core 320px scenario screenshot. Inspected Home, Research Brief, instrument/chart, Settings, What's New and the 320/390/768/1440px scenario layouts. Complete decimal amounts fit on one line at 32px or larger; the narrow-screen correction control fits above navigation. Tests and screenshots use synthetic fixtures only.

Real-device Safari/installed-PWA testing, provider sign-in and two-device sync remain separate, unverified gates. This is a guest-only branch review, with no merge or deployment.

## Local test evidence (supplementary)

During branch integration, `npm test` passed with all existing Node regressions, 48 private journal backup checks and 30 Studio logic checks. Browser binaries could not be installed in the integration environment; integrated-commit browser verification used the hosted workflow above. The earlier prototype evidence below is supplementary.

`npm test` passed, including 30 Studio logic checks, the private journal tests and original node regressions. `STUDIO_INLINE=1 STUDIO_BROWSERS=chromium CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:studio` passed **36** isolated Chromium browser checks at 320, 390 and 1440px, with synthetic fixture data and zero permitted provider/network calls. Managed Chromium in the verification environment blocks navigations even to locally intercepted synthetic domains, so `STUDIO_INLINE=1` loads the same app sources into a real Chromium page with isolated in-memory localStorage. This does **not** replace WebKit/Safari testing, physical-device testing or provider end-to-end checks.

## Preview without the live backend

Extract the archive into its own folder. Run `python -m http.server 8765` in that folder and open `http://localhost:8765/` on your machine. The default Demo mode is synthetic. Do not put private API keys into this public review archive. To run Node tests, use `npm install --ignore-scripts --no-audit --no-fund --package-lock=false`, then `npm test` and the above fixture browser command (requires a local Chromium executable and Playwright installation). The test scripts do not need an actual provider account.

## Integration changes compared with PR #8 source

- `index.html` (mobile zoom accessibility, stylesheet and script inclusion)
- `studio.css`, `studio.js` (new view/navigation, cards, data-context guidance, settings)
- `sw.js` (review-only cache revision and new assets)
- `package.json`, `test/studio.cjs`, `test/studio-browser.cjs` (test integration)
- Existing browser suites (start legacy research workflows at `#research`, open grouped Settings explicitly, and allow the two new local assets). Existing behavior/privacy assertions remain; service-worker checks now require all eleven shell assets and continue excluding query strings and provider URLs.
- `.github/workflows/research-studio-review.yml` (branch-only exact-commit tests and evidence; no deployment), `RESEARCH-STUDIO-WORKLOG.md` (integration status)

Do not treat the separate synthetic screenshots as market data, proof of correct prices or a real brokerage account.
