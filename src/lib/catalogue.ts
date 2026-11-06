/**
 * Catalogue access layer. UI code reads data only through these functions, so
 * the local arrays in `src/data/` can later be swapped for Supabase queries
 * without touching components.
 *
 * Value imports use relative `.ts` paths so Node's built-in test runner can
 * load this module directly.
 */
import type { CreditRole, EditorialStory, Film, Genre, GenreSlug, Person } from "@/types";
import { featuredPersonIds, trendingFilmIds } from "../data/collections.ts";
import { credits } from "../data/credits.ts";
import { editorialStories } from "../data/editorial.ts";
import { filmRecords } from "../data/films.ts";
import { genres } from "../data/genres.ts";
import { people } from "../data/people.ts";

export interface CastMember {
  person: Person;
  characterName?: string;
}

const personIdsFor = (filmId: string, role: CreditRole): string[] => [
  ...new Set(credits.filter((c) => c.filmId === filmId && c.role === role).map((c) => c.personId)),
];

const films: Film[] = filmRecords.map((record) => ({
  ...record,
  actorIds: personIdsFor(record.id, "actor"),
  directorIds: personIdsFor(record.id, "director"),
}));

const filmsById = new Map(films.map((film) => [film.id, film]));
const filmsBySlug = new Map(films.map((film) => [film.slug, film]));
const genresById = new Map(genres.map((genre) => [genre.id, genre]));
const peopleById = new Map(people.map((person) => [person.id, person]));

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

// Films

export function getAllFilms(): Film[] {
  return films;
}

export function getFilmById(id: string): Film | undefined {
  return filmsById.get(id);
}

export function getFilmBySlug(slug: string): Film | undefined {
  return filmsBySlug.get(slug);
}

export function getAllFilmSlugs(): string[] {
  return films.map((film) => film.slug);
}

/** Films flagged `featured`, falling back to the first film so the spotlight is never empty. */
export function getFeaturedFilms(): Film[] {
  const featured = films.filter((film) => film.featured);
  return featured.length > 0 ? featured : films.slice(0, 1);
}

/** Curated trending order. Unknown IDs are skipped. */
export function getTrendingFilms(): Film[] {
  return trendingFilmIds.map(getFilmById).filter(isDefined);
}

// Genres

export function getAllGenres(): Genre[] {
  return genres;
}

export function getGenreById(id: string): Genre | undefined {
  return genresById.get(id);
}

export function getGenreBySlug(slug: string): Genre | undefined {
  return genres.find((genre) => genre.slug === slug);
}

/** Films tagged with a genre. Returns an empty list for an unknown genre ID. */
export function getFilmsByGenre(genreId: string): Film[] {
  return films.filter((film) => film.genreIds.includes(genreId));
}

/** A film's genres, skipping any ID that does not resolve. */
export function getFilmGenres(film: Film): Genre[] {
  return film.genreIds.map(getGenreById).filter(isDefined);
}

/** Genre slugs for a film, used by the homepage genre filter. */
export function getFilmGenreSlugs(film: Film): GenreSlug[] {
  return getFilmGenres(film).map((genre) => genre.slug);
}

// People

export function getAllPeople(): Person[] {
  return people;
}

export function getPersonById(id: string): Person | undefined {
  return peopleById.get(id);
}

/** Curated featured personalities. Unknown IDs are skipped. */
export function getFeaturedPeople(): Person[] {
  return featuredPersonIds.map(getPersonById).filter(isDefined);
}

/** A film's cast with character names. Returns an empty list for an unknown film. */
export function getFilmActors(filmId: string): CastMember[] {
  return credits
    .filter((credit) => credit.filmId === filmId && credit.role === "actor")
    .map((credit) => {
      const person = getPersonById(credit.personId);
      return person ? { person, characterName: credit.characterName } : undefined;
    })
    .filter(isDefined);
}

/** A film's directors. Returns an empty list for an unknown film. */
export function getFilmDirectors(filmId: string): Person[] {
  return (getFilmById(filmId)?.directorIds ?? []).map(getPersonById).filter(isDefined);
}

/** Every film a person is credited on, in any role, newest first. */
export function getFilmsByPerson(personId: string): Film[] {
  const filmIds = new Set(credits.filter((c) => c.personId === personId).map((c) => c.filmId));
  return films.filter((film) => filmIds.has(film.id)).sort((a, b) => b.releaseYear - a.releaseYear);
}

// Editorial

export function getEditorialStories(): EditorialStory[] {
  return editorialStories;
}
