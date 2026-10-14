# TradingView completion and public-preview work log

## 2026-10-14 bounded continuation

The owner likes the deployed preview and explicitly asked to add the working TradingView part next. Preserve the existing design and guest behavior. Their earlier approval permits publishing this app update, with rollback; it does not authorize payment, public account activation, private-record migration, or market-data Worker/DNS changes.

### Read and preserved
- Current public main: `4456c7cb4ec929da29657160f1ca036da0faa11a`, version `10.2.0-preview.1`.
- Review branch before this note: `cf0d635d071f89e8f66e56a4fe536a18faf74636`; all prior account, journal, consolidation and SEC work is retained.
- Existing isolated TradingView release-repair branch: `2dd828f2c7e92619f0cb545cbf1d2ae6b93b034f`. No open PR was returned.
- Read the current work log, release manifest, preparation script, workflow, browser tests and previous exact-commit artifacts before resuming.
- Created `rollback/pre-tradingview-2026-10-14` at `4456c7c`, preserving the preview the owner likes. This is the preferred rollback for this update; older pre-Studio rollback branches remain untouched.

### Actual work this session
- Verified prior artifact SHA-256 `8ab3c9212512a70f77abce758e8325f6ecb5622ca155b74b144109be396338c5`. Its 66 composed-app checks passed; the actual AAPL chart rendered and denied parent storage. That run failed because the test did not recognize the first-party widget-sheriff rule endpoint. The resulting repair was never deployed.
- Continued the existing release-repair pipeline rather than replacing the preview or inventing a new provider. It replaces the opaque srcdoc wrapper with a fixed foreign HTTPS TradingView iframe. Provider own-origin behavior is allowed; app-origin storage/document access, top navigation and storage-access permission remain unavailable. No third-party script runs in StrikeQuests' origin.
- Updated the real-provider suite at `8ca926420c2cfb93fda31eecbe8556a576192b53`: recognize only the exact first-party rule endpoint in addition to the existing provider destinations, and strengthen verification to AAPL, XLK and NVDA in Chromium and WebKit. Verify chart canvas AND intended company/fund identity, explicit consent, no synthetic-private sentinel in outbound HTTP, unchanged research, denied parent document/storage, and unload. Do not extract/save numerical chart data.
- Local syntax check of the changed test passed. Separate unchanged review-source baselines passed 38 evidence logic, 15 SEC relay and 12 shell checks. These are not live-provider or physical-device verification.
- Exact-source hosted run: https://github.com/ASIEDU912/Strike-Quest/actions/runs/38631167031 . It retains all 66 composed-app assertions (including offline shell) before the strengthened provider suite. At this initial note, it was still running. The workflow may prepare an immutable candidate commit after success, but cannot update main or deploy it.

### Gates at the initial note
- Read the completed hosted results, verify exact candidate source and manifest, inspect current screenshots, then publish only a passing candidate under the owner's approval. Check main again and preserve concurrent edits; never force-push.
- Verify actual published bytes and widget behavior after deployment. Keep the preferred rollback at the liked preview, not the older v10.1.5 baseline.
- Public login/cloud sync remain disabled and outside this narrow update. Private journals, guest research, SEC dated snapshots, current price backend and free-only boundaries stay intact.
- The raw review Evidence Studio implementation and release composition are separate entry paths. Before a later broader release, retain/port the tested TradingView composition rather than reintroducing its old opaque wrapper.

Official documentation reviewed: https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/ , https://www.tradingview.com/widget-docs/widget-formats/ , https://www.tradingview.com/widget/ . The branded widget is a separate public visual, not a licensed raw-data feed for the scenario engine. No subscription or signup was performed.

## Published and verified — 2026-10-14

The narrow TradingView update is complete and live as `10.2.0-preview.2`.

- Pre-release run `38631167031` passed all 66 composed-app checks and all six actual-provider combinations: AAPL, XLK and NVDA in Chromium and WebKit at 390px. Every chart canvas and intended listing rendered; parent storage/document access was denied; consent and unloading worked; research stayed unchanged; no unexpected HTTP requests or page errors were recorded.
- Verified archive SHA-256 `0a9df68f1a0e976a719e6bd21fd9813403f7882a5f8b663c734234776d54fd28`, all six screenshot hashes, and all 27 included application-file hashes. GitHub's artifact uploader omitted the unchanged empty hidden `.nojekyll`; the subsequent live check explicitly verified it too.
- The prepared release was `c93002aeef7c352458ebce441bd630154fb33dd0`, tree `6ddbba8c6744341569590776c68c20e7620a253c`, from verified source recipe `8ca926420c2cfb93fda31eecbe8556a576192b53`. Read the exact diff: only research-evidence.js, studio.js, public-preview.js, sw.js and release-manifest.json changed. The app layout, data backend/config, SEC snapshots, account code, journal, DNS and CNAME did not change.
- Re-read main at `4456c7c`, then advanced it to `c93002a` with expected-SHA protection and force=false. No force push or history reset. The owner's existing production approval and explicit TradingView request covered this change.
- Pages deployment passed: https://github.com/ASIEDU912/Strike-Quest/actions/runs/38631902063 .
- Strengthened read-only post-publication verification passed: https://github.com/ASIEDU912/Strike-Quest/actions/runs/38632054717 . It checked all 28 live manifest assets against both their SHA-256 and their exact release Git blob, confirmed the liked-preview rollback at `4456c7c`, and verified the actual XLK chart, consent, parent-storage/document denial and unloading on https://strikequests.com/ . No page errors or unapproved destinations were found.
- Downloaded and verified the live artifact SHA-256 `504f637cbb5257cb8485ae7277255b607c1f1616b70ed4bd7f36cc167599d721`; visually inspected the phone-width actual XLK chart. Its screenshot SHA-256 is `f2a2fedb61d8776de2f86cbb888702d5a03d08aa161c685c00db8bb398c6a22d`. These are browser-emulated phone widths, not a physical iPhone or installed iPhone PWA test.

### Owner use and rollback
Open Research, select a supported stock/ETF, then Evidence Studio > Market visual. Confirm the exchange, check the external-loading consent box, and select Load TradingView chart. TradingView receives the selected symbol and connection details only after consent; it does not supply raw prices to the StrikeQuests scenario/seasonality engine. The provider's branding is retained. No subscription, payment, API-key setup, account activation, guest migration or journal upload occurred.

Preferred rollback for this patch: `rollback/pre-tradingview-2026-10-14` at `4456c7cb4ec929da29657160f1ca036da0faa11a`, the preview the owner liked. The inherited release-manifest rollback fields still identify the older pre-evidence release; its `previousPublicCommit` and this work log identify the correct latest preview restoration point. Preserve local records and newer Git history when restoring; do not clear browser storage. The optional authentication/sync project remains separate and unfinished.
