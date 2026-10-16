# EOD connection recovery — 10.3.5

Changing a ticker or horizon while the shared service health check was pending could discard a healthy connection. Refresh then reported “not connected” without rechecking it. Connection checks now have their own lifetime, share an in-flight check, and survive ticker/horizon changes. Changing mode cancels that lifetime. Only the current ticker/horizon request may apply data.

Refresh rechecks an unavailable shared connection. A successful health check means the service is reachable; it does not verify EOD delivery. Connection/configuration failures, provider failures, request limits, access refusal and invalid data have distinct messages. Untrusted provider errors are not copied into the UI. Cached snapshots remain explicitly stale; saved research, journal and XP are preserved. Private modes make no requests. No periodic polling was added.

## Backend status and scope

The read-only October 16, 2026 03:24 UTC check found matching public/repository config and healthy service/CORS. The one bounded AAPL request returned HTTP 502, PROVIDER / UNKNOWN, daily stage, upstream HTTP 200. No further market requests were made. This frontend release does not repair or claim restoration of the backend, change credentials/access/budgets/providers, establish redistribution rights, or add an intraday feed.

The existing TradingView chart remains opt-in display context. It does not supply scenario/history/seasonality inputs.

## Verification

The new deterministic suite tests connection lifetime, overlapping requests, reconnect, private cancellation, failure distinctions, stale cache and research preservation. Browser checks cover Chromium/WebKit at 320/390/768/1440, keyboard/touch, status announcements, reduced motion, and saved data. Service-worker upgrade checks use exact 10.3.4 bytes and preserve records/inputs/XP with the loopback origin stopped. Provider responses in these tests are synthetic; a passing fixture test is not working live EOD.

Existing calculation, shared request, journal/reflection, badge, Lumi and cache tests remain required. Physical iPhone/VoiceOver and physical Safari offline behavior remain unverified.

## Future intraday refresh design — not implemented

The owner's requirement is a maximum total displayed quote age of 15 minutes during market hours. A permitted source must provide enough freshness margin for its publication delay, refresh interval, network time and cache age together. A source already delayed by 15 minutes cannot guarantee that ceiling with periodic polling.

Use the exchange's session calendar, timezone, daylight-saving changes, holidays and early closes. Keep EOD and intraday modes distinct. Store and validate the source quote timestamp, received time and session separately. Compute age from the source timestamp, not fetch time; reject impossible future timestamps. Values older than 15 minutes must be labeled stale and must not be presented as satisfying the current-price requirement.

Deduplicate refreshes per symbol/listing across users at the shared service, coalesce concurrent requests, and reuse permitted fresh cache entries. Enforce hard free daily/minute budgets before upstream calls, bounded retries/backoff and an explicit unavailable/stale response when no budget or sufficiently fresh value remains. Never silently exceed quotas, purchase capacity, or scrape an unauthorized source. Select cadence only after provider rights, timestamps, delays and free limits are verified.
