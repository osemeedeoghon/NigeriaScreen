import "server-only";
import { cacheLife } from "next/cache";
import { getCurrentUser } from "../auth/session";
import { getAllGenres, getFilmById } from "../catalogue";
import { getOwnProfile } from "../library/queries";
import { createPublicSupabaseClient } from "../supabase/public";
import { createSupabaseServerClient } from "../supabase/server";
import type { GenreSlug } from "@/types";
import { getCatalogueFeatures } from "./features";
import { getRecommendationProvider } from "./provider";
import { TUNING } from "./weights";
import type { DiscoveryPreferences, FeedbackKind, PopularFilm, RecommendationSection, UserActivity } from "./types";

/**
 * Reads the signed-in user's own activity with their session, so RLS limits
 * every query to their rows. Four small queries selecting film ids only; the
 * user id never comes from the client. Returns null for visitors.
 */
export async function getOwnActivity(): Promise<UserActivity | null> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return null;

  const [profile, watchlist, watched, reviews, feedback] = await Promise.all([
    getOwnProfile(user.id),
    supabase.from("watchlist").select("film_id, added_at").order("added_at", { ascending: false }).limit(500),
    supabase.from("watched_films").select("film_id, watched_at").order("watched_at", { ascending: false }).limit(500),
    supabase.from("reviews").select("film_id, rating, updated_at").eq("user_id", user.id).limit(500),
    supabase.from("recommendation_feedback").select("film_id, kind, updated_at").limit(500),
  ]);

  return {
    watchlist: (watchlist.data ?? []).map((row) => ({ filmId: row.film_id, addedAt: row.added_at })),
    watched: (watched.data ?? []).map((row) => ({ filmId: row.film_id, watchedAt: row.watched_at })),
    ratings: (reviews.data ?? []).map((row) => ({ filmId: row.film_id, rating: row.rating, updatedAt: row.updated_at })),
    feedback: (feedback.data ?? []).map((row) => ({ filmId: row.film_id, kind: row.kind as FeedbackKind, updatedAt: row.updated_at })),
    preferences: preferencesFrom(profile),
  };
}

export function preferencesFrom(
  profile: { preferred_languages?: string[]; favourite_genres?: string[]; include_watched?: boolean } | null,
): DiscoveryPreferences {
  const genres = new Set<string>(getAllGenres().map((genre) => genre.slug));
  return {
    languages: profile?.preferred_languages ?? [],
    genres: (profile?.favourite_genres ?? []).filter((slug) => genres.has(slug)) as GenreSlug[],
    includeWatched: profile?.include_watched ?? false,
  };
}

/**
 * Anonymous popularity counts. Cached and shared between all users, which is
 * safe because it uses a cookie-less client and the database function returns
 * counts only, for films with at least three distinct members.
 */
export async function getPopularFilms(): Promise<PopularFilm[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("get_popular_films", { p_limit: 12 });
    if (error || !data) return [];
    return data.filter((row) => getFilmById(row.film_id)).map((row) => ({ filmId: row.film_id, memberCount: row.member_count }));
  } catch {
    return [];
  }
}

export interface HomeRecommendations {
  signedIn: boolean;
  /** Signed in, but no activity or preferences to personalise with yet. */
  needsActivity: boolean;
  sections: RecommendationSection[];
}

/**
 * Homepage sections for whoever is asking. Personalised results are computed
 * per request on the server and never cached; only the popularity counts are.
 */
export async function getHomeRecommendations(): Promise<HomeRecommendations> {
  const [activity, popular] = await Promise.all([getOwnActivity(), getPopularFilms()]);
  const provider = getRecommendationProvider();
  const catalogue = getCatalogueFeatures();
  if (!activity) {
    return { signedIn: false, needsActivity: false, sections: await provider.recommend({ activity: null, catalogue, popular, now: new Date(0) }) };
  }
  const sections = await provider.recommend({ activity, catalogue, popular, now: new Date() });
  const hasSignals =
    activity.watchlist.length + activity.watched.length + activity.ratings.length + activity.feedback.length > 0 ||
    activity.preferences.languages.length + activity.preferences.genres.length > 0;
  return { signedIn: true, needsActivity: !hasSignals, sections };
}

/**
 * Films the user has hidden, for the preferences page. `hiddenUntil` is when
 * a "hide" stops applying (null for "not interested" or an expired hide).
 */
export async function getOwnFeedback() {
  const supabase = await createSupabaseServerClient();
  if (!supabase || !(await getCurrentUser())) return null;
  const { data, error } = await supabase.from("recommendation_feedback").select("film_id, kind, updated_at").order("updated_at", { ascending: false });
  if (error) return null;
  const now = Date.now();
  return data.flatMap((row) => {
    const film = getFilmById(row.film_id);
    if (!film) return [];
    const until = new Date(row.updated_at).getTime() + TUNING.dismissDays * 86_400_000;
    return [{ film, kind: row.kind as FeedbackKind, hiddenUntil: row.kind === "dismissed" && until > now ? new Date(until) : null }];
  });
}
