# Research Studio public preview — release and rollback record

Prepared 9 October 2026. The owner authorized public publication with rollback readiness at 03:16 UTC. This authorization supersedes the earlier no-merge/deploy boundary for the UI/demo release only.

## Scope and gates

Release candidate derives from Studio `4e16ab4015aa3859320bee5d6ed3950ce6dffe4d`, whose application and tests match verified `5e85ea88848fdbac493534f1d4471286529af7d2`. PR #8 head `615485fa7c0e47fa6303230df025b882a5fe83fb` is already an ancestor; do not merge it a second time.

Home/Lumi, five-tab navigation, source-aware charts and Research Brief, grouped Settings, appearance and private journal backup remain as reviewed. Release preparation changes public-preview labels and the service-worker cache revision; it does not redesign the app or enable account services. No `account-config.json`, environment file or credential is included. Guest startup does not initialize Auth. Sign-in fails closed when static account configuration is absent.

Real email confirmation/recovery and physical iPhone/installed-PWA behavior remain unverified. Accounts/sync require separate authorization and verification. No database, OAuth, security setting, paid service, market-data backend, DNS or CNAME change is part of this release. Private journals stay local.

The local shell is unavailable (setup refresh failure). No local test run is claimed. All seven hosted Research Studio jobs must pass on the exact release candidate before merge; that candidate's Actions run and the merged PR are the verification records. Preview publication uses the existing GitHub Pages main/root deployment.

## Exact rollback point

- Previous production commit: `df587a2ef72e47f5518049a94c9d5df67fb2b890` (v10.1.5).
- Previous production tree: `3ccf8e26881de6445700122af835f5a7ca6877d7`.
- Preservation branch: `rollback/pre-studio-2026-10-09`, pointing at the previous production commit.
- Public URL: https://strikequests.com/.

If the owner requests rollback, inspect the then-current main head and any competing release first. Create a new rollback branch and a new commit whose parent is the current main head and whose tree is exactly `3ccf8e26881de6445700122af835f5a7ca6877d7`. Open a PR against main, review the diff, and merge using an expected-head check. This restores the full previous source tree while retaining shared history; never reset or force-push main. An ordinary `git revert -m 1 <Studio merge SHA>` is also suitable if no later work complicates the diff, provided its resulting tree matches the recorded rollback tree.

Wait for GitHub Pages deployment success, verify the deployed commit and compare public shell assets against the rollback source. The restored v10.1.5 service worker will replace the preview worker on the next online update; reload online if a browser still shows cached preview assets. Do not clear localStorage or delete user journals as part of rollback. Local preview data remains on the device; newer backup/Studio controls will not be present in the older UI.

## Publication verification

After merge, record the exact merge SHA, Pages run, candidate test run, public shell asset hashes, observed Home/Research navigation and unconfigured sign-in behavior in the release PR. Do not infer publication from merge success alone.
