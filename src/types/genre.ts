import type { GenreArtwork } from "./artwork";

export type GenreSlug =
  | "drama"
  | "romance"
  | "comedy"
  | "thriller"
  | "action"
  | "family"
  | "historical"
  | "crime";

export interface Genre {
  /** Stable identifier, e.g. "genre-drama". */
  id: string;
  name: string;
  slug: GenreSlug;
  description: string;
  artwork: GenreArtwork;
}
