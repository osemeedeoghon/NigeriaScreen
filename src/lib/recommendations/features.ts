/** Precomputes the per-film features the recommender and guest sections use. */
import { getAllFilms, getFilmActors, getFilmDirectors, getFilmGenres, getTrendingFilms } from "../catalogue.ts";
import { languageCode } from "../catalogueLanguages.ts";
import type { Film } from "../../types/index.ts";
import type { FilmFeatures } from "./types.ts";

/**
 * Editorial order: the curated trending list first, then everything else
 * newest first. Used for guests and as a tie-breaker.
 */
function editorialRanks(films: Film[]): Map<string, number> {
  const trending = getTrendingFilms().map((film) => film.id);
  const rest = films
    .filter((film) => !trending.includes(film.id))
    .sort((a, b) => b.releaseYear - a.releaseYear || a.title.localeCompare(b.title, "en"))
    .map((film) => film.id);
  return new Map([...trending, ...rest].map((id, index) => [id, index]));
}

export function buildFeatures(films: Film[] = getAllFilms()): FilmFeatures[] {
  const ranks = editorialRanks(films);
  return films.map((film) => ({
    film,
    genres: getFilmGenres(film).map(({ slug, name }) => ({ slug, name })),
    language: film.language,
    languageCode: languageCode(film.language),
    people: [
      ...getFilmDirectors(film.id).map((person) => ({ id: person.id, name: person.name, role: "director" as const })),
      ...getFilmActors(film.id).map(({ person }) => ({ id: person.id, name: person.name, role: "actor" as const })),
    ],
    editorialRank: ranks.get(film.id) ?? Number.MAX_SAFE_INTEGER,
  }));
}

let cached: FilmFeatures[] | undefined;

/** Catalogue features, built once per server process (non-personal data). */
export function getCatalogueFeatures(): FilmFeatures[] {
  cached ??= buildFeatures();
  return cached;
}
