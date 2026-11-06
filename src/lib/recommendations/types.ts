/**
 * Recommendation data shapes. The engine is pure: it receives the user's own
 * activity (already read under RLS on the server) and catalogue features, and
 * returns ranked films with the reasons behind each score.
 */
import type { Film, GenreSlug, Language } from "../../types/index.ts";

export type FeedbackKind = "dismissed" | "not_interested";

/** What one signed-in user has done. Never another user's data. */
export interface UserActivity {
  watchlist: { filmId: string; addedAt: string }[];
  watched: { filmId: string; watchedAt: string }[];
  ratings: { filmId: string; rating: number; updatedAt: string }[];
  feedback: { filmId: string; kind: FeedbackKind; updatedAt: string }[];
  preferences: DiscoveryPreferences;
}

export interface DiscoveryPreferences {
  /** ISO 639 codes from the catalogue's languages. */
  languages: string[];
  genres: GenreSlug[];
  /** When false, watched films are left out of recommendations. */
  includeWatched: boolean;
}

export const NO_PREFERENCES: DiscoveryPreferences = { languages: [], genres: [], includeWatched: false };

/** Everything the engine needs to know about one film. */
export interface FilmFeatures {
  film: Film;
  genres: { slug: GenreSlug; name: string }[];
  language: Language;
  languageCode: string;
  people: { id: string; name: string; role: "actor" | "director" }[];
  /** Position in the editorial (curated) order; lower comes first. */
  editorialRank: number;
}

export type ReasonKind =
  | "genre-language"
  | "genre"
  | "language"
  | "preferred-language"
  | "favourite-genre"
  | "person"
  | "watchlist"
  | "shares-person"
  | "new-language"
  | "popular"
  | "editorial";

export interface Reason {
  kind: ReasonKind;
  /** Contribution to the score, used to pick the strongest reason. */
  weight: number;
  text: string;
}

export interface Recommendation {
  film: Film;
  score: number;
  reasons: Reason[];
  /** The single sentence shown with the film. */
  explanation: string;
}

export type SectionId =
  | "recommended"
  | "because-you-like"
  | "based-on-watchlist"
  | "continue-exploring"
  | "discover-more"
  | "popular";

export interface RecommendationSection {
  id: SectionId;
  title: string;
  description: string;
  /** True when built from this user's activity; false for guest and editorial sections. */
  personalised: boolean;
  items: Recommendation[];
}

export interface PopularFilm {
  filmId: string;
  memberCount: number;
}

export interface RecommendationRequest {
  /** null for visitors. */
  activity: UserActivity | null;
  catalogue: FilmFeatures[];
  popular: PopularFilm[];
  /** Fixed "now" so results don't depend on when the test or request runs. */
  now: Date;
}

/**
 * Anything that can turn a request into homepage sections. The current
 * implementation is rule-based and content-based; a future model-backed
 * provider can implement the same interface (see README).
 */
export interface RecommendationProvider {
  readonly id: string;
  readonly description: string;
  recommend(request: RecommendationRequest): Promise<RecommendationSection[]>;
}
