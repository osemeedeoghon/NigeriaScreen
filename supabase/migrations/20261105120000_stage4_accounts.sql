-- NaijaScreen — Stage 4: accounts, watchlist, watched films, reviews.
--
-- Film identity: the catalogue still lives in TypeScript (src/data/films.ts),
-- so there is no films table to reference yet. Rows store the catalogue's
-- stable film id (e.g. "film-harmattan-letters") as text. Ids never change
-- when titles or slugs change, and the format is checked here. The server
-- also checks each id against the catalogue before writing. When the
-- catalogue moves into Postgres, create public.films with the same ids and
-- add the foreign keys listed at the bottom of this file.
--
-- Apply once, in order, in the Supabase SQL editor or with `supabase db push`.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, created automatically on sign-up.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(display_name) between 1 and 50 and display_name = btrim(display_name)),
  username text unique
    check (username ~ '^[a-z0-9_]{3,20}$'),
  avatar_url text
    check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public-facing account details. Email stays in auth.users.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creates the profile when Supabase Auth creates a user. The display name comes
-- from sign-up metadata, is trimmed and capped, and falls back to a default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    case when requested = '' then 'NaijaScreen viewer' else btrim(left(requested, 50)) end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Watchlist and watched films
-- ---------------------------------------------------------------------------

create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  film_id text not null check (film_id ~ '^film-[a-z0-9]+(-[a-z0-9]+)*$'),
  added_at timestamptz not null default now(),
  constraint watchlist_user_film_unique unique (user_id, film_id)
);

create table public.watched_films (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  film_id text not null check (film_id ~ '^film-[a-z0-9]+(-[a-z0-9]+)*$'),
  watched_at timestamptz not null default now(),
  constraint watched_films_user_film_unique unique (user_id, film_id)
);

-- ---------------------------------------------------------------------------
-- Reviews and ratings: one per user per film.
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  film_id text not null check (film_id ~ '^film-[a-z0-9]+(-[a-z0-9]+)*$'),
  rating smallint not null check (rating between 1 and 5),
  body text check (body is null or char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_user_film_unique unique (user_id, film_id)
);

create index reviews_film_id_created_at_idx on public.reviews (film_id, created_at desc);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.watchlist enable row level security;
alter table public.watched_films enable row level security;
alter table public.reviews enable row level security;

-- Visitors (anon) get nothing directly; signed-in users get only what RLS allows.
revoke all on public.profiles, public.watchlist, public.watched_films, public.reviews from anon;
revoke all on public.profiles, public.watchlist, public.watched_films, public.reviews from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, username, avatar_url) on public.profiles to authenticated;
grant select, insert, delete on public.watchlist to authenticated;
grant select, insert, delete on public.watched_films to authenticated;
grant select, insert, delete on public.reviews to authenticated;
grant update (rating, body) on public.reviews to authenticated;

-- Profiles: read and update your own row. Rows are created by the trigger and
-- removed with the auth user, so there are no insert or delete policies.
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Watchlist: full control over your own rows only. Rows are added or removed,
-- never edited, so there is no update grant.
create policy "Users can read their own watchlist"
  on public.watchlist for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add to their own watchlist"
  on public.watchlist for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can remove from their own watchlist"
  on public.watchlist for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Watched films: same shape as the watchlist.
create policy "Users can read their own watched films"
  on public.watched_films for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can mark their own watched films"
  on public.watched_films for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can unmark their own watched films"
  on public.watched_films for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Reviews: signed-in users manage only their own. Everyone reads reviews
-- through public.get_film_reviews below, which exposes display names only.
create policy "Users can read their own reviews"
  on public.reviews for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can write their own reviews"
  on public.reviews for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can edit their own reviews"
  on public.reviews for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own reviews"
  on public.reviews for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Public review feed
-- ---------------------------------------------------------------------------

-- Returns one film's reviews with each author's display name, and flags the
-- caller's own review. It runs as the table owner so visitors can read
-- reviews without being able to query profiles or reviews directly. It never
-- returns user ids, emails or usernames.
create or replace function public.get_film_reviews(p_film_id text)
returns table (
  id uuid,
  rating smallint,
  body text,
  created_at timestamptz,
  updated_at timestamptz,
  author_name text,
  is_own boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.rating,
    r.body,
    r.created_at,
    r.updated_at,
    coalesce(p.display_name, 'NaijaScreen viewer'),
    coalesce(r.user_id = (select auth.uid()), false)
  from public.reviews r
  left join public.profiles p on p.id = r.user_id
  where r.film_id = p_film_id
  order by r.created_at desc
  limit 100;
$$;

revoke all on function public.get_film_reviews(text) from public;
grant execute on function public.get_film_reviews(text) to anon, authenticated;

-- The trigger functions are not meant to be called directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Later: when the catalogue moves into Postgres (see README), run:
--
--   create table public.films (id text primary key, slug text unique not null, ...);
--   insert into public.films (id, ...) values ('film-harmattan-letters', ...), ...;
--   alter table public.watchlist     add foreign key (film_id) references public.films (id);
--   alter table public.watched_films add foreign key (film_id) references public.films (id);
--   alter table public.reviews       add foreign key (film_id) references public.films (id);
-- ---------------------------------------------------------------------------
