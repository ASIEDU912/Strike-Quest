# Optional development accounts

This integration belongs to `feat/research-studio`. It is not merged or deployed. The existing Supabase project is `strikequests-auth-dev` (`vjxroixeqhtswzgqfcpk`) in the verified Free `StrikeQuests Development` organization. No paid resource, custom SMTP, OAuth provider, production configuration or existing user data is involved.

## Behavior

- Continue as guest remains available. Ordinary guest startup makes no Supabase request. Opening optional sign-in loads development configuration and the pinned, locally bundled Supabase SDK.
- Verified sign-in opens a separate local account workspace. It never copies guest research automatically. Signing out returns to the existing guest workspace and clears this device’s auth session. Offline logout explicitly distinguishes local removal from unconfirmed server revocation.
- Guest import previews eligible items and defaults every selection to unchecked. Accepted copies go into the account’s local workspace. Upload requires a separate synchronization review. Guest originals remain unchanged.
- Manual synchronization first reads the signed-in owner’s records, then previews additions, updates, deletions and conflicts. Consent and every conflict choice are required before applying. Revisions and a database trigger reject stale writes. A mixed upsert is atomic; tombstones prevent an old device silently reviving a deletion.
- Eligible categories: Watchlist and its snapshots; saved analyses including saved reasoning, source/coverage and historical context; appearance theme; earned research milestones and visited horizons. Source identity, synthetic/stale labels and earned timestamps are preserved.
- Private Research Check-in entries and reflections never enter account projections. Nickname, in-progress inputs/notes, provider credentials, caches and public-share payloads are excluded. Private journal backup/import continues to operate in the selected local workspace. Journals are not implicitly transferred when signing in or out.
- Malformed, duplicate, oversized or credential-bearing eligible records block synchronization visibly. Existing device records are kept. A changed workspace invalidates its preview; local storage failure rolls back attempted device changes and directs the user to review any confirmed cloud writes again.

## Local review

Run `npm ci --ignore-scripts` and `npm run dev`, then open `http://localhost:3000`. The server accepts only the verified development project URL and a modern publishable key from ignored local environment variables:

```
SQ_SUPABASE_URL=https://vjxroixeqhtswzgqfcpk.supabase.co
SQ_SUPABASE_PUBLISHABLE_KEY=<development publishable key>
```

No real key is committed. The development server serves an explicit asset allowlist; environment files and repository internals are inaccessible. Account configuration, auth callbacks, provider requests and account rows are excluded from service-worker caching. An unconfigured static preview remains a working guest app.

The SDK is pinned to `@supabase/supabase-js` 2.117.3 and bundled with esbuild 0.28.2. Reproduce it with `npm run build:account`; CI checks that it matches the committed bundle. The lockfile is committed. OAuth is not presented as configured.

Email confirmation and recovery use the provider’s real APIs with PKCE and same-origin redirects. Hosted Free email restrictions still apply. This work does not change Auth email settings or send real confirmation/recovery messages. A real owner-controlled email round-trip and physical iPhone/installed-PWA session behavior remain unverified.

Read-only calls to the actual provider confirmed email signup enabled and email confirmation required. An anonymous REST request was denied with HTTP 401 / Postgres 42501. These checks do not create users or establish email delivery.

## Database and verification

Migration files mirror the three applied development migrations: initial owner-private table, authenticated-only validator permissions, and typed provenance validation. Internal functions stay `SECURITY INVOKER`, with an empty search path and no anonymous execute grant. The existing owner RLS policies remain enabled.

`test/account-isolation.sql` passed against the actual development database after the final schema update: owner read/write, cross-user select/insert/update/delete denial, immutable ownership, revisions, atomic mixed-batch rollback, typed provenance, private/unknown/mistyped fields, tombstones, and anonymous/missing-identity denial. Both synthetic auth fixtures and all rows roll back. The security advisor returned no findings.

Local verification passed the retained Node suites plus 29 account isolation/consent-plan checks and 49 service-worker checks. The production dependency audit reported no vulnerabilities. Local Playwright browser downloads were unavailable; the hosted results below provide the browser verification. Browser tests use the actual pinned SDK with intercepted synthetic Auth and REST responses. They do not certify hosted email delivery or replace the real database isolation test.

## Final hosted review — 2026-10-09 UTC

Tested application and test source: `5e85ea88848fdbac493534f1d4471286529af7d2`. [Exact-commit Actions run](https://github.com/ASIEDU912/Strike-Quest/actions/runs/37863252510). All seven jobs passed: source packaging, core, account, Studio, journal, tap and motion. This evidence update changes documentation only.

- 48 account browser cases passed across Chromium and WebKit: guest privacy; verified sign-in; selected local guest copies; canceled previews; explicit sync consent; two isolated devices; duplicate handling; conflict choices; stale revisions; changed guest previews; sign-out and offline/expired-session behavior; unconfirmed signup; recovery failure/success and PKCE callback; saved/provenance/theme/milestone round-trips; tombstone propagation; safe cloud-label rendering; unavailable configuration.
- 104 Studio browser cases passed at 320/390/768/1440px. The retained core browser suites passed 11 regression, 21 UI/PWA, 33 next-build, 34 guidance and 18 companion-placement cases. The offline cache contains exactly 15 static shell assets and excludes configuration, Auth/REST responses and credential-bearing query URLs.
- 18 Research Check-in and 14 private backup browser workflows passed. The 78 Lumi tap checks covered 50 host/stage combinations; both motion suites passed (24 mascot and 22 companion temporal checks). All provider traffic was intercepted and synthetic.
- Four account JPEG evidence frames were verified against their byte counts, SHA-256 hashes and exact tested commit. Chromium and WebKit mobile frames were visually inspected. Provider settings/anonymous REST denial and the transactional database isolation test were checked separately against the real Free development project.

Final read-only database verification showed zero Auth users and zero sync records after fixture rollback. Main remains `df587a2ef72e47f5518049a94c9d5df67fb2b890`; PR #8 remains open and unmerged at `615485fa7c0e47fa6303230df025b882a5fe83fb`. No application deployment occurred. Real owner-controlled email confirmation/recovery, OAuth configuration and physical iPhone/installed-PWA verification remain separate gates.
