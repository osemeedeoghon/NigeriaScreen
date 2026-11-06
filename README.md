# NaijaScreen

A Nollywood film discovery platform for viewers. Discover films, explore genres, meet the actors and directors behind them, and find legitimate places to watch.

**Status:** Pre-launch audit complete (see [docs/PRE_LAUNCH_AUDIT.md](docs/PRE_LAUNCH_AUDIT.md)). Not yet production-ready: live Supabase verification, real catalogue content, legal pages and hosting setup are outstanding. The film catalogue is still local TypeScript data. User accounts, watchlists, watched films, reviews, viewing destinations and trailers live in Supabase. NaijaScreen links out to authorised platforms; it never hosts or streams films. There are no payments or external AI APIs.

| Stage | Scope | State |
| --- | --- | --- |
| 1 | Brand, homepage, responsive layout, reusable components | Done |
| 2 | Typed catalogue, data layer, film detail pages, validation tests | Done |
| 3 | Search, filters, sorting, `/films` discovery page, genre pages, URL state | Done |
| 4 | Supabase Auth, profiles, watchlist, watched films, ratings and reviews, RLS | Done (not yet tested against a live project) |
| 5 | Where to watch, country availability, trailers, admin role and `/admin/viewing` | Done (not yet tested against a live project) |
| 6 | Content-based recommendations, feedback, discovery preferences, relevance-ranked search | Done (not yet tested against a live project) |
| 7 | Filmmaker onboarding, profiles, companies, film submissions, moderation, promotions, directory, notifications | Done (not yet tested against a live project) |
| Audit | Security hardening migration, headers, cookies, SEO, error page, accessibility fixes | Ready for review |

## Getting started

Requires Node.js 22.18 or newer (Node 24 recommended), because the tests use Node's built-in TypeScript support.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The site runs without Supabase: browsing works, and account features show a "not switched on yet" notice. To enable accounts, follow [Setting up Supabase](#setting-up-supabase).

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Catalogue, discovery, route, auth and validation tests (`node --test`) |
| `npm run test:db` | Runs the SQL migrations in PGlite (in memory, no network) and tests RLS policies, grants and constraints |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm start` | Serve the production build |

## Technology stack

- **Next.js 16** (App Router, Cache Components) with **React 19**
- **TypeScript** (strict)
- **Tailwind CSS v4**, with design tokens in `src/app/globals.css`
- **ESLint** (`eslint-config-next`)
- **Supabase** Auth and Postgres via `@supabase/supabase-js` and `@supabase/ssr` (cookie sessions for the App Router)
- **Node's built-in test runner** (`node:test`). No testing framework is installed.
- **PGlite** (dev only): Postgres in WebAssembly, used by `npm run test:db` to test the migration without Docker
- Fonts: Fraunces and Manrope via `next/font`

## Project structure

```
src/
  app/
    layout.tsx              root layout: fonts, skip link, Navbar, Footer, library state
    page.tsx                homepage
    films/page.tsx          /films discovery page (search, filters, sorting)
    films/[slug]/page.tsx   film detail page (prerendered for every film)
    genres/[slug]/page.tsx  genre page (prerendered for every genre)
    login/ signup/ forgot-password/   sign-in pages
    account/                profile, watchlist, watched, update-password (signed in only)
    admin/viewing/          providers, viewing options and trailers (administrators only)
    admin/industry/         moderation dashboard and submission review (administrators only)
    filmmaker/              filmmaker portal: onboarding, profile, company, submissions, promotions
    industry/ filmmakers/[slug]/ companies/[slug]/   public industry directory
    auth/confirm/route.ts   landing point for links in auth emails
    not-found.tsx           404 page
    globals.css             design tokens and utilities
  components/               UI only, no data definitions
    account/ auth/ forms/ library/ reviews/   Stage 4 UI
    viewing/ admin/         Stage 5 UI: Where to Watch, trailer player, admin forms
    recommendations/        Stage 6 UI: homepage recommendation rows, refresh button
    industry/               Stage 7 UI: portal forms, moderation forms, directory cards, spotlight
  data/                     the fictional catalogue (plain typed arrays)
    films.ts  genres.ts  people.ts  credits.ts
    collections.ts  editorial.ts
  lib/
    catalogue.ts            the only way UI code reads catalogue data
    discovery.ts            search, filters, sorting and URL state (pure functions)
    routes.ts               film/genre slug checks used by proxy.ts
    validateCatalogue.ts    data-integrity rules
    format.ts               display helpers
    auth/                   Server Actions, session helpers, validation, safe redirects
    library/                watchlist, watched and review actions and queries
    supabase/               server client, proxy session refresh, config
    viewing/                where-to-watch validation, countries, languages, trailers, queries, admin actions
    recommendations/        recommender: types, weights, taste profile, scoring, sections, provider, queries, actions
    searchRelevance.ts      search ranking and "did you mean" suggestions
    industry/               portal validation, status rules, queries, owner and admin actions
    *.test.ts               tests
  types/                    data models, independent of React (database.ts mirrors the SQL)
  proxy.ts                  real 404s for unknown slugs; refreshes the Supabase session
supabase/
  migrations/               SQL for Stages 4–7, applied in order
  tests/                    PGlite harness and RLS/constraint tests (npm run test:db)
.env.example                placeholder environment variables
```

## Catalogue architecture

```
types/  ──►  data/  ──►  lib/catalogue.ts  ──►  components/ and app/
 shapes      records       lookups, joins          rendering
                  ▲
       lib/validateCatalogue.ts  (run by npm test)
