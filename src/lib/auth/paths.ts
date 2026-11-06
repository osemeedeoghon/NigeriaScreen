/** Routes that need a signed-in user. Admin pages also check the role on the server. */
export function isProtectedPath(pathname: string): boolean {
  return ["/account", "/admin", "/filmmaker"].some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

/** Sign-in pages that a signed-in user is sent past. */
export function isGuestOnlyPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password";
}

/**
 * Returns a same-site path to continue to after signing in, or the fallback.
 * Rejects absolute URLs, protocol-relative URLs and backslash tricks so the
 * `next` parameter cannot become an open redirect.
 */
export function safeNextPath(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string") return fallback;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  if (path.length > 300 || /[\u0000-\u001f]/.test(path)) return fallback;
  if (isGuestOnlyPath(path.split(/[?#]/)[0])) return fallback;
  return path;
}

/** `/login?next=…` for a page the visitor wants to come back to. */
export function loginHref(next?: string): string {
  const path = safeNextPath(next, "");
  return path ? `/login?next=${encodeURIComponent(path)}` : "/login";
}

export function signupHref(next?: string): string {
  const path = safeNextPath(next, "");
  return path ? `/signup?next=${encodeURIComponent(path)}` : "/signup";
}
