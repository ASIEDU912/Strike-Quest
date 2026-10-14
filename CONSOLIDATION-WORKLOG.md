# Compare and consolidation development work log

## 2026-10-14 implementation session

This supplements, and does not replace, RESEARCH-STUDIO-WORKLOG.md. The owner approved Compare improvements and an app-wide redundancy cleanup. Work remains isolated to feat/research-studio.

### Starting state and preservation
- Read review HEAD `4e16ab4015aa3859320bee5d6ed3950ce6dffe4d`, main `7966836b4a0460e4b9dd97907fa374e8c9018d8b`, and open PRs (none). Historical account verification is recorded in the existing work log; it is not assumed to verify these changes.
- Reconstructed current Studio source locally and verified its Git blob hash `d1fae27161bb8c7c45337ac27d471f1134cb69ea` before editing. Current Studio stylesheet was likewise verified at `4088d32523dcce55650ff8739f9906704034f9d4`.
- Preserved the current account-enabled repository tree, index, account implementation, private journal, migrations, settings and existing tests. The local guest harness uses an older uploaded index only for isolated UI execution; that index is NOT uploaded or substituted for the current repository file.

### Implemented in review.2
- Watchlist and Compare have separate internal workspaces. Compare shows an accessible side-by-side metric table rather than duplicate watchlist cards; back/edit/research actions preserve selection.
- Recorded mode retains original snapshots. Shared correction, divisor and rounding explicitly recalculate a temporary preview only, without refreshing, saving, synchronizing or changing the research inputs. Original horizons remain visible. Formula and percentage gaps are explained as hypothetical, not expected returns.
- Sources, dates, incomplete settings, conflicting horizons and symbol mismatches remain explicit; mismatched instrument values are withheld. Three instruments use a contained table scroller on narrow screens, not horizontal page overflow.
- Research Overview owns the existing Brief; the duplicated metric trio appears only in Performance with clearer labels. Empty/manual data remains explained without fabricated charts.
- Compact Research mission and Home milestone summaries leave full progression in Quests. Existing functional Lumi controls stay intact. Quick Picks uses a single scrollable row, and Saved instructions open on demand. Corrected the Settings increment label to match its actual current-analysis behavior.
- What's New lists these implemented changes under a new review version. Service-worker cache revision changes without altering its shell allowlist, provider exclusions or offline behavior.

### Actual local verification
- Retained guest Node suite passed, including 30 Studio logic checks and the existing journal regressions. New comparison logic suite: 28 passed.
- New consolidation browser suite: 64 passed in system Chromium at 320/390/768/1440px, using the allowed inline guest harness with synthetic fixtures and in-memory storage. Current Studio source Git blob: `75e8c97bf83f40d0fb39fa1a5b0ce9e9d54d3fb2`.
- Tests exercised table/queue navigation, preview arithmetic/invalid values, record/current-input/progress/journal preservation, three columns, source mismatches, Research return path, unique Overview/Brief, specific-year controls, unavailable data, Saved help, What's New and page/network errors.
- Captured and inspected synthetic mobile comparison screenshots. The local harness is not the current account-enabled full application, WebKit, a physical iPhone, or an offline service-worker test. Browser navigation to test origins was blocked by the managed local browser; no policy bypass was attempted.
- Retained all existing hosted suites and added a consolidation matrix job for exact-commit Chromium/WebKit tests and screenshot artifacts. Hosted results are pending at commit creation; no readiness claim is made from packaging or local checks alone.

### Remaining work and boundaries
- Review exact-commit hosted results, repair regressions without weakening behavior/privacy assertions, and inspect resulting screenshots. Real email confirmation/recovery and physical-device tests remain separate unfinished account gates.
- Full Saved Ideas/Private Journal tab separation and further source/control consolidation remain future cleanup work. Normalized comparison history and shared horizon recalculation are not implemented without matching dated evidence; no fake chart series or substitute zero values are added.
- No merge, production/Pages deployment, Worker, DNS, CNAME, live market-data configuration, Supabase settings, user-record migration, paid tool or paid service changes. All QA uses synthetic fixtures; no real provider quota is consumed.
