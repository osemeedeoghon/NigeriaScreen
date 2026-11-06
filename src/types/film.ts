import type { PosterArtwork } from "./artwork";

/** Nigerian (NFVCB-style) age classifications. */
export type AgeRating = "G" | "PG" | "12" | "12A" | "15" | "18";

export type Language = "English" | "Yoruba" | "Igbo" | "Hausa" | "Nigerian Pidgin" | "Efik" | "Ijaw";

export type FilmStatus = "released" | "upcoming";

export interface Film {
  /** Stable identifier, e.g. "film-harmattan-letters". */
  id: string;
  /** URL segment for /films/[slug]. */
  slug: string;
  title: string;
  synopsis: string;
  releaseYear: number;
  runtimeMinutes: number;
  ageRating: AgeRating;
  /** Primary spoken language. */
  language: Language;
  country: string;
  genreIds: string[];
  /** Derived from credits by the catalogue. */
  actorIds: string[];
  /** Derived from credits by the catalogue. */
  directorIds: string[];
  artwork: PosterArtwork;
  status: FilmStatus;
  featured: boolean;
  /** ISO 8601 date the record was added to the catalogue. */
  createdAt: string;
  /** Marks every record as invented sample content. */
  isFictional: true;
}

/** Shape authored in `src/data/films.ts`; people are attached via credits. */
export type FilmRecord = Omit<Film, "actorIds" | "directorIds">;
