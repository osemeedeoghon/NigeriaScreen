/**
 * Stage 5 database tests: roles, viewing providers, film viewing options and
 * trailers. Runs the real Stage 4 and Stage 5 migrations in PGlite as the
 * `anon` and `authenticated` roles. In-memory only; see the README for what
 * still needs checking against a live Supabase project.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDatabase } from "./harness.ts";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const VIEWER = "00000000-0000-4000-8000-00000000000a";
const OTHER_VIEWER = "00000000-0000-4000-8000-00000000000b";
const FILM = "film-kano-nights";

let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
let activeProvider: string;
let inactiveProvider: string;

const ids = async (sql: string, params?: unknown[]) => (await ctx.db.query<{ id: string }>(sql, params)).rows.map((row) => row.id);

/** Inserts an option as the admin and returns its id. */
async function addOption(overrides: Record<string, unknown> = {}) {
  const row = {
    film_id: FILM,
    provider_id: activeProvider,
    destination_url: `https://provider.test/watch/${Math.random().toString(36).slice(2)}`,
    access_type: "rental",
    countries: ["NG"],
    ...overrides,
  };
  const columns = Object.keys(row);
  const [{ id }] = await ctx.commitAs<{ id: string }>(
    ADMIN,
    `insert into public.film_viewing_options (${columns.join(", ")}) values (${columns.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    Object.values(row),
  );
  return id;
}

async function setStatus(table: string, id: string, status: string) {
  await ctx.commitAs(ADMIN, `update public.${table} set verification_status = $1 where id = $2`, [status, id]);
}

before(async () => {
  ctx = await createTestDatabase(["stage4", "stage5"]);
  await ctx.db.query("insert into auth.users (id, email) values ($1, 'admin@test.invalid'), ($2, 'viewer@test.invalid'), ($3, 'other@test.invalid')", [
    ADMIN,
    VIEWER,
    OTHER_VIEWER,
  ]);
  // Only a trusted process (here the test's superuser connection) can grant the role.
  await ctx.db.query("update public.profiles set role = 'admin' where id = $1", [ADMIN]);

  [activeProvider] = (
    await ctx.commitAs<{ id: string }>(
      ADMIN,
      "insert into public.viewing_providers (name, slug, website_url) values ('Test Provider (fixture)', 'test-provider', 'https://provider.test/') returning id",
    )
  ).map((row) => row.id);
  [inactiveProvider] = (
    await ctx.commitAs<{ id: string }>(
      ADMIN,
      "insert into public.viewing_providers (name, slug, website_url, is_active) values ('Retired Provider (fixture)', 'retired-provider', 'https://retired.test/', false) returning id",
    )
  ).map((row) => row.id);
});

after(async () => {
  await ctx?.db.close();
});

describe("schema safety", () => {
  test("RLS is enabled on every public table, old and new", async () => {
    const { rows } = await ctx.db.query<{ tablename: string; rowsecurity: boolean }>(
      "select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename",
    );
    assert.deepEqual(
      rows.map((row) => row.tablename),
      ["film_trailers", "film_viewing_options", "profiles", "reviews", "viewing_providers", "watched_films", "watchlist"],
    );
    for (const row of rows) assert.equal(row.rowsecurity, true, row.tablename);
  });

  test("security definer functions pin their search_path", async () => {
    const { rows } = await ctx.db.query<{ proname: string; proconfig: string[] | null }>(
      "select proname, proconfig from pg_proc where pronamespace = 'public'::regnamespace and prosecdef order by proname",
    );
    assert.deepEqual(
      rows.map((row) => row.proname),
      ["get_film_reviews", "handle_new_user", "is_admin"],
    );
    for (const row of rows) assert.ok(row.proconfig?.includes('search_path=""'), row.proname);
  });

  test("no API role can delete providers, options or trailers", async () => {
    for (const table of ["viewing_providers", "film_viewing_options", "film_trailers"]) {
      await ctx.rejects(ADMIN, `delete from public.${table}`, "42501");
      await ctx.rejects(VIEWER, `delete from public.${table}`, "42501");
      await ctx.rejects("anon", `delete from public.${table}`, "42501");
    }
  });
});

describe("roles", () => {
  test("new accounts are viewers", async () => {
    const [{ role }] = (await ctx.db.query<{ role: string }>("select role from public.profiles where id = $1", [VIEWER])).rows;
    assert.equal(role, "viewer");
  });

  test("is_admin() is true only for administrators", async () => {
    const check = async (who: string) => (await ctx.as(who, (sql) => sql("select public.is_admin() as admin")))[0].admin;
    assert.equal(await check(ADMIN), true);
    assert.equal(await check(VIEWER), false);
    assert.equal(await check("anon"), false);
    assert.equal(await check("no-user"), false);
  });

  test("nobody can change a role through the API, not even an administrator", async () => {
    await ctx.rejects(VIEWER, "update public.profiles set role = 'admin' where id = auth.uid()", "42501");
    await ctx.rejects(ADMIN, `update public.profiles set role = 'admin' where id = '${OTHER_VIEWER}'`, "42501");
    await ctx.rejects(ADMIN, "update public.profiles set role = 'viewer' where id = auth.uid()", "42501");
    const { rows } = await ctx.db.query<{ column_name: string }>(
      "select column_name from information_schema.column_privileges where table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'UPDATE' order by column_name",
    );
    assert.deepEqual(
      rows.map((row) => row.column_name),
      ["avatar_url", "display_name", "username"],
    );
  });

  test("only role values viewer and admin are allowed", async () => {
    await assert.rejects(ctx.db.query("update public.profiles set role = 'owner' where id = $1", [VIEWER]), { code: "23514" });
  });

  test("viewers can still read and edit their own profile after the role column was added", async () => {
    const rows = await ctx.as(VIEWER, (sql) => sql("update public.profiles set display_name = 'Viewer' where id = auth.uid() returning role"));
    assert.deepEqual(rows, [{ role: "viewer" }]);
  });
});

describe("viewing providers", () => {
  test("visitors and viewers see active providers only; administrators see all", async () => {
    const names = async (who: string) => (await ctx.as(who, (sql) => sql("select slug from public.viewing_providers order by slug"))).map((row) => row.slug);
    assert.deepEqual(await names("anon"), ["test-provider"]);
    assert.deepEqual(await names(VIEWER), ["test-provider"]);
    assert.deepEqual(await names(ADMIN), ["retired-provider", "test-provider"]);
  });

  test("viewers and visitors cannot add or edit providers", async () => {
    await ctx.rejects(VIEWER, "insert into public.viewing_providers (name, slug, website_url) values ('X', 'x', 'https://x.test/')", "42501");
    await ctx.rejects("anon", "insert into public.viewing_providers (name, slug, website_url) values ('X', 'x', 'https://x.test/')", "42501");
    const updated = await ctx.as(VIEWER, (sql) => sql("update public.viewing_providers set name = 'Hijacked' returning id"));
    assert.equal(updated.length, 0);
    await ctx.rejects("anon", "update public.viewing_providers set name = 'Hijacked'", "42501");
  });

  test("administrators can add, edit and deactivate providers", async () => {
    await ctx.as(ADMIN, async (sql) => {
      const [{ id }] = await sql("insert into public.viewing_providers (name, slug, website_url) values ('Another (fixture)', 'another', 'https://another.test/') returning id");
      const [edited] = await sql("update public.viewing_providers set description = 'Fixture', is_active = false where id = $1 returning description, is_active", [id]);
      assert.deepEqual(edited, { description: "Fixture", is_active: false });
    });
  });

  test("names and slugs are unique, and links must be safe https", async () => {
    await ctx.rejects(ADMIN, "insert into public.viewing_providers (name, slug, website_url) values ('Dup', 'test-provider', 'https://dup.test/')", "23505");
    await ctx.rejects(ADMIN, "insert into public.viewing_providers (name, slug, website_url) values ('TEST PROVIDER (FIXTURE)', 'other-slug', 'https://dup.test/')", "23505");
    for (const url of ["javascript:alert(1)", "http://provider.test/", "data:text/html,x", "https://user:pw@provider.test/", "https://provider.test/a b", ""]) {
      await ctx.rejects(ADMIN, "insert into public.viewing_providers (name, slug, website_url) values ('Bad', 'bad', $1)", "23514", [url]);
    }
    await ctx.rejects(ADMIN, "insert into public.viewing_providers (name, slug, website_url) values ('Bad', 'Bad Slug', 'https://bad.test/')", "23514");
  });
});

describe("film viewing options: who can write", () => {
  test("administrators add options as pending, stamped with who added them", async () => {
    const id = await addOption();
    const [row] = (
      await ctx.db.query<{ verification_status: string; created_by: string; verified_at: unknown }>(
        "select verification_status, created_by, verified_at from public.film_viewing_options where id = $1",
        [id],
      )
    ).rows;
    assert.deepEqual(row, { verification_status: "pending", created_by: ADMIN, verified_at: null });
  });

  test("a new option cannot be created as verified, even by an administrator", async () => {
    await ctx.rejects(
      ADMIN,
      `insert into public.film_viewing_options (film_id, provider_id, destination_url, access_type, countries, verification_status)
       values ('${FILM}', '${activeProvider}', 'https://provider.test/v', 'rental', '{NG}', 'verified')`,
      "42501",
    );
  });

  test("verification dates, owner and film cannot be set directly", async () => {
    const id = await addOption();
    await ctx.rejects(ADMIN, `update public.film_viewing_options set verified_at = now() where id = '${id}'`, "42501");
    await ctx.rejects(ADMIN, `update public.film_viewing_options set created_by = '${VIEWER}' where id = '${id}'`, "42501");
    await ctx.rejects(ADMIN, `update public.film_viewing_options set film_id = 'film-the-ledger' where id = '${id}'`, "42501");
    await ctx.rejects(
      ADMIN,
      `insert into public.film_viewing_options (film_id, provider_id, destination_url, access_type, countries, created_by)
       values ('${FILM}', '${activeProvider}', 'https://provider.test/c', 'rental', '{NG}', '${VIEWER}')`,
      "42501",
    );
  });

  test("viewers and visitors cannot add options", async () => {
    const insert = `insert into public.film_viewing_options (film_id, provider_id, destination_url, access_type, countries)
      values ('${FILM}', '${activeProvider}', 'https://provider.test/viewer', 'free', '{NG}')`;
    await ctx.rejects(VIEWER, insert, "42501");
    await ctx.rejects("anon", insert, "42501");
    await ctx.rejects("no-user", insert, "42501");
  });

  test("viewers cannot verify, reject or edit any option, including verified ones they can see", async () => {
    const pending = await addOption();
    const verified = await addOption();
    await setStatus("film_viewing_options", verified, "verified");

    for (const id of [pending, verified]) {
      const changed = await ctx.as(VIEWER, (sql) =>
        sql("update public.film_viewing_options set verification_status = 'verified', destination_url = 'https://evil.test/' where id = $1 returning id", [id]),
      );
      assert.equal(changed.length, 0, id);
    }
    await ctx.rejects("anon", `update public.film_viewing_options set verification_status = 'verified' where id = '${pending}'`, "42501");
    const { rows } = await ctx.db.query<{ verification_status: string; destination_url: string }>(
      "select verification_status, destination_url from public.film_viewing_options where id = any($1)",
      [[pending, verified]],
    );
    assert.ok(rows.every((row) => !row.destination_url.includes("evil")));
    assert.deepEqual(rows.map((row) => row.verification_status).sort(), ["pending", "verified"]);
  });
});

describe("film viewing options: who can read", () => {
  let visible: string;
  let hidden: Record<string, string>;

  before(async () => {
    visible = await addOption({ film_id: "film-the-ledger", countries: ["NG", "GH"] });
    await setStatus("film_viewing_options", visible, "verified");

    hidden = {
      pending: await addOption({ film_id: "film-the-ledger" }),
      rejected: await addOption({ film_id: "film-the-ledger" }),
      expired: await addOption({ film_id: "film-the-ledger" }),
      inactive: await addOption({ film_id: "film-the-ledger" }),
      inactiveProvider: await addOption({ film_id: "film-the-ledger", provider_id: inactiveProvider }),
    };
    await setStatus("film_viewing_options", hidden.rejected, "rejected");
    await setStatus("film_viewing_options", hidden.expired, "verified");
    await setStatus("film_viewing_options", hidden.expired, "expired");
    await setStatus("film_viewing_options", hidden.inactive, "verified");
    await ctx.commitAs(ADMIN, "update public.film_viewing_options set is_active = false where id = $1", [hidden.inactive]);
    await setStatus("film_viewing_options", hidden.inactiveProvider, "verified");
  });

  test("visitors and viewers see only active, verified options from active providers", async () => {
    for (const who of ["anon", VIEWER, "no-user"]) {
      const rows = await ctx.as(who, (sql) => sql("select id from public.film_viewing_options where film_id = 'film-the-ledger'"));
      assert.deepEqual(
        rows.map((row) => row.id),
        [visible],
        who,
      );
    }
  });

  test("administrators see every option, whatever its status", async () => {
    const rows = await ctx.as(ADMIN, (sql) => sql("select id from public.film_viewing_options where film_id = 'film-the-ledger'"));
    assert.equal(rows.length, 6);
  });

  test("a film with no verified options returns an empty list, not an error", async () => {
    const rows = await ctx.as("anon", (sql) => sql("select * from public.film_viewing_options where film_id = 'film-harmattan-letters'"));
    assert.deepEqual(rows, []);
  });

  test("country filtering works on the stored ISO codes", async () => {
    const inGhana = await ctx.as("anon", (sql) => sql("select id from public.film_viewing_options where film_id = 'film-the-ledger' and 'GH' = any(countries)"));
    const inKenya = await ctx.as("anon", (sql) => sql("select id from public.film_viewing_options where film_id = 'film-the-ledger' and 'KE' = any(countries)"));
    assert.deepEqual(inGhana.map((row) => row.id), [visible]);
    assert.deepEqual(inKenya, []);
  });
});

describe("film viewing options: verification bookkeeping", () => {
  test("verifying stamps verified_at and last_checked_at; expiring clears verified_at", async () => {
    const id = await addOption();
    const read = async () =>
      (await ctx.db.query<{ verified_at: Date | null; last_checked_at: Date | null }>("select verified_at, last_checked_at from public.film_viewing_options where id = $1", [id])).rows[0];

    assert.deepEqual(await read(), { verified_at: null, last_checked_at: null });
    await setStatus("film_viewing_options", id, "verified");
    const verified = await read();
    assert.ok(verified.verified_at instanceof Date && verified.last_checked_at instanceof Date);

    await setStatus("film_viewing_options", id, "expired");
    const expired = await read();
    assert.equal(expired.verified_at, null);
    assert.ok(expired.last_checked_at instanceof Date);
  });

  test("editing other fields keeps the original verification date", async () => {
    const id = await addOption();
    await setStatus("film_viewing_options", id, "verified");
    const before = (await ctx.db.query<{ verified_at: Date }>("select verified_at from public.film_viewing_options where id = $1", [id])).rows[0].verified_at;
    await ctx.commitAs(ADMIN, "update public.film_viewing_options set availability_notes = 'Checked' where id = $1", [id]);
    const after = (await ctx.db.query<{ verified_at: Date }>("select verified_at from public.film_viewing_options where id = $1", [id])).rows[0].verified_at;
    assert.equal(after.getTime(), before.getTime());
  });
});

describe("film viewing options: duplicates and constraints", () => {
  test("the same link for the same film, provider and access type is rejected", async () => {
    await addOption({ destination_url: "https://provider.test/dup" });
    await assert.rejects(addOption({ destination_url: "https://provider.test/dup" }), { code: "23505" });
    // A different access type, or another film, is a different option.
    await addOption({ destination_url: "https://provider.test/dup", access_type: "purchase" });
    await addOption({ destination_url: "https://provider.test/dup", film_id: "film-third-mainland" });
  });

  test("bad values are refused by the database", async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ access_type: "stream" }, "23514"],
      [{ countries: [] }, "23514"],
      [{ countries: ["ng"] }, "23514"],
      [{ countries: ["NGA"] }, "23514"],
      [{ countries: ["NG", "NG"] }, "23514"],
      [{ audio_languages: ["EN"] }, "23514"],
      [{ subtitle_languages: ["english"] }, "23514"],
      [{ film_id: "kano-nights" }, "23514"],
      [{ destination_url: "javascript:alert(1)" }, "23514"],
      [{ destination_url: "data:text/html,<script>alert(1)</script>" }, "23514"],
      [{ destination_url: "file:///etc/passwd" }, "23514"],
      [{ destination_url: "http://provider.test/" }, "23514"],
      [{ availability_notes: "" }, "23514"],
      [{ provider_id: "00000000-0000-4000-8000-000000000000" }, "23503"],
    ];
    for (const [overrides, code] of cases) {
      await assert.rejects(addOption(overrides), { code }, JSON.stringify(overrides));
    }
  });

  test("a provider with options cannot be removed, only deactivated", async () => {
    // 23001: restrict_violation from the ON DELETE RESTRICT foreign key.
    await assert.rejects(ctx.db.query("delete from public.viewing_providers where id = $1", [activeProvider]), { code: "23001" });
  });
});

describe("trailers", () => {
  const insertTrailer = (videoId: string, provider = "youtube", extra = "") =>
    `insert into public.film_trailers (film_id, title, video_provider, video_id, video_url${extra ? ", verification_status" : ""})
     values ('${FILM}', 'Official trailer (fixture)', '${provider}', '${videoId}', 'https://www.youtube.com/watch?v=${videoId}'${extra ? `, '${extra}'` : ""}) returning id`;

  test("administrators add trailers as pending; visitors see them only once verified and active", async () => {
    const [{ id }] = await ctx.commitAs<{ id: string }>(ADMIN, insertTrailer("aaaaaaaaaaa"));
    const seen = async () => (await ctx.as("anon", (sql) => sql("select id from public.film_trailers where id = $1", [id]))).length;
    assert.equal(await seen(), 0);
    await setStatus("film_trailers", id, "verified");
    assert.equal(await seen(), 1);
    await ctx.commitAs(ADMIN, "update public.film_trailers set is_active = false where id = $1", [id]);
    assert.equal(await seen(), 0);
    await ctx.commitAs(ADMIN, "update public.film_trailers set is_active = true where id = $1", [id]);
    await setStatus("film_trailers", id, "rejected");
    assert.equal(await seen(), 0);
  });

  test("viewers and visitors cannot add, approve or edit trailers", async () => {
    await ctx.rejects(VIEWER, insertTrailer("bbbbbbbbbbb"), "42501");
    await ctx.rejects("anon", insertTrailer("bbbbbbbbbbb"), "42501");
    await ctx.rejects(ADMIN, insertTrailer("ccccccccccc", "youtube", "verified"), "42501");
    const changed = await ctx.as(VIEWER, (sql) => sql("update public.film_trailers set verification_status = 'verified' returning id"));
    assert.equal(changed.length, 0);
  });

  test("only YouTube and Vimeo ids in the right format are accepted", async () => {
    await ctx.rejects(ADMIN, insertTrailer("short"), "23514");
    await ctx.rejects(
      ADMIN,
      "insert into public.film_trailers (film_id, title, video_provider, video_id, video_url) values ($1, 'T', 'youtube', $2, 'https://www.youtube.com/watch?v=x')",
      "23514",
      [FILM, "aaaaaaaaa'--"],
    );
    await ctx.rejects(ADMIN, insertTrailer("abcdefghijk", "vimeo"), "23514");
    await ctx.rejects(ADMIN, insertTrailer("x7tgad0aaaa", "dailymotion"), "23514");
    await ctx.rejects(
      ADMIN,
      `insert into public.film_trailers (film_id, title, video_provider, video_id, video_url) values ('${FILM}', 'T', 'youtube', 'ddddddddddd', 'javascript:alert(1)')`,
      "23514",
    );
  });

  test("the same video can't be listed twice for one film, and the video can't be swapped later", async () => {
    await ctx.commitAs(ADMIN, insertTrailer("eeeeeeeeeee"));
    await ctx.rejects(ADMIN, insertTrailer("eeeeeeeeeee"), "23505");
    await ctx.rejects(ADMIN, "update public.film_trailers set video_id = 'fffffffffff'", "42501");
    await ctx.rejects(ADMIN, "update public.film_trailers set video_url = 'https://evil.test/'", "42501");
  });
});

describe("Stage 4 data stays private after Stage 5", () => {
  test("an administrator cannot read or change another user's watchlist or reviews", async () => {
    await ctx.commitAs(VIEWER, `insert into public.watchlist (film_id) values ('${FILM}')`);
    await ctx.commitAs(VIEWER, `insert into public.reviews (film_id, rating) values ('${FILM}', 4)`);
    const seen = await ctx.as(ADMIN, (sql) => sql("select id from public.watchlist union all select id from public.reviews"));
    assert.equal(seen.length, 0);
    const changed = await ctx.as(ADMIN, (sql) => sql("update public.reviews set rating = 1 returning id"));
    assert.equal(changed.length, 0);
    assert.ok((await ids("select id from public.reviews where user_id = $1", [VIEWER])).length === 1);
  });
});
