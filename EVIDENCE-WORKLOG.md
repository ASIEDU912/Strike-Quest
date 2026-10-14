# Evidence Studio development work log

## 2026-10-14 implementation

Owner approval: add TradingView public visuals, SEC fundamentals, evaluate only clearly licensed TickerInside/ETFIQ computed content, and create original StrikeQuests tools. No deployment or paid service approval is inferred.

### Verified starting point
- Read current review `932187c92a272fd5a95f8c3490b09e38205d50a6`, main `7966836b4a0460e4b9dd97907fa374e8c9018d8b`, open PRs (none), Research Studio and consolidation work logs.
- The mounted exact-source archive's revision marker matched the review SHA. Reconstructed its complete Git tree locally: `d9282d305455fb9f0abf13d7dab1b790e5c4d037`, matching the connected GitHub commit tree. This is the full current account-enabled source, not the older guest prototype.
- Preserved `index.html`, `studio.js`, `sw.js`, account/journal files, source configuration, Worker, CNAME, existing records and all other branches. The development server composes a separate review entry; the package generator composes a separate static review shell.

### Substantive implementation
- One Evidence Studio launcher in Research opens an accessible dialog instead of duplicating panels throughout the app.
- Opt-in, exchange-confirmed TradingView official widget in a storage-isolated iframe, with retained attribution and a provider fallback link. No extraction or use of widget prices in calculations.
- Keyless, loopback-only SEC relay with identification requirement, serial throttling, six-hour bounded public-data cache, no arbitrary proxy, rate-limit backoff and curated fact responses.
- Original Fundamentals Lens: conservative annual filing parser, aligned ratios, full units/periods/filing provenance and native revenue history. Contradictions and missing data are withheld.
- Original Exposure Lab: transient local basket overlap, explicit weights/coverage/dates and partial-data warnings. No record mutation, provider request, persistence, sync or sharing.
- TickerInside/ETFIQ evaluated against current primary-source terms. Their computed-only candidates and upstream exclusions are documented; no unverified response schema or data feed is activated.
- Added a dedicated evidence matrix job without removing or weakening existing jobs. No build/deployment jobs were added outside the existing isolated review workflow.

### Actual verification before commit
- Existing `npm test` completed successfully on the preserved application source.
- New deterministic evidence suite: 38 passed. Mock SEC relay/handler suite: 15 passed. Review composition, package isolation and service-worker allowlist suite: 12 passed (65 new Node checks total).
- Full current composed application: 48 new browser cases passed in system Chromium at 320/390/768/1440 px via the inline in-memory harness and installed Playwright 1.57 beta adapter. This differs from the pinned hosted browser environment and is not physical-iPhone or live-provider testing.
- Checked dialog navigation/focus, initial no-network behavior, explicit widget consent/opaque sandbox, no private sentinel in widget config, unavailable SEC state, synthetic fact calculations/provenance, cancelled requests, local overlap/coverage/errors, inactive candidate feeds, state preservation, mobile page geometry and uncaught errors.
- Captured eight synthetic screenshots and visually inspected mobile Fundamentals Lens and Exposure Lab. Refined fiscal-year chart labels to remain readable on narrow screens. No live quotes, account data or journal entries appear in screenshots.
- Browser provider transport and SEC data are mocked. No actual SEC or TradingView delivery success is claimed. Cache tests use the service-worker VM; installed offline behavior requires hosted/owner checks.

### Remaining checks
1. Inspect exact-commit hosted evidence tests, preserve their artifacts, and repair any genuine regressions. Packaging or local passing checks alone is not review readiness.
2. Verify real TradingView widget delivery in the isolated sandbox and real SEC requests with the operator's contact User-Agent on the development host. A failed/blocked source remains an honest unavailable state; no unrestricted proxy or weaker private-storage isolation is an approved fallback.
3. Validate precise computed-field schemas and source dates before activating any TickerInside/ETFIQ data. No raw vendor/issuer price or holdings reuse is assumed.
4. Existing broader consolidation browser failures (settings persistence, narrow scenario positioning and progression/companion compatibility), live account email/recovery and physical-device checks remain separate unfinished gates.

No production change, merge, deployment, paid subscription, new account, provider-key retrieval, real market-provider QA request, guest migration or private-journal upload occurred.

### Hosted fixture-run correction
- Committed the complete implementation as `661f2357776510a0cba8a7ca5bc6d3fdae7d1a9f`; guarded review-branch update succeeded. Run `38609109355` passed all 65 new Node checks, then the Chromium 320px browser pass reached its final error assertion and found a sandbox `navigator.serviceWorker` access exception.
- Inspected Playwright's context-level `serviceWorkers: 'block'` initializer: it reads `navigator.serviceWorker` in every frame. That access is forbidden by the deliberately opaque widget sandbox. Corrected this test-only fixture to stub registration solely in the top-level fixture origin, avoiding injection into the provider frame. Added explicit checks that no real service workers are created. The iframe still lacks `allow-same-origin`; all page-error, network, state-preservation and parent-storage-denial assertions are retained. No application security boundary is relaxed.
- Reran all 65 new Node checks and all 48 local inline Chromium cases successfully after this fixture correction. The resulting hosted Chromium/WebKit run remains to be inspected; the failed run is not treated as completed browser verification.
