import "server-only";
import { cache } from "react";
import { getCurrentUser } from "../auth/session";
import { getFilmById } from "../catalogue";
import { createSupabaseServerClient } from "../supabase/server";
import type { Film } from "@/types";
import type { Database } from "@/types/database";

export interface LibrarySnapshot {
  userId: string;
  watchlist: string[];
  watched: string[];
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type FilmReview = Database["public"]["Functions"]["get_film_reviews"]["Returns"][number];

/** The caller's watchlist and watched film ids, or null for visitors. */
export async function getLibrarySnapshot(): Promise<LibrarySnapshot | null> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return null;

  const [watchlist, watched] = await Promise.all([
    supabase.from("watchlist").select("film_id"),
    supabase.from("watched_films").select("film_id"),
  ]);
  return {
    userId: user.id,
    watchlist: (watchlist.data ?? []).map((row) => row.film_id),
    watched: (watched.data ?? []).map((row) => row.film_id),
  };
}

/** Cached for one request: the navbar and account page both ask for it. */
export const getOwnProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data;
});

export interface SavedFilm {
  film: Film;
  savedAt: string;
}

/**
 * The caller's saved films, newest first, matched to catalogue records.
 * Ids no longer in the catalogue are skipped rather than shown broken.
 */
export async function getSavedFilms(list: "watchlist" | "watched_films"): Promise<SavedFilm[] | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const rows =
    list === "watchlist"
      ? (await supabase.from("watchlist").select("film_id, added_at").order("added_at", { ascending: false })).data?.map(
          (row) => ({ filmId: row.film_id, savedAt: row.added_at }),
        )
      : (await supabase.from("watched_films").select("film_id, watched_at").order("watched_at", { ascending: false })).data?.map(
          (row) => ({ filmId: row.film_id, savedAt: row.watched_at }),
        );
  if (!rows) return null;

  return rows.flatMap(({ filmId, savedAt }) => {
    const film = getFilmById(filmId);
    return film ? [{ film, savedAt }] : [];
  });
}

export async function getAccountCounts() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const count = async (table: "watchlist" | "watched_films" | "reviews") =>
    (await supabase.from(table).select("id", { count: "exact", head: true })).count ?? 0;
  const [watchlist, watched, reviews] = await Promise.all([count("watchlist"), count("watched_films"), count("reviews")]);
  return { watchlist, watched, reviews };
}

/** Public reviews for one film. Returns null when reviews can't be loaded. */
export async function getFilmReviews(filmId: string): Promise<FilmReview[] | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_film_reviews", { p_film_id: filmId });
  return error ? null : data;
}
