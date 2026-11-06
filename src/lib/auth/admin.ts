import "server-only";
import { notFound, redirect } from "next/navigation";
import { getOwnProfile } from "../library/queries";
import { createSupabaseServerClient } from "../supabase/server";
import { loginHref } from "./paths.ts";
import { isAdminRole } from "./roles.ts";
import { getCurrentUser } from "./session";

/** True when the signed-in user's profile has the admin role. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return isAdminRole((await getOwnProfile(user.id))?.role);
}

/**
 * For admin pages: visitors are sent to sign in, and signed-in viewers get a
 * 404 so the admin area isn't advertised. RLS still enforces every write.
 */
export async function requireAdmin(next: string) {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  if (!supabase || !user) redirect(loginHref(next));
  if (!(await isCurrentUserAdmin())) notFound();
  return { supabase, user };
}

/** For admin Server Actions: returns a client only when the caller is an admin. */
export async function adminClientForAction() {
  const supabase = await createSupabaseServerClient();
  if (!supabase || !(await isCurrentUserAdmin())) return null;
  return supabase;
}
