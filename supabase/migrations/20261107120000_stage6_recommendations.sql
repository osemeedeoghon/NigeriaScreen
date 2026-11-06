-- NaijaScreen — Stage 6: discovery preferences, recommendation feedback and
-- anonymous popularity.
--
-- Apply after the Stage 4 and Stage 5 migrations, once, in the Supabase SQL
-- editor or with `supabase db push`. No existing table is replaced; profiles
-- gains three columns and one new table is added.

-- ---------------------------------------------------------------------------
-- Discovery preferences live on the existing profile row.
-- ---------------------------------------------------------------------------

-- Genre slugs as used by the catalogue (drama, romance, ...).
create or replace function public.is_slug_list(slugs text[], max_items int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(slugs, 1), 0) <= max_items
    and coalesce((select bool_and(s ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(s) <= 40) from unnest(slugs) as s), true)
    and (select count(distinct s) = count(*) from unnest(slugs) as s);
$$;

alter table public.profiles
  -- ISO 639 codes of the catalogue's languages (en, yo, ig, ha, pcm, efi, ijc).
  add column preferred_languages text[] not null default '{}'
    check (public.is_language_code_list(preferred_languages) and coalesce(array_length(preferred_languages, 1), 0) <= 10),
  add column favourite_genres text[] not null default '{}'
    check (public.is_slug_list(favourite_genres, 10)),
  -- false: films the user has watched are left out of recommendations.
  add column include_watched boolean not null default false;

-- Users may change these on their own row; the Stage 4 policy limits UPDATE to it.
grant update (preferred_languages, favourite_genres, include_watched) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Recommendation feedback: "hide this" and "not interested".
-- ---------------------------------------------------------------------------

create table public.recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  film_id text not null check (film_id ~ '^film-[a-z0-9]+(-[a-z0-9]+)*$'),
  -- dismissed: hide for a while. not_interested: hide until the user undoes it.
  kind text not null check (kind in ('dismissed', 'not_interested')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recommendation_feedback_user_film_unique unique (user_id, film_id)
);

create trigger recommendation_feedback_set_updated_at
  before update on public.recommendation_feedback
  for each row execute function public.set_updated_at();

alter table public.recommendation_feedback enable row level security;

revoke all on public.recommendation_feedback from anon, authenticated;
grant select, insert, delete on public.recommendation_feedback to authenticated;
grant update (kind) on public.recommendation_feedback to authenticated;

create policy "Users can read their own feedback"
  on public.recommendation_feedback for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own feedback"
  on public.recommendation_feedback for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can change their own feedback"
  on public.recommendation_feedback for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their own feedback"
  on public.recommendation_feedback for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Popular with viewers: anonymous counts only.
-- ---------------------------------------------------------------------------

-- Indexes for the popularity window (the unique constraints already index
-- user_id + film_id lookups).
create index if not exists watchlist_added_at_idx on public.watchlist (added_at);
create index if not exists watched_films_watched_at_idx on public.watched_films (watched_at);
create index if not exists reviews_created_at_idx on public.reviews (created_at);

-- Films that at least 3 different members saved, watched or rated 4+ in the
-- last 90 days, with the number of distinct members. It never returns who they
-- were. The threshold is fixed here so a caller can't lower it to single out
-- one person's activity.
create or replace function public.get_popular_films(p_limit integer default 12)
returns table (film_id text, member_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  with activity as (
    select w.film_id, w.user_id from public.watchlist w where w.added_at > now() - interval '90 days'
    union
    select f.film_id, f.user_id from public.watched_films f where f.watched_at > now() - interval '90 days'
    union
    select r.film_id, r.user_id from public.reviews r where r.rating >= 4 and r.created_at > now() - interval '90 days'
  )
  select a.film_id, count(distinct a.user_id)::integer as member_count
  from activity a
  group by a.film_id
  having count(distinct a.user_id) >= 3
  order by member_count desc, a.film_id
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

revoke all on function public.get_popular_films(integer) from public;
grant execute on function public.get_popular_films(integer) to anon, authenticated;
