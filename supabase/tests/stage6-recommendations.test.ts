/**
 * Stage 6 database tests: discovery preferences, recommendation feedback and
 * anonymous popularity. Runs the real Stage 4, 5 and 6 migrations in PGlite
 * as the anon and authenticated roles. In-memory only; see the README for
 * what still needs checking against a live Supabase project.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDatabase } from "./harness.ts";

const USERS = Array.from({ length: 5 }, (_, i) => `00000000-0000-4000-8000-00000000006${i}`);
const [ADA, BAYO, CHI, DAYO, EMEKA] = USERS;

let ctx: Awaited<ReturnType<typeof createTestDatabase>>;

before(async () => {
  ctx = await createTestDatabase(["stage4", "stage5", "stage6"]);
  for (const id of USERS) await ctx.db.query("insert into auth.users (id) values ($1)", [id]);
});

after(async () => {
  await ctx?.db.close();
});

describe("schema safety", () => {
  test("RLS is enabled on every public table, including the new feedback table", async () => {
    const { rows } = await ctx.db.query<{ tablename: string; rowsecurity: boolean }>(
      "select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename",
    );
    assert.ok(rows.some((row) => row.tablename === "recommendation_feedback"));
    assert.equal(rows.length, 8);
    for (const row of rows) assert.equal(row.rowsecurity, true, row.tablename);
  });

  test("profiles: users may now also update their discovery preferences, still never their role", async () => {
    const { rows } = await ctx.db.query<{ column_name: string }>(
      "select column_name from information_schema.column_privileges where table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'UPDATE' order by column_name",
    );
    assert.deepEqual(
      rows.map((row) => row.column_name),
      ["avatar_url", "display_name", "favourite_genres", "include_watched", "preferred_languages", "username"],
    );
    await ctx.rejects(ADA, "update public.profiles set role = 'admin' where id = auth.uid()", "42501");
  });

  test("the popularity function pins its search_path", async () => {
    const { rows } = await ctx.db.query<{ proconfig: string[] }>("select proconfig from pg_proc where proname = 'get_popular_films'");
    assert.ok(rows[0].proconfig.includes('search_path=""'));
  });
});

describe("discovery preferences", () => {
  test("users save and read their own preferences", async () => {
    const rows = await ctx.as(ADA, (sql) =>
      sql(
        "update public.profiles set preferred_languages = '{yo,ha}', favourite_genres = '{drama,crime}', include_watched = true where id = auth.uid() returning preferred_languages, favourite_genres, include_watched",
      ),
    );
    assert.deepEqual(rows, [{ preferred_languages: ["yo", "ha"], favourite_genres: ["drama", "crime"], include_watched: true }]);
  });

  test("new profiles start with no preferences and watched films excluded", async () => {
    const [row] = (await ctx.db.query("select preferred_languages, favourite_genres, include_watched from public.profiles where id = $1", [BAYO])).rows;
    assert.deepEqual(row, { preferred_languages: [], favourite_genres: [], include_watched: false });
  });

  test("users cannot change or read another user's preferences", async () => {
    const changed = await ctx.as(ADA, (sql) => sql("update public.profiles set favourite_genres = '{comedy}' where id = $1 returning id", [BAYO]));
    assert.equal(changed.length, 0);
    const seen = await ctx.as(ADA, (sql) => sql("select favourite_genres from public.profiles where id = $1", [BAYO]));
    assert.equal(seen.length, 0);
    await ctx.rejects("anon", "update public.profiles set favourite_genres = '{comedy}'", "42501");
  });

  test("malformed preference values are refused", async () => {
    for (const set of [
      "preferred_languages = '{EN}'",
      "preferred_languages = '{english}'",
      "preferred_languages = '{yo,yo}'",
      "favourite_genres = '{Drama}'",
      "favourite_genres = '{\"drama; drop table\"}'",
      "favourite_genres = '{a,b,c,d,e,f,g,h,i,j,k}'",
    ]) {
      await ctx.rejects(ADA, `update public.profiles set ${set} where id = auth.uid()`, "23514");
    }
  });
});

describe("recommendation feedback", () => {
  test("users add, read, change and remove their own feedback", async () => {
    await ctx.as(ADA, async (sql) => {
      await sql("insert into public.recommendation_feedback (film_id, kind) values ('film-kano-nights', 'dismissed')");
      assert.deepEqual(await sql("select user_id, film_id, kind from public.recommendation_feedback"), [
        { user_id: ADA, film_id: "film-kano-nights", kind: "dismissed" },
      ]);
      const [changed] = await sql("update public.recommendation_feedback set kind = 'not_interested' where film_id = 'film-kano-nights' returning kind");
      assert.deepEqual(changed, { kind: "not_interested" });
      assert.equal((await sql("delete from public.recommendation_feedback where film_id = 'film-kano-nights' returning id")).length, 1);
    });
  });

  test("one feedback row per user and film", async () => {
    await ctx.rejects(ADA, "insert into public.recommendation_feedback (film_id, kind) values ('film-the-ledger', 'dismissed'), ('film-the-ledger', 'not_interested')", "23505");
  });

  test("feedback is private to its owner", async () => {
    await ctx.commitAs(BAYO, "insert into public.recommendation_feedback (film_id, kind) values ('film-calabar-blue', 'not_interested')");
    assert.equal((await ctx.as(ADA, (sql) => sql("select * from public.recommendation_feedback where user_id = $1", [BAYO]))).length, 0);
    assert.equal((await ctx.as(ADA, (sql) => sql("update public.recommendation_feedback set kind = 'dismissed' where user_id = $1 returning id", [BAYO]))).length, 0);
    assert.equal((await ctx.as(ADA, (sql) => sql("delete from public.recommendation_feedback where user_id = $1 returning id", [BAYO]))).length, 0);
    assert.equal((await ctx.db.query("select 1 from public.recommendation_feedback where user_id = $1", [BAYO])).rows.length, 1);
  });

  test("users cannot write feedback for someone else or move it to another user", async () => {
    await ctx.rejects(ADA, `insert into public.recommendation_feedback (user_id, film_id, kind) values ('${BAYO}', 'film-the-ledger', 'dismissed')`, "42501");
    await ctx.commitAs(ADA, "insert into public.recommendation_feedback (film_id, kind) values ('film-okada-express', 'dismissed')");
    await ctx.rejects(ADA, `update public.recommendation_feedback set user_id = '${BAYO}'`, "42501");
    await ctx.rejects(ADA, "update public.recommendation_feedback set film_id = 'film-the-ledger'", "42501");
  });

  test("visitors and token-less sessions have no access", async () => {
    await ctx.rejects("anon", "select * from public.recommendation_feedback", "42501");
    await ctx.rejects("anon", "insert into public.recommendation_feedback (film_id, kind) values ('film-the-ledger', 'dismissed')", "42501");
    assert.equal((await ctx.as("no-user", (sql) => sql("select * from public.recommendation_feedback"))).length, 0);
    await ctx.rejects("no-user", "insert into public.recommendation_feedback (film_id, kind) values ('film-the-ledger', 'dismissed')", "42501");
  });

  test("bad kinds and film ids are refused", async () => {
    await ctx.rejects(ADA, "insert into public.recommendation_feedback (film_id, kind) values ('film-the-ledger', 'love')", "23514");
    await ctx.rejects(ADA, "insert into public.recommendation_feedback (film_id, kind) values ('the-ledger', 'dismissed')", "23514");
  });

  test("changing feedback moves updated_at, which the 30-day hide is measured from", async () => {
    await ctx.db.query("update public.recommendation_feedback set updated_at = now() - interval '40 days' where user_id = $1 and film_id = 'film-okada-express'", [ADA]);
    await ctx.commitAs(ADA, "update public.recommendation_feedback set kind = 'dismissed' where film_id = 'film-okada-express'");
    const [{ fresh }] = (
      await ctx.db.query<{ fresh: boolean }>("select updated_at > now() - interval '1 minute' as fresh from public.recommendation_feedback where user_id = $1 and film_id = 'film-okada-express'", [ADA])
    ).rows;
    assert.equal(fresh, true);
  });
});

describe("popular with viewers", () => {
  before(async () => {
    // Kano Nights: 4 different members. The Ledger: 2. Sunday Rice: 3, one via a 5-star review.
    for (const id of [ADA, BAYO, CHI, DAYO]) await ctx.commitAs(id, "insert into public.watchlist (film_id) values ('film-kano-nights')");
    await ctx.commitAs(ADA, "insert into public.watched_films (film_id) values ('film-kano-nights')"); // same member twice
    for (const id of [ADA, BAYO]) await ctx.commitAs(id, "insert into public.watched_films (film_id) values ('film-the-ledger')");
    for (const id of [CHI, DAYO]) await ctx.commitAs(id, "insert into public.watched_films (film_id) values ('film-sunday-rice')");
    await ctx.commitAs(EMEKA, "insert into public.reviews (film_id, rating) values ('film-sunday-rice', 5)");
    // Poor ratings and old activity don't count.
    for (const id of [ADA, BAYO, CHI]) await ctx.commitAs(id, "insert into public.reviews (film_id, rating) values ('film-danfo-diaries', 1)");
    for (const id of [ADA, BAYO, CHI]) await ctx.commitAs(id, "insert into public.watchlist (film_id) values ('film-creek-runner')");
    await ctx.db.query("update public.watchlist set added_at = now() - interval '120 days' where film_id = 'film-creek-runner'");
  });

  test("returns only films with at least three distinct members, with counts and no identities", async () => {
    const rows = await ctx.as("anon", (sql) => sql("select * from public.get_popular_films(10)"));
    assert.deepEqual(rows, [
      { film_id: "film-kano-nights", member_count: 4 },
      { film_id: "film-sunday-rice", member_count: 3 },
    ]);
  });

  test("signed-in users get the same anonymous result", async () => {
    const rows = await ctx.as(ADA, (sql) => sql("select film_id from public.get_popular_films(10)"));
    assert.deepEqual(rows.map((row) => row.film_id), ["film-kano-nights", "film-sunday-rice"]);
  });

  test("the limit is clamped and the member threshold can't be lowered by the caller", async () => {
    assert.equal((await ctx.as("anon", (sql) => sql("select * from public.get_popular_films(1)"))).length, 1);
    assert.equal((await ctx.as("anon", (sql) => sql("select * from public.get_popular_films(-5)"))).length, 1);
    await ctx.rejects("anon", "select * from public.get_popular_films(10, 1)", "42883");
  });

  test("visitors still can't read the underlying activity", async () => {
    await ctx.rejects("anon", "select * from public.watchlist", "42501");
    assert.equal((await ctx.as(EMEKA, (sql) => sql("select * from public.watchlist"))).length, 0);
  });
});

describe("account deletion", () => {
  test("deleting a user removes their feedback", async () => {
    await ctx.db.query("delete from auth.users where id = $1", [BAYO]);
    assert.equal((await ctx.db.query("select 1 from public.recommendation_feedback where user_id = $1", [BAYO])).rows.length, 0);
  });
});
