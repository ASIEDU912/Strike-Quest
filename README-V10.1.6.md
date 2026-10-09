# v10.1.6: Private Research Check-in backup (proposed)

Research Check-ins remain local to the browser/device. **Saved → Private journal backup** adds optional, manual export and import. This branch is for review; it does not publish the app. GitHub Pages publishes from `main` / repository root, so merge requires release approval after exact-head browser validation and visual review.

## Keep a private backup on a NAS

1. On the device containing your check-ins, open **Saved** and choose **Export journal (.json)**. Save the downloaded `StrikeQuests-Journal-<UTC timestamp>.json` file.
2. Copy the file into a private NAS folder, for example `StrikeQuests/Journal Backups`, using your NAS app or your usual private file connection. Retain dated files rather than overwriting the last known good backup. Do not create a public link.
3. On another device, download that file from the NAS to the device's file picker. On iPhone, use Safari's download/Files flow or your NAS app to make the JSON file available in Files; then open the StrikeQuests browser or installed app whose journal you want to restore.
4. In **Saved → Private journal backup**, choose the JSON file. Review the new-entry, duplicate, conflict and capacity counts. Choose **Import new check-ins** to apply the merge, or **Cancel import** to leave the journal unchanged.
5. Check the restored journal and export a fresh merged backup if you want to carry newly added entries back to the first device.

This is a file transfer, not automatic NAS sync. The public app never learns your NAS address, account, password or folder. Safari, an installed iPhone web app, and a PC browser can have separate storage; import into the browser/app you actually use. No claim is made that a synthetic file test verifies the availability, access controls or recovery of a particular physical NAS.

## Contents and privacy

The unencrypted JSON file contains private reflections, any self-reported observations, copied original/current reasoning, snapshot IDs and timestamps, hypothetical inputs/targets, source/session/coverage caveats, and recorded historical context. Store it with the same care as the journal. It is not an export of all saved analyses, watchlists, progress, settings, unfinished drafts or other application storage.

An explicit allowlist projects every exported record and nested snapshot. API-key settings and unrelated fields are excluded. Export and import also reject known locally configured credentials or explicit credential assignments pasted into journal text rather than silently editing a reflection. These checks cannot identify every arbitrary secret a person might paste into prose; keep passwords and credentials out of notes.

Export uses a local Blob download. Import reads the user-selected file locally. Neither operation calls a provider, app sharing, clipboard, NAS endpoint or cloud upload. Public Share/Copy summary continues to exclude journal reflections and copied notes. Importing grants no XP and neither loads nor changes a research scenario.

## Preservation and validation

- A separate version-1 backup envelope names its format, journal version, app version and export time. Only supported fields and versions are accepted. Import validates the entire file before offering a merge; it never partly accepts a malformed file. Limits are 8 MB per file and 100 entries. This accommodates a full journal with maximum-length Unicode notes.
- Entries retain their original IDs, original-record IDs, creation times, copied notes, snapshots and provenance. Missing legacy snapshot values remain null/unknown. Snapshot timestamps are retained as recorded, including an unrecognized legacy date that the journal displays as unknown. The original saved idea does not need to exist on the receiving device.
- Same-ID, identical-content entries are skipped, even if JSON properties are reordered. Exact repeated entries within one file are also skipped. A same-ID record with different content blocks the entire import. Both backup files can be retained for review; no conflict silently wins.
- A merge appends only new entries. Existing journal records are kept as stored; saved analyses, API settings, market caches, watchlists, badges and XP are untouched. Capacity overflow blocks rather than deleting older entries.
- Corrupt, unsupported or unreadable device storage blocks export/import without resetting it. A stale preview is invalidated when storage changes, and the raw journal is checked again immediately before writing. UI journal saves, clears and imports share an origin-wide Web Lock where supported. Older clients/browsers without Web Locks retain stale-preview protection; close older app tabs before restoring. Storage/quota failures preserve the preview for retry and do not report success.
- Cancel, app navigation, browser navigation and page departure discard pending imports. Late or superseded file reads cannot resurrect them. File names and entry text are displayed as text or escaped markup.

## Review checks

`npm test` includes `test/journal-backup.cjs` along with every existing Node suite. `npm run test:backup` exercises actual downloads, byte-preserving file transfer via a synthetic private-folder fixture, restoration into isolated receiving contexts, desktop/mobile layouts, keyboard confirmation, duplicate/conflict handling, malformed/future/oversized data, stale previews, quota retry, cancellation and cross-tab updates in Chromium and WebKit. All network and WebSocket traffic is fulfilled locally or blocked. Only synthetic records and invented credentials are used.

The existing free GitHub PR review workflow runs research, tap and motion jobs against the exact head commit, including both old check-in suites and the new backup suites. Bounded synthetic screenshots are emitted in ordinary review logs for visual inspection. No deployment, paid dependency, secrets or artifact uploads are added. After approval/merge, successful Pages deployment and published shell asset hashes still need verification.

Cache revision: `strikequests-v10-1-6-private-journal-backup`.
