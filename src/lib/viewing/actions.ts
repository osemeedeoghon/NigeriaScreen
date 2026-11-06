"use server";

import { refresh } from "next/cache";
import { adminClientForAction } from "../auth/admin";
import type { FormState } from "../auth/formState";
import { field } from "../auth/validation";
import type { VerificationStatus } from "@/types/viewing";
import { isVerificationStatus, validateProvider, validateTrailer, validateViewingOption } from "./validation";

/**
 * Admin-only writes for providers, viewing options and trailers. Each action
 * re-checks the admin role on the server; RLS (is_admin()) enforces it again
 * in the database, so a forged request from a viewer changes nothing.
 */

export type AdminResult = { ok: true; message: string } | { ok: false; message: string };

const NOT_ALLOWED = "You need administrator access to do that. Sign in again with an admin account.";
const FAILED = "That didn't save. Please try again.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export async function saveProvider(_prev: FormState, form: FormData): Promise<FormState> {
  const values = Object.fromEntries(["name", "slug", "websiteUrl", "logoUrl", "description"].map((name) => [name, field(form, name)]));
  const id = field(form, "id");
  if (id && !isUuid(id)) return { status: "error", message: "That provider doesn't exist.", values };

  const result = validateProvider(form);
  if (!result.ok) return { status: "error", message: "Check the highlighted fields.", fieldErrors: result.errors, values };

  const supabase = await adminClientForAction();
  if (!supabase) return { status: "error", message: NOT_ALLOWED, values };

  const { name, slug, websiteUrl, logoUrl, description } = result.data;
  const row = { name, slug, website_url: websiteUrl, logo_url: logoUrl, description };
  const { error } = id
    ? await supabase.from("viewing_providers").update(row).eq("id", id)
    : await supabase.from("viewing_providers").insert(row);

  if (error?.code === "23505") {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: { name: "A provider with this name or slug already exists." },
      values,
    };
  }
  if (error) return { status: "error", message: FAILED, values };

  refresh();
  return { status: "success", message: id ? `${name} updated.` : `${name} added.`, values: id ? values : undefined };
}

export async function setProviderActive(id: string, active: boolean): Promise<AdminResult> {
  if (!isUuid(id) || typeof active !== "boolean") return { ok: false, message: "That provider doesn't exist." };
  const supabase = await adminClientForAction();
  if (!supabase) return { ok: false, message: NOT_ALLOWED };
  const { data, error } = await supabase.from("viewing_providers").update({ is_active: active }).eq("id", id).select("name");
  if (error || !data?.length) return { ok: false, message: FAILED };
  refresh();
  return {
    ok: true,
    message: active ? `${data[0].name} is active again.` : `${data[0].name} is deactivated. Its links are hidden from viewers.`,
  };
}

// ---------------------------------------------------------------------------
// Viewing options
// ---------------------------------------------------------------------------

const OPTION_FIELDS = ["providerId", "destinationUrl", "accessType", "countries", "audioLanguages", "subtitleLanguages", "availabilityNotes"];

/**
 * Adds a viewing option as pending, or edits one. Editing always returns the
 * option to pending so the changed link is checked again before viewers see it.
 */
export async function saveViewingOption(_prev: FormState, form: FormData): Promise<FormState> {
  const values = Object.fromEntries(OPTION_FIELDS.map((name) => [name, field(form, name)]));
  const id = field(form, "id");
  if (id && !isUuid(id)) return { status: "error", message: "That viewing option doesn't exist.", values };

  const supabase = await adminClientForAction();
  if (!supabase) return { status: "error", message: NOT_ALLOWED, values };

  const filmId = field(form, "filmId");
  const [providers, existing] = await Promise.all([
    supabase.from("viewing_providers").select("id"),
    supabase.from("film_viewing_options").select("id, provider_id, access_type, destination_url").eq("film_id", filmId),
  ]);
  if (providers.error || existing.error) return { status: "error", message: FAILED, values };

  const result = validateViewingOption(form, {
    providerIds: new Set(providers.data.map((row) => row.id)),
    existing: existing.data.map((row) => ({
      id: row.id,
      providerId: row.provider_id,
      accessType: row.access_type,
      destinationUrl: row.destination_url,
    })),
    editingId: id || undefined,
  });
  if (!result.ok) return { status: "error", message: "Check the highlighted fields.", fieldErrors: result.errors, values };

  const input = result.data;
  const row = {
    provider_id: input.providerId,
    destination_url: input.destinationUrl,
    access_type: input.accessType,
    countries: input.countries,
    audio_languages: input.audioLanguages,
    subtitle_languages: input.subtitleLanguages,
    availability_notes: input.availabilityNotes,
  };
  const { error } = id
    ? await supabase
        .from("film_viewing_options")
        .update({ ...row, verification_status: "pending" })
        .eq("id", id)
        .eq("film_id", input.filmId)
    : await supabase.from("film_viewing_options").insert({ ...row, film_id: input.filmId });

  if (error?.code === "23505") {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: { destinationUrl: "This film already has this link for the same provider and access type." },
      values,
    };
  }
  if (error) return { status: "error", message: FAILED, values };

  refresh();
  return {
    status: "success",
    message: id
      ? "Changes saved. The option is back to pending until you verify it again."
      : "Viewing option saved as pending. Verify it once you've checked the official source.",
    values: id ? values : undefined,
  };
}

