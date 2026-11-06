import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { getLibrarySnapshot, getOwnProfile } from "@/lib/library/queries";
import { LibrarySync } from "../library/LibraryProvider";
import AccountMenu from "./AccountMenu";

/** Navbar account area. Reads the session, so it streams in behind a Suspense boundary. */
export default async function AccountNav({ variant }: { variant: "desktop" | "mobile" }) {
  const user = await getCurrentUser();
  const profile = user ? await getOwnProfile(user.id) : null;
  const name = user ? (profile?.display_name ?? "Your account") : null;
  return <AccountMenu name={name} isAdmin={isAdminRole(profile?.role)} variant={variant} />;
}

/** Hands the signed-in user's saved film ids to the client-side library state. */
export async function LibraryLoader() {
  return <LibrarySync snapshot={await getLibrarySnapshot()} />;
}
