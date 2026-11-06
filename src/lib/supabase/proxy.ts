import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { isGuestOnlyPath, isProtectedPath } from "../auth/paths.ts";
import { AUTH_COOKIE_OPTIONS, getSupabaseConfig } from "./config.ts";

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * between account and sign-in pages. This is a convenience for routing only:
 * pages, Server Actions and RLS each check the user again.
 */
export async function updateSession(request: NextRequest) {
  const config = getSupabaseConfig();
  // Without Supabase the account pages render a setup notice instead.
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(config.url, config.key, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Do not run code between creating the client and getClaims(): it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!signedIn && isProtectedPath(pathname)) {
    return redirectKeepingCookies(request, response, "/login", { next: pathname + search });
  }
  if (signedIn && isGuestOnlyPath(pathname)) {
    return redirectKeepingCookies(request, response, "/account");
  }
  return response;
}

function redirectKeepingCookies(
  request: NextRequest,
  from: NextResponse,
  pathname: string,
  params: Record<string, string> = {},
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = new URLSearchParams(params).toString();
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
