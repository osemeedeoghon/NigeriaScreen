/**
 * Stage 7 database tests: industry roles, applications, filmmaker profiles,
 * companies, film submissions, promotions, notifications and moderation.
 * Runs the real Stage 4–7 migrations in PGlite as separate users. This is a
 * simulation of Supabase (see the README), not a test of a live project.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDatabase } from "./harness.ts";

const id = (n: number) => `00000000-0000-4000-8000-0000000007${String(n).padStart(2, "0")}`;
const VIEWER = id(1);
const FILMMAKER = id(2);
const OTHER = id(3); // a second approved filmmaker
const ADMIN = id(4);
const ADMIN2 = id(5);
const LATER = id(6); // applies during the tests

let ctx: Awaited<ReturnType<typeof createTestDatabase>>;

const one = async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => (await ctx.db.query<T>(sql, params)).rows[0];
const COMPLETE_SUBMISSION = `(title, synopsis, release_year, runtime_minutes, genres, language, country, director, rights_confirmed, status)
  values ('A New Film', 'A synopsis that is long enough to submit.', 2026, 95, '{drama}', 'yo', 'NG', 'Ada Obi', true, 'pending_review')`;

async function apply(user: string, status = "pending_review", accountType = "filmmaker") {
  const [row] = await ctx.commitAs<{ id: string }>(
    user,
    `insert into public.industry_applications (account_type, professional_name, professional_role, company_name, biography, country, status)
     values ($1, 'Applicant ' || $2, 'director', case when $1 = 'company' then 'Applicant Films' end, 'I direct feature films in Lagos.', 'NG', $3) returning id`,
    [accountType, user.slice(-2), status],
  );
  return row.id;
}

async function approve(user: string) {
  const appId = await apply(user);
  await ctx.commitAs(ADMIN, "select public.moderate_application($1, 'approved', null)", [appId]);
}

async function makeProfile(user: string, slug: string, visibility = "public") {
  await ctx.commitAs(user, "insert into public.filmmaker_profiles (slug, professional_name, professional_role, visibility) values ($1, $2, 'actor', $3)", [
    slug,
    slug.replace("-", " "),
    visibility,
  ]);
}

before(async () => {
  // The final schema, including the Stage 8 hardening, so these also guard against regressions.
  ctx = await createTestDatabase(["stage4", "stage5", "stage6", "stage7", "stage8"]);
  for (const user of [VIEWER, FILMMAKER, OTHER, ADMIN, ADMIN2, LATER]) {
    await ctx.db.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2)", [user, JSON.stringify({ display_name: `User ${user.slice(-2)}` })]);
  }
  // Admins are granted by hand, as in the SQL editor.
  await ctx.db.query("update public.profiles set role = 'admin' where id = any($1)", [[ADMIN, ADMIN2]]);
  await approve(FILMMAKER);
  await approve(OTHER);
  await makeProfile(FILMMAKER, "ada-obi");
  await makeProfile(OTHER, "bayo-ade");
});

after(async () => {
  await ctx?.db.close();
});

describe("schema safety", () => {
  test("RLS is on for every public table", async () => {
    const { rows } = await ctx.db.query<{ tablename: string; rowsecurity: boolean }>(
      "select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename",
    );
    assert.deepEqual(
      rows.map((r) => r.tablename),
      [
        "company_members", "film_submissions", "film_trailers", "film_viewing_options", "filmmaker_profiles", "industry_applications",
        "moderation_notes", "notifications", "production_companies", "profiles", "promotion_requests", "published_films",
        "recommendation_feedback", "reviews", "submission_events", "viewing_providers", "watched_films", "watchlist",
      ],
    );
    for (const row of rows) assert.equal(row.rowsecurity, true, row.tablename);
  });

  test("every security definer function pins its search_path", async () => {
    const { rows } = await ctx.db.query<{ proname: string; proconfig: string[] | null }>(
      "select proname, proconfig from pg_proc where pronamespace = 'public'::regnamespace and prosecdef",
    );
    assert.ok(rows.length >= 20);
    for (const row of rows) assert.ok(row.proconfig?.includes('search_path=""'), row.proname);
  });

  test("internal helpers can't be called through the API", async () => {
    await ctx.rejects(FILMMAKER, `select public.notify('${FILMMAKER}', 'application_approved', 'x', null, null)`, "42501");
    await ctx.rejects(ADMIN, "select public.begin_moderation()", "42501");
    await ctx.rejects("anon", "select public.moderate_application(gen_random_uuid(), 'approved', null)", "42501");
  });
});

describe("roles", () => {
  test("approval grants the filmmaker role; nobody can change their own role", async () => {
    assert.equal((await one<{ role: string }>("select role from public.profiles where id = $1", [FILMMAKER])).role, "filmmaker");
    assert.equal((await one<{ role: string }>("select role from public.profiles where id = $1", [VIEWER])).role, "viewer");
    for (const role of ["filmmaker", "admin"]) {
      await ctx.rejects(VIEWER, `update public.profiles set role = '${role}' where id = auth.uid()`, "42501");
      await ctx.rejects(FILMMAKER, `update public.profiles set role = '${role}' where id = auth.uid()`, "42501");
    }
    await ctx.rejects(FILMMAKER, "update public.profiles set suspended_at = null where id = auth.uid()", "42501");
  });

  test("is_industry_member() reflects approval", async () => {
    const check = async (who: string) => (await ctx.as(who, (sql) => sql("select public.is_industry_member() as ok")))[0].ok;
    assert.equal(await check(VIEWER), false);
    assert.equal(await check(FILMMAKER), true);
    assert.equal(await check(ADMIN), true);
    assert.equal(await check("anon"), false);
  });
});

describe("filmmaker onboarding", () => {
  test("a viewer saves a draft, edits it and submits; then it's locked", async () => {
    const [{ id: appId }] = await ctx.commitAs<{ id: string }>(
      LATER,
      "insert into public.industry_applications (professional_name, professional_role) values ('Later Person', 'editor') returning id",
    );
    await ctx.commitAs(LATER, "update public.industry_applications set biography = 'I edit Nollywood features.', country = 'NG' where id = $1", [appId]);
    // Submitting a draft that isn't complete is refused by the check constraint.
    await ctx.rejects(LATER, "update public.industry_applications set biography = 'short', status = 'pending_review'", "23514");
    await ctx.commitAs(LATER, "update public.industry_applications set status = 'pending_review' where id = $1", [appId]);
    const row = await one<{ status: string; submitted_at: Date | null }>("select status, submitted_at from public.industry_applications where id = $1", [appId]);
    assert.equal(row.status, "pending_review");
    assert.ok(row.submitted_at instanceof Date);
    await ctx.rejects(LATER, "update public.industry_applications set biography = 'Edited after submitting.'", "42501");
    await ctx.rejects(LATER, "update public.industry_applications set status = 'draft'", "42501");
  });

  test("applicants can't approve themselves or write reviewer fields", async () => {
    await ctx.rejects(VIEWER, "insert into public.industry_applications (professional_name, professional_role, status) values ('Me', 'actor', 'approved')", "42501");
    await ctx.rejects(VIEWER, "insert into public.industry_applications (professional_name, professional_role, reviewer_feedback) values ('Me', 'actor', 'great')", "42501");
    await ctx.commitAs(VIEWER, "insert into public.industry_applications (professional_name, professional_role) values ('Viewer Person', 'actor')");
    await ctx.rejects(VIEWER, "update public.industry_applications set status = 'approved'", "42501");
    await ctx.rejects(VIEWER, `update public.industry_applications set reviewed_by = '${VIEWER}'`, "42501");
    await ctx.rejects(VIEWER, "select public.moderate_application(id, 'approved', null) from public.industry_applications", "42501");
  });

  test("applications are private to the applicant and admins", async () => {
    assert.equal((await ctx.as(OTHER, (sql) => sql("select * from public.industry_applications where user_id = $1", [LATER]))).length, 0);
    assert.equal((await ctx.as(ADMIN, (sql) => sql("select * from public.industry_applications where user_id = $1", [LATER]))).length, 1);
    await ctx.rejects("anon", "select * from public.industry_applications", "42501");
  });

  test("changes requested → applicant edits and resubmits → approved, with notifications", async () => {
    const { id: appId } = await one<{ id: string }>("select id from public.industry_applications where user_id = $1", [LATER]);
    await assert.rejects(ctx.commitAs(ADMIN, "select public.moderate_application($1, 'changes_requested', '')", [appId]), { code: "22023" });
    await ctx.commitAs(ADMIN, "select public.moderate_application($1, 'changes_requested', 'Add a portfolio link.')", [appId]);
    await ctx.commitAs(LATER, "update public.industry_applications set portfolio_links = '{https://later.example/reel}', status = 'pending_review' where id = $1", [appId]);
    await ctx.commitAs(ADMIN2, "select public.moderate_application($1, 'approved', null)", [appId]);
    assert.equal((await one<{ role: string }>("select role from public.profiles where id = $1", [LATER])).role, "filmmaker");
    const kinds = (await ctx.as(LATER, (sql) => sql("select kind from public.notifications order by created_at"))).map((r) => r.kind);
    assert.deepEqual(kinds, ["application_received", "application_changes_requested", "application_received", "application_approved"]);
  });

  test("an admin can't review their own application, and decided applications can't be re-decided", async () => {
    const own = await apply(ADMIN);
    await assert.rejects(ctx.commitAs(ADMIN, "select public.moderate_application($1, 'approved', null)", [own]), { code: "42501" });
    await ctx.commitAs(ADMIN2, "select public.moderate_application($1, 'approved', null)", [own]);
    assert.equal((await one<{ role: string }>("select role from public.profiles where id = $1", [ADMIN])).role, "admin", "approval never downgrades an admin");
    await assert.rejects(ctx.commitAs(ADMIN2, "select public.moderate_application($1, 'rejected', 'no')", [own]), { code: "22023" });
  });
});

describe("filmmaker profiles", () => {
  test("only approved members can create a profile", async () => {
    await ctx.rejects(VIEWER, "insert into public.filmmaker_profiles (slug, professional_name, professional_role) values ('viewer-x', 'Viewer X', 'actor')", "42501");
  });

  test("owners edit their own profile only", async () => {
    const changed = await ctx.as(FILMMAKER, (sql) => sql("update public.filmmaker_profiles set biography = 'Hello' where user_id = auth.uid() returning id"));
    assert.equal(changed.length, 1);
    const other = await ctx.as(FILMMAKER, (sql) => sql("update public.filmmaker_profiles set biography = 'Hacked' where slug = 'bayo-ade' returning id"));
    assert.equal(other.length, 0);
    assert.equal((await ctx.as(FILMMAKER, (sql) => sql("select * from public.filmmaker_profiles where slug = 'bayo-ade'"))).length, 0);
  });

  test("owners may ask for verification but never grant it", async () => {
    await ctx.rejects(FILMMAKER, "update public.filmmaker_profiles set verification_status = 'verified' where user_id = auth.uid()", "42501");
    await ctx.rejects(FILMMAKER, "update public.filmmaker_profiles set verified_at = now() where user_id = auth.uid()", "42501");
    await ctx.commitAs(FILMMAKER, "update public.filmmaker_profiles set verification_status = 'pending' where user_id = auth.uid()");
    const { id: profileId } = await one<{ id: string }>("select id from public.filmmaker_profiles where slug = 'ada-obi'");
    await ctx.rejects(FILMMAKER, `select public.moderate_profile_verification('${profileId}', 'verified', null)`, "42501");
    await ctx.commitAs(ADMIN, "select public.moderate_profile_verification($1, 'verified', null)", [profileId]);
    const row = await one<{ verification_status: string; verified_at: Date | null }>("select verification_status, verified_at from public.filmmaker_profiles where id = $1", [profileId]);
    assert.equal(row.verification_status, "verified");
    assert.ok(row.verified_at);
  });

  test("the public directory shows only public profiles of active members, without account data", async () => {
    await makeProfile(LATER, "later-person", "private");
    const rows = await ctx.as("anon", (sql) => sql("select * from public.get_public_filmmakers()"));
    assert.deepEqual(rows.map((r) => r.slug).sort(), ["ada-obi", "bayo-ade"]);
    assert.ok(!("user_id" in rows[0]) && !("email" in rows[0]));
    assert.equal(rows.find((r) => r.slug === "ada-obi")!.verified, true);
    assert.equal((await ctx.as("anon", (sql) => sql("select * from public.get_public_filmmakers(p_role => 'director')"))).length, 0);
    await ctx.rejects("anon", "select * from public.filmmaker_profiles", "42501");
  });
});

describe("companies and membership", () => {
  let companyId: string;
  let invitationId: string;

  before(async () => {
    [{ id: companyId }] = await ctx.commitAs<{ id: string }>(
      FILMMAKER,
      "insert into public.production_companies (slug, name, description, country) values ('ada-films', 'Ada Films', 'Lagos production house making drama.', 'NG') returning id",
    );
  });

  test("the creator becomes the owner; viewers can't create companies", async () => {
    const owner = await one<{ member_role: string; status: string }>("select member_role, status from public.company_members where company_id = $1", [companyId]);
    assert.deepEqual(owner, { member_role: "owner", status: "active" });
    await ctx.rejects(VIEWER, "insert into public.production_companies (slug, name) values ('viewer-co', 'Viewer Co')", "42501");
  });

  test("drafts aren't public; owners submit, but can't approve", async () => {
    assert.equal((await ctx.as("anon", (sql) => sql("select * from public.get_public_companies()"))).length, 0);
    await ctx.rejects(FILMMAKER, `update public.production_companies set review_status = 'approved' where id = '${companyId}'`, "42501");
    await ctx.commitAs(FILMMAKER, "update public.production_companies set review_status = 'pending_review' where id = $1", [companyId]);
    await ctx.commitAs(ADMIN, "select public.moderate_company($1, 'approved', null)", [companyId]);
    const rows = await ctx.as("anon", (sql) => sql("select slug, name, public_email from public.get_public_companies()"));
    assert.deepEqual(rows, [{ slug: "ada-films", name: "Ada Films", public_email: null }]);
  });

  test("owners invite by public profile; only the invitee can accept", async () => {
    await ctx.rejects(OTHER, `select public.invite_company_member('${companyId}', 'later-person', 'member')`, "42501");
    // later-person is private, so it can't be found.
    await assert.rejects(ctx.commitAs(FILMMAKER, "select public.invite_company_member($1, 'later-person', 'member')", [companyId]), { code: "P0002" });
    await assert.rejects(ctx.commitAs(FILMMAKER, "select public.invite_company_member($1, 'bayo-ade', 'owner')", [companyId]), { code: "22023" });
    [{ invite_company_member: invitationId }] = await ctx.commitAs<{ invite_company_member: string }>(
      FILMMAKER,
      "select public.invite_company_member($1, 'bayo-ade', 'member')",
      [companyId],
    );
    await ctx.rejects(FILMMAKER, `update public.company_members set status = 'active' where id = '${invitationId}'`, "42501");
    // The invitee can see the company to decide, but isn't a member yet.
    assert.equal((await ctx.as(OTHER, (sql) => sql("select id from public.production_companies where id = $1", [companyId]))).length, 1);
    await ctx.commitAs(OTHER, "update public.company_members set status = 'active' where id = $1", [invitationId]);
    const kinds = (await ctx.as(OTHER, (sql) => sql("select kind from public.notifications"))).map((r) => r.kind);
    assert.ok(kinds.includes("company_invite"));
  });

  test("members can't edit the company, promote themselves or remove the owner", async () => {
    const edited = await ctx.as(OTHER, (sql) => sql("update public.production_companies set name = 'Hijacked' where id = $1 returning id", [companyId]));
    assert.equal(edited.length, 0);
    await ctx.rejects(OTHER, `update public.company_members set member_role = 'manager' where id = '${invitationId}'`, "42501");
    await ctx.rejects(OTHER, `update public.company_members set member_role = 'owner' where id = '${invitationId}'`, "42501");
    const removed = await ctx.as(OTHER, (sql) => sql("delete from public.company_members where company_id = $1 and member_role = 'owner' returning id", [companyId]));
    assert.equal(removed.length, 0);
    await ctx.rejects(FILMMAKER, `delete from public.company_members where company_id = '${companyId}' and member_role = 'owner'`, "42501");
  });

  test("managers can edit; outsiders can't see the roster", async () => {
    await ctx.commitAs(FILMMAKER, "update public.company_members set member_role = 'manager' where id = $1", [invitationId]);
    const edited = await ctx.as(OTHER, (sql) => sql("update public.production_companies set city = 'Lagos' where id = $1 returning id", [companyId]));
    assert.equal(edited.length, 1);
    await ctx.rejects(VIEWER, `select * from public.get_company_roster('${companyId}')`, "42501");
    const roster = await ctx.as(OTHER, (sql) => sql("select member_role, display_name from public.get_company_roster($1)", [companyId]));
    assert.equal(roster.length, 2);
    assert.ok(!("email" in roster[0]));
    const members = await ctx.as("anon", (sql) => sql("select slug, member_role from public.get_public_company_members('ada-films')"));
    assert.deepEqual(members, [
      { slug: "ada-obi", member_role: "owner" },
      { slug: "bayo-ade", member_role: "manager" },
    ]);
  });

  test("an admin who belongs to a company can't moderate it", async () => {
    const [{ id: adminCo }] = await ctx.commitAs<{ id: string }>(
      ADMIN,
      "insert into public.production_companies (slug, name, description, country, review_status) values ('admin-co', 'Admin Co', 'An admin-owned company for testing.', 'NG', 'pending_review') returning id",
    );
    await assert.rejects(ctx.commitAs(ADMIN, "select public.moderate_company($1, 'approved', null)", [adminCo]), { code: "42501" });
  });
});

describe("film submissions", () => {
  let submissionId: string;

  test("viewers can't submit films; filmmakers can", async () => {
    await ctx.rejects(VIEWER, `insert into public.film_submissions ${COMPLETE_SUBMISSION}`, "42501");
    [{ id: submissionId }] = await ctx.commitAs<{ id: string }>(FILMMAKER, `insert into public.film_submissions ${COMPLETE_SUBMISSION} returning id`);
  });

  test("submitting requires the rights confirmation and complete details", async () => {
    await ctx.rejects(
      FILMMAKER,
      `insert into public.film_submissions (title, synopsis, release_year, runtime_minutes, genres, language, country, director, rights_confirmed, status)
       values ('No Rights', 'A synopsis that is long enough to submit.', 2026, 95, '{drama}', 'yo', 'NG', 'Ada Obi', false, 'pending_review')`,
      "23514",
    );
    await ctx.rejects(FILMMAKER, "insert into public.film_submissions (title, status, rights_confirmed) values ('Bare', 'pending_review', true)", "23514");
    // Drafts can be incomplete.
    await ctx.as(FILMMAKER, (sql) => sql("insert into public.film_submissions (title) values ('Working title')"));
  });

  test("unsafe links are refused by the database too", async () => {
    for (const column of ["trailer_url", "poster_url", "website_url"]) {
      await ctx.rejects(FILMMAKER, `insert into public.film_submissions (title, ${column}) values ('Bad link', 'javascript:alert(1)')`, "23514");
    }
    await ctx.rejects(FILMMAKER, `insert into public.film_submissions (title, viewing_links) values ('Bad', '[{"label":"x","url":"http://insecure.example"}]')`, "23514");
  });

  test("submitting records history and a 'received' notification", async () => {
    const events = await ctx.as(FILMMAKER, (sql) => sql("select from_status, to_status from public.submission_events where submission_id = $1", [submissionId]));
    assert.deepEqual(events, [{ from_status: null, to_status: "pending_review" }]);
    const kinds = (await ctx.as(FILMMAKER, (sql) => sql("select kind from public.notifications where kind like 'submission%'"))).map((r) => r.kind);
    assert.deepEqual(kinds, ["submission_received"]);
  });

  test("a pending submission is locked, and the submitter can't approve it", async () => {
    await ctx.rejects(FILMMAKER, `update public.film_submissions set title = 'Changed' where id = '${submissionId}'`, "42501");
    await ctx.rejects(FILMMAKER, `update public.film_submissions set status = 'approved' where id = '${submissionId}'`, "42501");
    await ctx.rejects(FILMMAKER, `update public.film_submissions set published_film_id = 'film-x' where id = '${submissionId}'`, "42501");
    await ctx.rejects(FILMMAKER, `select public.moderate_submission('${submissionId}', 'approved', null, 'a-new-film')`, "42501");
  });

  test("submissions and their history are private to the submitter and admins", async () => {
    assert.equal((await ctx.as(OTHER, (sql) => sql("select * from public.film_submissions where id = $1", [submissionId]))).length, 0);
    assert.equal((await ctx.as(OTHER, (sql) => sql("select * from public.submission_events where submission_id = $1", [submissionId]))).length, 0);
    assert.equal((await ctx.as(OTHER, (sql) => sql("delete from public.film_submissions where id = $1 returning id", [submissionId]))).length, 0);
    await ctx.rejects("anon", "select * from public.film_submissions", "42501");
  });

  test("admins move it through review: under review → changes requested → resubmitted → approved and published", async () => {
    await ctx.commitAs(ADMIN, "select public.moderate_submission($1, 'under_review', null, null)", [submissionId]);
    await assert.rejects(ctx.commitAs(ADMIN, "select public.moderate_submission($1, 'rejected', '', null)", [submissionId]), { code: "22023" });
    await ctx.commitAs(ADMIN, "select public.moderate_submission($1, 'changes_requested', 'Add the official trailer.', null)", [submissionId]);
    await ctx.commitAs(FILMMAKER, "update public.film_submissions set trailer_url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', status = 'pending_review' where id = $1", [submissionId]);
    await assert.rejects(ctx.commitAs(ADMIN, "select public.moderate_submission($1, 'approved', null, 'Bad Slug')", [submissionId]), { code: "22023" });
    const [{ moderate_submission: filmId }] = await ctx.commitAs<{ moderate_submission: string }>(
      ADMIN2,
      "select public.moderate_submission($1, 'approved', null, 'a-new-film')",
      [submissionId],
    );
    assert.equal(filmId, "film-a-new-film");
    const sub = await one<{ status: string; published_film_id: string }>("select status, published_film_id from public.film_submissions where id = $1", [submissionId]);
    assert.deepEqual(sub, { status: "approved", published_film_id: "film-a-new-film" });
    const history = (await ctx.as(FILMMAKER, (sql) => sql("select to_status from public.submission_events where submission_id = $1 order by created_at", [submissionId]))).map((r) => r.to_status);
    assert.deepEqual(history, ["pending_review", "under_review", "changes_requested", "pending_review", "approved"]);
    const kinds = (await ctx.as(FILMMAKER, (sql) => sql("select kind from public.notifications where kind like 'submission%' order by created_at"))).map((r) => r.kind);
    assert.deepEqual(kinds, ["submission_received", "submission_under_review", "submission_changes_requested", "submission_received", "submission_approved"]);
  });

  test("approved films are public; hiding a listing removes it", async () => {
    assert.equal((await ctx.as("anon", (sql) => sql("select title from public.published_films where slug = 'a-new-film'"))).length, 1);
    await ctx.rejects("anon", "insert into public.published_films (id, slug, title, synopsis, release_year, runtime_minutes, genres, language, country, director) values ('film-fake', 'fake', 'x', 'x', 2020, 90, '{drama}', 'en', 'NG', 'x')", "42501");
    await ctx.rejects(FILMMAKER, "update public.published_films set title = 'Mine now'", "42501");
    await ctx.commitAs(ADMIN, "select public.set_published_film_active('film-a-new-film', false)");
    assert.equal((await ctx.as("anon", (sql) => sql("select 1 from public.published_films where slug = 'a-new-film'"))).length, 0);
    await ctx.commitAs(ADMIN, "select public.set_published_film_active('film-a-new-film', true)");
  });

  test("an admin can't review their own submission or their company's", async () => {
    const [{ id: own }] = await ctx.commitAs<{ id: string }>(ADMIN, `insert into public.film_submissions ${COMPLETE_SUBMISSION} returning id`);
    await assert.rejects(ctx.commitAs(ADMIN, "select public.moderate_submission($1, 'approved', null, 'admin-film')", [own]), { code: "42501" });
    const companyId = (await one<{ id: string }>("select id from public.production_companies where slug = 'ada-films'")).id;
    // ADMIN2 joins Ada Films, then can't review a submission made for it.
    await ctx.db.query("insert into public.company_members (company_id, user_id, member_role, status) values ($1, $2, 'member', 'active')", [companyId, ADMIN2]);
    const [{ id: companySub }] = await ctx.commitAs<{ id: string }>(
      FILMMAKER,
      `insert into public.film_submissions (company_id, title, synopsis, release_year, runtime_minutes, genres, language, country, director, rights_confirmed, status)
       values ($1, 'Company Film', 'A synopsis that is long enough to submit.', 2026, 95, '{drama}', 'yo', 'NG', 'Ada Obi', true, 'pending_review') returning id`,
      [companyId],
    );
    await assert.rejects(ctx.commitAs(ADMIN2, "select public.moderate_submission($1, 'approved', null, 'company-film')", [companySub]), { code: "42501" });
  });

  test("you can only submit for companies you belong to; only drafts can be deleted", async () => {
    const companyId = (await one<{ id: string }>("select id from public.production_companies where slug = 'ada-films'")).id;
    await ctx.rejects(LATER, `insert into public.film_submissions (company_id, title) values ('${companyId}', 'Not my company')`, "42501");
    assert.equal((await ctx.as(FILMMAKER, (sql) => sql("delete from public.film_submissions where id = $1 returning id", [submissionId]))).length, 0);
  });
});

describe("promotion requests", () => {
  const start = "current_date + 1";
  const insert = (filmId: string, extra = "") =>
    `insert into public.promotion_requests (film_id, placement, starts_on, ends_on${extra ? ", " + extra.split("=")[0] : ""})
     values ('${filmId}', 'new_release_spotlight', ${start}, ${start} + 14${extra ? ", " + extra.split("=")[1] : ""}) returning id`;

  test("only the film's submitter (or its company) may request promotion", async () => {
    await ctx.rejects(VIEWER, insert("film-a-new-film"), "42501");
    await ctx.rejects(LATER, insert("film-a-new-film"), "42501");
    await ctx.as(FILMMAKER, (sql) => sql(insert("film-a-new-film")));
  });

  test("requests start pending, can't start in the past or exceed 90 days, and are editorial", async () => {
    await ctx.rejects(FILMMAKER, insert("film-a-new-film", "status='approved'"), "42501");
    await ctx.rejects(FILMMAKER, "insert into public.promotion_requests (film_id, placement, starts_on, ends_on) values ('film-a-new-film', 'featured_film', current_date - 1, current_date + 5)", "22023");
    await ctx.rejects(FILMMAKER, "insert into public.promotion_requests (film_id, placement, starts_on, ends_on) values ('film-a-new-film', 'featured_film', current_date + 1, current_date + 200)", "23514");
    await ctx.rejects(FILMMAKER, insert("film-a-new-film", "placement_kind='paid'"), "42501");
    await ctx.rejects(FILMMAKER, "insert into public.promotion_requests (film_id, placement, starts_on, ends_on) values ('film-a-new-film', 'genre_spotlight', current_date + 1, current_date + 5)", "23514");
  });

  test("requesters cancel but never approve; admins approve and it goes live", async () => {
    const [{ id: requestId }] = await ctx.commitAs<{ id: string }>(
      FILMMAKER,
      "insert into public.promotion_requests (film_id, placement, starts_on, ends_on) values ('film-a-new-film', 'new_release_spotlight', current_date, current_date + 7) returning id",
    );
    await ctx.rejects(FILMMAKER, `update public.promotion_requests set status = 'approved' where id = '${requestId}'`, "42501");
    await ctx.rejects(FILMMAKER, `select public.moderate_promotion('${requestId}', 'approved', null)`, "42501");
    assert.equal((await ctx.as("anon", (sql) => sql("select * from public.get_active_promotions()"))).length, 0);
    await ctx.commitAs(ADMIN, "select public.moderate_promotion($1, 'approved', null)", [requestId]);
    const live = await ctx.as("anon", (sql) => sql("select film_id, placement from public.get_active_promotions()"));
    assert.deepEqual(live, [{ film_id: "film-a-new-film", placement: "new_release_spotlight" }]);
    await ctx.rejects("anon", "select * from public.promotion_requests", "42501");
    // Hiding the film takes it out of the spotlight; expiring ends it.
    await ctx.commitAs(ADMIN, "select public.moderate_promotion($1, 'expired', null)", [requestId]);
    assert.equal((await ctx.as("anon", (sql) => sql("select * from public.get_active_promotions()"))).length, 0);

    const [{ id: cancelMe }] = await ctx.commitAs<{ id: string }>(FILMMAKER, insert("film-a-new-film"));
    await ctx.commitAs(FILMMAKER, "update public.promotion_requests set status = 'cancelled' where id = $1", [cancelMe]);
    await ctx.rejects(FILMMAKER, `update public.promotion_requests set status = 'pending' where id = '${cancelMe}'`, "42501");
  });

  test("other users can't see or touch someone's requests", async () => {
    assert.equal((await ctx.as(OTHER, (sql) => sql("select * from public.promotion_requests"))).length, 0);
    assert.equal((await ctx.as(OTHER, (sql) => sql("update public.promotion_requests set status = 'cancelled' returning id"))).length, 0);
  });
});

describe("notifications", () => {
  test("users see and mark only their own, and can't create or rewrite them", async () => {
    const mine = await ctx.as(FILMMAKER, (sql) => sql("select user_id from public.notifications"));
    assert.ok(mine.length > 0 && mine.every((r) => r.user_id === FILMMAKER));
    assert.equal((await ctx.as(FILMMAKER, (sql) => sql("select * from public.notifications where user_id = $1", [OTHER]))).length, 0);
    await ctx.rejects(FILMMAKER, `insert into public.notifications (user_id, kind, title) values ('${OTHER}', 'application_approved', 'Fake')`, "42501");
    await ctx.rejects(FILMMAKER, "update public.notifications set title = 'Edited'", "42501");
    const read = await ctx.as(FILMMAKER, (sql) => sql("update public.notifications set read_at = now() returning id"));
    assert.equal(read.length, mine.length);
    assert.equal((await ctx.as(FILMMAKER, (sql) => sql("update public.notifications set read_at = now() where user_id = $1 returning id", [OTHER]))).length, 0);
    await ctx.rejects("anon", "select * from public.notifications", "42501");
  });

  test("notification links are internal only, and nothing is marked as emailed", async () => {
    await assert.rejects(
      ctx.db.query("insert into public.notifications (user_id, kind, title, link) values ($1, 'application_approved', 'x', 'https://evil.example')", [FILMMAKER]),
      { code: "23514" },
    );
    const { count } = await one<{ count: number }>("select count(*)::int as count from public.notifications where email_status <> 'not_sent'");
    assert.equal(count, 0);
  });
});

describe("moderation notes and suspension", () => {
  test("notes are for admins only", async () => {
    const subject = (await one<{ id: string }>("select id from public.film_submissions where title = 'A New Film' and submitter_id = $1", [FILMMAKER])).id;
    await ctx.commitAs(ADMIN, "insert into public.moderation_notes (subject_type, subject_id, note) values ('submission', $1, 'Checked the trailer channel.')", [subject]);
    assert.equal((await ctx.as(FILMMAKER, (sql) => sql("select * from public.moderation_notes"))).length, 0);
    await ctx.rejects(FILMMAKER, `insert into public.moderation_notes (subject_type, subject_id, note) values ('submission', '${subject}', 'x')`, "42501");
    assert.equal((await ctx.as(ADMIN2, (sql) => sql("select * from public.moderation_notes"))).length, 1);
  });

  test("suspension removes industry access and hides public listings; admins can't be suspended", async () => {
    await ctx.rejects(FILMMAKER, `select public.set_account_suspension('${OTHER}', true, 'spam')`, "42501");
    await assert.rejects(ctx.commitAs(ADMIN, "select public.set_account_suspension($1, true, 'no')", [ADMIN2]), { code: "42501" });
    await assert.rejects(ctx.commitAs(ADMIN, "select public.set_account_suspension($1, true, '')", [OTHER]), { code: "22023" });
    await ctx.commitAs(ADMIN, "select public.set_account_suspension($1, true, 'Impersonation report under review.')", [OTHER]);
    await ctx.rejects(OTHER, `insert into public.film_submissions ${COMPLETE_SUBMISSION}`, "42501");
    const slugs = (await ctx.as("anon", (sql) => sql("select slug from public.get_public_filmmakers()"))).map((r) => r.slug);
    assert.ok(!slugs.includes("bayo-ade"));
    await ctx.commitAs(ADMIN, "select public.set_account_suspension($1, false, null)", [OTHER]);
    assert.ok((await ctx.as("anon", (sql) => sql("select slug from public.get_public_filmmakers()"))).some((r) => r.slug === "bayo-ade"));
  });

  test("the admin account list never includes emails", async () => {
    const rows = await ctx.as(ADMIN, (sql) => sql("select * from public.admin_list_industry_accounts()"));
    assert.ok(rows.length >= 3);
    assert.ok(!("email" in rows[0]));
    await ctx.rejects(FILMMAKER, "select * from public.admin_list_industry_accounts()", "42501");
  });
});

describe("viewer features still work alongside Stage 7", () => {
  test("a viewer's watchlist and reviews are unaffected", async () => {
    await ctx.as(VIEWER, async (sql) => {
      await sql("insert into public.watchlist (film_id) values ('film-kano-nights')");
      await sql("insert into public.reviews (film_id, rating) values ('film-kano-nights', 5)");
      assert.equal((await sql("select * from public.watchlist")).length, 1);
    });
  });
});
