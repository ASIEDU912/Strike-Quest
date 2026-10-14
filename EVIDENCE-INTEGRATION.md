# Evidence Studio: development-only integration

## Run the actual integrated review app

Use the existing Node development server:

```sh
npm run dev
```

Open the loopback address it prints. Research now has one **Evidence Studio** button. The server composes the evidence entry after the existing Studio and account scripts and composes a review-only service-worker shell. The original `index.html`, `sw.js`, market-data config, account code and private journal are not rewritten.

For SEC requests, set a descriptive `SEC_USER_AGENT` in the development process environment with a contact address controlled by the operator. It is an identification header, not an API key; keep operational contact configuration out of public source. Without it, the app reports `SEC_SETUP_REQUIRED` and makes no SEC request. Existing `.env` handling is retained by the development server. Do not put passwords, tokens or service-role keys in this variable.

For a static review package:

```sh
node scripts/evidence-shell.cjs /path/to/a-new-review-directory
```

The destination must not exist. Only enumerated public app assets are copied; no `.env`, account-config file, repository metadata, journal or saved records are included. Serve the result over local HTTP. **This static package has no SEC relay.** Its original local tools work, but SEC data loading needs `npm run dev` from the source checkout. This is not a production build/deploy instruction.

## Implemented tools

### TradingView public visual

The official Advanced Chart embed is requested only after the visitor selects/accepts an exchange-qualified symbol and checks explicit consent. It runs in an opaque-origin sandboxed iframe without `allow-same-origin`, rather than as third-party JavaScript in the app's storage origin. Referrers are suppressed. The widget is unloaded on tab, symbol, exchange or dialog changes. TradingView branding and source links are retained.

The widget is a separate public visual. Its quotes, sessions and entitlements are not automatically the inputs to StrikeQuests scenarios or seasonality. No scraping, price extraction, chart export or data redistribution is implemented. An iframe request is not reported as a verified quote. A provider link remains available if the widget is blocked or the listing is unsupported. Real TradingView compatibility with this sandbox still needs owner review; the automated provider transport is synthetic.

Official references checked October 14, 2026:
- https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
- https://www.tradingview.com/widget-docs/tutorials/build-page/widget-integration/
- https://www.tradingview.com/widget-docs/faq/general/

### SEC Fundamentals Lens and original visuals

The loopback-only development relay resolves one exact ticker to a CIK using SEC's company index, then requests that company's XBRL Company Facts. It permits no arbitrary upstream URLs, accepts only same-origin GET requests, uses a contact User-Agent, serializes requests at least 600 ms apart, caches public responses for six hours, caps response/cache size and backs off after 403/429 responses. Nothing is deployed to or changed in the public market-data Worker.

The original StrikeQuests parser selects annual 10-K/10-K/A US-GAAP/USD facts only. Facts need valid reporting and filing dates and cannot come from the future. Incompatible periods, filings, identities, contradictory values, unsupported tags and missing values are withheld, not estimated or replaced by zero. Ratios use aligned inputs from the same annual filing/period; prior revenue comparisons use the same tag and comparable annual durations. Latest amendments are allowed, so this is not an as-originally-reported backtest.

Reported revenue, net income, operating cash, PPE capital expenditures, assets and liabilities feed these original calculations:
- annual revenue change;
- net income / revenue;
- operating cash less payments to acquire property, plant and equipment (not all definitions of free cash flow);
- liabilities / assets (not debt / assets).

The native revenue-history SVG and fact table retain fiscal-period ends, units, filing dates and source documents. No P/E, quarterly/TTM, current valuation, forecast, investment recommendation or ETF look-through company ratios are manufactured. Missing data remains explicit.

Official references:
- https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- https://www.sec.gov/about/webmaster-frequently-asked-questions

The relay and parsing are tested with synthetic SEC responses. A real SEC fetch, identity confirmation and rendered real-filing review remain unverified in this session.

### Original Exposure Lab

Enter two sets of symbol/weight rows and optional as-of dates. The local calculation is the sum of the smaller weight for every shared symbol. It reports both input-coverage totals and the weights behind the overlap. Partial baskets are not normalized or described as complete diversification. Different/missing dates are visible, and future dates are rejected.

Inputs stay in transient dialog memory. They are not saved to accounts, synced, sent to providers, inserted into research records or put in public summaries. They are cleared by the explicit clear button or a page reload. No live holdings or stock-price data is invented. Original arithmetic and artwork do not grant reuse rights to any source data a visitor enters.

## Computed-content candidates: evaluation only

TickerInside and ETFIQ are documented in the Sources tab, but this build makes no requests to them and does not redisplay their data. Public JSON access alone is not a licence for every field. Any future adapter must validate the actual response schema and allowlist clearly licensed computed fields, dates, units and attribution; do not publish mixed raw responses wholesale.

| Source | Narrow candidate | Excluded / unresolved |
| --- | --- | --- |
| TickerInside | Publisher-computed overlap, look-through exposure, ownership counts and risk measures covered by its CC BY 4.0 notice, with attribution/source links | Upstream closing prices, blanket issuer holdings rights, bulk archive/history/flows rights; actual chosen response schema and data quality not yet verified |
| ETFIQ | Explicit `etfiq_fields` or files confirmed wholly publisher-computed, with attribution/source links | `issuer_fields`, `vendor_fields`, raw NAVs, closing prices and distributions; actual chosen response schema and data quality not yet verified |

Official rights/data references checked October 14, 2026:
- https://tickerinside.com/legal/
- https://tickerinside.com/api/
- https://etfiq.com/license/
- https://etfiq.com/data/

## Verification and release boundaries

Run `node test/research-evidence.cjs`, `node test/sec-research.cjs`, `node test/evidence-shell.cjs` and `node test/research-evidence-browser.cjs`. The browser suite defaults to the repository's pinned Chromium and WebKit. No test should consume live provider quota. `EVIDENCE_INLINE=1` is a limited local in-memory harness, not equivalent to real service-worker, Safari-device, authentication or live-provider validation.

The existing branch-only review workflow gains an evidence job, preserving every other suite. Its artifact includes synthetic screenshots and a composed static review package. All new results must be tied to the exact commit. Existing broader consolidation regressions and live authentication/email/recovery/physical-device gates are not declared resolved by these additions.

No paid resource, sign-up, billing action, production merge, Pages deployment, DNS/CNAME change, market-data backend change, guest migration or journal upload is authorized by this development build.