```

- **`src/types/`** defines the models. They import nothing from React or Next.js.
- **`src/data/`** holds the records as plain arrays, the way database tables would.
- **`src/lib/catalogue.ts`** is the access layer. Components never import from `src/data/` directly, so the storage behind these functions can change without touching the UI.
- **`src/lib/validateCatalogue.ts`** checks the integrity rules described below. `npm test` runs it against the real data and against deliberately broken copies.

### Catalogue functions

| Function | Returns |
| --- | --- |
| `getAllFilms()` | All films, with `actorIds`/`directorIds` derived from credits |
| `getFilmById(id)` / `getFilmBySlug(slug)` | A film, or `undefined` |
| `getAllFilmSlugs()` | Slugs used to prerender `/films/[slug]` |
| `getFeaturedFilms()` / `getTrendingFilms()` | Homepage curation |
| `getAllGenres()` / `getGenreById(id)` / `getGenreBySlug(slug)` | Genres, or `undefined` |
| `getFilmsByGenre(genreId)` | Films in a genre (empty list for an unknown ID) |
| `getFilmGenres(film)` | A film's resolved genres |
| `getAllPeople()` / `getPersonById(id)` | People, or `undefined` |
| `getFeaturedPeople()` | Homepage personalities |
| `getFilmActors(filmId)` | Cast with character names (empty list for an unknown film) |
| `getFilmDirectors(filmId)` | Directors (empty list for an unknown film) |
| `getFilmsByPerson(personId)` | A person's films, newest first |

Unknown IDs and slugs never throw: single lookups return `undefined` and list lookups return `[]`.

## Data model

| Model | Key fields | Notes |
| --- | --- | --- |
| **Film** (`types/film.ts`) | `id`, `slug`, `title`, `synopsis`, `releaseYear`, `runtimeMinutes`, `ageRating`, `language`, `country`, `genreIds`, `actorIds`, `directorIds`, `artwork`, `trailerUrl?`, `status`, `featured`, `createdAt` | `ageRating`: `G`, `PG`, `12`, `12A`, `15`, `18`. `status`: `released` or `upcoming`. `language` is the primary spoken language. |
| **Genre** (`types/genre.ts`) | `id`, `name`, `slug`, `description`, `artwork` | Eight genres: Drama, Romance, Comedy, Thriller, Action, Family, Historical, Crime |
| **Person** (`types/person.ts`) | `id`, `name`, `biography`, `profession`, `profileImage`, `nationality` | `profession`: `actor`, `director` or `actor-director` |
| **FilmCredit** (`types/credit.ts`) | `filmId`, `personId`, `role`, `characterName?` | `role`: `actor` or `director`. This is the join table between films and people. |
| **ViewingProvider, FilmViewingOption, FilmTrailer** (`types/viewing.ts`) | See [Where to watch](#where-to-watch-stage-5) | Stored in Supabase, not in `src/data/` |

**Credits are the single source of truth for who worked on a film.** `src/data/films.ts` stores `FilmRecord`s, which are films without `actorIds`/`directorIds`. `lib/catalogue.ts` derives those fields from `credits.ts`, so a film's cast list and its credits can never disagree.

**Artwork is a reference, not an image file.** Films use a `generated-poster` (motif, palette and description) drawn by `components/PosterArt.tsx`. Genres use an `accent` colour, and people use a `monogram` palette. A later stage can add an `image` variant for licensed artwork.

### Integrity rules (`npm test`)

- Film, genre, person and credit IDs are unique, film and genre slugs are unique, and film IDs match `film-<slug-style>` (the format Supabase rows use).
- Slugs are lowercase and hyphenated (`kano-nights`).
- Required fields (title, synopsis, slug, language, country, rating, status, artwork, `createdAt`) are present.
- `releaseYear` is a whole number from 1960 to 2030, and `runtimeMinutes` a whole number from 40 to 240.
- Every film has at least one genre, one director and one actor, and every genre ID exists.
- Every credit points to an existing film and person, and the role must match the person's profession.
- Actor credits have a character name.
- Film records contain no links: viewing destinations and trailers live in Supabase.
- Curated homepage lists reference existing records.

## Film discovery (Stage 3)

### Pages

| Route | Rendering | Purpose |
| --- | --- | --- |
| `/films` | Static shell + one client component | Search, filter and sort the whole catalogue |
| `/films/[slug]` | Prerendered per film | Film details; genre chips link to genre pages |
| `/genres/[slug]` | Prerendered per genre | Genre name, description and every film in it, newest first |

Unknown film and genre slugs return a real **404** (see `src/proxy.ts`).

### Search

Searches the film title, synopsis, genre names, primary language, cast names and director names.

- Matching is case- and accent-insensitive, and extra whitespace is ignored.
- Every word must match, but the words can come from different fields, so `hausa crime` finds *Kano Nights*.
- An empty query shows every film.
- Each film's searchable text is built once (`getSearchIndex` in `lib/discovery.ts`). In the browser, typing is deferred (`useDeferredValue`) and results are memoised.

### Filters and sorting

All filter options are derived from the catalogue (`getDiscoveryOptions`), so only values that exist are offered.

| Filter | Parameter | Behaviour |
| --- | --- | --- |
| Genre | `genre` (repeatable, or comma-separated) | Multi-select; a film matches if it has **any** selected genre |
| Language | `language` | Primary spoken language |
| Release year | `year` | Exact year |
| Age rating | `rating` | `G`, `PG`, `12`, `12A`, `15` or `18` |
| Availability | `status` | `released` or `upcoming` |

Different filters combine with **AND**, and they also combine with the search. For example, `q=princess&language=Yoruba&genre=drama` returns only films matching all three.

Sort with `sort=newest` (default), `oldest`, `title-asc`, `title-desc`, `shortest` or `longest`. Ties are broken by title. `sortFilms` returns a new array and never mutates the catalogue.

### URL state

The URL is the source of truth for filters and sorting, for example `/films?q=love&genre=drama&language=Yoruba`.

- **Refresh** restores the search, filters and sort.
- **Invalid values** (`?genre=western&year=1850&sort=random`) are dropped, and the URL is rewritten to its clean form.
- **Typing** replaces the current history entry, so it doesn't fill the history. **Filter and sort changes** add an entry, so Back and Forward step through them.
- **Clear search** removes `q`. **Clear all filters** removes every parameter.
- Updates use `window.history.pushState`/`replaceState`, which Next.js keeps in sync with `useSearchParams`, so filtering never makes a server request.

### Homepage integration

- The hero search previews matches as you type. Pressing Search (or Enter) opens `/films?q=…`, which also works without JavaScript via `next/form`.
- Genre cards open `/genres/[slug]`.
- Film cards open `/films/[slug]`.
- The trending section keeps its quick genre chips, and "Browse all films" links open `/films`.

## Accounts and personalisation (Stage 4)

### What signed-in members can do

| Feature | Where |
| --- | --- |
| Create an account (display name, email, password), sign in, sign out | `/signup`, `/login`, account menu |
| Reset a forgotten password by email, change password | `/forgot-password`, `/account/update-password` |
| Edit display name, optional username and profile image link | `/account` |
| Add or remove films from a watchlist | Bookmark button on every film card and detail page; `/account/watchlist` |
| Mark films as watched (released films only) | Eye button on cards and detail pages; `/account/watched` |
| Rate a film 1–5 stars, with an optional review, then edit or delete it | "Member reviews" on each released film's page |

Visitors who press a watchlist or watched button get a sign-in prompt that brings them back to the same page. `/account/*` redirects visitors to `/login?next=…`, and the sign-in pages send signed-in users to `/account`.

There are no sample ratings. The average shown on a film page is calculated only from real member reviews, and the empty state says so.

### How films are identified

The catalogue is still TypeScript, so there is no `films` table to reference. User tables store the catalogue's **stable film id** (for example `film-harmattan-letters`) as `text`:

- Ids never change when a title or slug changes; slugs are for URLs only.
- The database checks the id format (`^film-[a-z0-9]+(-[a-z0-9]+)*$`), and `npm test` checks every catalogue id matches it.
- Every Server Action checks the id exists in the catalogue before writing (`isCatalogueFilmId`), so rows can't point at made-up films.
- Rows whose film later disappears from the catalogue are skipped when lists are shown, not rendered broken.

When the catalogue moves into Postgres, create `films` with the same ids and add foreign keys. The exact statements are at the bottom of the migration file.

### Schema (`supabase/migrations/20261105120000_stage4_accounts.sql`)

| Table | Columns | Rules |
| --- | --- | --- |
| `profiles` | `id` (= `auth.users.id`), `display_name`, `username`, `avatar_url`, `created_at`, `updated_at` | Created by a trigger on sign-up. Name 1–50 characters; username `^[a-z0-9_]{3,20}$`, unique; avatar must be `https://` |
| `watchlist` | `id`, `user_id`, `film_id`, `added_at` | `unique (user_id, film_id)` |
| `watched_films` | `id`, `user_id`, `film_id`, `watched_at` | `unique (user_id, film_id)` |
| `reviews` | `id`, `user_id`, `film_id`, `rating`, `body`, `created_at`, `updated_at` | `unique (user_id, film_id)`; rating 1–5; body optional, at most 2000 characters |

`user_id` defaults to `auth.uid()`, and every user table cascades when the auth user is deleted. `updated_at` is maintained by a trigger.

### Security

- **RLS is on for every table.** Signed-in users can read and change only rows where `user_id = auth.uid()` (`id` for profiles). Visitors (`anon`) have no direct table access.
- **Column grants** limit what can change: profiles only `display_name`, `username` and `avatar_url`; reviews only `rating` and `body`. Watchlist and watched rows can be added or removed but not edited.
- **Public reviews** are read through `get_film_reviews(film_id)`, a `security definer` function. It returns rating, text, dates, the author's display name and an `is_own` flag, and never returns user ids, emails or usernames.
- **Server-side checks.** Server Actions re-read the verified session (`supabase.auth.getClaims()`), validate and clean all input (`lib/auth/validation.ts`) and ignore any user id sent by the client. The proxy and the UI only decide where to route people; the database is the security boundary.
- **Keys.** Only the publishable (or legacy anon) key is used, from `NEXT_PUBLIC_*` variables. The service-role key is never used and must never be added. `.env*` files are git-ignored except `.env.example`.
- **Safe redirects.** `?next=` only accepts same-site paths (`safeNextPath`), so it cannot be used as an open redirect.
- **No account enumeration.** Sign-up and password-reset messages are the same whether or not the email is registered.
- Review text is stored and shown as plain text; React escapes it.

### Database tests and their limits

`npm run test:db` loads the real migration file into [PGlite](https://pglite.dev) (Postgres compiled to WebAssembly, a dev dependency) and runs 172 tests in memory:
- 63 for Stage 4 (`stage4-accounts.test.ts`, Stage 4 migration only)
- 31 for Stage 5
- 19 for Stage 6
- 40 for Stage 7 (`stage7-industry.test.ts`, run against the final schema)
- 19 audit regression tests (`stage8-hardening.test.ts`)

The Stage 7 and audit suites use separate viewer, filmmaker, company-member and two admin identities. It needs no Docker, network or Supabase project, and it never touches a real database.

To imitate Supabase, the test creates `anon` and `authenticated` roles, an `auth.users` table, an `auth.uid()` function that reads the user id like Supabase does, and Supabase's default "grant everything to the API roles" privileges, which the migration must then revoke.

What it checks:

- RLS is on for every public table, and the expected policies exist.
- Users can read, add, edit and delete their own profile, watchlist, watched films and reviews, where the schema allows it.
- Users can't read, insert, update or delete another user's rows, even by targeting a row id directly.
- Visitors can't touch any table, and a signed-in role with no user id sees and changes nothing.
- Duplicates are rejected for the watchlist, watched films and reviews, both within one statement and across separate requests, while different users may save the same film.
- Rating, review length, username, avatar link and film id formats are enforced.
- Protected columns (ids, owners, timestamps, a review's film) can't be changed.
- The public review feed exposes display names only, and the caller's own review is flagged correctly.
- Sign-up creates a profile, and deleting an account removes all of its data.

**This is not proof of full Supabase compatibility.** PGlite is plain Postgres. It does not include:

- **Supabase Auth.** Real sign-up, email confirmation, sessions, token refresh and password reset are not exercised; the tests set the user id directly.
- **PostgREST**, the API that `supabase-js` calls. The tests run SQL directly, so request translation, `upsert` behaviour, `count` headers and RPC calls are not covered.
- **Real JWT handling**, including token expiry and the `request.jwt.claims` settings Supabase uses.
- **Supabase's exact Postgres version, extensions and built-in grants**, which may differ from the stub.
- **The Next.js side**: Server Actions, cookies and the proxy running against a real project.

Live checks still to do after [Setting up Supabase](#setting-up-supabase):

1. The migration runs cleanly in the Supabase SQL Editor.
2. Sign-up creates a row in `profiles` with the chosen display name, and the confirmation email link signs you in through `/auth/confirm`.
3. Login, staying signed in across refreshes and browser restarts, and logout.
4. Password reset email, then setting a new password at `/account/update-password`.
5. `/account/*` redirects visitors to sign in; `/login` sends signed-in users to `/account`.
6. Watchlist and watched buttons add and remove rows, survive a refresh, and appear on the account pages.
7. Creating, editing and deleting a review, including that a second review of the same film updates the first.
8. With two accounts in different browsers, neither can see or change the other's lists or reviews.
9. The Supabase **Security Advisor** (Database → Advisors) reports no RLS warnings for these tables.
10. Stage 5: after granting yourself the admin role in the SQL Editor, `/admin/viewing` opens, while a second, viewer-only account gets a 404 there.
11. Stage 5: add a provider and a pending option for a real film you have rights information for, or for a throwaway test row you delete afterwards in the SQL Editor. Check that it stays hidden on the public page until verified, appears after **Verify**, and disappears after **Expire**.
12. Stage 5: a verified trailer plays with the YouTube or Vimeo player, and the "Watch on…" link works.
13. Stage 6: after watching, rating and saving a few films, the homepage shows personal sections with explanations, and a second account sees different (or guest) sections.
14. Stage 6: "Hide" and "Not interested" remove a film, survive a refresh, and can be undone from **Account → Preferences**; saving preferences changes the picks.
15. Stage 6: "Popular with Viewers" appears only once three different accounts have saved, watched or rated the same film 4+ stars in the last 90 days.
16. Stage 7: with three accounts (a viewer, a second viewer who applies, and an admin), the applicant submits from `/filmmaker/onboarding`, and the admin approves it at `/admin/industry`. The applicant then gets the filmmaker role and a notification; the other viewer still gets "Approved filmmakers only" on portal pages.
17. Stage 7: the approved filmmaker creates a public profile (it appears at `/industry/filmmakers` and `/filmmakers/<slug>`) and a company (it appears only after admin approval), and invites a second filmmaker, who accepts.
18. Stage 7: a film submission goes Draft → Pending → Under review → Changes requested → resubmitted → Approved. The film then appears at `/films/<slug>`, and its history and notifications match.
19. Stage 7: a filmmaker can't open `/admin/industry` (404), and editing a pending submission is refused.
20. Stage 7: a promotion request for the approved film appears in the homepage "Editorial spotlight" only after approval and only between its dates.

### Authentication flow

Uses `@supabase/ssr` with cookie sessions, which Supabase recommends for the App Router:

- `src/proxy.ts` refreshes the session on each request (`lib/supabase/proxy.ts`).
- Server Components, Server Actions and the `/auth/confirm` route use `createSupabaseServerClient()`.
- Forms are Server Actions with `useActionState`, giving field errors, pending labels and success messages.
- Email links (confirm sign-up, reset password) land on `/auth/confirm`, which accepts both the `token_hash` and the PKCE `code` formats.
- With Cache Components, anything that reads the session (navbar account menu, saved-film state, reviews, account pages) streams in behind a `<Suspense>` boundary. The rest of each page stays in the static shell.

### Setting up Supabase

1. Create a free project at [supabase.com](https://supabase.com/dashboard).
2. In **Project Settings → API Keys**, copy the **Project URL** and the **publishable key** (`sb_publishable_…`). Older projects can use the **anon** key instead. Do not copy the secret or service-role key.
3. Copy `.env.example` to `.env.local` and fill in those two values. `.env.local` is git-ignored.
4. In **SQL Editor**, run each migration once, in order: `supabase/migrations/20261105120000_stage4_accounts.sql`, then `20261106120000_stage5_where_to_watch.sql`, then `20261107120000_stage6_recommendations.sql`, then `20261108120000_stage7_industry.sql`, then `20261109120000_stage8_hardening.sql`. Paste the whole file each time.
5. In **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/confirm` to the redirect URLs. Add your deployed domain the same way later.
6. Restart `npm run dev`.

Email confirmation is on by default; the free tier's built-in email sender is rate limited, so use real inboxes you control while testing.

## Where to watch (Stage 5)

NaijaScreen is a discovery and referral site: it sends viewers to official, authorised platforms and never hosts, downloads or rehosts films or trailers.

### Data model (`supabase/migrations/20261106120000_stage5_where_to_watch.sql`)

| Table | Purpose | Key rules |
| --- | --- | --- |
| `viewing_providers` | Platforms viewers are sent to: `name`, `slug`, `website_url`, `logo_url`, `description`, `is_active` | Unique name (case-insensitive) and slug; links must be safe `https://` |
| `film_viewing_options` | One link to one film on one provider: `film_id`, `provider_id`, `destination_url`, `access_type`, `countries`, `audio_languages`, `subtitle_languages`, `availability_notes`, `verification_status`, `verified_at`, `last_checked_at`, `created_by`, `is_active` | `unique (film_id, provider_id, access_type, destination_url)`; provider foreign key with `on delete restrict` |
| `film_trailers` | Official trailers on YouTube or Vimeo: `title`, `video_provider`, `video_id`, `video_url`, `embeddable`, `thumbnail_url`, `published_on`, verification fields | `unique (film_id, video_provider, video_id)`; the id format is checked per provider |
| `profiles.role` | `viewer` (default) or `admin` | Not updatable through the API by anyone |

- **Access types:** `subscription`, `free`, `free_with_ads`, `rental`, `purchase`, `other`.
- **Statuses:** `pending`, `verified`, `rejected`, `expired`.
- **Film ids:** films are still TypeScript, so `film_id` is the catalogue's stable text id, exactly as in Stage 4. There is no foreign key to a films table, because that table doesn't exist yet. The database checks the format and the server checks the id exists in the catalogue.
- **Countries** are ISO 3166-1 alpha-2 codes (`NG`, `GH`, `GB`), at least one per option, with no duplicates. There is deliberately no "worldwide" value: an option lists only the countries where it has been checked.
- **Languages** are ISO 639 codes (`en`, `yo`, `ig`, `ha`, `pcm`). Both lists may be empty, meaning "not recorded".
- **Dates are kept by the database.** A trigger sets `verified_at` when an option becomes verified, clears it when the status moves away from verified, stamps `last_checked_at` on every status change, and maintains `updated_at`. Clients can't set these fields.
- **Nothing is deleted.** There are no delete grants. Records are rejected, expired or deactivated, so the history stays.
- The old local `ViewingOption` type and the empty `src/data/viewingOptions.ts` from Stage 2 were removed. Supabase is now the only source, so there's no second, duplicate model.

### Who can do what (RLS)

| | Visitors (`anon`) | Signed-in viewers | Administrators |
| --- | --- | --- | --- |
| Read active providers | Yes | Yes | Yes, including inactive |
| Read viewing options | Active, verified, from an active provider | Same | All, any status |
| Read trailers | Active and verified | Same | All |
| Add or edit providers, options, trailers | No | No | Yes |
| Create a record as verified | No | No | **No**: new records are always pending |
| Change verification status | No | No | Yes, from the admin pages |
| Change roles | No | No | **No** |

- `public.is_admin()` (security definer, fixed `search_path`) reads the caller's own `profiles.role`, and every write policy uses it.
- Column grants stop anyone, administrators included, from changing `created_by`, `verified_at`, `film_id` or a trailer's video.
- Viewing data adds no new environment variables. Only the publishable key is used; the service-role key is never needed or used.

### Admin role

There is no way to become an admin from the app. An operator grants the role by hand in the Supabase **SQL Editor**, which runs as the database owner:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Revoke it with `set role = 'viewer'`. On the app side:

- `/admin/*` sends visitors to sign in, and signed-in viewers get a 404.
- Pages call `requireAdmin()`, and every admin Server Action re-checks the role from the database (`adminClientForAction()`).
- The account menu shows an "Admin" link only when the server-read role is `admin`. That link is a convenience, not a security check; RLS is.

### Adding and verifying a viewing option

1. Sign in as an administrator and open **Admin: where to watch** (`/admin/viewing`).
2. Add the provider if it isn't listed: its real name and official homepage, plus a logo link only if you have permission to use it.
3. Find the film and open it.
4. Under **Add a viewing option**, fill in the following, then **Save as pending**. Pending options are invisible to viewers.
   - The provider and access type.
   - The film's official page on that provider.
   - The countries you have checked.
   - Optionally, audio and subtitle languages and a short note.
5. Open the link and confirm on the provider's own site that the film is really there, in those countries, with that access type. Then press **Verify**, which asks for confirmation.
6. When a link stops working or the film leaves the platform, press **Expire**. Use **Reject** for links that were never valid, and **Deactivate** to hide an option without changing its status. Editing an option returns it to pending.

Validation (`src/lib/viewing/validation.ts`, repeated by database constraints):

- Links must be `https://` with a public hostname. `javascript:`, `data:`, `file:`, `http:`, embedded credentials, local or numeric hosts and control characters are rejected.
- Country and language codes must be known codes.
- Duplicates are caught before saving and again by the unique constraint.

### Trailers

- Only **YouTube** and **Vimeo** links are accepted. The pasted URL is reduced to a provider and a video id.
- The embed URL is rebuilt from those, on `www.youtube-nocookie.com` or `player.vimeo.com` with `dnt=1`. A user-supplied URL is never used as an iframe source, and `isApprovedEmbedUrl()` checks the final host again.
- The player loads only when the viewer presses play. The iframe is sandboxed, has an accessible title, and sits next to a normal "Watch on YouTube/Vimeo" link.
- If the owner has switched embedding off, choose **Link only** and the page shows just the link. If a video is later removed or made private, the provider's player shows its own message and the link remains. Expire the trailer when you notice.
- Add trailers from the film's admin page. They start pending and appear once you **Verify** them. Add only uploads by the film's owner or distributor.

### Country availability on film pages

The "Where to Watch" section lists confirmed options with the countries each was checked for. A **Your country** picker filters the list to one country. It defaults to "All listed countries": it doesn't guess the viewer's location and uses no geolocation service.

When nothing matches, the page says there's no confirmed option *yet* and that the film may still be available. It never says a film is unavailable.

## Recommendations (Stage 6)

### What this is, and what it isn't

The recommender is a **transparent, rule-based, content-based scoring system**. It compares films' genres, language, cast and director with the signed-in user's own activity and preferences, using fixed, documented weights.

It is **not** a trained machine-learning model, it doesn't learn from other users' behaviour, and no AI service, paid API, vector database or background worker is involved. Every recommendation can be traced to the measured matches that produced it.

### Architecture (`src/lib/recommendations/`)

| File | Role |
| --- | --- |
| `types.ts` | Data shapes, including the `RecommendationProvider` interface |
| `weights.ts` | Every tunable number: signal weights, score weights and thresholds |
| `features.ts` | Per-film features (genres, language code, cast, director, editorial rank), built once per server process from the catalogue |
| `taste.ts` | Turns one user's activity into a taste profile and an exclusion list |
| `score.ts` | Scores candidates and records the reasons behind each score |
| `sections.ts` | Builds homepage sections, removes duplicates, hides thin sections |
| `provider.ts` | The provider in use (`content-based-v1`) and `getRecommendationProvider()` |
| `queries.ts` | Server-only: reads the user's own activity under RLS, gets popularity counts, calls the provider |
| `actions.ts` | Server Actions for feedback, refresh and preferences |
| `preferences.ts` | Validation for the preferences form |

Everything except `queries.ts` and `actions.ts` is a pure, deterministic function. The same inputs always give the same output, and "now" is passed in so time-based rules (the 30-day hide) can be tested.

### Scoring

**1. Activity becomes a taste profile.** Each film gets one signal, and the strongest applies: a rating beats "watched", which beats "watchlist".

| Signal | Weight |
| --- | --- |
| Rated 5 / 4 / 3 / 2 / 1 stars | +2 / +1.5 / +0.5 / −1 / −1.5 |
| Watched (no rating) | +1 |
| On watchlist (not watched) | +0.75 |
| "Not interested" | −0.75 |

- A film's signal is shared across its genres, and also counts towards its language.
- Cast and directors count only from films with a positive signal that were watched or rated. Films rated 4+ count fully and are labelled "rated highly"; films only watched count at half weight.
- Repeated activity is squashed with `1 − e^(−total / 2)`. One liked drama gives drama about 0.4, five give about 0.9, and nothing exceeds 1.

**2. Each candidate film is scored.** Every component is between −1 and 1, then weighted:

| Component | Weight | Measures |
| --- | --- | --- |
| Genre | 3 | Average of the film's genre affinities, nudged toward its best one |
| People | 2 | The strongest cast or director affinity |
| Language | 1.5 | The film's language affinity |
| Watchlist | 1.5 | Closest watchlist film: shared genres, plus a little for the same language |
| Favourite genre | 1.5 | 1 if the film has a genre the user chose in preferences |
| Preferred language | 1.25 | 1 if the film is in a chosen language |

The maximum total is 10.75, and no single component can contribute more than 3 (28%). A film needs a score of at least 0.6, and at least one reason worth 0.35 or more, so every pick has something real to show. Ties are broken by editorial order, then the newer film, then title, then id.

**3. Some films are never recommended:**
- films already watched or rated (unless the user turns on "Include films I've already watched");
- films rated 2 stars or lower, always;
- films already on the watchlist;
- films marked "Not interested";
- films hidden in the last 30 days.

The weights live in `weights.ts`. Changing them changes the results, and the tests show what each behaviour depends on.

### Homepage sections

The sections stream in below the hero, inside a Suspense boundary, and show four films each, with **Show more** for the rest. A film appears at most once across all sections, and a section with fewer than two films is left out.

| Section | Who sees it | Shown when |
| --- | --- | --- |
| Recommended for You | Signed in | Any activity or preference produces matches |
| Because You Like *Genre* | Signed in | Two or more watched or rated films share a genre, or it's a chosen favourite |
| Based on Your Watchlist | Signed in | Candidates are close to a watchlist film |
| Continue Exploring | Signed in | Other films share cast or director with the most recently watched or rated film |
| Discover More Nollywood | Everyone | Signed in: languages with no activity yet. Visitors: one editors' pick per language |
| Popular with Viewers | Everyone | At least two films have real activity from three or more members |

- "Recommended for You" takes its top four picks first, the themed sections fill next, and then it is topped up. In a small catalogue this stops one section from using every good match.
- A signed-in user with no activity and no preferences sees the visitor sections and a prompt to save, rate or set preferences, not empty carousels.
- Visitors never need an account to browse.

### Explanations

Each score component that matched produces a sentence, and the strongest one is shown. The wording depends on the evidence:

- "Because you enjoy Hausa dramas" or "Because you enjoy dramas" needs watched or rated films, not just saved ones.
- Saved-only interest says "Like the romances on your watchlist" or "In Efik, like films on your watchlist".
- "Directed by …" or "Features …" ends with "from films you rated highly" only when a 4+ rating exists; otherwise it says "from films you've watched".
- "One of your favourite genres: …" and "Matches your preferred language, …" appear only when those preferences are set.
- Section-specific lines name the actual film: "Similar to *Title*, on your watchlist" and "Shares *Name* with *Title*".

The catalogue has no themes or moods, so the recommender never claims "similar themes".

### Feedback and refresh

- **Hide** stores `dismissed`: the film is left out for 30 days.
- **Not interested** stores `not_interested`: the film is left out until the user undoes it, and similar films are nudged down slightly.
- Both write to `recommendation_feedback` (one row per user and film). The film disappears at once, with an **Undo** link.
- **Account → Preferences** lists hidden films with **Show again**.
- **Refresh recommendations** re-runs the recommender with the latest activity. Results are deterministic, so they change only when activity, preferences or feedback change.

### Preferences

**Account → Preferences** (`/account/preferences`) stores three new columns on the existing `profiles` row:

- `preferred_languages`: ISO codes of the catalogue's languages;
- `favourite_genres`: catalogue genre slugs;
- `include_watched`.

Nothing else is collected. The catalogue has no themes or film types, so those aren't offered.

### Privacy and caching

- Personal recommendations are computed on the server for each request, from activity read with the user's own session, so RLS limits every query to their rows.
- The user id comes from the verified session; client-sent ids are never used.
- Personal results are never put in a shared cache. Only selected film data, scores, reasons and the explanation are sent to the browser, not the taste profile.
- **Popular with Viewers** is the only shared, cached data. It comes from `get_popular_films()`, a `security definer` function that returns only film ids and member counts.
  - It includes only films that **at least three distinct members** saved, watched or rated 4+ stars in the last 90 days.
  - The threshold is fixed in SQL, so a caller can't lower it to reveal one person's activity.
  - It is fetched with a cookie-less client and cached with `"use cache"` for up to an hour (`cacheLife`: stale 5 min, revalidate 15 min).
- The editorial order and catalogue features are non-personal and are computed once per process.

### Adding an AI provider later

`RecommendationProvider` (`types.ts`) is the seam: `recommend(request) → Promise<RecommendationSection[]>`. A future provider could, for example:

- compute embeddings of synopses and rank by vector similarity;
- learn from aggregate behaviour across users (collaborative filtering);
- re-rank this engine's candidates with an LLM.

It would implement the same interface and be returned from `getRecommendationProvider()`. Pages and components wouldn't change.

Before doing that, decide:
- which data the model may see, under the same per-user RLS rules;
- where it runs, and which keys it needs (server-side only, never `NEXT_PUBLIC_*`);
- how its explanations stay truthful;
- how it's evaluated against the current engine.

Until then, nothing in NaijaScreen should be described as "AI-powered".

## Search relevance (Stage 6)

Search on `/films` and in the homepage box still requires every word to appear somewhere: title, synopsis, genre, language, cast or director. The default sort is now **Best match**, which ranks results by relevance (`src/lib/searchRelevance.ts`):

| Match | Points |
| --- | --- |
| Exact title | 100 |
| Title starts with the query | 60 |
| Query appears as a phrase in the title | 45 |
| Each query word that is a whole title word / starts a title word | 12 / 8 |
| Query contains or equals a full cast or director name | 30 |
| Each query word in a cast or director name | 6 |
| Each word matching a genre / the language | 5 / 5 |
| Each word in the synopsis | 2 |

- Text is compared case-insensitively, without accents or punctuation, and with whitespace collapsed. Ties go to the newer film, then title.
- With no query, Best match is newest first, the previous default.
- `relevance` is the default sort, so it is left out of URLs. Every existing parameter (`q`, `genre`, `language`, `year`, `rating`, `status`, `sort`) works as before, and choosing any other sort overrides relevance.
- When nothing matches, the empty state suggests close titles for likely typos ("harmatan leters" → Harmattan Letters). When filters are the reason, it offers to keep the search and clear them.
- No search service or extra dependency is used.

## Filmmaker portal and industry (Stage 7)

### Accounts and roles

The existing `profiles.role` column is extended rather than adding a second role system: `viewer` (default), `filmmaker`, `company` and `admin`.

- **Nobody can change a role through the API.** There is no UPDATE grant on the column, and the tests prove this for viewers, filmmakers and admins.
- `filmmaker` and `company` come only from an approved application, through `moderate_application()`, which never downgrades an admin. `admin` is still granted by hand in the SQL editor.
- `profiles.suspended_at` and `suspension_reason` are set only through `set_account_suspension()`. Suspended accounts keep their viewer features, but lose industry access, and their public profiles and companies are hidden. Admins can't be suspended from the app.
- `is_industry_member()` (an approved role and not suspended) gates every portal write in RLS. The `/filmmaker` pages show "Approved filmmakers only" to everyone else, but that message is a convenience: the database is the boundary.

### Onboarding (`/filmmaker/onboarding`)

A signed-in viewer applies as an individual or as a production company. They give:
- their professional name and main role;
- a short biography;
- the country and, optionally, city they work in;
- portfolio links.

**Draft → Pending review → Approved / Rejected / Changes requested.** "Changes requested" reopens the form; any other decision locks it. The guard trigger `guard_industry_application` lets the applicant only save a draft or submit, and only while it's a draft or returned. Reviewer fields can't be written by anyone but the moderation functions.

### Filmmaker profiles (`/filmmaker/profile`, `/filmmakers/[slug]`)

Approved members create one profile with the following fields:
- professional name, role, expertise and biography;
- profile image link;
- city and country (no addresses);
- languages;
- website, portfolio and social links;
- a selected filmography ("Title | Year | Role" lines);
- visibility, private by default.

**Verification:** an owner may *request* verification, but only a moderator can set `verified` (`moderate_profile_verification()`, never on your own profile). Registering never makes anyone verified.

**What the public sees:** public pages read through `get_public_filmmakers()`. It returns only public profiles of active members, and never user ids, emails or private application data.

### Production companies (`/filmmaker/company`, `/companies/[slug]`)

- **Creating:** an approved member creates a company and becomes its owner (by trigger). Companies have their own review (Draft → Pending review → Approved / Rejected / Changes requested) and verification.
- **Contact details:** `public_email` and `public_phone` exist so a company can publish contact details deliberately. Account emails are never used.
- **Membership** (`company_members`, roles owner, manager and member):
  - owners and managers invite filmmakers by their **public profile address** (`invite_company_member()`), so no email is needed or revealed;
  - only the invitee can accept;
  - managers edit company details and change members' roles;
  - members can leave;
  - the owner can't be removed or replaced.
- **Rosters:** a company's own members see its roster through `get_company_roster()`, which shows display names and public profiles only.
- **Public pages** (`get_public_companies()`, `get_public_company_members()`) list approved, public companies, their public members, and films approved with that company.

### Film submissions (`/filmmaker/submissions`)

**Fields:** title, original title, synopsis, year, runtime, up to three catalogue genres, language, country of production, director, producers, cast, the submitter's company, and links to the official trailer, poster, website and authorised viewing destinations. Every link must be safe `https://`. There's also a rights statement and notes for moderators.

**Rights:** submitting needs an explicit **rights confirmation** (also a database constraint). The review page says plainly that a confirmation isn't proof of copyright.

**Statuses:** Draft → Pending review → Under review → Changes requested / Approved / Rejected.
- Submitters edit only drafts and returned submissions, and can delete only drafts.
- Every status change is written to `submission_events` by trigger. The submitter sees this history, and moderators' messages appear in it.
- Nothing is published automatically. Nobody can approve their own submission, or one for a company they belong to; the database refuses it even for admins.

**From approval to the catalogue.** The catalogue is still TypeScript, so approval doesn't create a fake TypeScript record or a broken foreign key.
- `moderate_submission(…, 'approved', …, slug)` copies the submission into **`published_films`**, with id `film-<slug>` in the same format as catalogue ids. The app first checks the slug isn't a catalogue film.
- `/films/[slug]` serves these alongside catalogue films: catalogue slugs are prerendered as before, and other slugs are looked up in `published_films`. The proxy does the same lookup, so unknown slugs still return a real 404.
- Admins can hide or restore a listing.

**Current limits of published films:** they appear on their own page, on company pages, in "Newly listed by filmmakers" on `/industry`, and in the homepage spotlight when promoted. They are **not yet** in `/films` search, filters, recommendations, watchlists or reviews, which all read the TypeScript catalogue or check ids against it. Viewing links from a submission are shown to moderators but not added to Where to Watch automatically.

Including these films everywhere means moving the catalogue into Postgres. The plan in [Migrating to Supabase](#migrating-to-supabase-postgresql) applies: create `films` with the same ids, copy `published_films` into it, and add the foreign keys listed in the Stage 4 migration.

### Moderation (`/admin/industry`)

The dashboard has queues for:
- applications;
- film submissions, each with a detail page showing every field, links to check, the rights statement, history and private notes;
- profile verification;
- companies;
- promotions;
- approved listings;
- accounts (suspend or restore).

Every queue has status filters and search, and a count of items waiting.

How decisions work:
- Each decision calls a `security definer` function. The function checks `is_admin()`, refuses self-review, enforces the allowed status change, writes the record, adds history where relevant and notifies the person.
- Rejections and change requests need a message for the person.
- Destructive decisions (reject, end a placement, remove verification, suspend) need an explicit confirmation tick, checked on the server.
- Private notes (`moderation_notes`) are visible to admins only.

### Promotional listings (`/filmmaker/promotions`)

- **Requests:** a submitter (or a member of the film's company) requests a placement for an **approved, listed** film: featured film, homepage editorial feature, new release spotlight, genre spotlight or upcoming release feature. They set start and end dates: no earlier than today, at most 90 days.
- **Statuses:** pending → approved / rejected; approved → expired; requesters may cancel while pending. Approved placements past their end date show as expired.
- **Homepage:** approved placements running today appear in **"Editorial spotlight"** on the homepage, through `get_active_promotions()`, which returns film ids and placements only.
- **No payments:** there is no payment processing, pricing or paid promotion. `placement_kind` is constrained to `editorial`; paid placements would need a new value, payment records and clear labelling, introduced deliberately later.

### Notifications (`/account/notifications`)

A simple database-backed notification table. Rows are created only by triggers and moderation functions (`notify()` can't be called through the API), for the following events:
- application received or decided;
- profile verification;
- company received or decided, and company invitations;
- submission received or decided;
- promotion received or updated;
- suspension or restoration.

Users read, mark as read and delete only their own notifications. Links are restricted to internal paths. `email_status` is prepared for a future, opt-in email integration, but **nothing sends email**.

### Files and assets

Supabase Storage isn't configured in this project, so uploads aren't implemented. Profile images, logos, posters and trailers are **validated `https://` links**, checked in the app and by database constraints.

The catalogue's `javascript:`, `data:`, `file:` and `http:` rules apply, and images load with `referrerPolicy="no-referrer"`. No private documents or verification evidence are collected.

Secure uploads (type and size limits, safe names, owner-only private buckets) are listed as later work.

### Stage 7 security summary

| Rule | Where it's enforced |
| --- | --- |
| Users edit only their own application, profile and submissions | RLS (`auth.uid() = user_id`) and the guard triggers |
| Owners can't approve or verify anything | Guard triggers; reviewer columns aren't granted |
| Nobody reviews their own work, or their company's | Every moderation function |
| Only admins moderate | `is_admin()` in each moderation function, plus `is_moderating()` in the triggers |
| Company actions by role | `is_company_manager()` and `is_company_member()` in policies and functions |
| Public sees only approved, visible records | Public `security definer` functions; no anonymous table access |
| Private data stays private | No emails anywhere public; notes admin-only; applications owner- and admin-only |
| Roles can't be self-assigned | No UPDATE grant on `profiles.role`; only `moderate_application()` changes it |

No new environment variables are needed, and the service-role key is never used.

## Security hardening (pre-launch audit)

`supabase/migrations/20261109120000_stage8_hardening.sql` closes the issues found in the audit. Each has a regression test in `supabase/tests/stage8-hardening.test.ts`.

| Area | Change |
| --- | --- |
| Filmmaker profiles | Changing the name, role, address or links of a verified (or pending) profile resets verification |
| Companies | Content is locked while in review; editing an approved company sends it back to review and drops verification; rejected companies are read-only |
| Invitations | Only approved companies can invite; at most 10 open invitations per company and 3 invitations per person per day |
| Abuse caps | At most 5 companies per owner, 20 open submissions per member, one pending promotion per film and placement |
| Company email | A plain address only, so `mailto:` can't carry extra recipients or a body |
| Account deletion | Deleting an owner's auth user cascades instead of failing |
| Suspension | Suspended members can't change roles, remove members or accept invites (they can still leave) |
| Self-review | Moderators can't decide promotions or hide listings for films they or their company submitted |
| Data exposure | `created_by` (an admin's user id) is no longer readable on viewing data; the company roster returns `is_self` instead of user ids |
| Where to Watch | Changing a verified option's link, provider, access type or countries returns it to pending in the database |

In the app:

- **Response headers** (`next.config.ts`):
  - a Content Security Policy that allows iframes only from the two approved trailer players and blocks framing of the site;
  - `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and HSTS in production;
  - no `X-Powered-By`.
- **Session cookies** are `httpOnly`, `SameSite=Lax` and `Secure` in production. The browser never needs them, because every Supabase call runs on the server.
- **Error page:** `app/error.tsx` gives a branded error page that shows no error details.
- **SEO:** `robots.txt`, `sitemap.xml`, canonical URLs on the homepage, film and genre pages, and Open Graph and Twitter metadata.
  - Indexing is **off** unless `NEXT_PUBLIC_ALLOW_INDEXING=true`, so staging and the fictional catalogue stay out of search engines.
  - Private and sign-in pages are always `noindex`.

## Production configuration

| Setting | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Hosting environment | Public by design; never the secret or service-role key |
| `NEXT_PUBLIC_SITE_URL` | Hosting environment | The real `https://` domain. Used for auth email links, canonical URLs and the sitemap |
| `NEXT_PUBLIC_ALLOW_INDEXING=true` | Hosting environment | Only once the real catalogue is live |
| Site URL and redirect URLs | Supabase → Authentication → URL Configuration | `https://<domain>` and `https://<domain>/auth/confirm` |
| Email confirmation and custom SMTP | Supabase → Authentication | The built-in sender is rate limited; use your own SMTP for launch |
| Secure password change | Supabase → Authentication → Providers → Email | Turn on so changing a password needs a recent sign-in |
| Migrations | Supabase SQL Editor or `supabase db push` | All five, in order, on a fresh project; then grant the first admin by hand |
| Backups | Supabase → Database → Backups | Daily backups on paid plans; point-in-time recovery is an add-on. Decide what you need |
| Monitoring and analytics | Not set up | Choose a provider (e.g. the host's built-in logs, Sentry's free tier); none is installed |

## Sample data disclaimer

**Everything in the catalogue is fictional.** The 25 films, 20 actors and directors, their biographies, synopses, ratings, years, runtimes and character names were invented for development. They are not real Nollywood releases or real people, and any resemblance is unintended. Every film and person record carries `isFictional: true`, and each detail page says so.

- No real actor or director is used, and no filmography is invented for a real person.
- No copyrighted posters, celebrity photographs or promotional artwork are used. All artwork is generated in code.
- **There are no viewing destinations or trailers.** None are seeded for the fictional films, and none should be added: every film page shows "We haven't confirmed an authorised viewing option for this film yet." The database tests use providers named "(fixture)" on `.test` domains, which exist only inside the in-memory test database. The trending order is sample curation, not real statistics.

## How to…

### Add a new film

1. Add a `FilmRecord` to `src/data/films.ts`. Give it a unique `id` (`film-<slug>`) and a unique lowercase `slug`, and use existing `genreIds`:

   ```ts
   {
     id: "film-lagos-rain",
     slug: "lagos-rain",
     title: "Lagos Rain",
     synopsis: "…",
     releaseYear: 2025,
     runtimeMinutes: 102,
     ageRating: "12",
     language: "English",
     country: "Nigeria",
     genreIds: ["genre-romance"],
     artwork: { kind: "generated-poster", motif: "rings", palette: ["#101828", "#2C4A7A", "#F0C987"], description: "rain ripples under streetlights" },
     status: "released",
     featured: false,
     createdAt: "2026-11-05",
     isFictional: true,
   },
   ```

2. Add at least one director credit and one actor credit for it in `src/data/credits.ts`. See [Associate people with films](#associate-people-with-films).
3. Run `npm test`. The detail page `/films/lagos-rain` is created automatically, and the film becomes searchable and filterable on `/films`.

### Add a new genre

1. Add the slug to the `GenreSlug` union in `src/types/genre.ts`.
2. Add a `Genre` to `src/data/genres.ts` with a unique `id` (`genre-<slug>`), a description and an accent colour.
3. Tag at least one film with it, then run `npm test`. The homepage genre card, the `/genres/<slug>` page and the `/films` genre filter all appear automatically.

### Add an actor or director

Add a `Person` to `src/data/people.ts` with a unique `id` (`person-<name>`), a `biography`, a `profession` (`actor`, `director` or `actor-director`), a `nationality`, a monogram `profileImage` palette and `isFictional: true`. To feature them on the homepage, add their ID to `featuredPersonIds` in `src/data/collections.ts`.

### Associate people with films

Add one `FilmCredit` per person per role to `src/data/credits.ts`:

```ts
{ filmId: "film-lagos-rain", personId: "person-ngozi-ikemefuna-hale", role: "director" },
{ filmId: "film-lagos-rain", personId: "person-folake-odusanya-blake", role: "actor", characterName: "Adaeze" },
```

A person with the `actor-director` profession can have both an actor and a director credit on the same film. `npm test` fails if a credit points to a missing film or person, if a role doesn't match the person's profession, or if an actor credit has no character name.

## Migrating to Supabase (PostgreSQL)

The local catalogue is shaped like relational tables, so it can move to Supabase without UI changes.

1. **Create tables** that mirror the types:

   ```sql
   create type age_rating as enum ('G','PG','12','12A','15','18');
   create type film_status as enum ('released','upcoming');
   create type profession as enum ('actor','director','actor-director');
   create type credit_role as enum ('actor','director');

   create table genres (
     id text primary key, slug text unique not null, name text not null,
     description text not null, artwork jsonb not null
   );
   create table films (
     id text primary key, slug text unique not null, title text not null,
     synopsis text not null,
     release_year int not null check (release_year between 1960 and 2030),
     runtime_minutes int not null check (runtime_minutes between 40 and 240),
     age_rating age_rating not null, language text not null, country text not null,
     artwork jsonb not null, trailer_url text, status film_status not null,
     featured boolean not null default false, created_at timestamptz not null default now()
   );
   create table film_genres (
     film_id text references films on delete cascade,
     genre_id text references genres,
     position int not null default 0,
     primary key (film_id, genre_id)
   );
   create table people (
     id text primary key, name text not null, biography text not null,
     profession profession not null, profile_image jsonb not null, nationality text not null
   );
   create table film_credits (
     film_id text references films on delete cascade,
     person_id text references people,
     role credit_role not null, character_name text,
     primary key (film_id, person_id, role)
   );
   ```

   `genreIds` becomes the `film_genres` join table, and `actorIds`/`directorIds` stay derived from `film_credits`. Foreign keys, `unique` constraints and `check` constraints now enforce most of the rules that `validateCatalogue.ts` checks today.

2. **Seed the tables** with a one-off script that imports the arrays from `src/data/` and inserts them in dependency order: genres, people, films, film_genres, film_credits. Run `validateCatalogue` against the exported rows first.
3. **Swap the access layer.** Re-implement the functions in `src/lib/catalogue.ts` as async Supabase queries with the same names and return types, cache them with `'use cache'`, and add `await` at the call sites. Components and pages keep their imports.
4. **Secure it.** Enable Row Level Security with public read-only policies for the catalogue tables. Viewing options and trailers already have their own tables and policies from Stage 5. Keep the Supabase URL and keys in git-ignored `.env.local`, never in code.
5. **Change `lib/routes.ts`** to check slug existence with a lightweight query (or remove the proxy, if every slug is prerendered), and keep `generateStaticParams` returning at least one slug.
6. **Link user data to films.** Add foreign keys from `watchlist`, `watched_films`, `reviews`, `film_viewing_options` and `film_trailers` to `films (id)`, as listed at the end of the Stage 4 migration. Then the catalogue checks in Server Actions (`isCatalogueFilmId`, `isKnownFilmId`) become a backstop rather than the only check.
7. **Move search server-side** once the catalogue grows. `discoverFilms` can become a Postgres full-text query (`to_tsvector` over title, synopsis and names) behind the same `DiscoveryState` and URL parameters, so the `/films` UI stays unchanged.

## Agent rules

See [AGENTS.md](AGENTS.md) for the rules AI coding agents must follow in this repository.
