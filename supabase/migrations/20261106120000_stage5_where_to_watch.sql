-- NaijaScreen — Stage 5: where to watch, trailers and administrator roles.
--
-- Apply after 20261105120000_stage4_accounts.sql, once, in the Supabase SQL
-- editor or with `supabase db push`.
--
-- Films still live in the TypeScript catalogue, so film_id is the catalogue's
-- stable text id (same format and reasoning as Stage 4). The server checks
-- each id against the catalogue before writing; foreign keys to a films table
-- can be added when the catalogue moves into Postgres.

-- ---------------------------------------------------------------------------
-- Roles: every profile is a viewer unless a trusted operator promotes it.
-- ---------------------------------------------------------------------------

-- Stage 4 grants authenticated users UPDATE on display_name, username and
-- avatar_url only, so nobody can change their own role through the API.
alter table public.profiles
  add column role text not null default 'viewer' check (role in ('viewer', 'admin'));

comment on column public.profiles.role is
  'viewer or admin. Change only from the SQL editor or another trusted server process, never from the app.';

-- True when the caller's profile has the admin role. security definer so it can
-- be used inside policies without exposing other profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Validation helpers used by check constraints
-- ---------------------------------------------------------------------------

-- A non-empty https URL without credentials, spaces or control characters.
create or replace function public.is_safe_https_url(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value is not null
    and char_length(value) <= 2000
    and value ~ '^https://[^/?#@\s]+(/[^\s]*)?$'
    and value !~ '[[:cntrl:]]';
$$;

-- ISO 3166-1 alpha-2 codes: two upper-case letters each, no duplicates.
create or replace function public.is_country_code_list(codes text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(codes, 1), 0) between 1 and 250
    and (select bool_and(c ~ '^[A-Z]{2}$') from unnest(codes) as c)
    and (select count(distinct c) = count(*) from unnest(codes) as c);
$$;

-- ISO 639 language codes (two or three lower-case letters), possibly empty.
create or replace function public.is_language_code_list(codes text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(codes, 1), 0) <= 30
    and coalesce((select bool_and(c ~ '^[a-z]{2,3}$') from unnest(codes) as c), true)
    and (select count(distinct c) = count(*) from unnest(codes) as c);
$$;

-- ---------------------------------------------------------------------------
-- Viewing providers
-- ---------------------------------------------------------------------------

create table public.viewing_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  website_url text not null check (public.is_safe_https_url(website_url)),
  logo_url text check (logo_url is null or public.is_safe_https_url(logo_url)),
  description text check (description is null or char_length(description) between 1 and 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index viewing_providers_name_unique on public.viewing_providers (lower(name));

create trigger viewing_providers_set_updated_at
  before update on public.viewing_providers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Film viewing options
-- ---------------------------------------------------------------------------

create table public.film_viewing_options (
  id uuid primary key default gen_random_uuid(),
  film_id text not null check (film_id ~ '^film-[a-z0-9]+(-[a-z0-9]+)*$'),
  provider_id uuid not null references public.viewing_providers (id) on delete restrict,
  destination_url text not null check (public.is_safe_https_url(destination_url)),
  access_type text not null
    check (access_type in ('subscription', 'free', 'free_with_ads', 'rental', 'purchase', 'other')),
  countries text[] not null check (public.is_country_code_list(countries)),
  audio_languages text[] not null default '{}' check (public.is_language_code_list(audio_languages)),
  subtitle_languages text[] not null default '{}' check (public.is_language_code_list(subtitle_languages)),
  availability_notes text check (availability_notes is null or char_length(availability_notes) between 1 and 500),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'expired')),
  verified_at timestamptz,
  last_checked_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A verified option always records when it was verified.
  constraint film_viewing_options_verified_has_date check (verification_status <> 'verified' or verified_at is not null),
  -- The same destination can't be listed twice for one film, provider and access type.
  constraint film_viewing_options_unique unique (film_id, provider_id, access_type, destination_url)
);

create index film_viewing_options_public_idx
  on public.film_viewing_options (film_id)
  where is_active and verification_status = 'verified';
create index film_viewing_options_provider_idx on public.film_viewing_options (provider_id);
create index film_viewing_options_status_idx on public.film_viewing_options (verification_status, updated_at desc);

-- ---------------------------------------------------------------------------
-- Film trailers: links to authorised uploads on approved video platforms.
-- Nothing is downloaded or rehosted; the app embeds the provider's own player.
-- ---------------------------------------------------------------------------

