# AGENTS.md — NaijaScreen

Rules for any AI coding agent (Claude Code or otherwise) working in this repository.

## Mandatory rules

1. Only modify files inside this NaijaScreen project directory.
2. Never access, modify, rename, move or delete the owner's personal files.
3. Never execute destructive terminal commands (for example `rm -rf` outside build output, `git reset --hard`, `git clean -fdx`, force pushes, disk or permission changes).
4. Never access unrelated repositories.
5. Never expose API keys, credentials or environment variables, in code, logs, chat or commits.
6. Never commit secrets or private data. `.env*` files stay git-ignored.
7. Do not install unnecessary dependencies. Justify every new package.
8. Do not push to GitHub without the owner's explicit permission.
9. Preserve all existing contributors and Git history. Do not rewrite history, change remotes or alter the configured author identity.
10. Ask before making changes outside the agreed scope of the current stage.

## Project context

- **Product:** NaijaScreen, a Nollywood film discovery platform for viewers.
- **Stack:** Next.js (App Router), TypeScript, Tailwind CSS v4, ESLint.
- **Current stage:** Pre-launch audit complete (docs/PRE_LAUNCH_AUDIT.md). Fix work only; no new features without a brief. Supabase Auth and Postgres hold profiles, watchlists, watched films, reviews, viewing providers, film viewing options and trailers; the film catalogue is still local TypeScript data. NaijaScreen links out and never hosts, downloads or rehosts films or trailers. No payments or external AI APIs.
- **Viewing data:** never invent viewing availability, provider websites, logos or trailers, and never attach real platform links to the fictional films. New viewing options and trailers are always saved as `pending`; only an administrator verifies them, after checking the official source. Only build iframe URLs from a validated provider and id (`lib/viewing/trailers.ts`), never from user input.
- **Recommendations:** the engine in `src/lib/recommendations/` is rule-based and content-based. Never describe it as AI or machine learning. Explanations must come from measured matches in the user's own activity. Personal results are computed per request on the server and must never go into a shared cache; only anonymous, thresholded data (`get_popular_films`) may be cached.
- **Industry portal:** every review decision goes through a Stage 7 moderation function (admin check, no self-review, history, notification). Never let an owner write a reviewer field or an approved/verified status. Public pages read only through the `get_public_*` functions; never expose emails, user ids or application data publicly. Promotions are editorial only; don't add pricing or payments without a brief.
- **Admin role:** `profiles.role` is granted only by hand in the SQL editor (admin) or by `moderate_application()` (filmmaker/company). Never add an app path that changes roles, and never trust a client-side admin flag.
- **Supabase:** use only the publishable (or anon) key from `NEXT_PUBLIC_*` variables. Never add a service-role key to the app or commit `.env.local`, and never print `.env.local`. Every new table needs RLS policies and a test in `supabase/tests/`. Server Actions must re-check the session and validate input; never trust client-side checks.
- **Sample data:** every film, person and article in `src/data/` is fictional. Keep it clearly labelled as such. Never add real viewing links to fictional films, and never invent filmographies for real people.
- **Data access:** UI code reads data only through `src/lib/catalogue.ts`, never from `src/data/` directly.
- **Imagery:** no copyrighted posters, unlicensed celebrity photographs or promotional artwork. Use CSS-generated artwork or properly licensed assets.

## Working conventions

- Run `npm test`, `npm run test:db`, `npm run lint`, `npx tsc --noEmit` and `npm run build` before reporting work as done. New database changes go in a new migration with a regression test; never edit applied migrations.
- Do not stage, commit or push unless the owner asks.
