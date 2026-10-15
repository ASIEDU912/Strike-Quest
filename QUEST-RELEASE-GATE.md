# Quest Renewal 10.3 production gate — October 15, 2026

The owner explicitly authorized production verification and publication, stressing Automatic EOD as the default. The public-source audit found that the shared provider was configured but a new browser still defaulted to Demo. The production candidate corrects only the new-device fallback to Automatic EOD and retains existing explicit Demo/Manual/Automatic choices.

Exact production candidate: `332027278d989b18e2098f21d08d8416e6d8b4ca`, parent/current production `c93002aeef7c352458ebce441bd630154fb33dd0`. It composes Quest runtime source `f41e22927160ce53481b579fd9a53ea9af043593` with the current public shell. Current TradingView foreign-origin isolation, six dated SEC snapshots, account availability controls, config, CNAME and all other unchanged assets are preserved byte-for-byte. Candidate changes are limited to index.html, studio.js, mascot.js, sw.js, public-preview.js and release-manifest.json.

Exact candidate synthetic Chromium/WebKit production-composition checks passed in run `38724032215`, job `116385439205`. Coverage includes 320/390/1440px, fresh Automatic EOD startup, matched Quick Picks and Compare, specific-year seasonality, scenario confirmation/cancellation, badges, unavailable/stale/wrong/incomplete data, saved input preservation, private data/public-share exclusions and actual old-service-worker upgrade plus offline navigation. Those fixtures did not call a live data provider.

The separately authorized bounded operational EOD smoke must now confirm a normal default-instrument load through the unchanged shared endpoint. It makes no forced refresh, repeated symbol loop or direct provider request. It records cache status and before/after provider budget so cached delivery is not confused with an upstream refresh. Health alone is not evidence that market history loaded.

No main update or deployment yet. New expedition badges remain device-local. Public sign-in/recovery/cloud synchronization remain unavailable; fixture account tests and browser emulation are not actual owner authentication or a physical iPhone test. Do not describe this guest publication as finished account functionality.