const STATUS_MESSAGES: Record<VerificationStatus, string> = {
  verified: "Verified. Viewers can now see this option.",
  rejected: "Rejected. It won't be shown to viewers.",
  expired: "Marked as expired and hidden from viewers.",
  pending: "Moved back to pending and hidden from viewers.",
};

async function setStatus(table: "film_viewing_options" | "film_trailers", id: string, status: string): Promise<AdminResult> {
  if (!isUuid(id) || !isVerificationStatus(status)) return { ok: false, message: "That record doesn't exist." };
  const supabase = await adminClientForAction();
  if (!supabase) return { ok: false, message: NOT_ALLOWED };
  // The database stamps verified_at and last_checked_at.
  const { data, error } = await supabase.from(table).update({ verification_status: status }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, message: FAILED };
  refresh();
  return { ok: true, message: STATUS_MESSAGES[status] };
}

async function setActive(table: "film_viewing_options" | "film_trailers", id: string, active: boolean): Promise<AdminResult> {
  if (!isUuid(id) || typeof active !== "boolean") return { ok: false, message: "That record doesn't exist." };
  const supabase = await adminClientForAction();
  if (!supabase) return { ok: false, message: NOT_ALLOWED };
  const { data, error } = await supabase.from(table).update({ is_active: active }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, message: FAILED };
  refresh();
  return { ok: true, message: active ? "Reactivated." : "Deactivated and hidden from viewers." };
}

export async function setViewingOptionStatus(id: string, status: VerificationStatus) {
  return setStatus("film_viewing_options", id, status);
}

export async function setViewingOptionActive(id: string, active: boolean) {
  return setActive("film_viewing_options", id, active);
}

// ---------------------------------------------------------------------------
// Trailers
// ---------------------------------------------------------------------------

export async function saveTrailer(_prev: FormState, form: FormData): Promise<FormState> {
  const values = Object.fromEntries(["title", "videoUrl", "thumbnailUrl", "publishedOn", "embeddable"].map((name) => [name, field(form, name)]));
  const id = field(form, "id");
  if (id && !isUuid(id)) return { status: "error", message: "That trailer doesn't exist.", values };

  const result = validateTrailer(form);
  if (!result.ok) return { status: "error", message: "Check the highlighted fields.", fieldErrors: result.errors, values };

  const supabase = await adminClientForAction();
  if (!supabase) return { status: "error", message: NOT_ALLOWED, values };

  const { filmId, title, video, embeddable, thumbnailUrl, publishedOn } = result.data;
  const { error } = id
    ? // The video itself can't be swapped on an existing record; add a new trailer instead.
      await supabase
        .from("film_trailers")
        .update({ title, embeddable, thumbnail_url: thumbnailUrl, published_on: publishedOn, verification_status: "pending" })
        .eq("id", id)
        .eq("film_id", filmId)
    : await supabase.from("film_trailers").insert({
        film_id: filmId,
        title,
        video_provider: video.provider,
        video_id: video.videoId,
        video_url: video.canonicalUrl,
        embeddable,
        thumbnail_url: thumbnailUrl,
        published_on: publishedOn,
      });

  if (error?.code === "23505") {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors: { videoUrl: "This video is already listed for this film." }, values };
  }
  if (error) return { status: "error", message: FAILED, values };

  refresh();
  return {
    status: "success",
    message: id ? "Trailer updated and back to pending." : "Trailer saved as pending. Approve it once you've confirmed it's an official upload.",
    values: id ? values : undefined,
  };
}

export async function setTrailerStatus(id: string, status: VerificationStatus) {
  return setStatus("film_trailers", id, status);
}

export async function setTrailerActive(id: string, active: boolean) {
  return setActive("film_trailers", id, active);
}
