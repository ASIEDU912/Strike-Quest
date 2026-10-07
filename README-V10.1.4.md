# v10.1.4: Say hello to Lumi

Click or tap Lumi’s artwork in Research, Seasonality, Saved, Watchlist or Quests for a playful wave, curious head tilt or tail flourish. All five cosmetic forms respond. The native artwork button also works with Enter and Space, has a stable touch target and a visible keyboard-focus ring, and remains separate from guide, pause and collapse controls.

Each response lasts one second. Repeated activations replace and restart it immediately. A small, changing text cue and a separate polite announcement acknowledge every activation, including when motion is paused or reduced. Existing pause, hidden/offscreen-view, collapsed-panel and reduced-motion animation guards remain authoritative. Changing form or leaving the visible placement clears the response, and returning never replays it.

Reactions are cosmetic and local to the illustration. They do not award XP, alter saved research or preferences, navigate, select comparisons, contact providers or change any calculation. Only existing dated core milestones contribute to the same 500 XP total. Genuine reward announcements remain separate.

The shell cache revision is `strikequests-v10-1-4-lumi-taps`.

## Verification

- `npm test` includes native artwork structure, independent forepaws, finite CSS, cycling, rapid replacement, stale-timer protection, pause/hidden/evolution cleanup, stable controller controls, and all existing regressions.
- `npm run test:browser` and `npm run test:motion` retain the existing fixture-only application and temporal regression coverage.
- `npm run test:tap` checks all five placements and forms in Chromium and WebKit, real pointer/touch and keyboard activation, focus/touch geometry, repeated input, static feedback under motion restrictions, persistence, and independent body-part transforms and decoded screenshot pixels.

Browser suites use isolated synthetic fixtures and reject unexpected/provider traffic. The free public standard GitHub review job uses read-only repository contents, pinned actions, no secrets, no deployment and no artifact uploads. Bounded rendered evidence is emitted into ordinary job logs. An exact-head green run and inspected screenshot evidence are required before merge; local syntax and Node checks alone do not establish browser behavior.