create table public.film_trailers (
  id uuid primary key default gen_random_uuid(),
  film_id text not null check (film_id ~ '^film-[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 120 and title = btrim(title)),
  video_provider text not null check (video_provider in ('youtube', 'vimeo')),
  -- Provider video id, extracted and checked by the server from the pasted URL.
  video_id text not null,
  video_url text not null check (public.is_safe_https_url(video_url)),
  -- False when the owner has switched embedding off: the app shows a link instead.
  embeddable boolean not null default true,
  thumbnail_url text check (thumbnail_url is null or public.is_safe_https_url(thumbnail_url)),
  published_on date,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'expired')),
  verified_at timestamptz,
  last_checked_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint film_trailers_video_id_format check (
    (video_provider = 'youtube' and video_id ~ '^[A-Za-z0-9_-]{11}$')
    or (video_provider = 'vimeo' and video_id ~ '^[0-9]{6,12}$')
  ),
  constraint film_trailers_verified_has_date check (verification_status <> 'verified' or verified_at is not null),
  constraint film_trailers_unique unique (film_id, video_provider, video_id)
);

create index film_trailers_public_idx
  on public.film_trailers (film_id)
  where is_active and verification_status = 'verified';

-- ---------------------------------------------------------------------------
-- Verification bookkeeping
-- ---------------------------------------------------------------------------

-- Keeps updated_at, verified_at and last_checked_at honest whatever the client
-- sends: verifying stamps verified_at, any status change stamps last_checked_at,
-- and leaving "verified" clears verified_at.
create or replace function public.stamp_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' then
    new.verified_at = null;
    new.last_checked_at = null;
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status then
    new.last_checked_at = now();
    new.verified_at = case when new.verification_status = 'verified' then now() else null end;
  else
    new.verified_at = old.verified_at;
  end if;
  return new;
end;
$$;

create trigger film_viewing_options_stamp
  before insert or update on public.film_viewing_options
  for each row execute function public.stamp_verification();

create trigger film_trailers_stamp
  before insert or update on public.film_trailers
  for each row execute function public.stamp_verification();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.viewing_providers enable row level security;
alter table public.film_viewing_options enable row level security;
alter table public.film_trailers enable row level security;

revoke all on public.viewing_providers, public.film_viewing_options, public.film_trailers from anon, authenticated;

grant select on public.viewing_providers, public.film_viewing_options, public.film_trailers to anon, authenticated;
grant insert (name, slug, website_url, logo_url, description, is_active) on public.viewing_providers to authenticated;
grant update (name, slug, website_url, logo_url, description, is_active) on public.viewing_providers to authenticated;
grant insert (film_id, provider_id, destination_url, access_type, countries, audio_languages, subtitle_languages,
  availability_notes, is_active) on public.film_viewing_options to authenticated;
grant update (provider_id, destination_url, access_type, countries, audio_languages, subtitle_languages,
  availability_notes, verification_status, is_active) on public.film_viewing_options to authenticated;
grant insert (film_id, title, video_provider, video_id, video_url, embeddable, thumbnail_url, published_on, is_active)
  on public.film_trailers to authenticated;
grant update (title, embeddable, thumbnail_url, published_on, verification_status, is_active)
  on public.film_trailers to authenticated;
-- No delete grants: records are deactivated, rejected or expired so the history stays.

-- Providers: everyone sees active ones; administrators see and manage all.
create policy "Anyone can read active providers"
  on public.viewing_providers for select to anon, authenticated
  using (is_active or (select public.is_admin()));

create policy "Administrators can add providers"
  on public.viewing_providers for insert to authenticated
  with check ((select public.is_admin()));

create policy "Administrators can edit providers"
  on public.viewing_providers for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Viewing options: the public sees only active, verified options from active
-- providers. Administrators see everything and may add options as pending only.
create policy "Anyone can read verified viewing options"
  on public.film_viewing_options for select to anon, authenticated
  using (
    (
      is_active
      and verification_status = 'verified'
      and exists (select 1 from public.viewing_providers p where p.id = provider_id and p.is_active)
    )
    or (select public.is_admin())
  );

create policy "Administrators can add pending viewing options"
  on public.film_viewing_options for insert to authenticated
  with check ((select public.is_admin()) and verification_status = 'pending');

create policy "Administrators can update viewing options"
  on public.film_viewing_options for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Trailers: same rules as viewing options.
create policy "Anyone can read verified trailers"
  on public.film_trailers for select to anon, authenticated
  using ((is_active and verification_status = 'verified') or (select public.is_admin()));

create policy "Administrators can add pending trailers"
  on public.film_trailers for insert to authenticated
  with check ((select public.is_admin()) and verification_status = 'pending');

create policy "Administrators can update trailers"
  on public.film_trailers for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Helper functions are for constraints and policies, not for API calls.
revoke all on function public.stamp_verification() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Granting the admin role (run by hand in the SQL editor, never from the app):
--
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
-- ---------------------------------------------------------------------------
