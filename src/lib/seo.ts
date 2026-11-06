/**
 * Search indexing is off unless NEXT_PUBLIC_ALLOW_INDEXING is "true". This
 * keeps local, staging and the fictional sample catalogue out of search
 * engines until the real catalogue launches.
 */
export function indexingAllowed(): boolean {
  return process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";
}

/** Paths that must never be indexed (private or transactional). */
export const PRIVATE_PATHS = ["/account", "/admin", "/filmmaker", "/auth", "/login", "/signup", "/forgot-password"];

export const NO_INDEX = { index: false, follow: false } as const;
