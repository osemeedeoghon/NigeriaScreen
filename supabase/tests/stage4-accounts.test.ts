/**
 * Stage 4 database tests. Runs the real Stage 4 migration in PGlite (Postgres compiled to WebAssembly)
 * and checks Row Level Security, grants and constraints as Supabase's `anon`
 * and `authenticated` roles. Supabase's auth schema is stubbed with the parts
 * the migration relies on: auth.users, auth.uid() and the default grants.
 *
 * Run with `npm run test:db`. Everything runs in memory: no Docker, network or
 * Supabase project is used, and nothing is applied to any real database.
 *
 * What this does NOT prove: PGlite is plain Postgres, not Supabase. It does not
 * run Supabase Auth, PostgREST (the API supabase-js talks to), real JWTs,
 * Supabase's own grants and extensions, or its Postgres version. See
 * "Database tests and their limits" in the README for what still needs a live check.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDatabase } from "./harness.ts";

const ADA = "00000000-0000-4000-8000-00000000000a";
const BAYO = "00000000-0000-4000-8000-00000000000b";
const FILM = "film-harmattan-letters";
const OTHER_FILM = "film-third-mainland";

let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
let as: Awaited<ReturnType<typeof createTestDatabase>>["as"];
let commitAs: Awaited<ReturnType<typeof createTestDatabase>>["commitAs"];
let rejects: Awaited<ReturnType<typeof createTestDatabase>>["rejects"];

before(async () => {
  // Stage 4 on its own, so its schema checks describe exactly that migration.
  ({ db, as, commitAs, rejects } = await createTestDatabase(["stage4"]));
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'ada@example.com', $2), ($3, 'bayo@example.com', $4)", [
    ADA,
    JSON.stringify({ display_name: "  Ada Obi  " }),
    BAYO,
    JSON.stringify({}),
  ]);
});

after(async () => {
  await db?.close();
});

describe("profiles", () => {
  test("a profile is created on sign-up from trimmed metadata, with a default name", async () => {
    const rows = (await db.query("select id, display_name from public.profiles order by id")).rows;
    assert.deepEqual(rows, [
      { id: ADA, display_name: "Ada Obi" },
      { id: BAYO, display_name: "NaijaScreen viewer" },
    ]);
  });

  test("an over-long sign-up name is cut to 50 characters", async () => {
    const id = "00000000-0000-4000-8000-0000000000cc";
    await db.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2)", [id, JSON.stringify({ display_name: "x".repeat(80) })]);
    const [{ length }] = (await db.query<{ length: number }>("select char_length(display_name) as length from public.profiles where id = $1", [id])).rows;
    assert.equal(length, 50);
    await db.query("delete from auth.users where id = $1", [id]);
  });

  test("users read only their own profile", async () => {
    const rows = await as(ADA, (sql) => sql("select id from public.profiles"));
    assert.deepEqual(rows, [{ id: ADA }]);
  });

  test("users update their own profile and not anyone else's", async () => {
    const own = await as(ADA, (sql) => sql("update public.profiles set display_name = 'Ada' where id = $1 returning id", [ADA]));
    assert.equal(own.length, 1);
    const other = await as(ADA, (sql) => sql("update public.profiles set display_name = 'Hacked' where id = $1 returning id", [BAYO]));
    assert.equal(other.length, 0);
  });

  test("protected profile columns cannot be changed", async () => {
    await rejects(ADA, `update public.profiles set id = '${BAYO}'`, "42501");
    await rejects(ADA, "update public.profiles set created_at = now()", "42501");
  });

  test("users cannot create or delete profiles directly", async () => {
    await rejects(ADA, `insert into public.profiles (id, display_name) values ('${BAYO}', 'x')`, "42501");
    await rejects(ADA, "delete from public.profiles", "42501");
  });

  test("username and avatar rules are enforced", async () => {
    await rejects(ADA, "update public.profiles set username = 'Bad Name' where id = auth.uid()", "23514");
    await rejects(ADA, "update public.profiles set avatar_url = 'http://example.com/a.jpg' where id = auth.uid()", "23514");
    await rejects(ADA, "update public.profiles set display_name = '' where id = auth.uid()", "23514");
    await commitAs(ADA, "update public.profiles set username = 'ada_obi' where id = auth.uid()");
    await rejects(BAYO, "update public.profiles set username = 'ada_obi' where id = auth.uid()", "23505");
  });

  test("updated_at moves forward on update", async () => {
    const before = (await db.query<{ updated_at: Date }>("select updated_at from public.profiles where id = $1", [ADA])).rows[0].updated_at;
    await commitAs(ADA, "update public.profiles set display_name = 'Ada Obi' where id = auth.uid()");
    const after = (await db.query<{ updated_at: Date }>("select updated_at from public.profiles where id = $1", [ADA])).rows[0].updated_at;
    assert.ok(after.getTime() >= before.getTime());
  });

  test("visitors cannot read profiles", async () => {
    await rejects("anon", "select * from public.profiles", "42501");
  });
});

for (const table of ["watchlist", "watched_films"] as const) {
  describe(table, () => {
    test("users add, see and remove their own entries", async () => {
      await as(ADA, async (sql) => {
        await sql(`insert into public.${table} (film_id) values ($1)`, [FILM]);
        const rows = await sql(`select user_id, film_id from public.${table}`);
        assert.deepEqual(rows, [{ user_id: ADA, film_id: FILM }]);
        const removed = await sql(`delete from public.${table} where film_id = $1 returning id`, [FILM]);
        assert.equal(removed.length, 1);
      });
    });

    test("the same film cannot be added twice", async () => {
      await rejects(ADA, `insert into public.${table} (film_id) values ('${FILM}'), ('${FILM}')`, "23505");
    });

    test("a repeated add with on conflict do nothing is a no-op", async () => {
      const rows = await as(ADA, async (sql) => {
        await sql(`insert into public.${table} (film_id) values ($1)`, [FILM]);
        await sql(`insert into public.${table} (film_id) values ($1) on conflict (user_id, film_id) do nothing`, [FILM]);
        return sql(`select id from public.${table}`);
      });
      assert.equal(rows.length, 1);
    });

    test("users cannot write entries for someone else", async () => {
      await rejects(ADA, `insert into public.${table} (user_id, film_id) values ('${BAYO}', '${FILM}')`, "42501");
    });

    test("users cannot see or delete someone else's entries", async () => {
      await commitAs(BAYO, `insert into public.${table} (film_id) values ('${OTHER_FILM}')`);
      const seen = await as(ADA, (sql) => sql(`select id from public.${table}`));
      assert.equal(seen.length, 0);
      const deleted = await as(ADA, (sql) => sql(`delete from public.${table} where film_id = $1 returning id`, [OTHER_FILM]));
      assert.equal(deleted.length, 0);
      const still = await db.query(`select id from public.${table} where user_id = $1`, [BAYO]);
      assert.equal(still.rows.length, 1);
    });

    test("entries cannot be edited, only added or removed", async () => {
      await rejects(BAYO, `update public.${table} set film_id = '${FILM}'`, "42501");
    });

    test("malformed film ids are rejected", async () => {
      for (const filmId of ["harmattan-letters", "film-", "FILM-X", "film-a b", ""]) {
        await rejects(ADA, `insert into public.${table} (film_id) values ($1)`, "23514", [filmId]);
      }
    });

    test("visitors can neither read nor write", async () => {
      await rejects("anon", `select * from public.${table}`, "42501");
      await rejects("anon", `insert into public.${table} (film_id) values ('${FILM}')`, "42501");
    });
  });
}

describe("reviews", () => {
  test("users create, edit and delete their own review", async () => {
    await as(ADA, async (sql) => {
      const [created] = await sql("insert into public.reviews (film_id, rating, body) values ($1, 4, 'Moving.') returning rating, body", [FILM]);
      assert.deepEqual(created, { rating: 4, body: "Moving." });
      const [edited] = await sql("update public.reviews set rating = 5, body = null where film_id = $1 returning rating, body", [FILM]);
      assert.deepEqual(edited, { rating: 5, body: null });
      const deleted = await sql("delete from public.reviews where film_id = $1 returning id", [FILM]);
      assert.equal(deleted.length, 1);
    });
  });

  test("one review per user per film", async () => {
    await rejects(ADA, `insert into public.reviews (film_id, rating) values ('${FILM}', 4), ('${FILM}', 2)`, "23505");
    // Different users may each review the same film.
    await commitAs(ADA, `insert into public.reviews (film_id, rating, body) values ('${FILM}', 4, 'Beautifully shot.')`);
    await commitAs(BAYO, `insert into public.reviews (film_id, rating) values ('${FILM}', 3)`);
  });

  test("ratings must be whole numbers from 1 to 5 and reviews at most 2000 characters", async () => {
    await rejects(ADA, `insert into public.reviews (film_id, rating) values ('${OTHER_FILM}', 0)`, "23514");
    await rejects(ADA, `insert into public.reviews (film_id, rating) values ('${OTHER_FILM}', 6)`, "23514");
    await rejects(ADA, `insert into public.reviews (film_id, rating, body) values ('${OTHER_FILM}', 3, $1)`, "23514", ["a".repeat(2001)]);
    await rejects(ADA, `insert into public.reviews (film_id, rating, body) values ('${OTHER_FILM}', 3, '')`, "23514");
  });

  test("users cannot edit or delete someone else's review", async () => {
    const edited = await as(BAYO, (sql) => sql("update public.reviews set rating = 1 where user_id = $1 returning id", [ADA]));
    assert.equal(edited.length, 0);
    const deleted = await as(BAYO, (sql) => sql("delete from public.reviews where user_id = $1 returning id", [ADA]));
    assert.equal(deleted.length, 0);
  });

  test("users cannot move a review to another film or user", async () => {
    await rejects(ADA, `update public.reviews set film_id = '${OTHER_FILM}'`, "42501");
    await rejects(ADA, `update public.reviews set user_id = '${BAYO}'`, "42501");
    await rejects(ADA, `insert into public.reviews (user_id, film_id, rating) values ('${BAYO}', '${OTHER_FILM}', 5)`, "42501");
  });

  test("direct table reads return only the user's own reviews", async () => {
    const rows = await as(ADA, (sql) => sql("select user_id from public.reviews"));
    assert.deepEqual(rows, [{ user_id: ADA }]);
    await rejects("anon", "select * from public.reviews", "42501");
  });

  test("get_film_reviews shows every review to visitors without user ids", async () => {
    const rows = await as("anon", (sql) => sql("select * from public.get_film_reviews($1) order by rating desc", [FILM]));
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map(({ rating, body, author_name, is_own }) => ({ rating, body, author_name, is_own })),
      [
        { rating: 4, body: "Beautifully shot.", author_name: "Ada Obi", is_own: false },
        { rating: 3, body: null, author_name: "NaijaScreen viewer", is_own: false },
      ],
    );
    assert.deepEqual(Object.keys(rows[0]).sort(), ["author_name", "body", "created_at", "id", "is_own", "rating", "updated_at"]);
  });

  test("get_film_reviews flags the caller's own review", async () => {
    const rows = await as(ADA, (sql) => sql("select author_name, is_own from public.get_film_reviews($1) where is_own", [FILM]));
    assert.deepEqual(rows, [{ author_name: "Ada Obi", is_own: true }]);
  });

  test("get_film_reviews returns nothing for a film without reviews", async () => {
    const rows = await as("anon", (sql) => sql("select * from public.get_film_reviews($1)", [OTHER_FILM]));
    assert.equal(rows.length, 0);
  });

  test("the sign-up trigger function cannot be called through the API", async () => {
    await rejects(ADA, "select public.handle_new_user()", "42501");
  });
});

describe("schema safety", () => {
  test("RLS is enabled on every table in the public schema", async () => {
    const { rows } = await db.query<{ tablename: string; rowsecurity: boolean }>(
      "select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename",
    );
    assert.deepEqual(
      rows.map((row) => row.tablename),
      ["profiles", "reviews", "watched_films", "watchlist"],
    );
    for (const row of rows) assert.equal(row.rowsecurity, true, row.tablename);
  });

  test("every table has policies for the authenticated role only", async () => {
    const { rows } = await db.query<{ tablename: string; cmd: string; roles: string[] }>(
      "select tablename, cmd, roles from pg_policies where schemaname = 'public' order by tablename, cmd",
    );
    const byTable = new Map<string, string[]>();
    for (const row of rows) {
      assert.deepEqual(row.roles, ["authenticated"], `${row.tablename} ${row.cmd}`);
      byTable.set(row.tablename, [...(byTable.get(row.tablename) ?? []), row.cmd]);
    }
    assert.deepEqual(Object.fromEntries(byTable), {
      profiles: ["SELECT", "UPDATE"],
      reviews: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      watched_films: ["DELETE", "INSERT", "SELECT"],
      watchlist: ["DELETE", "INSERT", "SELECT"],
    });
  });

  test("security definer functions pin their search_path", async () => {
    const { rows } = await db.query<{ proname: string; proconfig: string[] | null }>(
      "select proname, proconfig from pg_proc where pronamespace = 'public'::regnamespace and prosecdef order by proname",
    );
    assert.deepEqual(
      rows.map((row) => row.proname),
      ["get_film_reviews", "handle_new_user"],
    );
    for (const row of rows) assert.ok(row.proconfig?.includes("search_path=\"\""), row.proname);
  });
});

describe("duplicates across separate requests", () => {
  for (const table of ["watchlist", "watched_films"] as const) {
    test(`${table}: a second add of the same film by the same user is rejected`, async () => {
      await commitAs(ADA, `insert into public.${table} (film_id) values ('film-kano-nights')`);
      await rejects(ADA, `insert into public.${table} (film_id) values ('film-kano-nights')`, "23505");
      // Another user may save the same film.
      const rows = await as(BAYO, (sql) => sql(`insert into public.${table} (film_id) values ('film-kano-nights') returning id`));
      assert.equal(rows.length, 1);
    });
  }

  test("reviews: a second review of the same film by the same user is rejected", async () => {
    await commitAs(ADA, "insert into public.reviews (film_id, rating) values ('film-kano-nights', 5)");
    await rejects(ADA, "insert into public.reviews (film_id, rating) values ('film-kano-nights', 1)", "23505");
    const [{ count }] = (
      await db.query<{ count: number }>("select count(*)::int as count from public.reviews where user_id = $1 and film_id = 'film-kano-nights'", [ADA])
    ).rows;
    assert.equal(count, 1);
  });

  test("reviews: the app's save sequence updates an existing review instead of adding one", async () => {
    // saveReview() runs: update ... where user_id and film_id; insert only when nothing was updated.
    const result = await as(ADA, async (sql) => {
      const updated = await sql(
        "update public.reviews set rating = 3, body = 'Changed my mind.' where user_id = $1 and film_id = 'film-kano-nights' returning id",
        [ADA],
      );
      const total = await sql("select rating, body from public.reviews where film_id = 'film-kano-nights'");
      return { updated: updated.length, total };
    });
    assert.deepEqual(result, { updated: 1, total: [{ rating: 3, body: "Changed my mind." }] });
  });
});

describe("cross-user isolation", () => {
  const privateTables = [
    { table: "watchlist", owner: "user_id" },
    { table: "watched_films", owner: "user_id" },
    { table: "reviews", owner: "user_id" },
    { table: "profiles", owner: "id" },
  ] as const;

  for (const { table, owner } of privateTables) {
    test(`${table}: another user's rows are invisible even when asked for directly`, async () => {
      const { rows } = await db.query<{ id: string }>(`select id from public.${table} where ${owner} = $1 limit 1`, [ADA]);
      assert.equal(rows.length, 1, `fixture: Ada should own a ${table} row`);
      const byOwner = await as(BAYO, (sql) => sql(`select * from public.${table} where ${owner} = $1`, [ADA]));
      const byId = await as(BAYO, (sql) => sql(`select * from public.${table} where id = $1`, [rows[0].id]));
      assert.equal(byOwner.length, 0);
      assert.equal(byId.length, 0);
    });

    test(`${table}: another user's rows cannot be deleted`, async () => {
      const deleted = await as(BAYO, async (sql) => {
        try {
          return (await sql(`delete from public.${table} where ${owner} = $1 returning id`, [ADA])).length;
        } catch (error) {
          // profiles has no delete grant at all.
          assert.equal((error as { code?: string }).code, "42501");
          return 0;
        }
      });
      assert.equal(deleted, 0);
      const { rows } = await db.query(`select 1 from public.${table} where ${owner} = $1`, [ADA]);
      assert.ok(rows.length > 0);
    });

    test(`${table}: visitors cannot insert, update or delete`, async () => {
      await rejects("anon", `update public.${table} set ${owner} = ${owner}`, "42501");
      await rejects("anon", `delete from public.${table}`, "42501");
    });

    test(`${table}: the authenticated role without a user id sees and changes nothing`, async () => {
      const rows = await as("no-user", (sql) => sql(`select * from public.${table}`));
      assert.equal(rows.length, 0);
      if (table !== "profiles") {
        const deleted = await as("no-user", (sql) => sql(`delete from public.${table} returning id`));
        assert.equal(deleted.length, 0);
      }
    });
  }

  test("another user's review cannot be edited, whichever column is targeted", async () => {
    const { rows } = await db.query<{ id: string }>("select id from public.reviews where user_id = $1 limit 1", [ADA]);
    const edited = await as(BAYO, (sql) => sql("update public.reviews set rating = 1, body = 'Spam' where id = $1 returning id", [rows[0].id]));
    assert.equal(edited.length, 0);
    const [{ rating }] = (await db.query<{ rating: number }>("select rating from public.reviews where id = $1", [rows[0].id])).rows;
    assert.notEqual(rating, 1);
  });

  test("users cannot insert rows on behalf of another user in any table", async () => {
    await rejects(BAYO, `insert into public.watchlist (user_id, film_id) values ('${ADA}', 'film-the-ledger')`, "42501");
    await rejects(BAYO, `insert into public.watched_films (user_id, film_id) values ('${ADA}', 'film-the-ledger')`, "42501");
    await rejects(BAYO, `insert into public.reviews (user_id, film_id, rating) values ('${ADA}', 'film-the-ledger', 5)`, "42501");
  });

  test("the authenticated role without a user id cannot insert", async () => {
    // auth.uid() is null here, so the insert policy refuses the row before the not-null check runs.
    await rejects("no-user", "insert into public.watchlist (film_id) values ('film-the-ledger')", "42501");
    await rejects("no-user", "insert into public.reviews (film_id, rating) values ('film-the-ledger', 4)", "42501");
  });

  test("visitors cannot insert into any table", async () => {
    await rejects("anon", "insert into public.watched_films (film_id) values ('film-the-ledger')", "42501");
    await rejects("anon", "insert into public.reviews (film_id, rating) values ('film-the-ledger', 4)", "42501");
    await rejects("anon", `insert into public.profiles (id, display_name) values ('${ADA}', 'x')`, "42501");
  });
});

describe("account deletion", () => {
  test("deleting an auth user removes their profile and data", async () => {
    await commitAs(BAYO, `insert into public.watchlist (film_id) values ('${FILM}')`);
    await db.query("delete from auth.users where id = $1", [BAYO]);
    for (const table of ["profiles", "watchlist", "watched_films", "reviews"]) {
      const column = table === "profiles" ? "id" : "user_id";
      const { rows } = await db.query(`select 1 from public.${table} where ${column} = $1`, [BAYO]);
      assert.equal(rows.length, 0, table);
    }
  });
});
