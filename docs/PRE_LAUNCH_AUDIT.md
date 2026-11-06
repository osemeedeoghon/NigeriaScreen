# NaijaScreen pre-launch audit

**Date:** 5 November 2026 · **Scope:** Stages 1–7, the whole repository · **Decision:** **NOT READY FOR PRODUCTION** (see section 9)

How it was tested, and what each kind of test can prove:

| Kind of test | Where | What it proves |
| --- | --- | --- |
| Unit tests | `npm test`, 231 tests | Pure TypeScript logic, no database |
| Local PostgreSQL tests | `npm run test:db`, 172 tests | The real SQL migrations run in PGlite (Postgres compiled to WebAssembly), with Supabase's `anon`/`authenticated` roles and `auth.uid()` simulated. **Not a Supabase project.** |
| Browser checks | Built-in browser against `next build && next start` | Routes, layouts, accessibility (`axe-core` 4.14, WCAG 2.1 AA), CSP behaviour. Run with no Supabase project and with placeholder settings only. |
| Live Supabase integration | Not performed | No Supabase project or `.env.local` exists. |

**Nothing in this audit verifies live Supabase authentication, sessions, email, or RLS on Supabase itself.**

---

## Report A: Executive summary

**Overall status.** All seven stages exist in code and pass their automated checks: 231 unit tests, 172 local Postgres tests, lint, TypeScript and the production build. The audit found **3 high, 4 medium and 9 low** security and quality issues in the code, plus SEO and resilience gaps. All of them are fixed, each with a regression test or a recorded browser check. Nothing critical was found in the code.

**Implemented features:**
- **Discovery:** a responsive branded homepage; film discovery with relevance-ranked search, filters, sorting and state kept in the URL; genre and film pages.
- **Accounts:** Supabase email/password sign-up, login, logout and password reset.
- **Viewer features:** watchlist, watched films, ratings and reviews.
- **Recommendations:** a rule-based recommender with explanations, feedback and preferences.
- **Where to Watch:** country filtering, sandboxed trailer embeds, and an admin area for managing them.
- **Filmmaker portal:** onboarding, profiles, companies, submissions, moderation, editorial promotions, a public directory and notifications.

**Major outstanding risks (not code defects):**
1. **Never tested against live Supabase.** Every authentication and authorisation guarantee is proven only in a local Postgres simulation.
2. **The catalogue is fictional.** All 25 films, the 20 people and the editorial stories are invented, and there are no real viewing options or trailers. A commercial launch needs real, licensed content.
3. **No legal pages.** There is no privacy policy, terms of use, cookie notice or content-takedown process, and no in-app account deletion or data export.
4. **No production infrastructure.** Hosting, domain, SMTP, monitoring, analytics, backups and incident procedures are not set up.
5. **Filmmaker-listed films are second-class.** Approved submissions have their own pages but aren't in search, recommendations, watchlists or reviews. Fixing that needs the planned move of the catalogue into Postgres.

**Ready for launch?** No. The code is in good shape for a **private beta** once a Supabase project is configured and the live checklist passes. A **public launch** also needs real content, legal pages and operations (Report H).

---

## Report B: Stage-by-stage audit

| Stage | Expected | Actual | Tests | Missing / defects |
| --- | --- | --- | --- | --- |
| 1. Foundation | Branded homepage and components, fictional data, accessibility | Implemented. Homepage sections, Navbar (hamburger below 1024px), Footer, CSS-generated poster art | Browser; `axe` with 0 violations on the homepage at desktop and mobile | None open. Fixed: a heading-order issue on grids |
| 2. Catalogue | Typed models, data layer, detail pages, validation | Implemented. 25 films, 8 genres, 20 people, credits, validator | `validateCatalogue`, catalogue and route tests | Data is fictional by design. Added: catalogue ids must equal `film-<slug>` (prevents clashes with published films) |
| 3. Discovery | Search, filters, sorting, URL state, genre pages | Implemented, plus relevance ranking from Stage 6 | Discovery, relevance and route tests; browser URL, back/forward and filter checks | Filters briefly show the full list before JavaScript loads. Errors don't show with JavaScript off. Year filter is a single year, not a range |
| 4. Accounts | Supabase Auth, profiles, watchlist, watched, reviews, RLS | Implemented with `@supabase/ssr` cookie sessions and server actions | 63 local Postgres RLS tests; validation tests; browser form validation | **Live sign-up, email, session, reset and logout not tested.** No account deletion or data export |
| 5. Where to Watch | Providers, options, verification, countries, trailers, admin | Implemented | 31 local Postgres tests (plus 2 audit regressions); trailer and URL tests; CSP browser test of iframe hosts | No real providers or options, by design. Fixed: verification now resets in the database when a link changes; `created_by` is hidden |
| 6. Recommendations | Content-based engine, explanations, feedback, preferences, search | Implemented, rule-based (not AI) | 49 engine and search unit tests; 19 local Postgres tests | "Popular" needs real activity. Not tested with live data |
| 7. Industry | Onboarding, profiles, companies, submissions, moderation, promotions, directory, notifications | Implemented. URL-based assets only; no uploads | 40 local Postgres tests on the final schema; 30 unit tests; browser form checks | Fixed: 9 issues from the security review (Report C). Open: published films are missing from search, recommendations and reviews; no uploads; no live test |

