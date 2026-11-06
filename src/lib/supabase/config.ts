/**
 * Public Supabase settings. Both values are safe in the browser: the
 * publishable (or legacy anon) key only grants what Row Level Security allows.
 * The service-role key is never used by this app.
 *
 * `process.env.NEXT_PUBLIC_*` must be written out in full so Next can inline it.
 */
export interface SupabaseConfig {
  url: string;
  key: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/**
 * Auth cookie settings. The browser never reads the session (every Supabase
 * call runs on the server), so the cookies can be httpOnly, and they are
 * Secure in production builds.
 */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/** Public base URL used for metadata, sitemaps and auth email links. */
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** False until `.env.local` is filled in; account features show a setup notice instead. */
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}
