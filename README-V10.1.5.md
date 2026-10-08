# v10.1.5: Research Check-in

Return to a saved idea without rewriting it. Prepare a scenario in Research, then choose **Check in** on a Saved record for the same instrument. The comparison keeps the original reasoning alongside a frozen current research snapshot, with source, data session, horizon, correction, divisor, rounding increment, reference and historical-change inputs, and hypothetical Low/Mid/High levels. Available baseline, sample, trend and range context is included; missing legacy fields remain explicitly unknown.

Lumi asks whether the difference comes from assumptions, source quality, or dated evidence. Choose whether your thinking changed, still holds, or remains uncertain, and write a reflection. Self-reported observations require a separate source/date description and are never treated as verified market outcomes. Changes in hypothetical targets are never labeled returns, profits or prediction successes.

## Local and bounded

- Check-ins use a separate versioned device-local journal. Original saved ideas and existing XP/milestone stores remain intact.
- No provider is contacted by opening, comparing or saving a check-in. It does not load the original inputs, switch research mode, refresh a quote, recommend trades, or award XP.
- Different instruments cannot be saved as a check-in. Changed research inputs require an explicit recapture. Removed or edited originals invalidate the draft.
- Cancel, leaving Saved, browser navigation, and page departure discard unfinished drafts. A failed storage write keeps the draft for retry. Repeated save activation cannot append the same draft twice.
- Corrupted journals and malformed history remain untouched. New writes are blocked rather than silently resetting them. The journal is bounded to 100 entries and never silently discards older entries. Its copied notes and snapshots remain after an original idea is deleted; the separate Clear check-in journal control removes them only after confirmation.
- Check-ins and their notes are excluded from Share and Copy summary. They are private to this browser/device and are not cloud backups.
- Existing five Lumi placements and forms, artwork reactions, pause/collapse/reduced-motion behavior, saved-hypothesis review, 500-XP migration, and the fresh 2-Year/10% default remain unchanged.

## Verification

`npm test` retains all existing Node suites and adds Research Check-in fixtures. `npm run test:checkin` runs the new mobile Chromium and WebKit workflows. All browser requests are intercepted as local synthetic fixtures; unexpected network requests fail the suites. Existing browser, motion and tap regressions remain part of the free standard public GitHub review job, which uses no secrets, deployment, artifact upload, provider request or paid dependency.

Rendered evidence is emitted as bounded fixture screenshots in ordinary job logs. The release requires an exact-head green review run and visual inspection before merge, followed by successful Pages deployment and matching published asset hashes.

Cache revision: `strikequests-v10-1-5-research-checkin`.
