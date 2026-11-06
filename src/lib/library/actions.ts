"use server";

import { refresh } from "next/cache";
import type { FormState } from "../auth/formState";
import { getCurrentUser } from "../auth/session";
import { field, isCatalogueFilmId, validateReview } from "../auth/validation";
import { getFilmById } from "../catalogue";
import { createSupabaseServerClient } from "../supabase/server";

export type LibraryList = "watchlist" | "watched_films";

export type LibraryResult = { ok: true } | { ok: false; reason: "signed-out" | "invalid" | "failed" };

/**
 * Adds or removes one film from the caller's watchlist or watched list.
 * The user id comes from the verified session, never from the client, and
 * RLS limits every statement to the caller's own rows.
 */
export async function setLibraryEntry(list: LibraryList, filmId: string, included: boolean): Promise<LibraryResult> {
  if ((list !== "watchlist" && list !== "watched_films") || !isCatalogueFilmId(filmId) || typeof included !== "boolean") {
    return { ok: false, reason: "invalid" };
  }
  // Upcoming films can be saved for later but not marked as watched.
  if (list === "watched_films" && included && getFilmById(filmId)?.status === "upcoming") {
    return { ok: false, reason: "invalid" };
  }
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return { ok: false, reason: "signed-out" };

  const { error } = included
    ? // A repeated add is a no-op thanks to the (user_id, film_id) unique constraint.
      await supabase.from(list).upsert({ film_id: filmId }, { onConflict: "user_id,film_id", ignoreDuplicates: true })
    : await supabase.from(list).delete().eq("user_id", user.id).eq("film_id", filmId);

  return error ? { ok: false, reason: "failed" } : { ok: true };
}

/** Creates the caller's review for a film, or updates it if one exists. */
export async function saveReview(_prev: FormState, form: FormData): Promise<FormState> {
  const filmId = field(form, "filmId");
  const values = { rating: field(form, "rating"), body: field(form, "body") };
  if (!isCatalogueFilmId(filmId)) return { status: "error", message: "That film isn't in the catalogue." };
  if (getFilmById(filmId)?.status === "upcoming") {
    return { status: "error", message: "Reviews open once the film is released." };
  }

  const result = validateReview(form);
  if (!result.ok) return { status: "error", message: "Check the highlighted fields.", fieldErrors: result.errors, values };

  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return { status: "error", message: "Sign in to rate and review films.", values };

  const { rating, body } = result.data;
  // Update first; insert only if there is no review yet. A unique constraint
  // stops a second review even if two saves race.
  const updated = await supabase
    .from("reviews")
    .update({ rating, body })
    .eq("user_id", user.id)
    .eq("film_id", filmId)
    .select("id");

  let error = updated.error;
  if (!error && (updated.data ?? []).length === 0) {
    const inserted = await supabase.from("reviews").insert({ film_id: filmId, rating, body });
    error = inserted.error;
    if (error?.code === "23505") {
      error = (await supabase.from("reviews").update({ rating, body }).eq("user_id", user.id).eq("film_id", filmId)).error;
    }
  }
  if (error) return { status: "error", message: "Your review couldn't be saved. Please try again.", values };

  refresh();
  return { status: "success", message: "Your review is saved.", values };
}

export async function deleteReview(filmId: string): Promise<LibraryResult> {
  if (!isCatalogueFilmId(filmId)) return { ok: false, reason: "invalid" };
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return { ok: false, reason: "signed-out" };

  const { error } = await supabase.from("reviews").delete().eq("user_id", user.id).eq("film_id", filmId);
  if (error) return { ok: false, reason: "failed" };
  refresh();
  return { ok: true };
}
