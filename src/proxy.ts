import { NextResponse, type NextRequest } from "next/server";
import { databaseRoute, isKnownCatalogueRoute } from "@/lib/routes";
import { updateSession } from "@/lib/supabase/proxy";
import { publicRecordExists } from "@/lib/supabase/routeLookup";

/**
 * Runs before every page request.
 *
 * 1. Returns a real 404 status for unknown film and genre slugs. With Cache
 *    Components, dynamic routes stream a prerendered shell for slugs outside
 *    generateStaticParams, so a page's own notFound() can only render the
 *    not-found UI with a 200 status. Checking here runs before rendering.
 *    Films outside the catalogue, filmmaker profiles and companies are
 *    looked up in Supabase (public data only) for the same reason.
 * 2. Refreshes the Supabase session cookie and routes between account and
 *    sign-in pages.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Rewriting to a route that does not exist renders app/not-found.tsx with a 404.
  const notFound = () => NextResponse.rewrite(new URL("/catalogue-not-found", request.url));

  const record = databaseRoute(pathname);
  if (record) {
    // Films listed from approved submissions, filmmaker profiles and companies live in Supabase.
    if (!(await publicRecordExists(record))) return notFound();
  } else if (!isKnownCatalogueRoute(pathname) || /^\/(filmmakers|companies)\/[^/]+\/?$/.test(pathname)) {
    // Unknown catalogue slugs, and profile addresses that can't be valid.
    return notFound();
  }
  return updateSession(request);
}

export const config = {
  // Everything except build assets and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
