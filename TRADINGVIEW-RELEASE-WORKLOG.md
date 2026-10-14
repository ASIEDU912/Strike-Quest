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
- Exact-source hosted run: https://github.com/ASIEDU912/Strike-Quest/actions/runs/38631167031 . It retains all 66 composed-app assertions (including offline shell) before the strengthened provider suite. At this note, it is still running. The workflow may prepare an immutable candidate commit after success, but cannot update main or deploy it.

### Remaining gates
- Read the completed hosted results, verify exact candidate source and manifest, inspect current screenshots, then publish only a passing candidate under the owner's approval. Check main again and preserve concurrent edits; never force-push.
- Verify actual published bytes and widget behavior after deployment. Keep the preferred rollback at the liked preview, not the older v10.1.5 baseline.
- Public login/cloud sync remain disabled and outside this narrow update. Private journals, guest research, SEC dated snapshots, current price backend and free-only boundaries stay intact.
- The raw review Evidence Studio implementation and release composition are separate entry paths. Before a later broader release, retain/port the tested TradingView composition rather than reintroducing its old opaque wrapper.

Official documentation reviewed: https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/ , https://www.tradingview.com/widget-docs/widget-formats/ , https://www.tradingview.com/widget/ . The branded widget is a separate public visual, not a licensed raw-data feed for the scenario engine. No subscription or signup was performed.
