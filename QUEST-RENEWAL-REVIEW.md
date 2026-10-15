# Quest Renewal — 10.3.0-quest-review.1

Review-only continuation of the owner's approved stronger v10.1.5 energy + Studio clarity direction. No release, account activation, paid service, backend change or guest migration is part of this update.

## Implemented
- Stronger original blue/gold treatment for Home and the three hypothetical scenario cards. Math, evidence sources, Compare and saved-record behavior are unchanged.
- Visible 2Y · 10% View, Seasonality, Continue current ticker and Quick Picks shortcuts on Home and Research. Existing sessions/saved inputs are not reset. Changing working assumptions asks for acknowledgement; Cancel preserves them. Manual horizons still require appropriate inputs.
- Ten slower stages from Spark to Mythic Lumi at 0/100/240/430/680/1000/1400/1850/2400/3000 XP. Five existing body forms gain second-stage crest variants; the aura starts at stage five. This is ten cosmetic stages, not ten wholly new anatomical drawings.
- Next-stage progress, a ten-stage map, original unlocked-look collection and 24 additional optional research badges (34 including the ten original badges). Original XP and dates are retained. Higher thresholds rebalance the active stage, but original unlocked looks remain viewable.
- Badge review/confirmation, eligibility validation, repeat-claim prevention, storage-error/corrupt-record preservation and per-guest/account device separation. Different badges use different storage keys so simultaneous distinct claims do not overwrite one another. Web Locks serialize cooperating claims where available.
- Finite saved-research, seasonal-curiosity and milestone celebrations. Existing pause/collapse and reduced-motion controls remain authoritative; no XP for animation, repeated taps, trades or streaks.
- Versioned What's New entry and Settings explanation of the new progress scope.

## Deliberate limitations
New expedition badges are device-local. They are excluded from current account synchronization until a separate schema/consent integration is implemented and tested. Existing core milestone sync is unchanged. Private Research Check-in data, drafts, provider keys and local display name are not read by this module or included in its records. New badge records contain only version, earning time and research mode.

The five-look mascot library remains available for compatibility, with a separate ten-stage model used by the composed application. `quest-src/renewal.js` and `renewal.css` are bundled into the already-loaded Studio script: no new network request or service-worker allowlist expansion.

## Testing / status
Run `node test/quest-renewal.cjs` and `node test/quest-renewal-browser.cjs` after installing the repository's pinned dependencies. The browser suite uses only local synthetic fixtures at 320/390/768/1440px in Chromium and WebKit. Local inline Chromium QA is not Safari on a physical iPhone. Hosted exact-source results must be checked before calling this review ready. Authentication/email recovery and physical-device verification remain separate unfinished gates.

## Build boundary
The preparation workflow creates immutable Git objects only. It never moves a branch, merges a PR or deploys. A separate expected-head, non-force update through the connected GitHub tool is required to place the tested commit on `feat/research-studio`. Preserve the current main/production commit, existing rollback branches and all provider configuration.

## Expanded regression expectations
The composed app uses ten slower ranks, so the existing five-rank browser fixtures now seed valid core plus expedition awards at all ten boundaries. The initial 50 XP award deliberately remains Spark; 500 XP remains 500 earned points but is Navigator, not the terminal look. Existing checks for privacy, duplicate awards, exact inputs, visible controls, native artwork interactions and zero-motion preferences remain in force. Legacy five-look library unit checks are unchanged.
