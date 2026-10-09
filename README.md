# StrikeQuests - Strike Price Calculator

## v10.1.6: Private journal backup (proposed)

Export a private Research Check-in JSON file, keep it on your device or NAS, and preview a safe merge on another device. IDs, dates, original reasoning and source details survive restoration. Duplicates are skipped; conflicts, invalid data and capacity overflow block the import without replacing existing records. [Backup, restoration and NAS instructions](README-V10.1.6.md).

## v10.1.5: Research Check-in

Revisit a saved idea beside a same-instrument current scenario, inspect its provenance and changed assumptions, and record your thinking in a private device-local journal. See [Research Check-in behavior and verification](README-V10.1.5.md).

## v10.1.4: Tap to greet Lumi

Lumi responds to artwork taps, clicks, Enter and Space across all five placements and forms, with finite playful reactions and static feedback when motion is paused or reduced. See [v10.1.4 interaction and verification notes](README-V10.1.4.md) and [v10.1.3 contextual guides](README-V10.1.3.md).

## v10.1.2 review iteration

This branch adds a 2-Year/10% fresh starting view, direct target and seasonality navigation, an animated evolving Lumi companion, guided research steps, source-aware saved/watchlist comparisons and safer Manual editing of provider scenarios. See [v10.1.2 behavior, validation and release boundaries](README-V10.1.2.md).

## v10.1.1 baseline

The proposed v10.1.1 frontend starts in private Demo mode with clearly labeled synthetic examples. Private Manual mode also disables provider, health and remote symbol-search requests. Automatic mode is an explicit choice and uses the public shared-service configuration in `config.json`, with the existing optional owner fallbacks.

This update preserves all eight original Quick Picks and adds three more, with local identifying icons and ETF provider labels. It adds five contextual horizons, prominent Low/Mid/High scenario prices, synchronized 0-30% correction sliders, input/history validation, source and coverage labels, and distinct artwork for nine research milestones. Previously earned badges migrate without granting missing awards; Thoughtful Return remains a separate companion. A new browser starts with zero earned badges. Notes and badge progress stay on that device; shared summaries exclude notes, history and keys.

See [v10.1.1 behavior, validation and limitations](README-V10.1.md). The review branch does not publish the site. The existing GitHub Pages source is `main` / repository root, so merging to `main` can trigger publication and requires release approval.

### Local checks

Serve the repository root with a local HTTP server, for example `python -m http.server 8000`, and open `http://localhost:8000`. Opening a file URL does not exercise the service worker.

With Node.js and the declared development dependency installed:

```sh
npm test
npm run test:browser
```

Browser tests use Playwright's Chromium by default. Set `CHROMIUM_EXECUTABLE` to an installed Chrome/Chromium executable when needed. All provider traffic in tests is intercepted with synthetic fixtures. Screenshots and test output go to ignored `test-results/`, or the directory specified by `EVIDENCE_DIR`.

## Historical v9.x documentation

The following notes are retained from the original app. Their automatic startup, badge/XP and validation-preset descriptions are superseded by the v10.1 review notes above.

**Research the market. Find your strike. Complete the quest.**

StrikeQuestss is a gamified, mobile-first research app for stocks and ETFs. It combines automated end-of-day market data, native seasonality, trend/range context, saved research, watchlists, side-by-side comparisons, and Low/Mid/High strike-zone targets.

## Public URL

**https://strikequests.com**

The app can continue to run from the GitHub Pages project URL while DNS/HTTPS provisioning finishes, but the public brand and canonical URL are StrikeQuestss.com.

## v9 public features
- Fully rebranded **StrikeQuestss** identity
- Automated EOD data path with Alpha Vantage fallback and Barchart-ready provider selection
- Native Seasonality with 5/10/15/20-year lookbacks
- Predictive ticker/company/ETF search
- Trend, 52-week range, historical performance, Seasonality, and Strike Zone research stages
- Watchlist snapshots and 2–3 ticker Compare Mode
- Saved analyses with load/delete controls
- Research XP, badges, quests, and persistent progress
- Shareable result summaries that point back to StrikeQuestss.com
- PWA support for iPhone, Android, tablet, and desktop
- Local-only API-key storage; no credentials are shipped in the repository

## Branding
- Product name: **StrikeQuestss**
- Readable phrase: **StrikeQuestsss**
- Domain: **strikequests.com**
- Installed app label: **StrikeQuestss**
- Tagline: **Research the market. Find your strike. Complete the quest.**
- Secondary theme line: **Data • Discipline • Progress**
- App icon: `icon-180.png`, `icon-192.png`, `icon-512.png`

## Recommended GitHub repository description

StrikeQuestss is a gamified stock and ETF research app with automated EOD data, seasonality, watchlists, comparisons, saved analyses, and shareable Low/Mid/High strike zones.

## GitHub Pages / custom domain
The package includes `CNAME` with `strikequests.com`. Keep it in the repository root. GitHub Pages should remain configured to deploy from `main` → `/(root)`. Once DNS verification completes, enable **Enforce HTTPS** in Settings → Pages.

## Install as an app
### iPhone / iPad
Open **https://strikequests.com** in Safari → Share → **Add to Home Screen** → keep **Open as Web App** enabled.

### Android
Open **https://strikequests.com** in Chrome/Edge/Samsung Internet → **Install app** or **Add to Home screen**.

## Data and safety note
StrikeQuestss is an informational research tool, not an investment recommendation. Automatic providers may require each user's own authorized API key unless a secure shared backend is added later. Keys are stored locally in the user's browser and are not included in share text or repository files.

## v9.1 validation cleanup
Validation presets are now hidden under Settings → Diagnostics & validation and use 2026 AAPL/XLK examples. The public Research screen no longer exposes developer validation controls.


## v9.2 — Flexible Seasonality
Seasonality now supports a 1–25 year range slider plus Specific Years selection, including Previous Year and Current YTD shortcuts.