---

## Report C: Security report

The review traced every migration, server action, the proxy, the auth route and the URL rendering code. It was done independently by a separate reviewer, then each finding was confirmed with a failing case before fixing.

**Confirmed and fixed**

| ID | Severity | Finding | Affected | Fix | Verified by |
| --- | --- | --- | --- | --- | --- |
| SEC-01 | High | A verified profile could change its name or address and keep the badge | `guard_filmmaker_profile` | Identity changes reset verification | `stage8-hardening.test.ts`, "renaming a verified profile…" |
| SEC-02 | High | Approved or verified companies were fully editable, even mid-review (swap content after approval) | `guard_production_company`, `saveCompany` | Locked while pending; edits to an approved company go back to review and drop verification; rejected companies are read-only | Three tests in the "companies can't change what moderators reviewed" suite |
| SEC-03 | High | No security headers, so admin pages could be framed (clickjacking); no CSP | `next.config.ts` | CSP (frame-ancestors none; frame-src limited to the two trailer hosts), X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP, HSTS in production, `X-Powered-By` removed | curl headers; browser: external script and frame blocked, YouTube frame allowed, server action works under CSP |
| SEC-04 | Medium | Unlimited invitation and notification spam with attacker-written text | `invite_company_member` | Approved companies only; 10 open invites per company; 3 invites per person per day; fixed wording | "invitations can't be used for spam" (2 tests) |
| SEC-05 | Medium | Session cookies readable by JavaScript and not `Secure` | `lib/supabase/server.ts`, `proxy.ts`, `config.ts` | `httpOnly`, `SameSite=Lax`, `Secure` in production (the browser never needs them) | Code review only. **Needs live check** |
| SEC-06 | Medium | No abuse caps on companies, submissions or duplicate promotions | Stage 7 tables | 5 companies per owner, 20 open submissions, one pending promotion per film and placement | "abuse caps" tests |
| SEC-07 | Low | `mailto:` parameter injection through a company's public email | Company page, validation, DB constraint | Plain-address regex in the app and database; href encoded | DB and unit tests |
| SEC-08 | Low | Deleting the auth user of a company owner failed (blocks erasure requests) | `guard_company_member` | Cascading deletes allowed; direct owner removal still refused | "account deletion works for company owners" |
| SEC-09 | Low | Suspended managers kept roster powers | `company_members` policies | Policies require an active, unsuspended member (leaving still allowed) | "a suspended manager can't…" |
| SEC-10 | Low | Admins in a film's company could approve its promotion or hide its listing | `moderate_promotion`, `set_published_film_active` | `is_own_published_film()` check | "moderators can't act on their company's films" |
| SEC-11 | Low | `created_by` (admin user ids) readable by anonymous visitors; roster returned user ids | Stage 5 grants, `get_company_roster` | Column grants exclude `created_by`; roster returns `is_self` | "viewing data hides who created it"; roster test |
| SEC-12 | Low | A verified option's link could change and stay verified (enforced only in the app) | `stamp_verification` | Database resets to pending | "changing a verified option's link…" |
| SEC-13 | Info | A published film's id could clash with a catalogue id | `validateCatalogue` | Rule: id must equal `film-<slug>` | Unit test |

**Checked and sound** (confirmed by the independent reviewer and the tests):
- no API path can change `profiles.role`, `suspended_at` or reviewer columns;
- RLS limits every private table to its owner, and no server action trusts a user id from the client;
- the moderation functions check `is_admin()` and refuse self-review, and every security definer function pins `search_path`;
- iframes are rebuilt from a validated provider and id, allow-listed and sandboxed;
- `safeNextPath` blocks open redirects;
- there is no `dangerouslySetInnerHTML`, and React escapes all text;
- there is no SSRF (the server never fetches user-supplied URLs);
- the shared caches (`getPopularFilms`, spotlight) use a client with no cookies and public data only;
- there are no secrets in the browser bundles, and the Supabase client library isn't shipped to the browser;
- production dependencies have 0 known vulnerabilities (`npm audit --omit=dev`).

