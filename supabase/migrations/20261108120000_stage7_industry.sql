-- NaijaScreen — Stage 7: filmmaker portal and industry ecosystem.
--
-- Apply after the Stage 4–6 migrations, once, in the Supabase SQL editor or
-- with `supabase db push`.
--
-- Design:
-- * The existing profiles.role is extended (viewer, filmmaker, company, admin)
--   rather than adding a second role system. Only moderation functions change
--   it; no API role has UPDATE on the column.
-- * Applicants and filmmakers write their own rows directly, under RLS, with
--   triggers that allow only the status changes an owner may make (save a
--   draft, submit for review, request verification, cancel a request).
-- * Every review decision goes through a security definer moderation function
--   that checks is_admin(), refuses self-review, records history and sends a
--   notification. These functions set a transaction-local flag that the
--   guard triggers require for reviewer-only changes.
-- * Public pages read through security definer functions that return only
--   public columns of approved, visible records. Anonymous users get no
--   direct access to the industry tables.
-- * Films still live in the TypeScript catalogue. An approved submission is
--   copied into public.published_films (id "film-<slug>"), which the app shows
--   at /films/<slug> alongside catalogue films.

-- ---------------------------------------------------------------------------
-- Roles and suspension
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('viewer', 'filmmaker', 'company', 'admin'));
alter table public.profiles
  add column suspended_at timestamptz,
  add column suspension_reason text check (suspension_reason is null or char_length(suspension_reason) between 1 and 500);

comment on column public.profiles.role is
  'viewer, filmmaker, company or admin. filmmaker/company come only from an approved application; admin only from the SQL editor.';

-- Caller is an approved industry member (or an admin) and not suspended.
create or replace function public.is_industry_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role in ('filmmaker', 'company', 'admin') and p.suspended_at is null
       from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

-- Any user is an approved, unsuspended industry member (for public listings).
create or replace function public.is_public_industry_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role in ('filmmaker', 'company', 'admin') and p.suspended_at is null from public.profiles p where p.id = p_user_id),
    false
  );
$$;

-- True only inside a moderation function (transaction-local flag) run by an admin.
create or replace function public.is_moderating()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('naijascreen.moderating', true), '') = 'yes' and public.is_admin();
$$;

-- ---------------------------------------------------------------------------
-- Shared validation helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_https_url_list(urls text[], max_items int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(urls, 1), 0) <= max_items
    and coalesce((select bool_and(public.is_safe_https_url(u)) from unnest(urls) as u), true);
$$;

create or replace function public.is_short_text_list(items text[], max_items int, max_length int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(items, 1), 0) <= max_items
    and coalesce((select bool_and(char_length(i) between 1 and max_length and i = btrim(i)) from unnest(items) as i), true);
$$;

-- [{"label": "...", "url": "https://..."}], at most max_items.
create or replace function public.is_link_list(links jsonb, max_items int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(links) = 'array'
    and jsonb_array_length(links) <= max_items
    and coalesce((
      select bool_and(
        jsonb_typeof(l) = 'object'
        and char_length(coalesce(l ->> 'label', '')) between 1 and 80
        and public.is_safe_https_url(l ->> 'url')
      ) from jsonb_array_elements(links) as l
    ), true);
$$;

-- [{"title": "...", "year": 2020, "role": "..."}], at most max_items.
create or replace function public.is_filmography(entries jsonb, max_items int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(entries) = 'array'
    and jsonb_array_length(entries) <= max_items
    and coalesce((
      select bool_and(
        jsonb_typeof(e) = 'object'
        and char_length(coalesce(e ->> 'title', '')) between 1 and 120
        and (e ->> 'year') ~ '^(19[5-9][0-9]|20[0-3][0-9])$'
        and char_length(coalesce(e ->> 'role', '')) between 1 and 80
      ) from jsonb_array_elements(entries) as e
    ), true);
$$;

-- ---------------------------------------------------------------------------
-- Notifications (in-app only; email delivery is prepared but never sent)
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'application_received', 'application_approved', 'application_rejected', 'application_changes_requested',
    'profile_verified', 'profile_verification_rejected',
    'company_received', 'company_approved', 'company_rejected', 'company_changes_requested', 'company_invite',
    'submission_received', 'submission_under_review', 'submission_approved', 'submission_rejected', 'submission_changes_requested',
    'promotion_received', 'promotion_updated', 'account_suspended', 'account_restored'
  )),
  title text not null check (char_length(title) between 1 and 120),
  body text check (body is null or char_length(body) <= 2000),
  -- Internal links only.
  link text check (link is null or (link ~ '^/[A-Za-z0-9/_?=&.%-]*$' and link !~ '^//')),
  read_at timestamptz,
  -- For a future, opt-in email integration. Nothing in this stage sends email.
  email_status text not null default 'not_sent' check (email_status in ('not_sent', 'queued', 'sent', 'skipped')),
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "Users read their own notifications"
  on public.notifications for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users mark their own notifications read"
  on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own notifications"
  on public.notifications for delete to authenticated using ((select auth.uid()) = user_id);

-- Internal: only triggers and moderation functions create notifications.
create or replace function public.notify(p_user_id uuid, p_kind text, p_title text, p_body text, p_link text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, link) values (p_user_id, p_kind, p_title, p_body, p_link);
$$;

-- ---------------------------------------------------------------------------
-- Industry applications (one per user; reused for resubmission)
-- ---------------------------------------------------------------------------

create table public.industry_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  account_type text not null default 'filmmaker' check (account_type in ('filmmaker', 'company')),
  professional_name text not null check (char_length(professional_name) between 1 and 80 and professional_name = btrim(professional_name)),
  professional_role text not null check (professional_role in (
    'actor', 'director', 'producer', 'screenwriter', 'cinematographer', 'editor', 'production_designer', 'composer', 'other'
  )),
  company_name text check (company_name is null or char_length(company_name) between 1 and 120),
  biography text not null default '' check (char_length(biography) <= 2000),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  city text check (city is null or char_length(city) between 1 and 80),
  portfolio_links text[] not null default '{}' check (public.is_https_url_list(portfolio_links, 10)),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'rejected', 'changes_requested')),
  -- Shown to the applicant. Private reviewer notes live in moderation_notes.
  reviewer_feedback text check (reviewer_feedback is null or char_length(reviewer_feedback) <= 2000),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint industry_applications_company_name check (account_type <> 'company' or company_name is not null),
  constraint industry_applications_ready check (status = 'draft' or (char_length(biography) >= 20 and country is not null))
);

