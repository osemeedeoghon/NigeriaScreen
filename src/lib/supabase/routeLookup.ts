import type { DatabaseRoute } from "../routes.ts";
import { createPublicSupabaseClient } from "./public.ts";

/**
 * Whether a public record exists for a database-backed route. Uses only the
 * anonymous, public functions and tables. On a network error it answers true,
 * leaving the page to render its own not-found state rather than hiding a
 * real record behind a 404.
 */
export async function publicRecordExists(route: DatabaseRoute): Promise<boolean> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return false;
  try {
    const signal = AbortSignal.timeout(2500);
    if (route.kind === "film") {
      const { data, error } = await supabase.from("published_films").select("id").eq("slug", route.slug).eq("is_active", true).abortSignal(signal).maybeSingle();
      return error ? true : data !== null;
    }
    const { data, error } =
      route.kind === "filmmaker"
        ? await supabase.rpc("get_public_filmmakers", { p_slug: route.slug }).abortSignal(signal)
        : await supabase.rpc("get_public_companies", { p_slug: route.slug }).abortSignal(signal);
    return error ? true : (data?.length ?? 0) > 0;
  } catch {
    return true;
  }
}
