/**
 * Data-integrity checks for the catalogue. Pure functions over plain arrays so
 * they work on the local dataset today and on database exports later.
 */
import type { FilmCredit, FilmRecord, Genre, Person } from "@/types";

export const MIN_RELEASE_YEAR = 1960;
export const MAX_RELEASE_YEAR = 2030;
export const MIN_RUNTIME_MINUTES = 40;
export const MAX_RUNTIME_MINUTES = 240;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Film ids are stored in Supabase (watchlists, reviews); the database checks the same format. */
const FILM_ID_PATTERN = /^film-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface CatalogueInput {
  films: FilmRecord[];
  genres: Genre[];
  people: Person[];
  credits: FilmCredit[];
  trendingFilmIds?: string[];
  featuredPersonIds?: string[];
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

const isBlank = (value: unknown) => typeof value !== "string" || value.trim() === "";

/** Returns a list of human-readable problems. An empty list means the catalogue is valid. */
export function validateCatalogue(input: CatalogueInput): string[] {
  const { films, genres, people, credits, trendingFilmIds = [], featuredPersonIds = [] } = input;
  const issues: string[] = [];

  const filmIds = new Set(films.map((f) => f.id));
  const genreIds = new Set(genres.map((g) => g.id));
  const peopleById = new Map(people.map((p) => [p.id, p]));

  // Uniqueness
  for (const id of findDuplicates(films.map((f) => f.id))) issues.push(`Duplicate film id: ${id}`);
  for (const slug of findDuplicates(films.map((f) => f.slug))) issues.push(`Duplicate film slug: ${slug}`);
  for (const id of findDuplicates(genres.map((g) => g.id))) issues.push(`Duplicate genre id: ${id}`);
  for (const slug of findDuplicates(genres.map((g) => g.slug))) issues.push(`Duplicate genre slug: ${slug}`);
  for (const id of findDuplicates(people.map((p) => p.id))) issues.push(`Duplicate person id: ${id}`);
  for (const key of findDuplicates(credits.map((c) => `${c.filmId}|${c.personId}|${c.role}`))) {
    issues.push(`Duplicate credit: ${key}`);
  }

  // Films
  for (const film of films) {
    const label = `Film ${film.id || "(missing id)"}`;
    for (const field of ["id", "slug", "title", "synopsis", "language", "country", "ageRating", "status", "createdAt"] as const) {
      if (isBlank(film[field])) issues.push(`${label}: missing required field "${field}"`);
    }
    if (!isBlank(film.slug) && !SLUG_PATTERN.test(film.slug)) issues.push(`${label}: invalid slug "${film.slug}"`);
    if (!isBlank(film.id) && !FILM_ID_PATTERN.test(film.id)) issues.push(`${label}: invalid id format`);
    // Published films use id = "film-" + slug, so catalogue films must too, or the two could collide.
    if (!isBlank(film.id) && !isBlank(film.slug) && film.id !== `film-${film.slug}`) issues.push(`${label}: id must be "film-${film.slug}"`);
    if (!Number.isInteger(film.releaseYear) || film.releaseYear < MIN_RELEASE_YEAR || film.releaseYear > MAX_RELEASE_YEAR) {
      issues.push(`${label}: invalid release year ${film.releaseYear}`);
    }
    if (
      !Number.isInteger(film.runtimeMinutes) ||
      film.runtimeMinutes < MIN_RUNTIME_MINUTES ||
      film.runtimeMinutes > MAX_RUNTIME_MINUTES
    ) {
      issues.push(`${label}: invalid runtime ${film.runtimeMinutes}`);
    }
    if (!isBlank(film.createdAt) && Number.isNaN(Date.parse(film.createdAt))) {
      issues.push(`${label}: invalid createdAt "${film.createdAt}"`);
    }
    if (!film.artwork) issues.push(`${label}: missing required field "artwork"`);
    if (!Array.isArray(film.genreIds) || film.genreIds.length === 0) {
      issues.push(`${label}: must have at least one genre`);
    } else {
      for (const genreId of film.genreIds) {
        if (!genreIds.has(genreId)) issues.push(`${label}: unknown genre reference ${genreId}`);
      }
    }

    const filmCredits = credits.filter((c) => c.filmId === film.id);
    if (!filmCredits.some((c) => c.role === "director")) issues.push(`${label}: has no director`);
    if (!filmCredits.some((c) => c.role === "actor")) issues.push(`${label}: has no actors`);
  }

  // Genres and people
  for (const genre of genres) {
    for (const field of ["id", "name", "slug", "description"] as const) {
      if (isBlank(genre[field])) issues.push(`Genre ${genre.id || "(missing id)"}: missing required field "${field}"`);
    }
  }
  for (const person of people) {
    for (const field of ["id", "name", "biography", "profession", "nationality"] as const) {
      if (isBlank(person[field])) issues.push(`Person ${person.id || "(missing id)"}: missing required field "${field}"`);
    }
  }

  // Credits
  for (const credit of credits) {
    const label = `Credit ${credit.filmId} → ${credit.personId}`;
    if (!filmIds.has(credit.filmId)) issues.push(`${label}: unknown film reference ${credit.filmId}`);
    const person = peopleById.get(credit.personId);
    if (!person) {
      issues.push(`${label}: unknown ${credit.role} reference ${credit.personId}`);
      continue;
    }
    if (credit.role === "actor" && person.profession === "director") {
      issues.push(`${label}: credited as actor but profession is director`);
    }
    if (credit.role === "director" && person.profession === "actor") {
      issues.push(`${label}: credited as director but profession is actor`);
    }
    if (credit.role === "actor" && isBlank(credit.characterName)) {
      issues.push(`${label}: actor credit is missing a character name`);
    }
  }

  // Curated collections
  for (const id of trendingFilmIds) if (!filmIds.has(id)) issues.push(`Trending list: unknown film ${id}`);
  for (const id of featuredPersonIds) if (!peopleById.has(id)) issues.push(`Featured people: unknown person ${id}`);

  return issues;
}
