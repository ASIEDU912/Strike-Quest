# Strike Price Calculator — Barchart iPhone PWA

This build replaces Alpha Vantage with **Barchart OnDemand** as the automatic market-data source.

## Barchart data used
- `getQuote`: current/last price, 52-week high/low, trade timestamp/data mode
- `getHistory`: historical baseline, selected-period dollar performance, selected-period high/low, 1M and 3M trend

Period behavior mirrors Barchart's Performance Report:
- 3M, 6M, 1Y, 2Y → daily history
- 3Y → weekly history

Historical Performance ($) = Barchart current price - Barchart baseline close nearest/on-or-before the selected period start.

## Important
Automatic Barchart mode requires a **Barchart OnDemand API key/account with access to getQuote and getHistory**.
The public Barchart webpage is not scraped. The key is entered in the app and stored only in the browser/PWA's localStorage on the iPhone.

If Safari blocks a direct browser API request, the Barchart account may require site/browser authorization or a small server-side proxy. Manual mode remains available.

## GitHub update
Replace these files in the existing repository:
- `index.html`
- `manifest.webmanifest`
- `sw.js`

The existing root-level icon files can stay:
- `icon-180.png`
- `icon-192.png`
- `icon-512.png`

After GitHub Pages redeploys, fully close the installed iPhone app and reopen it. If needed, remove/re-add the Home Screen app to clear an older service-worker cache.