create index industry_applications_status_idx on public.industry_applications (status, submitted_at);

-- ---------------------------------------------------------------------------
-- Filmmaker profiles
-- ---------------------------------------------------------------------------

create table public.filmmaker_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  professional_name text not null check (char_length(professional_name) between 1 and 80 and professional_name = btrim(professional_name)),
  professional_role text not null check (professional_role in (
    'actor', 'director', 'producer', 'screenwriter', 'cinematographer', 'editor', 'production_designer', 'composer', 'other'
  )),
  expertise text[] not null default '{}' check (public.is_short_text_list(expertise, 10, 40)),
  biography text not null default '' check (char_length(biography) <= 3000),
  avatar_url text check (avatar_url is null or public.is_safe_https_url(avatar_url)),
  city text check (city is null or char_length(city) between 1 and 80),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  languages text[] not null default '{}' check (public.is_language_code_list(languages)),
  website_url text check (website_url is null or public.is_safe_https_url(website_url)),
  portfolio_links text[] not null default '{}' check (public.is_https_url_list(portfolio_links, 10)),
  social_links text[] not null default '{}' check (public.is_https_url_list(social_links, 10)),
  filmography jsonb not null default '[]' check (public.is_filmography(filmography, 30)),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  verification_feedback text check (verification_feedback is null or char_length(verification_feedback) <= 1000),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index filmmaker_profiles_directory_idx on public.filmmaker_profiles (visibility, professional_role, country);

-- ---------------------------------------------------------------------------
-- Production companies and memberships
-- ---------------------------------------------------------------------------

create table public.production_companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(name) between 1 and 120 and name = btrim(name)),
  logo_url text check (logo_url is null or public.is_safe_https_url(logo_url)),
  description text not null default '' check (char_length(description) <= 3000),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  city text check (city is null or char_length(city) between 1 and 80),
  website_url text check (website_url is null or public.is_safe_https_url(website_url)),
  -- Contact details the company chooses to publish. Never an account email.
  public_email text check (public_email is null or (char_length(public_email) <= 254 and public_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  public_phone text check (public_phone is null or public_phone ~ '^\+?[0-9 ()-]{6,20}$'),
  social_links text[] not null default '{}' check (public.is_https_url_list(social_links, 10)),
  visibility text not null default 'public' check (visibility in ('private', 'public')),
  review_status text not null default 'draft' check (review_status in ('draft', 'pending_review', 'approved', 'rejected', 'changes_requested')),
  reviewer_feedback text check (reviewer_feedback is null or char_length(reviewer_feedback) <= 2000),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_companies_ready check (review_status = 'draft' or (char_length(description) >= 20 and country is not null))
);

create unique index production_companies_name_unique on public.production_companies (lower(name));
create index production_companies_directory_idx on public.production_companies (review_status, visibility, country);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.production_companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner', 'manager', 'member')),
  status text not null default 'invited' check (status in ('invited', 'active')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_members_unique unique (company_id, user_id)
);

create index company_members_user_idx on public.company_members (user_id);

create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;

create or replace function public.is_company_manager(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.member_role in ('owner', 'manager')
  );
$$;

create or replace function public.is_invited_to_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id and m.user_id = (select auth.uid()) and m.status = 'invited'
  );
$$;

-- ---------------------------------------------------------------------------
-- Published films (approved submissions) and film submissions
-- ---------------------------------------------------------------------------

create table public.published_films (
  id text primary key check (id ~ '^film-[a-z0-9]+(-[a-z0-9]+)*$'),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  title text not null,
  original_title text,
  synopsis text not null,
  release_year integer not null,
  runtime_minutes integer not null,
  genres text[] not null,
  language text not null,
  country text not null,
  director text not null,
  producers text[] not null default '{}',
  cast_names text[] not null default '{}',
  trailer_url text,
  poster_url text,
  website_url text,
  company_id uuid references public.production_companies (id) on delete set null,
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_films_id_matches_slug check (id = 'film-' || slug)
);

create table public.film_submissions (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid references public.production_companies (id) on delete set null,
  title text not null check (char_length(title) between 1 and 160 and title = btrim(title)),
  original_title text check (original_title is null or char_length(original_title) between 1 and 160),
  synopsis text not null default '' check (char_length(synopsis) <= 3000),
  release_year integer check (release_year is null or release_year between 1950 and 2035),
  runtime_minutes integer check (runtime_minutes is null or runtime_minutes between 1 and 600),
  genres text[] not null default '{}' check (public.is_slug_list(genres, 3)),
  language text check (language is null or language ~ '^[a-z]{2,3}$'),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  director text check (director is null or char_length(director) between 1 and 120),
  producers text[] not null default '{}' check (public.is_short_text_list(producers, 20, 120)),
  cast_names text[] not null default '{}' check (public.is_short_text_list(cast_names, 50, 120)),
  trailer_url text check (trailer_url is null or public.is_safe_https_url(trailer_url)),
  poster_url text check (poster_url is null or public.is_safe_https_url(poster_url)),
  website_url text check (website_url is null or public.is_safe_https_url(website_url)),
  viewing_links jsonb not null default '[]' check (public.is_link_list(viewing_links, 10)),
  rights_confirmed boolean not null default false,
  rights_statement text check (rights_statement is null or char_length(rights_statement) <= 1000),
  notes_for_admins text check (notes_for_admins is null or char_length(notes_for_admins) <= 2000),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'under_review', 'changes_requested', 'approved', 'rejected')),
  reviewer_feedback text check (reviewer_feedback is null or char_length(reviewer_feedback) <= 2000),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  published_film_id text unique references public.published_films (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Anything past draft must be complete and carry the rights confirmation.
  constraint film_submissions_ready check (
    status = 'draft' or (
      rights_confirmed and char_length(synopsis) >= 20 and coalesce(array_length(genres, 1), 0) >= 1
      and language is not null and country is not null and release_year is not null
      and runtime_minutes is not null and director is not null
    )
  )
);

create index film_submissions_submitter_idx on public.film_submissions (submitter_id, updated_at desc);
create index film_submissions_status_idx on public.film_submissions (status, submitted_at);

