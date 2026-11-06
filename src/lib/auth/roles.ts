/**
 * Roles stored in public.profiles.role. New accounts are viewers; filmmaker
 * and company come only from an approved application, admin only from the SQL
 * editor.
 */
export type Role = "viewer" | "filmmaker" | "company" | "admin";

/**
 * Only the server-read profile decides this. Never pass a role from the
 * browser; the database's is_admin() policies enforce it again.
 */
export function isAdminRole(role: unknown): boolean {
  return role === "admin";
}

/** Approved for the filmmaker portal (admins included). Suspension is checked separately. */
export function isIndustryRole(role: unknown): boolean {
  return role === "filmmaker" || role === "company" || role === "admin";
}
