import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "../supabase/server";
import { loginHref } from "./paths.ts";

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Reads the signed-in user from the verified Supabase session. Returns null
 * for visitors or when Supabase is not configured. Reads cookies, so callers
 * must sit inside a <Suspense> boundary. Cached for the length of one request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

/** For account pages: returns the user and a client, or redirects to sign in. */
export async function requireUser(next: string) {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  if (!supabase || !user) redirect(loginHref(next));
  return { supabase, user };
}
