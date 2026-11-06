/**
 * Where-to-watch and trailer records. They live in Supabase
 * (supabase/migrations/20261106120000_stage5_where_to_watch.sql), not in the
 * local catalogue, and are linked to films by the catalogue's stable film id.
 */

export const ACCESS_TYPES = ["subscription", "free", "free_with_ads", "rental", "purchase", "other"] as const;
export type AccessType = (typeof ACCESS_TYPES)[number];

export const VERIFICATION_STATUSES = ["pending", "verified", "rejected", "expired"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const TRAILER_PROVIDERS = ["youtube", "vimeo"] as const;
export type TrailerProvider = (typeof TRAILER_PROVIDERS)[number];

export interface ViewingProvider {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string;
  logoUrl: string | null;
  description: string | null;
  isActive: boolean;
}

/** A link to a film on an authorised platform. Only active, verified ones are shown as confirmed. */
export interface FilmViewingOption {
  id: string;
  filmId: string;
  provider: Pick<ViewingProvider, "id" | "name" | "slug" | "logoUrl" | "isActive">;
  destinationUrl: string;
  accessType: AccessType;
  /** ISO 3166-1 alpha-2 codes where this option has been verified. */
  countries: string[];
  /** ISO 639 codes. Empty means not recorded. */
  audioLanguages: string[];
  subtitleLanguages: string[];
  availabilityNotes: string | null;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  isActive: boolean;
}

export interface FilmTrailer {
  id: string;
  filmId: string;
  title: string;
  videoProvider: TrailerProvider;
  videoId: string;
  videoUrl: string;
  embeddable: boolean;
  thumbnailUrl: string | null;
  publishedOn: string | null;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  isActive: boolean;
}
