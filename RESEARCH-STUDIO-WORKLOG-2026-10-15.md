# Research Studio development work log — October 15, 2026

This entry supplements RESEARCH-STUDIO-WORKLOG.md without replacing its history.

## Owner instruction and release boundary
The owner explicitly requested production verification, working Automatic EOD as the default, and then publication to see Quest Renewal live. App publication is authorized. Free-only, no paid upgrades, private journal isolation, no silent guest migration, and the earlier exclusion of market-data Worker/backend/DNS/CNAME changes remain in force. General permission to publish the UI is not permission to conceal failing market data or completed-account claims.

## Implemented release candidate
- Review runtime source: f41e22927160ce53481b579fd9a53ea9af043593, retaining the ten-stage Lumi journey, 24 new badges, preferred 2Y/10% shortcuts and prior Research Studio functionality.
- Current production/rollback source: c93002aeef7c352458ebce441bd630154fb33dd0.
- Exact composed candidate: 332027278d989b18e2098f21d08d8416e6d8b4ca, a direct child of current main. It is an immutable candidate, not a published release.
- Candidate changes are limited to index.html, studio.js, mascot.js, sw.js, public-preview.js and release-manifest.json. Preserve current public TradingView origin isolation, dated SEC assets and disabled public account availability. Config, CNAME, Worker and other production assets remain byte-for-byte unchanged.
- New-device startup and fallback are Automatic EOD, with the shared provider and 2Y/10% defaults. Existing explicit Manual/Demo/EOD choices and saved working assumptions are retained.
- Published-language/version identity in the candidate is 10.3.0. The new shell cache is strikequests-v10-3-quest-renewal-20261015-1; its allowlist is not widened.
- Created rollback/pre-quest-renewal-2026-10-15 at the exact previous production commit through the connected GitHub tool. No existing rollback reference was overwritten.

## Successful exact-candidate verification
Run 38724032215, production-browser job 116385439205, passed 73 checks against candidate 332027278d989b18e2098f21d08d8416e6d8b4ca. Chromium and WebKit were emulated browsers, not a physical iPhone. Synthetic fixtures only; no live market requests were used by this suite.

Coverage includes manifest hashes; fresh shared EOD startup without visitor keys; 320/390/1440px layouts; five-destination state preservation; preferred scenario consent/cancel; specific-year seasonality; matched Quick Picks and Compare; ten stages and 24 new badges; claim cancellation and duplicate prevention; reduced motion; implemented-only release notes; unavailable public accounts; Save/Load/Delete with custom inputs; private-note sharing exclusions; outage/wrong-symbol/missing-history/stale-data handling; existing Manual/Demo choices and saved/journal preservation; real old-service-worker upgrade; all ten offline shell-path/navigation combinations; provider/query/credential cache exclusions.

Synthetic screenshots were captured and identified by exact candidate hashes. They have not been visually reviewed in this session. Real-device Safari and real-account email/sign-in/recovery remain unverified. New expedition badges remain device-local and are not cloud-synced.

## Actual operational EOD checks: FAILED, publication blocked
- Initial public audit run 38722902603 confirmed that the current live HTML/config matched production main. Worker health was HTTP 200 with shared-eod mode and provider/cache configured. Health is not proof that a ticker's prices/history load.
- A bounded normal AAPL startup smoke in run 38724498975, job 116386878838, timed out waiting for verified loaded EOD. It made one ordinary shared endpoint request, not a forced refresh. Its first diagnostic logger did not retain response details on failure, so this is a failed check, not evidence of success.
- Added failure-path diagnostics without changing the application or relaxing its data checks. Run 38724986841, job 116388491109, checked the same immutable candidate using one ordinary default-instrument request.
- At 2026-10-15T11:07:03.092Z the unchanged shared service returned HTTP 502 for AAPL: ok=false, error="Shared market-data refresh failed." CORS allowed https://strikequests.com. No daily, weekly or monthly arrays were supplied. There were no blocked requests, request failures or uncaught app errors in this browser.
- The app correctly remained in auto_eod/shared mode at 2Y/10% and displayed "Market data could not be verified or loaded. Check source availability and use valid data. Manual inputs are still available." It produced no scenario from unverified/fake prices.
- Worker-reported provider budget was 15/21 before and 18/21 after the diagnostic smoke; prior audit observed 12/21. These are observed counters, not proof of successful upstream data retrieval. No further market requests, forced refreshes or repeated symbol tests are authorized by this blocked session; conserve the remaining free quota.
- The failure payload advertised additional code/providerHint/providerStage/providerStatus fields, but their values were not retained by the logger. Do not infer an invalid key, paid-plan requirement, rate limit or exact failing endpoint without evidence. Do not make another upstream-consuming request just to recover those fields; inspect existing server logs securely.
- No app publication, main update, Worker change, provider substitution, purchase, new paid service, real-user data upload or credential retrieval occurred. Main was re-read after the failed gate and still pointed to c93002aeef7c352458ebce441bd630154fb33dd0.

## Specific next owner-action gate
Obtain permission for a free-only inspection/repair of the existing Cloudflare market-data Worker/provider connection, which was previously excluded from changes. Keep its public URL, DNS/CNAME, pricing and journal boundaries unchanged. Inspect existing providerStage/code/providerHint from the failed request through a secure owner-accessible Cloudflare log/configuration path; do not request API secrets in chat and do not copy them into code, logs or screenshots. Plugin discovery did not return a Cloudflare connector in this session.

After a justified repair is authorized and verified with fixtures, perform a bounded normal cached EOD load with explicit freshness/session evidence. Revalidate changed candidate bytes if any, inspect exact running-app screenshots, re-read main/review/rollback and preserve concurrent edits, then fast-forward only the reviewed production composition. Confirm Pages deployment plus actual published manifest/asset hashes and live guest/EOD behavior before announcing publication. Do not describe browser fixtures as full account or physical-device verification.

The existing StrikeQuests development automation was already disabled when inspected; it was not restarted. The separate data-source research/provider-reply watches were not changed.