alter table public.published_films
  add column submission_id uuid unique references public.film_submissions (id) on delete set null;

-- History of every status change, written by trigger.
create table public.submission_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.film_submissions (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index submission_events_submission_idx on public.submission_events (submission_id, created_at);

-- ---------------------------------------------------------------------------
-- Promotion requests (editorial only; no payments in this stage)
-- ---------------------------------------------------------------------------

create table public.promotion_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  film_id text not null references public.published_films (id) on delete cascade,
  placement text not null check (placement in ('featured_film', 'homepage_editorial', 'new_release_spotlight', 'genre_spotlight', 'upcoming_release')),
  genre text check (genre is null or genre ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  starts_on date not null,
  ends_on date not null,
  -- Paid placements would need a new value here plus payment records; none exist yet.
  placement_kind text not null default 'editorial' check (placement_kind = 'editorial'),
  message text check (message is null or char_length(message) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  reviewer_feedback text check (reviewer_feedback is null or char_length(reviewer_feedback) <= 2000),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotion_requests_dates check (ends_on >= starts_on and ends_on <= starts_on + 90),
  constraint promotion_requests_genre check ((placement = 'genre_spotlight') = (genre is not null))
);

create index promotion_requests_status_idx on public.promotion_requests (status, starts_on, ends_on);

-- Requester submitted the film, or is an active member of its company.
create or replace function public.can_promote_film(p_film_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.published_films f
    join public.film_submissions s on s.id = f.submission_id
    where f.id = p_film_id and f.is_active
      and (s.submitter_id = (select auth.uid())
           or (f.company_id is not null and public.is_company_member(f.company_id)))
  );
$$;

-- ---------------------------------------------------------------------------
-- Private moderation notes (administrators only)
-- ---------------------------------------------------------------------------

create table public.moderation_notes (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('application', 'profile', 'company', 'submission', 'promotion', 'account')),
  subject_id uuid not null,
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  note text not null check (char_length(note) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index moderation_notes_subject_idx on public.moderation_notes (subject_type, subject_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger industry_applications_set_updated_at before update on public.industry_applications
  for each row execute function public.set_updated_at();
create trigger filmmaker_profiles_set_updated_at before update on public.filmmaker_profiles
  for each row execute function public.set_updated_at();
create trigger production_companies_set_updated_at before update on public.production_companies
  for each row execute function public.set_updated_at();
create trigger company_members_set_updated_at before update on public.company_members
  for each row execute function public.set_updated_at();
create trigger film_submissions_set_updated_at before update on public.film_submissions
  for each row execute function public.set_updated_at();
create trigger promotion_requests_set_updated_at before update on public.promotion_requests
  for each row execute function public.set_updated_at();
create trigger published_films_set_updated_at before update on public.published_films
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guard triggers: what an owner may change without a moderator
-- ---------------------------------------------------------------------------

-- Applications: owners edit drafts and returned applications, and may submit.
create or replace function public.guard_industry_application()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_moderating() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending_review') then
      raise exception 'New applications start as a draft or are submitted for review' using errcode = '42501';
    end if;
    new.reviewer_feedback := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
  else
    if old.status not in ('draft', 'changes_requested') then
      raise exception 'This application is with the moderators and cannot be edited' using errcode = '42501';
    end if;
    if new.status not in ('draft', 'pending_review') then
      raise exception 'Applicants can only save or submit their application' using errcode = '42501';
    end if;
  end if;
  if new.status = 'pending_review' then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

create trigger industry_applications_guard before insert or update on public.industry_applications
  for each row execute function public.guard_industry_application();

-- Profiles: owners may ask for verification, never grant it.
create or replace function public.guard_filmmaker_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_moderating() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.verification_status not in ('unverified', 'pending') then
      raise exception 'Profiles start unverified' using errcode = '42501';
    end if;
    new.verified_at := null;
    new.verification_feedback := null;
  elsif new.verification_status is distinct from old.verification_status then
    if not (new.verification_status = 'pending' and old.verification_status in ('unverified', 'rejected')) then
      raise exception 'Only a moderator can change verification' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger filmmaker_profiles_guard before insert or update on public.filmmaker_profiles
  for each row execute function public.guard_filmmaker_profile();

-- Companies: managers edit drafts and returned companies, submit them, and
-- ask for verification. Visibility of an approved company may still change.
create or replace function public.guard_production_company()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_moderating() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.review_status not in ('draft', 'pending_review') or new.verification_status <> 'unverified' then
      raise exception 'New companies start as a draft' using errcode = '42501';
    end if;
    new.reviewer_feedback := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
  else
    if new.review_status is distinct from old.review_status then
      if not (old.review_status in ('draft', 'changes_requested') and new.review_status in ('draft', 'pending_review')) then
        raise exception 'Only a moderator can change a company''s review status' using errcode = '42501';
      end if;
    end if;
    if new.verification_status is distinct from old.verification_status then
      if not (new.verification_status = 'pending' and old.verification_status in ('unverified', 'rejected') and old.review_status = 'approved') then
        raise exception 'Only a moderator can change verification' using errcode = '42501';
      end if;
    end if;
  end if;
  if new.review_status = 'pending_review' and (tg_op = 'INSERT' or old.review_status <> 'pending_review') then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

create trigger production_companies_guard before insert or update on public.production_companies
  for each row execute function public.guard_production_company();

-- The company's creator becomes its owner.
create or replace function public.add_company_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.company_members (company_id, user_id, member_role, status, invited_by)
  values (new.id, new.owner_id, 'owner', 'active', new.owner_id);
  return new;
end;
$$;

create trigger production_companies_add_owner after insert on public.production_companies
  for each row execute function public.add_company_owner();

-- Memberships: owners can't be changed or removed; invitees may only accept.
create or replace function public.guard_company_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.member_role = 'owner' then
      raise exception 'A company''s owner cannot be removed' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.member_role = 'owner' and (new.member_role <> 'owner' or new.status <> old.status) then
    raise exception 'A company''s owner cannot be changed' using errcode = '42501';
  end if;
  if new.member_role = 'owner' and old.member_role <> 'owner' then
    raise exception 'Ownership cannot be granted' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not (old.status = 'invited' and new.status = 'active' and old.user_id = (select auth.uid())) then
    raise exception 'Only the invited person can accept an invitation' using errcode = '42501';
  end if;
  if new.member_role is distinct from old.member_role and not public.is_company_manager(old.company_id) then
    raise exception 'Only company managers can change roles' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger company_members_guard before update or delete on public.company_members
  for each row execute function public.guard_company_member();

-- Submissions: owners edit drafts and returned submissions, and may submit.
create or replace function public.guard_film_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_moderating() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending_review') then
      raise exception 'New submissions start as a draft or are submitted for review' using errcode = '42501';
    end if;
    new.reviewer_feedback := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.published_film_id := null;
  else
    if old.status not in ('draft', 'changes_requested') then
      raise exception 'This submission is with the moderators and cannot be edited' using errcode = '42501';
    end if;
    if new.status not in ('draft', 'pending_review') then
      raise exception 'Submitters can only save or submit' using errcode = '42501';
    end if;
  end if;
  if new.company_id is not null and not public.is_company_member(new.company_id) then
    raise exception 'You can only submit films for companies you belong to' using errcode = '42501';
  end if;
  if new.status = 'pending_review' then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

create trigger film_submissions_guard before insert or update on public.film_submissions
  for each row execute function public.guard_film_submission();

-- Promotions: requesters may only cancel a pending request.
create or replace function public.guard_promotion_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_moderating() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      raise exception 'Promotion requests start as pending' using errcode = '42501';
    end if;
    if new.starts_on < current_date then
      raise exception 'A promotion cannot start in the past' using errcode = '22023';
    end if;
    new.reviewer_feedback := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
  elsif not (old.status = 'pending' and new.status = 'cancelled') then
    raise exception 'Requesters can only cancel a pending request' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger promotion_requests_guard before insert or update on public.promotion_requests
  for each row execute function public.guard_promotion_request();

-- ---------------------------------------------------------------------------
-- History and "received" notifications
-- ---------------------------------------------------------------------------

create or replace function public.record_submission_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.submission_events (submission_id, actor_id, from_status, to_status, note)
    values (
      new.id, (select auth.uid()),
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      case when new.status in ('changes_requested', 'approved', 'rejected') then new.reviewer_feedback end
    );
    if new.status = 'pending_review' then
      perform public.notify(new.submitter_id, 'submission_received', 'Film submission received',
        format('We''ve received "%s". A moderator will review it.', new.title), '/filmmaker/submissions/' || new.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger film_submissions_history after insert or update on public.film_submissions
  for each row execute function public.record_submission_event();

create or replace function public.notify_application_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending_review' and (tg_op = 'INSERT' or old.status <> 'pending_review') then
    perform public.notify(new.user_id, 'application_received', 'Application received',
      'Thanks for applying. A moderator will review your application and let you know here.', '/filmmaker/onboarding');
  end if;
  return new;
end;
$$;

create trigger industry_applications_received after insert or update on public.industry_applications
  for each row execute function public.notify_application_received();

create or replace function public.notify_company_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.review_status = 'pending_review' and (tg_op = 'INSERT' or old.review_status <> 'pending_review') then
    perform public.notify(new.owner_id, 'company_received', 'Company profile received',
      format('We''ve received "%s" for review.', new.name), '/filmmaker/company');
  end if;
  return new;
end;
$$;

create trigger production_companies_received after insert or update on public.production_companies
  for each row execute function public.notify_company_received();

create or replace function public.notify_promotion_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify(new.requester_id, 'promotion_received', 'Promotion request received',
    'A moderator will review your request. Placements are editorial and unpaid.', '/filmmaker/promotions');
  return new;
end;
$$;

create trigger promotion_requests_received after insert on public.promotion_requests
  for each row execute function public.notify_promotion_received();

-- ---------------------------------------------------------------------------
-- Row Level Security and grants
-- ---------------------------------------------------------------------------

alter table public.industry_applications enable row level security;
alter table public.filmmaker_profiles enable row level security;
alter table public.production_companies enable row level security;
alter table public.company_members enable row level security;
alter table public.published_films enable row level security;
alter table public.film_submissions enable row level security;
alter table public.submission_events enable row level security;
alter table public.promotion_requests enable row level security;
alter table public.moderation_notes enable row level security;

revoke all on public.industry_applications, public.filmmaker_profiles, public.production_companies, public.company_members,
  public.published_films, public.film_submissions, public.submission_events, public.promotion_requests, public.moderation_notes
  from anon, authenticated;

-- Applications
grant select on public.industry_applications to authenticated;
grant insert (account_type, professional_name, professional_role, company_name, biography, country, city, portfolio_links, status)
  on public.industry_applications to authenticated;
grant update (account_type, professional_name, professional_role, company_name, biography, country, city, portfolio_links, status)
  on public.industry_applications to authenticated;

create policy "Applicants read their application" on public.industry_applications for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "Viewers start their own application" on public.industry_applications for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Applicants edit their own application" on public.industry_applications for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Filmmaker profiles: owner (approved industry member) and admins; public via functions.
grant select on public.filmmaker_profiles to authenticated;
grant insert (slug, professional_name, professional_role, expertise, biography, avatar_url, city, country, languages,
  website_url, portfolio_links, social_links, filmography, visibility, verification_status) on public.filmmaker_profiles to authenticated;
grant update (slug, professional_name, professional_role, expertise, biography, avatar_url, city, country, languages,
  website_url, portfolio_links, social_links, filmography, visibility, verification_status) on public.filmmaker_profiles to authenticated;

create policy "Owners and admins read filmmaker profiles" on public.filmmaker_profiles for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "Approved members create their profile" on public.filmmaker_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_industry_member()));
create policy "Approved members edit their profile" on public.filmmaker_profiles for update to authenticated
  using ((select auth.uid()) = user_id and (select public.is_industry_member()))
  with check ((select auth.uid()) = user_id);

-- Companies
grant select on public.production_companies to authenticated;
grant insert (slug, name, logo_url, description, country, city, website_url, public_email, public_phone, social_links, visibility, review_status)
  on public.production_companies to authenticated;
grant update (name, logo_url, description, country, city, website_url, public_email, public_phone, social_links, visibility, review_status, verification_status)
  on public.production_companies to authenticated;

create policy "Members, invitees and admins read companies" on public.production_companies for select to authenticated
  using ((select auth.uid()) = owner_id or public.is_company_member(id) or public.is_invited_to_company(id) or (select public.is_admin()));
create policy "Approved members create companies" on public.production_companies for insert to authenticated
  with check ((select auth.uid()) = owner_id and (select public.is_industry_member()));
create policy "Managers edit their company" on public.production_companies for update to authenticated
  using (public.is_company_manager(id) and (select public.is_industry_member()))
  with check (public.is_company_manager(id));

-- Memberships: invitations are created by invite_company_member().
grant select, delete on public.company_members to authenticated;
grant update (member_role, status) on public.company_members to authenticated;

create policy "Members see their company's roster" on public.company_members for select to authenticated
  using ((select auth.uid()) = user_id or public.is_company_member(company_id) or (select public.is_admin()));
create policy "Invitees accept and managers change roles" on public.company_members for update to authenticated
  using ((select auth.uid()) = user_id or public.is_company_manager(company_id))
  with check ((select auth.uid()) = user_id or public.is_company_manager(company_id));
create policy "Managers remove members; members leave" on public.company_members for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_company_manager(company_id));

-- Published films: public read when active; writes only through moderation.
grant select on public.published_films to anon, authenticated;
create policy "Anyone reads active published films" on public.published_films for select to anon, authenticated
  using (is_active or (select public.is_admin()));

-- Submissions
grant select, delete on public.film_submissions to authenticated;
grant insert (company_id, title, original_title, synopsis, release_year, runtime_minutes, genres, language, country, director,
  producers, cast_names, trailer_url, poster_url, website_url, viewing_links, rights_confirmed, rights_statement, notes_for_admins, status)
  on public.film_submissions to authenticated;
grant update (company_id, title, original_title, synopsis, release_year, runtime_minutes, genres, language, country, director,
  producers, cast_names, trailer_url, poster_url, website_url, viewing_links, rights_confirmed, rights_statement, notes_for_admins, status)
  on public.film_submissions to authenticated;

create policy "Submitters and admins read submissions" on public.film_submissions for select to authenticated
  using ((select auth.uid()) = submitter_id or (select public.is_admin()));
create policy "Approved members create submissions" on public.film_submissions for insert to authenticated
  with check ((select auth.uid()) = submitter_id and (select public.is_industry_member()));
create policy "Submitters edit their submissions" on public.film_submissions for update to authenticated
  using ((select auth.uid()) = submitter_id and (select public.is_industry_member()))
  with check ((select auth.uid()) = submitter_id);
create policy "Submitters delete drafts" on public.film_submissions for delete to authenticated
  using ((select auth.uid()) = submitter_id and status = 'draft');

-- Submission history: read-only for the submitter and admins.
grant select on public.submission_events to authenticated;
create policy "Submitters and admins read history" on public.submission_events for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.film_submissions s where s.id = submission_id and s.submitter_id = (select auth.uid()))
  );

