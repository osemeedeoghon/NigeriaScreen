import "server-only";
import { createSupabaseServerClient } from "../supabase/server";
import type { Database } from "@/types/database";
import type { FilmTrailer, FilmViewingOption, ViewingProvider } from "@/types/viewing";
import { confirmedOptions } from "./availability";

type Tables = Database["public"]["Tables"];
type ProviderRow = Tables["viewing_providers"]["Row"];
// created_by is not readable by API roles (stage 8), so it is never selected.
type TrailerRow = Omit<Tables["film_trailers"]["Row"], "created_by">;
type OptionRow = Omit<Tables["film_viewing_options"]["Row"], "created_by"> & {
  provider: Pick<ProviderRow, "id" | "name" | "slug" | "logo_url" | "is_active"> | null;
};

const OPTION_COLUMNS =
  "id, film_id, provider_id, destination_url, access_type, countries, audio_languages, subtitle_languages, availability_notes, verification_status, verified_at, last_checked_at, is_active, created_at, updated_at, provider:viewing_providers(id, name, slug, logo_url, is_active)";

const TRAILER_COLUMNS =
  "id, film_id, title, video_provider, video_id, video_url, embeddable, thumbnail_url, published_on, verification_status, verified_at, last_checked_at, is_active, created_at, updated_at";

export function toProvider(row: ProviderRow): ViewingProvider {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    websiteUrl: row.website_url,
    logoUrl: row.logo_url,
    description: row.description,
    isActive: row.is_active,
  };
}

function toOption(row: OptionRow): FilmViewingOption {
  return {
    id: row.id,
    filmId: row.film_id,
    // A provider hidden by RLS (inactive) is treated as inactive.
    provider: row.provider
      ? { id: row.provider.id, name: row.provider.name, slug: row.provider.slug, logoUrl: row.provider.logo_url, isActive: row.provider.is_active }
      : { id: row.provider_id, name: "Unavailable provider", slug: "", logoUrl: null, isActive: false },
    destinationUrl: row.destination_url,
    accessType: row.access_type,
    countries: row.countries,
    audioLanguages: row.audio_languages,
    subtitleLanguages: row.subtitle_languages,
    availabilityNotes: row.availability_notes,
    verificationStatus: row.verification_status,
    verifiedAt: row.verified_at,
    lastCheckedAt: row.last_checked_at,
    isActive: row.is_active,
  };
}

function toTrailer(row: TrailerRow): FilmTrailer {
  return {
    id: row.id,
    filmId: row.film_id,
    title: row.title,
    videoProvider: row.video_provider,
    videoId: row.video_id,
    videoUrl: row.video_url,
    embeddable: row.embeddable,
    thumbnailUrl: row.thumbnail_url,
    publishedOn: row.published_on,
    verificationStatus: row.verification_status,
    verifiedAt: row.verified_at,
    lastCheckedAt: row.last_checked_at,
    isActive: row.is_active,
  };
}

export type FilmViewing =
  | { status: "not-configured" }
  | { status: "error" }
  | { status: "ok"; options: FilmViewingOption[]; trailers: FilmTrailer[] };

/**
 * Confirmed viewing options and approved trailers for the public film page.
 * RLS already limits visitors to verified, active records; the filters here
 * make sure an administrator browsing the public page sees the same thing.
 */
export async function getFilmViewing(filmId: string): Promise<FilmViewing> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "not-configured" };

  const [options, trailers] = await Promise.all([
    supabase
      .from("film_viewing_options")
      .select(OPTION_COLUMNS)
      .eq("film_id", filmId)
      .eq("is_active", true)
      .eq("verification_status", "verified")
      .returns<OptionRow[]>(),
    supabase
      .from("film_trailers")
      .select(TRAILER_COLUMNS)
      .eq("film_id", filmId)
      .eq("is_active", true)
      .eq("verification_status", "verified")
      .order("published_on", { ascending: false, nullsFirst: false }),
  ]);
  if (options.error || trailers.error) return { status: "error" };

  return {
    status: "ok",
    options: confirmedOptions((options.data ?? []).map(toOption)),
    trailers: (trailers.data ?? []).map(toTrailer),
  };
}

// ---------------------------------------------------------------------------
// Admin reads. RLS returns every row only to administrators.
// ---------------------------------------------------------------------------

export async function listProviders(): Promise<ViewingProvider[] | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("viewing_providers").select("*").order("name");
  return error ? null : data.map(toProvider);
}

export async function listFilmOptionsForAdmin(filmId: string): Promise<FilmViewingOption[] | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("film_viewing_options")
    .select(OPTION_COLUMNS)
    .eq("film_id", filmId)
    .order("created_at", { ascending: false })
    .returns<OptionRow[]>();
  return error ? null : data.map(toOption);
}

export async function listFilmTrailersForAdmin(filmId: string): Promise<FilmTrailer[] | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("film_trailers")
    .select(TRAILER_COLUMNS)
    .eq("film_id", filmId)
    .order("created_at", { ascending: false });
  return error ? null : data.map(toTrailer);
}

/** Recently changed options across all films, newest first, for the admin overview. */
export async function listRecentOptionsForAdmin(limit = 20): Promise<FilmViewingOption[] | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("film_viewing_options")
    .select(OPTION_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(limit)
    .returns<OptionRow[]>();
  return error ? null : data.map(toOption);
}

/** Number of viewing options (any status) per film id, for the admin film finder. */
export async function countOptionsByFilm(): Promise<Map<string, number> | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("film_viewing_options").select("film_id");
  if (error) return null;
  const counts = new Map<string, number>();
  for (const row of data) counts.set(row.film_id, (counts.get(row.film_id) ?? 0) + 1);
  return counts;
}
