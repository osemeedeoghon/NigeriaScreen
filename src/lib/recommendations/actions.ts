"use server";

import { refresh } from "next/cache";
import type { FormState } from "../auth/formState";
import { getCurrentUser } from "../auth/session";
import { isCatalogueFilmId } from "../auth/validation";
import { createSupabaseServerClient } from "../supabase/server";
import { validatePreferences } from "./preferences";
import type { FeedbackKind } from "./types";

export type FeedbackResult = { ok: true } | { ok: false; reason: "signed-out" | "invalid" | "failed" };

/**
 * Records "hide" or "not interested" for one film. The user comes from the
 * verified session and RLS limits the row to them; no user id is accepted.
 */
export async function recordFeedback(filmId: string, kind: FeedbackKind): Promise<FeedbackResult> {
  if (!isCatalogueFilmId(filmId) || (kind !== "dismissed" && kind !== "not_interested")) return { ok: false, reason: "invalid" };
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return { ok: false, reason: "signed-out" };

  const updated = await supabase.from("recommendation_feedback").update({ kind }).eq("user_id", user.id).eq("film_id", filmId).select("id");
  if (updated.error) return { ok: false, reason: "failed" };
  if (updated.data.length === 0) {
    const inserted = await supabase.from("recommendation_feedback").insert({ film_id: filmId, kind });
    if (inserted.error && inserted.error.code !== "23505") return { ok: false, reason: "failed" };
  }
  return { ok: true };
}

/** Undo: the film can be recommended again. */
export async function clearFeedback(filmId: string): Promise<FeedbackResult> {
  if (!isCatalogueFilmId(filmId)) return { ok: false, reason: "invalid" };
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return { ok: false, reason: "signed-out" };
  const { error } = await supabase.from("recommendation_feedback").delete().eq("user_id", user.id).eq("film_id", filmId);
  if (error) return { ok: false, reason: "failed" };
  refresh();
  return { ok: true };
}

/** "Refresh recommendations": re-renders the page so new activity and feedback are applied. */
export async function refreshRecommendations(): Promise<void> {
  refresh();
}

export async function updateDiscoveryPreferences(_prev: FormState, form: FormData): Promise<FormState> {
  const result = validatePreferences(form);
  if (!result.ok) return { status: "error", message: "Check the highlighted fields.", fieldErrors: result.errors };

  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return { status: "error", message: "Your session has ended. Sign in again to save preferences." };

  const { languages, genres, includeWatched } = result.data;
  const { error } = await supabase
    .from("profiles")
    .update({ preferred_languages: languages, favourite_genres: genres, include_watched: includeWatched })
    .eq("id", user.id);
  if (error) return { status: "error", message: "Your preferences couldn't be saved. Please try again." };

  refresh();
  return { status: "success", message: "Preferences saved. Your recommendations now use them." };
}
