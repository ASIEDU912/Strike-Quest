# v10.1.2: Guided research and honest snapshots

This is a frontend-only review iteration centered on 2-year scenario research, seasonality and an evolving research companion. It retains the existing design, eleven Quick Picks, nine core badge illustrations and Thoughtful Return, five horizons, and synchronized 0–30% correction controls.

## What changed

- A fresh session starts at the 2-Year wider view with a 10% correction and its existing 1.5 holding divisor. Explicit saved session horizons, corrections and overrides are restored unchanged. Top-level Low/Mid/High and Seasonality buttons jump directly to those tools without changing the scenario or granting rewards.
- Lumi is an animated original astro-fox with five distinct creature forms at 0/50/150/300/500 research XP. The final form retains its full-body gold/cyan aura. XP is derived once from valid earned core badges using the existing reward amounts; migrated badges preserve progress, legacy counters cannot manufacture it, and Thoughtful Return remains separate. Evolution and abilities are cosmetic. The companion is collapsible, pause/collapse choices persist locally, reduced motion is respected, and initialization or repeated actions never celebrate a new award.

- The Research and Quests screens suggest an achievable next step. The button opens the relevant controls or evidence and moves keyboard focus. It does not grant a badge, change data mode or request market data. Unavailable history has an explicit explanation; Manual users can still save notes and watch valid scenarios.
- Trend and range evidence appears beside its explicit acknowledgement. Completed, current Automatic history loads now record supported horizon visits, so Multi-Timeframe can be earned after exploring two supported horizons and saving a takeaway.
- Editing a provider reference price or historical dollar change switches to private Manual mode, preserves both typed values, cancels pending provider requests and discards the provider context. Correction, divisor and increment remain hypothetical assumptions.
- Saved research, watchlists and comparison cards label synthetic examples, Manual inputs, EOD sessions, stale snapshots and older records with unknown provenance. Synthetic origins survive repeated save/load cycles. Watchlist correction assumptions replace the old unlabeled score, and comparisons explain that differing sources, sessions and horizons are not an investment ranking.
- Invalid saved numeric fields cannot reuse the previous scenario or turn missing targets into zero-dollar comparison entries. Changing a loaded idea's inputs or note clears its review eligibility; earned badges remain intact.
- The app-shell cache includes the local mascot JavaScript/CSS and is versioned `strikequests-v10-1-2-research-guidance`. The footer uses the product version without a review/unpublished label.

## Boundaries

No provider, backend, credentials, hosting settings, analytics or account changes. Demo and Manual remain isolated from provider, health and remote search calls. No live market providers were used for validation. Automatic availability remains unverified. The freshness warning uses the existing conservative four-calendar-day heuristic; it is not a market holiday calendar or a live-data guarantee.

Scenarios remain hypothetical underlying price levels, not listed option strikes, option premiums, Greeks, probabilities or trade recommendations. Learning rewards remain independent of trading frequency and profits.

## Validation

Run the complete Node suite with `npm test`. Run all Playwright suites with `npm run test:browser`; use `CHROMIUM_EXECUTABLE` if required. The new suites are `test/research-guidance.cjs` and `test/research-guidance-browser.cjs`. They use local synthetic fixtures and block unmocked provider traffic.

Review validation on 2026-10-07:
- `npm test`: 122 passing behavior/cache/integration checks (53 original, 49 provenance/guidance, 20 core-experience), plus 85 mascot asset assertions and the separate mascot controller adapter suite. Historical 1-Year fixtures select that horizon explicitly; their assertions are preserved.
- Inline JavaScript, service worker and all test files pass syntax checks. Static HTML ID/reference checks and the changed-file credential/private-path scan pass.
- Final browser suites are syntax-checked but unrun. Earlier launch attempts stopped before page launch at Chromium's `socket() failed: Operation not permitted` environment restriction. No browser assertions passed and no new app screenshots were captured.
- This draft is not ready to merge until the browser suite and visual/accessibility review run in a supported browser environment. No production deployment was performed. The integrated browser layout and animation remain unverified; static mascot artwork inspection is not a substitute for browser QA.

The browser suite covers the next-step path, keyboard focus and visible evidence, repeated save/reload and correction flows, source labels, provider-edit detachment and 320px, 390px and desktop layouts. Browser checks must actually run before release: source checks and the Node DOM adapter do not establish visual correctness or accessibility.

This branch is for a draft pull request. Merging to the existing GitHub Pages source (`main`, repository root) can publish the site and requires release approval.
