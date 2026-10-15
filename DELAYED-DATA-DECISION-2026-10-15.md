# EOD preservation and free delayed-data review — 2026-10-15

## Owner decision and current scope
The owner accepted the recommendation to retain the existing market-data backend and Automatic EOD for the 2Y/10% scenarios and specific-year seasonality, with external charts kept separate. The owner now asks about free 15-minute-delayed data instead of real time. This authorizes research, not a speculative provider swap, new signup, paid service, secret exposure, silent guest-data migration or bypass of the existing release checks. The prior free-only repair approval remains available; do not ask for that general approval again. Preserve the backend if a safe, justified improvement cannot be established.

Before this session, connected GitHub reads showed review head 7c2a0c8d2814566f233d025bde303ab6ff033d8e and main/rollback c93002aeef7c352458ebce441bd630154fb33dd0. The open-PR query returned none. Read BACKEND-REPAIR-AUTHORIZATION-AND-AUDIT-2026-10-15.md before evaluating the new scope. The unpublished release candidate remains 332027278d989b18e2098f21d08d8416e6d8b4ca; this research does not validate live EOD or release it.

## Primary-source findings checked this session

### TradingView: retain the separate delayed display
TradingView offers free branded embedded widgets. Its widget-specific North America table labels NASDAQ, NYSE and Arca stock data from Cboe One as delayed. The table does not establish a universal exact 15-minute delay for every instrument. Preserve the provider's delay/source indicators; do not substitute a blanket Live or 15-minute badge without symbol-level evidence. Widget data is not available through a raw-data API or export for our scenario calculations. Do not scrape it.
Sources: https://www.tradingview.com/widget/ ; https://www.tradingview.com/widget-docs/markets/north-america/ ; https://www.tradingview.com/widget-docs/faq/data/

### FinaQuotes: additional explicit 15-minute display candidate, not a selected backend
Its Free-widget terms explicitly allow no-account iframe embedding at no charge, retain the by FinaQuotes attribution, limit each widget to 30 instruments and specify a 15-minute delay for exchange instruments. The interface refreshes about every 15 seconds; that is not the age of the underlying data. Raw-feed/historical access requires a separate agreement, and scraping/redistribution is restricted.
Its data policy states that prices are indicative, are not official venue prices and can come from undisclosed changing sources. Free widgets are as-is and can be limited/discontinued. Therefore provider documentation is not proof of operational reliability or an independently verified chain of exchange permissions. The instrument catalogue lists XLK and SPY, but that does not prove actual free-widget coverage, correct symbol mapping or fresh usable data. No live widget/API requests were executed to test those claims.
Disposition: investigate only as a removable, optional delayed-market-context display if needed; do not make it the core price/history source or promise its uptime, official price status, permanent availability or tested compatibility.
Sources: https://finaquotes.com/widgets/ ; https://finaquotes.com/terms/ ; https://finaquotes.com/data-policy/ ; https://finaquotes.com/docs/instruments/

### Alpaca: delayed personal access is not public redistribution permission
The current plan page lists free US stock/ETF historical access excluding the latest 15 minutes. The more specific market-data FAQ says historical SIP queries can use an end time at least 15 minutes old without the paid subscription. This is historical polling, not a claim of free live consolidated snapshots or unrestricted streaming. Its redistribution support page says Alpaca API data cannot be redistributed. A separate partner agreement or independently approved per-user integration would need review; no new account or connection is being proposed here.
Sources: https://docs.alpaca.markets/us/docs/about-market-data-api ; https://docs.alpaca.markets/us/docs/market-data-faq ; https://alpaca.markets/support/redistribute-alpaca-api

### Massive and Alpha Vantage: delay is not free on the documented offers
Massive Custom Bars identifies Basic as EOD and Starter at $29/month as 15-minute delayed. This is not a recommendation to buy, and the individual price is not a public redistribution license. Alpha Vantage explicitly describes realtime and 15-minute-delayed US stock data as premium-only. No project-specific exemption or public license was established by this research.
Sources: https://www.massive.com/docs/rest/stocks/aggregates/custom-bars ; https://www.alphavantage.co/support/

### Other leads screened, not selected
Stockdio's exchange directory lists US stocks/ETFs at a 15-minute delay. However, its terms require written approval for using market data in game functionality and for caching subject to data-owner restrictions. Given StrikeQuests' gamification and saved scenarios, do not treat it as cleared simply because signup is free.
Sources: https://www.stockdio.com/exchanges/index.html ; https://www.stockdio.com/terms-of-service.html
OHLC's free page advertises 15-minute-delayed quotes for five predefined stocks only, personal/testing use, with no ETFs. Commercial display/redistribution is not included. Thus it is not a free public replacement for this app.
Source: https://ohlc.io/pricing

## Architecture recommendation accepted and preserved
- EOD remains the main scenario/history mode, not a claim that the prior live provider failure has been resolved.
- Keep any permitted delayed widget separately sourced and labelled Market context — delayed, with provider delay/time information. Do not pull its prices into calculations, saved analyses, shares, or fallback caches.
- A recent delayed quote cannot by itself supply the dated multiyear daily/weekly/monthly history and adjustment information needed for seasonality and scenario calculations.
- Do not describe polling an EOD endpoint every 15 minutes as 15-minute-delayed market data.
- If an optional provider fails, the app should keep its independent research controls available and honestly mark the affected data unavailable rather than silently substituting invented/current-looking prices.

## What actually changed
This documentation-only addition records the owner's accepted direction and current primary-source research. No application/backend/Worker/DNS/CNAME change, new widget integration, provider request, cache refresh, quota consumption, account configuration, purchase, private-record access, email, automation change or publication was performed. No new application/browser tests were run because no runtime code changed. Existing test evidence must not be relabelled as tests of these candidate services.

The previously documented actual-EOD delivery failure and secure account-specific inspection requirement remain unresolved. This session did not perform another live health/market check. The original owner's working-EOD publication prerequisite has not been met by adding a delayed-display candidate.
