# Quest Renewal verification

## Scope and source
The feature implementation is in immutable commit `94c1fa7ab5df972e4810537a020a43756a6b151f`, prepared from the existing review branch without replacing newer account/evidence work. The follow-up changes only the retained contextual-motion test, review workflows and this record; application bytes are unchanged from that implementation.

## Results before the final rerun
Review run `38681992915` passed the new behavior/browser, core, Studio, journal, account, evidence, consolidation and tap jobs. New coverage recorded 33 unit checks and 96 browser checks over Chromium/WebKit and widths 320, 390, 768 and 1440. All fixtures were synthetic; no live provider traffic was used.

The ten-stage mascot motion test passed its 34 temporal checks. The contextual motion suite failed its immediate first-greeting assertion after scrolling: animation name `none` rather than `sq-mascot-greet`. That failure is not counted as a pass.

The reviewed follow-up waits up to three seconds for the actual first greeting after scrolling, allowing asynchronous visibility delivery. It does not force visibility, replay a greeting, bypass a failed check, change XP or remove paint/repetition/privacy assertions. Hosted results must establish whether this resolves the failure.

## Completion gate
`Research Studio review` must pass all eight retained suites on the current branch head, and `Quest Renewal regression` must pass on the same head. A committed test change alone does not establish readiness. The workflows verify the exact checked-out SHA.

## Constraints
Work stays on `feat/research-studio`; no main merge or production deployment is authorized. Production main observed before this follow-up: `c93002aeef7c352458ebce441bd630154fb33dd0`.

The review uses standard runners only while the repository is public. Stored artifact uploads have been removed from review CI to avoid storage-quota exposure; source packages/screenshots remain ephemeral on the runner. No new paid services, subscriptions, provider/backend/DNS/CNAME changes or private user-data uploads are part of this work.

New expedition badges are device-local and separately scoped to guest/account workspaces; they are not part of cloud synchronization. Physical iPhone testing and existing real-owner authentication/recovery gates remain separate. Automated fixture checks must not be described as completed physical-device or live-account testing.
