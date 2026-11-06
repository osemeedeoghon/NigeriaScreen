/**
 * Regression tests for the pre-launch audit fixes (stage 8 hardening). Each
 * test reproduces a finding against the full migration chain in PGlite and
 * checks it is now refused or handled. Simulated Supabase; see the README.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDatabase } from "./harness.ts";

const id = (n: number) => `00000000-0000-4000-8000-0000000008${String(n).padStart(2, "0")}`;
const OWNER = id(1);
const MEMBER = id(2);
const ADMIN = id(3);
const OUTSIDER = id(4);
const VIEWER = id(5);

let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
let companyId: string;
const one = async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => (await ctx.db.query<T>(sql, params)).rows[0];

async function approveMember(user: string, slug: string) {
  const [{ id: appId }] = await ctx.commitAs<{ id: string }>(
    user,
    "insert into public.industry_applications (professional_name, professional_role, biography, country, status) values ('Member', 'director', 'I direct films in Lagos and Accra.', 'NG', 'pending_review') returning id",
  );
  await ctx.commitAs(ADMIN, "select public.moderate_application($1, 'approved', null)", [appId]);
  await ctx.commitAs(user, "insert into public.filmmaker_profiles (slug, professional_name, professional_role, visibility) values ($1, $1, 'actor', 'public')", [slug]);
}

before(async () => {
  ctx = await createTestDatabase(["stage4", "stage5", "stage6", "stage7", "stage8"]);
  for (const user of [OWNER, MEMBER, ADMIN, OUTSIDER, VIEWER]) await ctx.db.query("insert into auth.users (id) values ($1)", [user]);
  await ctx.db.query("update public.profiles set role = 'admin' where id = $1", [ADMIN]);
  await approveMember(OWNER, "owner-person");
  await approveMember(MEMBER, "member-person");
  await approveMember(OUTSIDER, "outsider-person");
  [{ id: companyId }] = await ctx.commitAs<{ id: string }>(
    OWNER,
    "insert into public.production_companies (slug, name, description, country, review_status) values ('small-films', 'Small Films', 'A small Lagos production company.', 'NG', 'pending_review') returning id",
  );
});

after(async () => {
  await ctx?.db.close();
});

describe("verified profiles can't change identity and keep the badge", () => {
  test("renaming a verified profile drops its verification", async () => {
    const { id: profileId } = await one<{ id: string }>("select id from public.filmmaker_profiles where slug = 'member-person'");
    await ctx.commitAs(ADMIN, "select public.moderate_profile_verification($1, 'verified', null)", [profileId]);
    await ctx.commitAs(MEMBER, "update public.filmmaker_profiles set professional_name = 'A Famous Director', slug = 'famous-director' where user_id = auth.uid()");
    const row = await one<{ verification_status: string; verified_at: unknown }>("select verification_status, verified_at from public.filmmaker_profiles where id = $1", [profileId]);
    assert.deepEqual(row, { verification_status: "unverified", verified_at: null });
    const listed = await ctx.as("anon", (sql) => sql("select verified from public.get_public_filmmakers(p_slug => 'famous-director')"));
    assert.deepEqual(listed, [{ verified: false }]);
  });

  test("editing the biography keeps verification", async () => {
    const { id: profileId } = await one<{ id: string }>("select id from public.filmmaker_profiles where slug = 'owner-person'");
    await ctx.commitAs(ADMIN, "select public.moderate_profile_verification($1, 'verified', null)", [profileId]);
    await ctx.commitAs(OWNER, "update public.filmmaker_profiles set biography = 'Updated bio.' where user_id = auth.uid()");
    assert.equal((await one<{ v: string }>("select verification_status as v from public.filmmaker_profiles where id = $1", [profileId])).v, "verified");
  });
});

describe("companies can't change what moderators reviewed", () => {
  test("content is locked while a company is pending review", async () => {
    await ctx.rejects(OWNER, `update public.production_companies set name = 'Swapped Name' where id = '${companyId}'`, "42501");
    // Visibility can still change.
    await ctx.as(OWNER, (sql) => sql("update public.production_companies set visibility = 'private' where id = $1", [companyId]));
  });

  test("editing an approved, verified company sends it back to review and drops verification", async () => {
    await ctx.commitAs(ADMIN, "select public.moderate_company($1, 'approved', null)", [companyId]);
    await ctx.commitAs(ADMIN, "select public.moderate_company($1, 'verified', null)", [companyId]);
    assert.equal((await ctx.as("anon", (sql) => sql("select verified from public.get_public_companies(p_slug => 'small-films')")))[0].verified, true);

    const [after] = await ctx.as(OWNER, (sql) =>
      sql("update public.production_companies set name = 'Netflix Naija Studios' where id = $1 returning review_status, verification_status", [companyId]),
    );
    assert.deepEqual(after, { review_status: "pending_review", verification_status: "unverified" });
  });

  test("rejected companies can't be edited", async () => {
    const [{ id: rejected }] = await ctx.commitAs<{ id: string }>(
      OUTSIDER,
      "insert into public.production_companies (slug, name, description, country, review_status) values ('rejected-co', 'Rejected Co', 'A company that will be rejected.', 'NG', 'pending_review') returning id",
    );
    await ctx.commitAs(ADMIN, "select public.moderate_company($1, 'rejected', 'Not a real company.')", [rejected]);
    await ctx.rejects(OUTSIDER, `update public.production_companies set name = 'Try Again' where id = '${rejected}'`, "42501");
  });
});

describe("invitations can't be used for spam", () => {
  test("only approved companies can invite", async () => {
    const [{ id: draft }] = await ctx.commitAs<{ id: string }>(OWNER, "insert into public.production_companies (slug, name) values ('draft-co', 'Draft Co') returning id");
    await assert.rejects(ctx.commitAs(OWNER, "select public.invite_company_member($1, 'outsider-person', 'member')", [draft]), { code: "22023" });
  });

  test("one person gets at most three invitations a day", async () => {
    const companies: string[] = [];
    for (const n of [1, 2, 3, 4]) {
      const [{ id: co }] = await ctx.commitAs<{ id: string }>(
        MEMBER,
        `insert into public.production_companies (slug, name, description, country, review_status) values ('invite-co-${n}', 'Invite Co ${n}', 'A company used to test invitation limits.', 'NG', 'pending_review') returning id`,
      );
      await ctx.commitAs(ADMIN, "select public.moderate_company($1, 'approved', null)", [co]);
      companies.push(co);
    }
    for (const co of companies.slice(0, 3)) await ctx.commitAs(MEMBER, "select public.invite_company_member($1, 'outsider-person', 'member')", [co]);
    await assert.rejects(ctx.commitAs(MEMBER, "select public.invite_company_member($1, 'outsider-person', 'member')", [companies[3]]), { code: "22023" });
  });

  test("a member can own at most five companies", async () => {
    // MEMBER already owns four.
    await ctx.as(MEMBER, (sql) => sql("insert into public.production_companies (slug, name) values ('fifth-co', 'Fifth Co')"));
    await ctx.commitAs(MEMBER, "insert into public.production_companies (slug, name) values ('fifth-co', 'Fifth Co')");
    await ctx.rejects(MEMBER, "insert into public.production_companies (slug, name) values ('sixth-co', 'Sixth Co')", "22023");
  });
});

describe("abuse caps on submissions and promotions", () => {
  test("at most 20 open submissions per member", async () => {
    for (let i = 0; i < 20; i++) await ctx.commitAs(OUTSIDER, "insert into public.film_submissions (title) values ($1)", [`Draft ${i}`]);
    await ctx.rejects(OUTSIDER, "insert into public.film_submissions (title) values ('Draft 21')", "22023");
  });

  test("only one pending request per film and placement", async () => {
    const [{ id: sub }] = await ctx.commitAs<{ id: string }>(
      OWNER,
      `insert into public.film_submissions (title, synopsis, release_year, runtime_minutes, genres, language, country, director, rights_confirmed, status)
       values ('Owner Film', 'A synopsis long enough to be submitted.', 2026, 90, '{drama}', 'en', 'NG', 'Owner', true, 'pending_review') returning id`,
    );
    await ctx.commitAs(ADMIN, "select public.moderate_submission($1, 'approved', null, 'owner-film')", [sub]);
    const insert = "insert into public.promotion_requests (film_id, placement, starts_on, ends_on) values ('film-owner-film', 'featured_film', current_date + 1, current_date + 10)";
    await ctx.commitAs(OWNER, insert);
    await ctx.rejects(OWNER, insert, "23505");
  });
});

describe("company emails can't carry mailto parameters", () => {
  test("query strings and encoded characters are refused", async () => {
    const [{ id: co }] = await ctx.commitAs<{ id: string }>(OWNER, "insert into public.production_companies (slug, name) values ('mail-co', 'Mail Co') returning id");
    for (const email of ["info@co.ng?cc=victim%40x.com", "info@co.ng&body=hi", "a b@co.ng", "info@co"]) {
      await ctx.rejects(OWNER, "update public.production_companies set public_email = $1 where id = '" + co + "'", "23514", [email]);
    }
    await ctx.as(OWNER, (sql) => sql("update public.production_companies set public_email = 'info@small-films.com.ng' where id = $1", [co]));
  });
});

describe("account deletion works for company owners", () => {
  test("deleting an owner's auth user removes their companies and memberships", async () => {
    const DOOMED = id(9);
    await ctx.db.query("insert into auth.users (id) values ($1)", [DOOMED]);
    await approveMember(DOOMED, "doomed-person");
    await ctx.commitAs(DOOMED, "insert into public.production_companies (slug, name) values ('doomed-co', 'Doomed Co')");
    await ctx.db.query("delete from auth.users where id = $1", [DOOMED]);
    assert.equal((await ctx.db.query("select 1 from public.production_companies where slug = 'doomed-co'")).rows.length, 0);
    assert.equal((await ctx.db.query("select 1 from public.company_members where user_id = $1", [DOOMED])).rows.length, 0);
  });

  test("an owner row still can't be deleted directly", async () => {
    await ctx.rejects(OWNER, `delete from public.company_members where company_id = '${companyId}' and member_role = 'owner'`, "42501");
  });
});

describe("suspended managers lose roster powers", () => {
  test("a suspended manager can't change roles or remove members, but can leave", async () => {
    // The company is still approved (the earlier edit test rolled back). OWNER invites MEMBER, who accepts.
    const [{ invite_company_member: invite }] = await ctx.commitAs<{ invite_company_member: string }>(
      OWNER,
      "select public.invite_company_member($1, 'famous-director', 'member')", // renamed in the first test
      [companyId],
    );
    await ctx.commitAs(MEMBER, "update public.company_members set status = 'active' where id = $1", [invite]);
    await ctx.commitAs(ADMIN, "select public.set_account_suspension($1, true, 'Under review')", [OWNER]);

    const changed = await ctx.as(OWNER, (sql) => sql("update public.company_members set member_role = 'manager' where id = $1 returning id", [invite]));
    assert.equal(changed.length, 0);
    const removed = await ctx.as(OWNER, (sql) => sql("delete from public.company_members where id = $1 returning id", [invite]));
    assert.equal(removed.length, 0);
    // The suspended member can still leave a company they don't own.
    await ctx.commitAs(ADMIN, "select public.set_account_suspension($1, true, 'Under review')", [MEMBER]);
    const left = await ctx.as(MEMBER, (sql) => sql("delete from public.company_members where id = $1 returning id", [invite]));
    assert.equal(left.length, 1);

    await ctx.commitAs(ADMIN, "select public.set_account_suspension($1, false, null)", [OWNER]);
    await ctx.commitAs(ADMIN, "select public.set_account_suspension($1, false, null)", [MEMBER]);
  });

  test("the roster no longer returns user ids", async () => {
    const rows = await ctx.as(OWNER, (sql) => sql("select * from public.get_company_roster($1)", [companyId]));
    assert.ok(rows.length >= 1);
    assert.ok(!("user_id" in rows[0]));
    assert.equal(rows.find((r) => r.member_role === "owner")?.is_self, true);
  });
});

describe("moderators can't act on their company's films", () => {
  test("an admin in the film's company can't approve its promotion or hide its listing", async () => {
    await ctx.db.query("insert into public.company_members (company_id, user_id, member_role, status) values ($1, $2, 'member', 'active')", [companyId, ADMIN]);
    const [{ id: sub }] = await ctx.commitAs<{ id: string }>(
      OWNER,
      `insert into public.film_submissions (company_id, title, synopsis, release_year, runtime_minutes, genres, language, country, director, rights_confirmed, status)
       values ($1, 'Company Feature', 'A synopsis long enough to be submitted.', 2026, 90, '{drama}', 'en', 'NG', 'Owner', true, 'pending_review') returning id`,
      [companyId],
    );
    // A second admin (not a member) approves the film itself.
    const ADMIN2 = id(10);
    await ctx.db.query("insert into auth.users (id) values ($1)", [ADMIN2]);
    await ctx.db.query("update public.profiles set role = 'admin' where id = $1", [ADMIN2]);
    await ctx.commitAs(ADMIN2, "select public.moderate_submission($1, 'approved', null, 'company-feature')", [sub]);
    const [{ id: request }] = await ctx.commitAs<{ id: string }>(
      OWNER,
      "insert into public.promotion_requests (film_id, placement, starts_on, ends_on) values ('film-company-feature', 'homepage_editorial', current_date, current_date + 5) returning id",
    );
    await assert.rejects(ctx.commitAs(ADMIN, "select public.moderate_promotion($1, 'approved', null)", [request]), { code: "42501" });
    await assert.rejects(ctx.commitAs(ADMIN, "select public.set_published_film_active('film-company-feature', false)"), { code: "42501" });
    await ctx.commitAs(ADMIN2, "select public.moderate_promotion($1, 'approved', null)", [request]);
  });

  test("the film's company is found by film id for its public page", async () => {
    const rows = await ctx.as("anon", (sql) => sql("select * from public.get_public_company_for_film('film-company-feature')"));
    assert.deepEqual(rows, [{ slug: "small-films", name: "Small Films" }]);
  });
});

describe("viewing data hides who created it, and re-verifies changed links", () => {
  let optionId: string;

  before(async () => {
    const [{ id: provider }] = await ctx.commitAs<{ id: string }>(
      ADMIN,
      "insert into public.viewing_providers (name, slug, website_url) values ('Fixture Provider', 'fixture-provider', 'https://provider.test/') returning id",
    );
    [{ id: optionId }] = await ctx.commitAs<{ id: string }>(
      ADMIN,
      "insert into public.film_viewing_options (film_id, provider_id, destination_url, access_type, countries) values ('film-kano-nights', $1, 'https://provider.test/kano', 'rental', '{NG}') returning id",
      [provider],
    );
    await ctx.commitAs(ADMIN, "update public.film_viewing_options set verification_status = 'verified' where id = $1", [optionId]);
  });

  test("visitors and viewers can read options but not created_by", async () => {
    assert.equal((await ctx.as("anon", (sql) => sql("select id, destination_url from public.film_viewing_options"))).length, 1);
    await ctx.rejects("anon", "select created_by from public.film_viewing_options", "42501");
    await ctx.rejects(VIEWER, "select * from public.film_viewing_options", "42501");
    await ctx.rejects("anon", "select created_by from public.film_trailers", "42501");
  });

  test("changing a verified option's link returns it to pending, even when done directly", async () => {
    const [row] = await ctx.as(ADMIN, (sql) =>
      sql("update public.film_viewing_options set destination_url = 'https://elsewhere.test/kano' where id = $1 returning verification_status, verified_at", [optionId]),
    );
    assert.deepEqual(row, { verification_status: "pending", verified_at: null });
    const [notes] = await ctx.as(ADMIN, (sql) => sql("update public.film_viewing_options set availability_notes = 'Checked' where id = $1 returning verification_status", [optionId]));
    assert.equal(notes.verification_status, "verified");
  });
});
