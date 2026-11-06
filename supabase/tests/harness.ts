/**
 * Shared PGlite setup for the database tests. Loads the real migration files
 * into an in-memory Postgres with a stand-in for the parts of Supabase they
 * depend on, and runs statements as the `anon` or `authenticated` role.
 *
 * This is plain Postgres, not Supabase: see "Database tests and their limits"
 * in the README for what still needs a live check.
 */
import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

export const MIGRATIONS = {
  stage4: "20261105120000_stage4_accounts.sql",
  stage5: "20261106120000_stage5_where_to_watch.sql",
  stage6: "20261107120000_stage6_recommendations.sql",
  stage7: "20261108120000_stage7_industry.sql",
  stage8: "20261109120000_stage8_hardening.sql",
} as const;

// The pieces of a Supabase database that the migrations depend on.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Supabase grants everything on new public objects to both API roles; the migrations must revoke.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

/** A user id, a visitor, or the authenticated role with no user id in the token. */
export type Who = string | "anon" | "no-user";
type Sql = (query: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

export async function createTestDatabase(migrations: (keyof typeof MIGRATIONS)[]) {
  const db = await PGlite.create();
  await db.exec(SUPABASE_STUB);
  for (const name of migrations) {
    await db.exec(readFileSync(new URL(`../migrations/${MIGRATIONS[name]}`, import.meta.url), "utf8"));
  }

  async function become(tx: { query: PGlite["query"] }, who: Who) {
    if (who === "anon") {
      await tx.query("set local role anon");
    } else {
      await tx.query("set local role authenticated");
      if (who !== "no-user") await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [who]);
    }
  }

  /** Runs queries as an API role inside a transaction that is always rolled back. */
  async function as<T>(who: Who, run: (sql: Sql) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      await become(tx, who);
      const result = await run(async (query, params) => (await tx.query<Record<string, unknown>>(query, params)).rows);
      await tx.rollback();
      return result;
    });
  }

  /** Like `as`, but keeps the changes. */
  async function commitAs<T = Record<string, unknown>>(who: Who, query: string, params?: unknown[]): Promise<T[]> {
    return db.transaction(async (tx) => {
      await become(tx, who);
      return (await tx.query<T>(query, params)).rows;
    });
  }

  /** Asserts that a statement fails with the given Postgres error code. */
  async function rejects(who: Who, query: string, code: string, params?: unknown[]) {
    await assert.rejects(
      as(who, (sql) => sql(query, params)),
      (error: { code?: string }) => {
        assert.equal(error.code, code, `expected ${code} for: ${query}`);
        return true;
      },
    );
  }

  return { db, as, commitAs, rejects };
}