-- Promotions
grant select on public.promotion_requests to authenticated;
grant insert (film_id, placement, genre, starts_on, ends_on, message) on public.promotion_requests to authenticated;
grant update (status) on public.promotion_requests to authenticated;

create policy "Requesters and admins read promotions" on public.promotion_requests for select to authenticated
  using ((select auth.uid()) = requester_id or (select public.is_admin()));
create policy "Members request promotion for their own approved films" on public.promotion_requests for insert to authenticated
  with check ((select auth.uid()) = requester_id and (select public.is_industry_member()) and public.can_promote_film(film_id));
create policy "Requesters cancel their requests" on public.promotion_requests for update to authenticated
  using ((select auth.uid()) = requester_id) with check ((select auth.uid()) = requester_id);

-- Moderation notes: administrators only.
grant select, insert (subject_type, subject_id, note) on public.moderation_notes to authenticated;
create policy "Admins read notes" on public.moderation_notes for select to authenticated using ((select public.is_admin()));
create policy "Admins write notes" on public.moderation_notes for insert to authenticated
  with check ((select public.is_admin()) and author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Owner actions that need to look across rows
-- ---------------------------------------------------------------------------

-- Invites a filmmaker with a public profile to a company, by profile slug, so
-- no email address is ever needed or revealed.
create or replace function public.invite_company_member(p_company_id uuid, p_filmmaker_slug text, p_member_role text default 'member')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitee uuid;
  company_name text;
  new_id uuid;
begin
  if not public.is_industry_member() or not public.is_company_manager(p_company_id) then
    raise exception 'Only company managers can invite members' using errcode = '42501';
  end if;
  if p_member_role not in ('manager', 'member') then
    raise exception 'Invite as a manager or member' using errcode = '22023';
  end if;
  select fp.user_id into invitee from public.filmmaker_profiles fp
  where fp.slug = p_filmmaker_slug and fp.visibility = 'public' and public.is_public_industry_user(fp.user_id);
  if invitee is null then
    raise exception 'No public filmmaker profile with that address' using errcode = 'P0002';
  end if;
  insert into public.company_members (company_id, user_id, member_role, status, invited_by)
  values (p_company_id, invitee, p_member_role, 'invited', (select auth.uid()))
  returning id into new_id;
  select c.name into company_name from public.production_companies c where c.id = p_company_id;
  perform public.notify(invitee, 'company_invite', 'Company invitation',
    format('You''ve been invited to join %s on NaijaScreen.', company_name), '/filmmaker/company');
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Moderation functions (administrators only)
-- ---------------------------------------------------------------------------

create or replace function public.begin_moderation()
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  perform set_config('naijascreen.moderating', 'yes', true);
end;
$$;

create or replace function public.moderate_application(p_id uuid, p_decision text, p_feedback text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  app public.industry_applications;
begin
  perform public.begin_moderation();
  select * into app from public.industry_applications where id = p_id for update;
  if not found then raise exception 'Application not found' using errcode = 'P0002'; end if;
  if app.user_id = (select auth.uid()) then raise exception 'You cannot review your own application' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'rejected', 'changes_requested') then raise exception 'Unknown decision' using errcode = '22023'; end if;
  if app.status <> 'pending_review' then raise exception 'Only applications awaiting review can be decided' using errcode = '22023'; end if;
  if p_decision <> 'approved' and coalesce(btrim(p_feedback), '') = '' then
    raise exception 'Give the applicant a reason' using errcode = '22023';
  end if;

  update public.industry_applications
  set status = p_decision, reviewer_feedback = nullif(btrim(p_feedback), ''), reviewed_at = now(), reviewed_by = (select auth.uid())
  where id = p_id;

  if p_decision = 'approved' then
    -- Never downgrades an admin.
    update public.profiles set role = app.account_type where id = app.user_id and role in ('viewer', 'filmmaker', 'company');
  end if;

  perform public.notify(app.user_id,
    case p_decision when 'approved' then 'application_approved' when 'rejected' then 'application_rejected' else 'application_changes_requested' end,
    case p_decision when 'approved' then 'Your filmmaker access is approved' when 'rejected' then 'Your application was not approved' else 'Changes requested on your application' end,
    coalesce(nullif(btrim(p_feedback), ''), 'You can now set up your filmmaker profile.'),
    case p_decision when 'approved' then '/filmmaker' else '/filmmaker/onboarding' end);
end;
$$;

create or replace function public.moderate_profile_verification(p_profile_id uuid, p_decision text, p_feedback text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile public.filmmaker_profiles;
begin
  perform public.begin_moderation();
  select * into profile from public.filmmaker_profiles where id = p_profile_id for update;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
  if profile.user_id = (select auth.uid()) then raise exception 'You cannot verify your own profile' using errcode = '42501'; end if;
  if p_decision not in ('verified', 'rejected', 'unverified') then raise exception 'Unknown decision' using errcode = '22023'; end if;

  update public.filmmaker_profiles
  set verification_status = p_decision,
      verification_feedback = nullif(btrim(p_feedback), ''),
      verified_at = case when p_decision = 'verified' then now() else null end
  where id = p_profile_id;

  if p_decision in ('verified', 'rejected') then
    perform public.notify(profile.user_id,
      case when p_decision = 'verified' then 'profile_verified' else 'profile_verification_rejected' end,
      case when p_decision = 'verified' then 'Your profile is verified' else 'Profile verification not approved' end,
      nullif(btrim(p_feedback), ''), '/filmmaker/profile');
  end if;
end;
$$;

create or replace function public.moderate_company(p_id uuid, p_decision text, p_feedback text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  company public.production_companies;
begin
  perform public.begin_moderation();
  select * into company from public.production_companies where id = p_id for update;
  if not found then raise exception 'Company not found' using errcode = 'P0002'; end if;
  if company.owner_id = (select auth.uid()) or public.is_company_member(p_id) then
    raise exception 'You cannot review a company you belong to' using errcode = '42501';
  end if;

  if p_decision in ('approved', 'rejected', 'changes_requested') then
    if company.review_status <> 'pending_review' then raise exception 'Only companies awaiting review can be decided' using errcode = '22023'; end if;
    if p_decision <> 'approved' and coalesce(btrim(p_feedback), '') = '' then raise exception 'Give the company a reason' using errcode = '22023'; end if;
    update public.production_companies
    set review_status = p_decision, reviewer_feedback = nullif(btrim(p_feedback), ''), reviewed_at = now(), reviewed_by = (select auth.uid())
    where id = p_id;
    perform public.notify(company.owner_id,
      case p_decision when 'approved' then 'company_approved' when 'rejected' then 'company_rejected' else 'company_changes_requested' end,
      case p_decision when 'approved' then format('%s is approved', company.name) when 'rejected' then format('%s was not approved', company.name) else format('Changes requested for %s', company.name) end,
      nullif(btrim(p_feedback), ''), '/filmmaker/company');
  elsif p_decision in ('verified', 'unverified') or (p_decision = 'verification_rejected') then
    if company.review_status <> 'approved' then raise exception 'Approve the company before verifying it' using errcode = '22023'; end if;
    update public.production_companies
    set verification_status = case p_decision when 'verification_rejected' then 'rejected' else p_decision end
    where id = p_id;
  else
    raise exception 'Unknown decision' using errcode = '22023';
  end if;
end;
$$;

-- Moves a submission through review. Approving copies it into published_films
-- under the given slug (the app checks the slug isn't a catalogue film first).
create or replace function public.moderate_submission(p_id uuid, p_decision text, p_feedback text default null, p_slug text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub public.film_submissions;
  film_id text;
begin
  perform public.begin_moderation();
  select * into sub from public.film_submissions where id = p_id for update;
  if not found then raise exception 'Submission not found' using errcode = 'P0002'; end if;
  if sub.submitter_id = (select auth.uid()) or (sub.company_id is not null and public.is_company_member(sub.company_id)) then
    raise exception 'You cannot review your own submission' using errcode = '42501';
  end if;

  if p_decision = 'under_review' then
    if sub.status <> 'pending_review' then raise exception 'Only pending submissions can be taken for review' using errcode = '22023'; end if;
  elsif p_decision in ('approved', 'rejected', 'changes_requested') then
    if sub.status not in ('pending_review', 'under_review') then raise exception 'This submission is not awaiting a decision' using errcode = '22023'; end if;
    if p_decision <> 'approved' and coalesce(btrim(p_feedback), '') = '' then raise exception 'Give the submitter a reason' using errcode = '22023'; end if;
  else
    raise exception 'Unknown decision' using errcode = '22023';
  end if;

  if p_decision = 'approved' then
    if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) > 60 then
      raise exception 'Choose a valid catalogue address for the film' using errcode = '22023';
    end if;
    film_id := 'film-' || p_slug;
    insert into public.published_films (id, slug, submission_id, title, original_title, synopsis, release_year, runtime_minutes,
      genres, language, country, director, producers, cast_names, trailer_url, poster_url, website_url, company_id)
    values (film_id, p_slug, sub.id, sub.title, sub.original_title, sub.synopsis, sub.release_year, sub.runtime_minutes,
      sub.genres, sub.language, sub.country, sub.director, sub.producers, sub.cast_names, sub.trailer_url, sub.poster_url,
      sub.website_url, sub.company_id);
  end if;

  update public.film_submissions
  set status = p_decision,
      reviewer_feedback = case when p_decision = 'under_review' then reviewer_feedback else nullif(btrim(p_feedback), '') end,
      reviewed_at = now(), reviewed_by = (select auth.uid()),
      published_film_id = coalesce(film_id, published_film_id)
  where id = p_id;

  perform public.notify(sub.submitter_id,
    'submission_' || p_decision,
    case p_decision
      when 'under_review' then format('"%s" is under review', sub.title)
      when 'approved' then format('"%s" is approved and listed', sub.title)
      when 'rejected' then format('"%s" was not approved', sub.title)
      else format('Changes requested for "%s"', sub.title)
    end,
    nullif(btrim(p_feedback), ''),
    '/filmmaker/submissions/' || sub.id);
  return film_id;
end;
$$;

create or replace function public.set_published_film_active(p_film_id text, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.begin_moderation();
  update public.published_films set is_active = p_active where id = p_film_id;
  if not found then raise exception 'Film not found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.moderate_promotion(p_id uuid, p_decision text, p_feedback text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.promotion_requests;
begin
  perform public.begin_moderation();
  select * into req from public.promotion_requests where id = p_id for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if req.requester_id = (select auth.uid()) then raise exception 'You cannot review your own request' using errcode = '42501'; end if;
  if p_decision in ('approved', 'rejected') and req.status <> 'pending' then
    raise exception 'Only pending requests can be decided' using errcode = '22023';
  elsif p_decision = 'expired' and req.status <> 'approved' then
    raise exception 'Only approved placements can be expired' using errcode = '22023';
  elsif p_decision not in ('approved', 'rejected', 'expired') then
    raise exception 'Unknown decision' using errcode = '22023';
  end if;

  update public.promotion_requests
  set status = p_decision, reviewer_feedback = nullif(btrim(p_feedback), ''), reviewed_at = now(), reviewed_by = (select auth.uid())
  where id = p_id;

  perform public.notify(req.requester_id, 'promotion_updated',
    case p_decision when 'approved' then 'Promotion approved' when 'rejected' then 'Promotion not approved' else 'Promotion ended' end,
    nullif(btrim(p_feedback), ''), '/filmmaker/promotions');
end;
$$;

-- Suspends or restores a non-admin account. Suspended members lose industry
-- access and their public profiles and companies are hidden.
create or replace function public.set_account_suspension(p_user_id uuid, p_suspend boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.begin_moderation();
  if p_user_id = (select auth.uid()) then raise exception 'You cannot suspend yourself' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then
    raise exception 'Administrators can only be changed in the SQL editor' using errcode = '42501';
  end if;
  if p_suspend and coalesce(btrim(p_reason), '') = '' then raise exception 'Give a reason' using errcode = '22023'; end if;
  update public.profiles
  set suspended_at = case when p_suspend then now() else null end,
      suspension_reason = case when p_suspend then btrim(p_reason) else null end
  where id = p_user_id;
  if not found then raise exception 'Account not found' using errcode = 'P0002'; end if;
  perform public.notify(p_user_id,
    case when p_suspend then 'account_suspended' else 'account_restored' end,
    case when p_suspend then 'Your industry access is suspended' else 'Your industry access is restored' end,
    case when p_suspend then btrim(p_reason) end, '/filmmaker');
end;
$$;

-- Admin list of industry accounts (no emails).
create or replace function public.admin_list_industry_accounts()
returns table (user_id uuid, display_name text, role text, suspended_at timestamptz, suspension_reason text, profile_slug text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  return query
    select p.id, p.display_name, p.role, p.suspended_at, p.suspension_reason, fp.slug
    from public.profiles p
    left join public.filmmaker_profiles fp on fp.user_id = p.id
    where p.role in ('filmmaker', 'company') or p.suspended_at is not null
       or exists (select 1 from public.industry_applications a where a.user_id = p.id)
    order by p.display_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public directory (safe columns of approved, visible records only)
-- ---------------------------------------------------------------------------

create or replace function public.get_public_filmmakers(
  p_role text default null, p_country text default null, p_city text default null,
  p_language text default null, p_company_slug text default null, p_slug text default null)
returns table (
  slug text, professional_name text, professional_role text, expertise text[], biography text, avatar_url text,
  city text, country text, languages text[], website_url text, portfolio_links text[], social_links text[],
  filmography jsonb, verified boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select fp.slug, fp.professional_name, fp.professional_role, fp.expertise, fp.biography, fp.avatar_url,
    fp.city, fp.country, fp.languages, fp.website_url, fp.portfolio_links, fp.social_links, fp.filmography,
    fp.verification_status = 'verified'
  from public.filmmaker_profiles fp
  where fp.visibility = 'public'
    and public.is_public_industry_user(fp.user_id)
    and (p_slug is null or fp.slug = p_slug)
    and (p_role is null or fp.professional_role = p_role)
    and (p_country is null or fp.country = p_country)
    and (p_city is null or lower(fp.city) = lower(p_city))
    and (p_language is null or p_language = any (fp.languages))
    and (p_company_slug is null or exists (
      select 1 from public.company_members m join public.production_companies c on c.id = m.company_id
      where m.user_id = fp.user_id and m.status = 'active' and c.slug = p_company_slug
        and c.review_status = 'approved' and c.visibility = 'public'))
  order by (fp.verification_status = 'verified') desc, fp.professional_name
  limit 200;
$$;

create or replace function public.get_public_companies(p_country text default null, p_city text default null, p_slug text default null)
returns table (
  id uuid, slug text, name text, logo_url text, description text, country text, city text, website_url text,
  public_email text, public_phone text, social_links text[], verified boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.slug, c.name, c.logo_url, c.description, c.country, c.city, c.website_url, c.public_email, c.public_phone,
    c.social_links, c.verification_status = 'verified'
  from public.production_companies c
  where c.review_status = 'approved' and c.visibility = 'public'
    and public.is_public_industry_user(c.owner_id)
    and (p_slug is null or c.slug = p_slug)
    and (p_country is null or c.country = p_country)
    and (p_city is null or lower(c.city) = lower(p_city))
  order by (c.verification_status = 'verified') desc, c.name
  limit 200;
$$;

-- Public filmmakers who are active members of a public company.
create or replace function public.get_public_company_members(p_company_slug text)
returns table (slug text, professional_name text, professional_role text, member_role text)
language sql
stable
security definer
set search_path = ''
as $$
  select fp.slug, fp.professional_name, fp.professional_role, m.member_role
  from public.production_companies c
  join public.company_members m on m.company_id = c.id and m.status = 'active'
  join public.filmmaker_profiles fp on fp.user_id = m.user_id and fp.visibility = 'public'
  where c.slug = p_company_slug and c.review_status = 'approved' and c.visibility = 'public'
    and public.is_public_industry_user(m.user_id)
  order by (m.member_role = 'owner') desc, fp.professional_name;
$$;

-- Public companies a filmmaker belongs to.
create or replace function public.get_public_filmmaker_companies(p_filmmaker_slug text)
returns table (slug text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.slug, c.name
  from public.filmmaker_profiles fp
  join public.company_members m on m.user_id = fp.user_id and m.status = 'active'
  join public.production_companies c on c.id = m.company_id
  where fp.slug = p_filmmaker_slug and fp.visibility = 'public' and public.is_public_industry_user(fp.user_id)
    and c.review_status = 'approved' and c.visibility = 'public'
  order by c.name;
$$;

-- A company's roster for its own members and invitees: names come from the
-- members' display names and public profiles, never emails.
create or replace function public.get_company_roster(p_company_id uuid)
returns table (member_id uuid, user_id uuid, member_role text, status text, display_name text, profile_slug text, profile_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_company_member(p_company_id) or public.is_invited_to_company(p_company_id) or public.is_admin()) then
    raise exception 'Not a member of this company' using errcode = '42501';
  end if;
  return query
    select m.id, m.user_id, m.member_role, m.status, p.display_name,
      case when fp.visibility = 'public' then fp.slug end,
      case when fp.visibility = 'public' then fp.professional_name end
    from public.company_members m
    join public.profiles p on p.id = m.user_id
    left join public.filmmaker_profiles fp on fp.user_id = m.user_id
    where m.company_id = p_company_id
    order by (m.member_role = 'owner') desc, m.status, p.display_name;
end;
$$;

-- Approved promotions running today. Film ids and placement only.
create or replace function public.get_active_promotions()
returns table (film_id text, placement text, genre text, starts_on date, ends_on date)
language sql
stable
security definer
set search_path = ''
as $$
  select r.film_id, r.placement, r.genre, r.starts_on, r.ends_on
  from public.promotion_requests r
  join public.published_films f on f.id = r.film_id and f.is_active
  where r.status = 'approved' and current_date between r.starts_on and r.ends_on
  order by r.starts_on, r.film_id
  limit 20;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------

-- Internal helpers: not callable through the API.
revoke all on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.begin_moderation() from public, anon, authenticated;
revoke all on function public.guard_industry_application() from public, anon, authenticated;
revoke all on function public.guard_filmmaker_profile() from public, anon, authenticated;
revoke all on function public.guard_production_company() from public, anon, authenticated;
revoke all on function public.guard_company_member() from public, anon, authenticated;
revoke all on function public.guard_film_submission() from public, anon, authenticated;
revoke all on function public.guard_promotion_request() from public, anon, authenticated;
revoke all on function public.add_company_owner() from public, anon, authenticated;
revoke all on function public.record_submission_event() from public, anon, authenticated;
revoke all on function public.notify_application_received() from public, anon, authenticated;
revoke all on function public.notify_company_received() from public, anon, authenticated;
revoke all on function public.notify_promotion_received() from public, anon, authenticated;

-- Used inside policies, so the API roles need EXECUTE; each only reveals facts about the caller.
revoke all on function public.is_industry_member() from public;
grant execute on function public.is_industry_member() to anon, authenticated;
revoke all on function public.is_public_industry_user(uuid) from public, anon, authenticated;
revoke all on function public.is_company_member(uuid) from public;
grant execute on function public.is_company_member(uuid) to authenticated;
revoke all on function public.is_company_manager(uuid) from public;
grant execute on function public.is_company_manager(uuid) to authenticated;
revoke all on function public.is_invited_to_company(uuid) from public;
grant execute on function public.is_invited_to_company(uuid) to authenticated;
revoke all on function public.can_promote_film(text) from public;
grant execute on function public.can_promote_film(text) to authenticated;
revoke all on function public.is_moderating() from public;
grant execute on function public.is_moderating() to anon, authenticated;

-- Callable actions (each checks the caller itself).
revoke all on function public.invite_company_member(uuid, text, text) from public, anon;
grant execute on function public.invite_company_member(uuid, text, text) to authenticated;
revoke all on function public.moderate_application(uuid, text, text) from public, anon;
grant execute on function public.moderate_application(uuid, text, text) to authenticated;
revoke all on function public.moderate_profile_verification(uuid, text, text) from public, anon;
grant execute on function public.moderate_profile_verification(uuid, text, text) to authenticated;
revoke all on function public.moderate_company(uuid, text, text) from public, anon;
grant execute on function public.moderate_company(uuid, text, text) to authenticated;
revoke all on function public.moderate_submission(uuid, text, text, text) from public, anon;
grant execute on function public.moderate_submission(uuid, text, text, text) to authenticated;
revoke all on function public.set_published_film_active(text, boolean) from public, anon;
grant execute on function public.set_published_film_active(text, boolean) to authenticated;
revoke all on function public.moderate_promotion(uuid, text, text) from public, anon;
grant execute on function public.moderate_promotion(uuid, text, text) to authenticated;
revoke all on function public.set_account_suspension(uuid, boolean, text) from public, anon;
grant execute on function public.set_account_suspension(uuid, boolean, text) to authenticated;
revoke all on function public.admin_list_industry_accounts() from public, anon;
grant execute on function public.admin_list_industry_accounts() to authenticated;

revoke all on function public.get_company_roster(uuid) from public, anon;
grant execute on function public.get_company_roster(uuid) to authenticated;

-- Public directory.
revoke all on function public.get_public_filmmakers(text, text, text, text, text, text) from public;
grant execute on function public.get_public_filmmakers(text, text, text, text, text, text) to anon, authenticated;
revoke all on function public.get_public_companies(text, text, text) from public;
grant execute on function public.get_public_companies(text, text, text) to anon, authenticated;
revoke all on function public.get_public_company_members(text) from public;
grant execute on function public.get_public_company_members(text) to anon, authenticated;
revoke all on function public.get_public_filmmaker_companies(text) from public;
grant execute on function public.get_public_filmmaker_companies(text) to anon, authenticated;
revoke all on function public.get_active_promotions() from public;
grant execute on function public.get_active_promotions() to anon, authenticated;
