-- NaijaScreen — pre-launch security hardening.
--
-- Apply after the Stage 4–7 migrations, once. Fixes issues found in the
-- pre-launch audit without loosening any existing policy:
--  1. Verified profiles lose verification when their identity changes.
--  2. Company content can't change during review, and edits to an approved
--     company send it back for review (and drop verification).
--  3. Invitations need an approved company and are rate limited.
--  4. Caps on companies, open submissions and duplicate pending promotions.
--  5. Company public emails can't carry mailto parameters.
--  6. Deleting an auth user who owns a company no longer fails.
--  7. Suspended members can't manage company rosters or accept invites.
--  8. Moderators can't act on promotions or listings for their own films or
--     their companies' films.
--  9. created_by (an admin's user id) is no longer readable by API roles on
--     viewing options and trailers; the roster no longer returns user ids.
-- 10. Changing a verified viewing option's link, provider, access type or
--     countries returns it to pending in the database, not only in the app.
-- 11. A public lookup of a film's company by film id.

-- ---------------------------------------------------------------------------
-- 1. Filmmaker profiles: identity changes reset verification
-- ---------------------------------------------------------------------------

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
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status then
    if not (new.verification_status = 'pending' and old.verification_status in ('unverified', 'rejected')) then
      raise exception 'Only a moderator can change verification' using errcode = '42501';
    end if;
  end if;

  -- A verified badge belongs to the identity that was checked. Changing who
  -- the profile says it is, or where it points, needs a fresh check.
  if old.verification_status in ('verified', 'pending') and (
    new.slug is distinct from old.slug
    or new.professional_name is distinct from old.professional_name
    or new.professional_role is distinct from old.professional_role
    or new.website_url is distinct from old.website_url
    or new.avatar_url is distinct from old.avatar_url
    or new.portfolio_links is distinct from old.portfolio_links
    or new.social_links is distinct from old.social_links
  ) then
    new.verification_status := 'unverified';
    new.verified_at := null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Companies: locked during review, re-reviewed after approved edits
-- ---------------------------------------------------------------------------

create or replace function public.guard_production_company()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  content_changed boolean;
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
    if new.review_status = 'pending_review' then new.submitted_at := now(); end if;
    return new;
  end if;

  content_changed :=
    new.name is distinct from old.name
    or new.logo_url is distinct from old.logo_url
    or new.description is distinct from old.description
    or new.country is distinct from old.country
    or new.city is distinct from old.city
    or new.website_url is distinct from old.website_url
    or new.public_email is distinct from old.public_email
    or new.public_phone is distinct from old.public_phone
    or new.social_links is distinct from old.social_links;

  -- Moderators must approve exactly what they reviewed.
  if old.review_status = 'pending_review' and content_changed then
    raise exception 'This company is being reviewed and can''t be edited until a moderator decides' using errcode = '42501';
  end if;

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

  -- Edits to an approved company go back to the moderators and drop verification.
  if old.review_status in ('approved', 'rejected') and content_changed then
    if old.review_status = 'rejected' then
      raise exception 'Rejected companies can''t be edited' using errcode = '42501';
    end if;
    new.review_status := 'pending_review';
    new.verification_status := 'unverified';
    new.reviewer_feedback := null;
  end if;

  if new.review_status = 'pending_review' and old.review_status <> 'pending_review' then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Invitations: approved companies only, rate limited
-- ---------------------------------------------------------------------------

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
  select c.name into company_name from public.production_companies c where c.id = p_company_id and c.review_status = 'approved';
  if company_name is null then
    raise exception 'Invitations open once a moderator has approved the company' using errcode = '22023';
  end if;
  if (select count(*) from public.company_members m where m.company_id = p_company_id and m.status = 'invited') >= 10 then
    raise exception 'This company already has 10 open invitations' using errcode = '22023';
  end if;
  select fp.user_id into invitee from public.filmmaker_profiles fp
  where fp.slug = p_filmmaker_slug and fp.visibility = 'public' and public.is_public_industry_user(fp.user_id);
  if invitee is null then
    raise exception 'No public filmmaker profile with that address' using errcode = 'P0002';
  end if;
  -- No one receives more than three invitations a day, from any company.
  if (select count(*) from public.notifications n
      where n.user_id = invitee and n.kind = 'company_invite' and n.created_at > now() - interval '1 day') >= 3 then
    raise exception 'This person has had several invitations today. Try again tomorrow.' using errcode = '22023';
  end if;

  insert into public.company_members (company_id, user_id, member_role, status, invited_by)
  values (p_company_id, invitee, p_member_role, 'invited', (select auth.uid()))
  returning id into new_id;
  perform public.notify(invitee, 'company_invite', 'Company invitation',
    format('You''ve been invited to join the production company "%s" on NaijaScreen. Review it in your filmmaker portal.', company_name),
    '/filmmaker/company');
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Abuse caps
-- ---------------------------------------------------------------------------

create or replace function public.enforce_industry_caps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'production_companies' then
    if (select count(*) from public.production_companies c where c.owner_id = new.owner_id) >= 5 then
      raise exception 'You can own at most 5 companies' using errcode = '22023';
    end if;
  elsif tg_table_name = 'film_submissions' then
    if (select count(*) from public.film_submissions s
        where s.submitter_id = new.submitter_id and s.status in ('draft', 'pending_review', 'under_review', 'changes_requested')) >= 20 then
      raise exception 'You have 20 open submissions. Finish or delete some first.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger production_companies_caps before insert on public.production_companies
  for each row execute function public.enforce_industry_caps();
create trigger film_submissions_caps before insert on public.film_submissions
  for each row execute function public.enforce_industry_caps();

-- One pending request per film and placement.
create unique index promotion_requests_one_pending on public.promotion_requests (film_id, placement) where status = 'pending';

revoke all on function public.enforce_industry_caps() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Company public email: a plain address, no mailto parameters
-- ---------------------------------------------------------------------------

alter table public.production_companies drop constraint production_companies_public_email_check;
alter table public.production_companies add constraint production_companies_public_email_check
  check (public_email is null or (char_length(public_email) <= 254 and public_email ~ '^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$'));

-- ---------------------------------------------------------------------------
-- 6 & 7. Memberships: allow cascading deletes; suspended members can't manage
-- ---------------------------------------------------------------------------

create or replace function public.guard_company_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- pg_trigger_depth() > 1 means a cascade from deleting the company or the
    -- auth user, which must succeed (account erasure). Direct deletes of the
    -- owner row are still refused.
    if old.member_role = 'owner' and pg_trigger_depth() <= 1 then
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

drop policy "Invitees accept and managers change roles" on public.company_members;
drop policy "Managers remove members; members leave" on public.company_members;

create policy "Invitees accept and managers change roles" on public.company_members for update to authenticated
  using (
    (select public.is_industry_member())
    and ((select auth.uid()) = user_id or public.is_company_manager(company_id))
  )
  with check ((select auth.uid()) = user_id or public.is_company_manager(company_id));

-- Anyone may leave (or decline); only active, unsuspended managers remove others.
create policy "Managers remove members; members leave" on public.company_members for delete to authenticated
  using ((select auth.uid()) = user_id or ((select public.is_industry_member()) and public.is_company_manager(company_id)));

-- Roster without raw user ids: is_self tells the caller which row is theirs.
drop function public.get_company_roster(uuid);
create function public.get_company_roster(p_company_id uuid)
returns table (member_id uuid, is_self boolean, member_role text, status text, display_name text, profile_slug text, profile_name text)
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
    select m.id, m.user_id = (select auth.uid()), m.member_role, m.status, p.display_name,
      case when fp.visibility = 'public' then fp.slug end,
      case when fp.visibility = 'public' then fp.professional_name end
    from public.company_members m
    join public.profiles p on p.id = m.user_id
    left join public.filmmaker_profiles fp on fp.user_id = m.user_id
    where m.company_id = p_company_id
    order by (m.member_role = 'owner') desc, m.status, p.display_name;
end;
$$;
revoke all on function public.get_company_roster(uuid) from public, anon;
grant execute on function public.get_company_roster(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. No moderating your own (or your company's) promotions and listings
-- ---------------------------------------------------------------------------

-- True when the caller submitted the published film or belongs to its company.
create or replace function public.is_own_published_film(p_film_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.published_films f
    left join public.film_submissions s on s.id = f.submission_id
    where f.id = p_film_id
      and (s.submitter_id = (select auth.uid()) or (f.company_id is not null and public.is_company_member(f.company_id)))
  );
$$;
revoke all on function public.is_own_published_film(text) from public, anon, authenticated;

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
  if req.requester_id = (select auth.uid()) or public.is_own_published_film(req.film_id) then
    raise exception 'You cannot review a promotion for your own film' using errcode = '42501';
  end if;
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

create or replace function public.set_published_film_active(p_film_id text, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.begin_moderation();
  if public.is_own_published_film(p_film_id) then
    raise exception 'You cannot moderate a listing for your own film' using errcode = '42501';
  end if;
  update public.published_films set is_active = p_active where id = p_film_id;
  if not found then raise exception 'Film not found' using errcode = 'P0002'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Don't expose created_by on public viewing data
-- ---------------------------------------------------------------------------

revoke select on public.film_viewing_options, public.film_trailers from anon, authenticated;
grant select (id, film_id, provider_id, destination_url, access_type, countries, audio_languages, subtitle_languages,
  availability_notes, verification_status, verified_at, last_checked_at, is_active, created_at, updated_at)
  on public.film_viewing_options to anon, authenticated;
grant select (id, film_id, title, video_provider, video_id, video_url, embeddable, thumbnail_url, published_on,
  verification_status, verified_at, last_checked_at, is_active, created_at, updated_at)
  on public.film_trailers to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. Re-verify viewing options when what was verified changes
-- ---------------------------------------------------------------------------

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
  -- A verified link that now points somewhere else hasn't been verified.
  if tg_table_name = 'film_viewing_options'
     and old.verification_status = 'verified'
     and new.verification_status = 'verified'
     and (new.destination_url is distinct from old.destination_url
          or new.provider_id is distinct from old.provider_id
          or new.access_type is distinct from old.access_type
          or new.countries is distinct from old.countries) then
    new.verification_status = 'pending';
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

-- ---------------------------------------------------------------------------
-- 11. A published film's company, for its public page
-- ---------------------------------------------------------------------------

create or replace function public.get_public_company_for_film(p_film_id text)
returns table (slug text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.slug, c.name
  from public.published_films f
  join public.production_companies c on c.id = f.company_id
  where f.id = p_film_id and f.is_active
    and c.review_status = 'approved' and c.visibility = 'public' and public.is_public_industry_user(c.owner_id);
$$;
revoke all on function public.get_public_company_for_film(text) from public;
grant execute on function public.get_public_company_for_film(text) to anon, authenticated;