**Remaining risks**

| ID | Severity | Risk | Action |
| --- | --- | --- | --- |
| R-01 | High | None of the above has run on a real Supabase project | Run the live checklist (README items 1–20) with three accounts |
| R-02 | Medium | Changing a password doesn't require signing in again | Turn on Supabase "Secure password change" |
| R-03 | Medium | No app-level rate limiting beyond Supabase Auth's limits and the new database caps (e.g. review and feedback writes) | Use the host's rate limiting or WAF at launch |
| R-04 | Low | CSP needs `'unsafe-inline'` scripts (Next.js inline bootstrap); nonces would end static rendering | Accept, or move to nonce-based CSP later |
| R-05 | Low | Owner-supplied image links (avatars, logos, posters) are hotlinked from any https host: possible tracking pixels; mitigated by `no-referrer` | Add Supabase Storage uploads or an image proxy later |
| R-06 | Low | Direct API calls can create watchlist, review or feedback rows for well-formed but non-catalogue film ids (integrity only; the app ignores them) | Fixed by the Postgres catalogue migration (foreign keys) |
| R-07 | Info | 8 moderate advisories in dev-only lint tooling (`minimatch`) | Don't run `npm audit fix --force`; wait for `eslint-config-next` updates |

---

## Report D: Database report

**Migrations,** applied in order. All five apply cleanly to an empty database in every `npm run test:db` run.

| File | Contents |
| --- | --- |
| `20261105120000_stage4_accounts.sql` | `profiles` (+ sign-up trigger), `watchlist`, `watched_films`, `reviews`, `get_film_reviews()` |
| `20261106120000_stage5_where_to_watch.sql` | `profiles.role`, `is_admin()`, `viewing_providers`, `film_viewing_options`, `film_trailers`, verification trigger |
| `20261107120000_stage6_recommendations.sql` | Preference columns on `profiles`, `recommendation_feedback`, `get_popular_films()` (≥ 3 members), activity indexes |
| `20261108120000_stage7_industry.sql` | 10 industry tables, guard triggers, moderation and public-directory functions, notifications |
| `20261109120000_stage8_hardening.sql` | Audit fixes (Report C) |

**Tables (18), all with RLS enabled** (asserted by test):
- **Accounts and viewer data:** `profiles`, `watchlist`, `watched_films`, `reviews`, `recommendation_feedback`.
- **Where to Watch:** `viewing_providers`, `film_viewing_options`, `film_trailers`.
- **Industry:** `industry_applications`, `filmmaker_profiles`, `production_companies`, `company_members`, `film_submissions`, `submission_events`, `published_films`, `promotion_requests`, `notifications`, `moderation_notes`.

**Relationships:**
- **To accounts:** every user-owned row references `auth.users` with `on delete cascade`; reviewer and author columns use `set null`.
- **Where to Watch:** `film_viewing_options.provider_id` uses `restrict` (deactivate rather than delete a provider).
- **Industry:** `company_members` → `production_companies` cascades; `published_films` ↔ `film_submissions` is linked both ways (`set null`); `promotion_requests.film_id` → `published_films` cascades.
- **Films:** film references are checked by format only, because the catalogue is still TypeScript. Foreign keys get added when the catalogue moves into Postgres (the statements are at the end of the Stage 4 migration).

**Constraints:**
- **No duplicates:** unique (user, film) on every per-film table; unique slugs and names; one review per user and film; one pending promotion per film and placement.
- **Allowed values:** status and role check constraints.
- **Safe values:** `https://` link checks; ISO country and language checks; length limits.
- **Readiness checks:** submissions need the rights confirmation and complete details before review.

**Indexes:** on every owner and lookup path, the public partial indexes, and activity-window indexes for popularity.

**Still open:**
- foreign keys to a `films` table, which needs the catalogue migration;
- indexes on `film_submissions.company_id`, `published_films.company_id` and `promotion_requests.film_id`. These are low priority at current volumes; add them before large data.
- **Live Supabase checks:** whether the Supabase Security Advisor and Performance Advisor flag anything, and whether `supabase db push` reproduces the schema exactly.

---

## Report E: Quality assurance report

