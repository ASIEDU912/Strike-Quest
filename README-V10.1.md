# v10.1.1 review notes

This frontend retains the original static HTML/PWA structure and the existing CNAME, icons, manifest and supporting files. It proposes a new private research flow for review; it does not change hosting, backend resources or credentials.

## Research flow

- Demo opens generated examples, explicitly labeled synthetic, with no provider requests. Manual accepts unverified user inputs and also blocks provider, health and remote symbol search. Automatic connects only when selected or restored from an explicitly chosen Automatic session.
- Eleven Quick Picks use local SVG identifying illustrations. All eight original instruments remain: AAPL, MSFT, NVDA, XLK, SPY, QQQ, SMH and AMZN, followed by GOOGL, TSLA and VOO. ETF cards identify the fund and provider. Five horizons offer 3M, 6M, 1Y, 2Y and 3Y perspectives. The selected historical baseline and quote session are displayed together.
- Green Low, gold Mid and red High cards show large, centered hypothetical prices and percentage differences from the input reference. Mobile cards retain the shield, scales and rocket artwork with the correction slider immediately below. Colors/icons identify scenarios, not safety, probability or expected profit. The shield does not indicate principal protection.
- Both 0–30% correction sliders use one state and update on input, with native keyboard controls and accessible value text. Repeated dragging recalculates from the same inputs and does not fetch data. Reset restores 10%; it does not clear badges or notes.
- Saved research restores the exact price, historical dollar change, custom divisor, increment and correction in private Manual mode. Saved Demo values remain labeled synthetic. Changing a Manual horizon clears its historical dollar change to prevent carrying the wrong basis forward.

## Formula and data quality

The existing formula is preserved. Projected = reference price + historical dollar change / divisor. High = projected; Mid = projected × (1 − correction/2); Low = projected × (1 − correction). Each is rounded upward to the selected increment. These are not listed option strikes, Greeks or profit forecasts.

Input validation rejects nonpositive/nonfinite prices and overflow. Provider validation rejects mismatched tickers, malformed dates, nonpositive closes, invalid high/low ranges and duplicate/out-of-order rows. Changed tickers cannot retain the previous ticker's targets. Request ordering prevents older responses from replacing newer selections.

Source, session, retrieval time, stale state and coverage are visible. Insufficient 52-week coverage is unavailable. Seasonality counts only adjacent completed months in the selected years; missing months are not zero returns. A real zero return still counts, and sample counts remain visible.

Adjustment conventions are inherited, not normalized by this update. Alpha daily closes can differ in adjustment basis from weekly/monthly history; Barchart history requests split/dividend adjustment. Corporate-action normalization and live provider availability require separate verification. Health alone does not prove that market data can be returned. Mocked tests do not establish live data availability.

## Notes and badges

Nine original milestones have distinct artwork: First Analysis (star), Trend Checked (arrow), 52W Range Reviewed (gauge), Seasonality Scout (calendar), Multi-Timeframe (stacked panels), Saved Analysis (journal), Watchlist Builder (heart), Side-by-Side (opposing cards), and Full Research Run (trophy). Thoughtful Return remains a separate companion milestone. A fresh browser has zero earned badges; valid context can supply in-progress steps without granting an award. Each badge is earned once through an explicit research action. Full Research Run requires the other eight milestones and an explicit finish action. Progress persists locally and does not reward trades, profits, streaks or repeated clicks. Reduced-motion settings disable toast animation.

Migration preserves valid dated legacy awards and their original timestamps, leaving both older browser stores intact. The four v10.1 awards map by meaning: note to Saved Analysis, sample to Seasonality Scout, horizon comparison to Multi-Timeframe, and review to the separate Thoughtful Return companion. Missing awards are never inferred from counters or available data. Notes show the minimum-length validation beside the input rather than on badge artwork.

Share/Copy excludes private notes, saved history and API keys. App-shell caching excludes provider URLs, query strings and unsuccessful responses. Previously saved browser keys retain their existing storage behavior; no credentials are shipped in this repository.

## Validation

The review runs 107 checks: 43 behavior, shared-service, cache and data-integrity checks, 10 badge-migration checks, and 54 isolated browser/UI/PWA checks. Coverage includes saved divisor restoration, Alpha-only Quick Picks, stale response races, malformed inputs, all horizons, correction 0/10/30%, keyboard input, private reload/offline flows, all original Quick Picks, distinct badge artwork and earned flows, 320/360/390px mobile layouts, four- through six-digit target prices and decimals, enlarged text, and reduced motion. Provider traffic is mocked throughout.

The app HTML is the exact reviewed build. Test harness adjustments only remove a machine-specific browser path and put generated evidence under an ignored portable directory. The original installed-app icons are preserved while the in-page SQ mark is updated.
