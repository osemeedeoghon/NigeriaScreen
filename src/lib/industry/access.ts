import "server-only";
import { redirect } from "next/navigation";
import { isAdminRole, isIndustryRole } from "../auth/roles";
import { requireUser } from "../auth/session";
import { getOwnProfile } from "../library/queries";

/**
 * The signed-in user's portal standing, read from their own profile on the
 * server. Convenience for pages only; RLS and the guard triggers enforce it.
 */
export async function getPortalAccess(next: string) {
  const { supabase, user } = await requireUser(next);
  const profile = await getOwnProfile(user.id);
  const suspended = Boolean(profile?.suspended_at);
  return {
    supabase,
    user,
    profile,
    role: profile?.role ?? "viewer",
    suspended,
    isMember: isIndustryRole(profile?.role) && !suspended,
    isAdmin: isAdminRole(profile?.role),
  };
}

/** For pages only approved, unsuspended members may use: others go to onboarding. */
export async function requirePortalMember(next: string) {
  const access = await getPortalAccess(next);
  if (!access.isMember) redirect("/filmmaker/onboarding");
  return access;
}