| Check | Result |
| --- | --- |
| Unit tests (`npm test`) | **231 passed, 0 failed** (57 suites) |
| Local Postgres tests (`npm run test:db`) | **172 passed, 0 failed** (41 suites; 5 migrations; separate users) |
| TypeScript (`npx tsc --noEmit`) | **0 errors** |
| Lint (`npm run lint`) | **0 errors, 0 warnings** |
| Production build (`npm run build`) | **Passes**: 69 routes, with no Supabase settings and with placeholder settings |
| Accessibility (`axe-core`, WCAG 2.1 AA + best practice) | 11 pages at desktop width, 5 at mobile: **0 violations** after fixing heading order |
| Responsive | No horizontal scroll at 375px on the pages checked; navbar fits at 1024px |
| Route status | Correct 200, 307 (to sign-in) and 404 for valid, protected and unknown routes, with and without Supabase |
| Browser console | No hydration errors. One iframe attribute warning, fixed |

**Test limits:**
- **No end-to-end framework** (Playwright isn't installed; adding it needs your approval). End-to-end journeys were run by hand in the built-in browser.
- **Signed-in journeys** (registration, email confirmation, session persistence, watchlist and review writes, moderation in the UI) **were not run**, because they need a Supabase project.
- **The local Postgres simulation** stands in for Supabase's `auth` schema and API roles. It doesn't run PostgREST, real JWTs or Supabase Auth.

---

## Report F: Performance and SEO report

**Performance findings:**
- **JavaScript:** about 282 KB gzipped across all routes' chunks, the largest being React DOM (70 KB). Catalogue data is small (25 films).
- **Static rendering:** catalogue pages are static; session-dependent parts stream in Suspense.
- **Shared caching** is limited to anonymous data. Personal results are computed per request and never cached.
- **Queries:** a constant number per page (no per-film queries). Recommendations use 5 small queries.
- **Images:** posters are CSS-generated; external images load lazily.
- **Fonts:** self-hosted through `next/font`.

**SEO improvements made:**
- `metadataBase` from `NEXT_PUBLIC_SITE_URL`;
- Open Graph and Twitter defaults;
- canonical URLs on the homepage, film and genre pages;
- `robots.txt` and a sitemap with 38 URLs;
- `noindex` on account, sign-in and portal pages;
- an indexing switch that is off by default, keeping the fictional catalogue and staging out of search engines.

A mistake caught during the audit: putting the canonical URL in the root layout would have pointed every page at the homepage. It was moved to the homepage before the build.

**Remaining opportunities:**
- the sitemap doesn't yet list database-backed pages (published films, profiles, companies);
- there are no Open Graph images;
- no structured data, deliberately, while films are fictional;
- the filter flash on `/films`;
- Core Web Vitals haven't been measured on real hosting.

---

## Report G: Remediation report

| Issue | Severity | Fix | Files | Verified by |
| --- | --- | --- | --- | --- |
| SEC-01 to SEC-12 | High–Low | See Report C | `supabase/migrations/20261109120000_stage8_hardening.sql`; `src/lib/supabase/{config,server,proxy}.ts`; `next.config.ts`; `src/lib/viewing/queries.ts`; `src/lib/industry/{actions,validation}.ts`; `src/app/filmmaker/company/page.tsx`; `src/components/industry/{PortalForms,PublishedFilmView}.tsx`; `src/app/companies/[slug]/page.tsx`; `src/types/database.ts` | `supabase/tests/stage8-hardening.test.ts` (19 tests), the Stage 7 suite re-run on the final schema (40), unit tests, curl and browser |
| SEC-13: id clash rule | Info | Catalogue validator rule | `src/lib/validateCatalogue.ts` (+ test) | Unit test |
| QA-01: no error boundary | Medium | Branded `app/error.tsx` (no details shown) | `src/app/error.tsx` | Build |
| SEO-01: no robots, sitemap, OG or canonical; private pages indexable | Medium | Metadata, robots, sitemap, noindex, indexing switch | `src/app/{layout,page,robots,sitemap}.tsx/ts`, `src/lib/seo.ts`, auth and account pages, film and genre pages, `.env.example` | `src/lib/seo.test.ts`; curl of robots, sitemap and meta tags |
| A11Y-01: heading order on grids | Low | Visually hidden `h2` before results | `FilmDiscovery.tsx`, `genres/[slug]/page.tsx` | `axe` re-scan: 0 violations |
| QA-02: iframe `allowfullscreen` warning | Low | Removed the duplicate attribute (`allow` covers fullscreen) | `TrailerPlayer.tsx` | Browser console |
| FUN-01: a film's company found among only 200 companies | Low | `get_public_company_for_film()` | Hardening migration, `PublishedFilmView.tsx` | DB test |

No dependencies were added or upgraded, and no earlier migration was edited.

---

## Report H: Production launch checklist

| Area | Item | Status |
| --- | --- | --- |
| Application code | Unit tests, local DB tests, lint, types, build | PASS |
| Application code | End-to-end tests of signed-in journeys | NOT TESTED |
| Database | Migrations apply cleanly in order (local Postgres) | PASS |
| Database | Migrations applied to the production Supabase project | REQUIRES MY ACTION |
| Database | Supabase Security and Performance Advisors clean | NOT TESTED |
| Authentication | Sign-up, email confirmation, login, logout, reset (live) | NOT TESTED |
| Authentication | Site URL and redirect URLs set in Supabase | REQUIRES MY ACTION |
| Authentication | Custom SMTP for auth emails | REQUIRES MY ACTION |
| Authentication | "Secure password change" turned on | REQUIRES MY ACTION |
| Security | RLS and privilege rules (local simulation) | PASS |
| Security | RLS on live Supabase with separate accounts | NOT TESTED |
| Security | Security headers and CSP | PASS |
| Security | Session cookie flags in a live session | NOT TESTED |
| Security | No secrets in code or browser bundles; no service-role key used | PASS |
| Security | Production dependency vulnerabilities | PASS (0) |
| Security | App-level rate limiting / WAF | REQUIRES MY ACTION |
| User privacy | Privacy policy, terms, cookie notice | FAIL (missing) |
| User privacy | Account deletion and data export for users | FAIL (missing; deletion cascade itself works) |
| User privacy | Personal data not cached or indexed | PASS |
| Admin permissions | First admin granted by hand in the SQL Editor | REQUIRES MY ACTION |
| Admin permissions | Admin and filmmaker separation (local tests) | PASS |
| Content and licensing | Real, licensed catalogue (films, people, artwork) | FAIL (catalogue is fictional) |
| Content and licensing | Verified viewing options and authorised trailers | REQUIRES MY ACTION |
| Content and licensing | Dependency licences | PASS (MIT/Apache in production; LGPL only in optional, unused image binaries) |
| Content and licensing | Takedown / copyright complaint process | FAIL (missing) |
| Performance | Build output and query patterns reviewed | PASS |
| Performance | Core Web Vitals on real hosting | NOT TESTED |
| Accessibility | `axe` WCAG 2.1 AA on key pages | PASS |
| Accessibility | Screen-reader walkthrough by a person | NOT TESTED |
| SEO | Metadata, robots, sitemap, noindex on private pages | PASS |
| SEO | Indexing switched on at launch (`NEXT_PUBLIC_ALLOW_INDEXING`) | REQUIRES MY ACTION |
| Domain | Domain purchased, DNS, HTTPS | REQUIRES MY ACTION |
| Deployment | Hosting chosen, environment variables set, preview → production | REQUIRES MY ACTION |
| Deployment | Code committed and pushed (nothing is committed yet) | REQUIRES MY ACTION |
| Backups | Supabase backup plan and a restore test | REQUIRES MY ACTION |
| Monitoring | Error monitoring, uptime checks, logs | REQUIRES MY ACTION |
| Monitoring | Analytics (privacy-respecting) | REQUIRES MY ACTION |
| Recovery | Incident and rollback procedure, admin access recovery | FAIL (not written) |

---

## 9. Final decision: NOT READY FOR PRODUCTION

Why:
1. **Authentication and authorisation have never run against Supabase.** The guarantees hold in a faithful local Postgres simulation, but not yet on the real service.
2. **The catalogue is entirely fictional.** A public, commercial launch with invented films would mislead viewers, and there are no real viewing options.
3. **Legal and privacy foundations are missing:** privacy policy, terms, cookie notice, takedown process, and self-service account deletion and data export.
4. **There is no production environment** (hosting, domain, SMTP, monitoring, backups), and the code isn't committed to version control yet.

**Path to "ready after manual configuration":**
1. Create the Supabase project, apply the five migrations, configure Auth, and run README checklist items 1–20 with three accounts.
2. Replace the sample catalogue with real, licensed records, and add verified viewing options.
3. Publish the legal pages, and decide how account deletion requests are handled.
4. Set up hosting, the domain, `NEXT_PUBLIC_SITE_URL`, SMTP, monitoring and backups.
5. Re-run this checklist.

Most of the code-side work is done; what's left is configuration, content and legal work.
