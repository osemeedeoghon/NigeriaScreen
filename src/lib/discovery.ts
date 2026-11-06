/**
 * Film discovery: search, filters, sorting and URL state.
 *
 * Pure functions over the catalogue, shared by the /films page, the homepage
 * search box and the tests. Nothing here mutates catalogue arrays.
 */
import type { AgeRating, Film, FilmStatus, GenreSlug, Language } from "@/types";
import {
  getAllFilms,
  getAllGenres,
  getFilmActors,
  getFilmDirectors,
  getFilmGenres,
  getFilmGenreSlugs,
} from "./catalogue.ts";
import { rankByRelevance, suggestTitles } from "./searchRelevance.ts";

// Text matching

/** Lower-cases, strips accents and collapses whitespace: "  Ọmọ  ỌBA " → "omo oba". */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

let searchIndex: Map<string, string> | undefined;

/** Searchable text per film ID, built once on first use. */
function getSearchIndex(): Map<string, string> {
  searchIndex ??= new Map(
    getAllFilms().map((film) => {
      const fields = [
        film.title,
        film.synopsis,
        film.language,
        ...getFilmGenres(film).map((genre) => genre.name),
        ...getFilmActors(film.id).map((member) => member.person.name),
        ...getFilmDirectors(film.id).map((person) => person.name),
      ];
      return [film.id, normalizeText(fields.join(" | "))];
    }),
  );
  return searchIndex;
}

/**
 * Films whose title, synopsis, genre, language, cast or director contain every
 * word of the query. An empty or whitespace-only query returns the input unchanged.
 */
export function searchFilms(films: Film[], query: string): Film[] {
  const terms = normalizeText(query).split(" ").filter(Boolean);
  if (terms.length === 0) return films;
  const index = getSearchIndex();
  return films.filter((film) => {
    const haystack = index.get(film.id) ?? "";
    return terms.every((term) => haystack.includes(term));
  });
}

// Filters and sorting

export const SORT_OPTIONS = [
  // With a search, ranks by relevance; without one, falls back to newest first.
  { value: "relevance", label: "Best match" },
  { value: "newest", label: "Newest release first" },
  { value: "oldest", label: "Oldest release first" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
  { value: "shortest", label: "Shortest runtime first" },
  { value: "longest", label: "Longest runtime first" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];
export const DEFAULT_SORT: SortOption = "relevance";

export interface DiscoveryState {
  query: string;
  /** Any selected genre matches (OR). Empty means all genres. */
  genres: GenreSlug[];
  language: Language | null;
  year: number | null;
  rating: AgeRating | null;
  status: FilmStatus | null;
  sort: SortOption;
}

export const EMPTY_STATE: DiscoveryState = {
  query: "",
  genres: [],
  language: null,
  year: null,
  rating: null,
  status: null,
  sort: DEFAULT_SORT,
};

/** Applies every active structured filter. Different filters combine with AND. */
export function filterFilms(films: Film[], state: Omit<DiscoveryState, "query" | "sort">): Film[] {
  return films.filter((film) => {
    if (state.genres.length > 0) {
      const slugs = getFilmGenreSlugs(film);
      if (!state.genres.some((genre) => slugs.includes(genre))) return false;
    }
    if (state.language && film.language !== state.language) return false;
    if (state.year && film.releaseYear !== state.year) return false;
    if (state.rating && film.ageRating !== state.rating) return false;
    if (state.status && film.status !== state.status) return false;
    return true;
  });
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const byTitle = (a: Film, b: Film) => collator.compare(a.title, b.title);

const newestFirst = (a: Film, b: Film) => b.releaseYear - a.releaseYear || byTitle(a, b);

const comparators: Record<SortOption, (a: Film, b: Film) => number> = {
  relevance: newestFirst,
  newest: newestFirst,
  oldest: (a, b) => a.releaseYear - b.releaseYear || byTitle(a, b),
  "title-asc": byTitle,
  "title-desc": (a, b) => byTitle(b, a),
  shortest: (a, b) => a.runtimeMinutes - b.runtimeMinutes || byTitle(a, b),
  longest: (a, b) => b.runtimeMinutes - a.runtimeMinutes || byTitle(a, b),
};

/**
 * Returns a new sorted array; the input is left untouched. "relevance" ranks
 * by match quality when there is a query, and is newest-first otherwise.
 */
export function sortFilms(films: readonly Film[], sort: SortOption, query = ""): Film[] {
  if (sort === "relevance" && query.trim()) return rankByRelevance(films, query);
  return [...films].sort(comparators[sort]);
}

/** Search, then filter, then sort. */
export function discoverFilms(state: DiscoveryState, films: Film[] = getAllFilms()): Film[] {
  return sortFilms(filterFilms(searchFilms(films, state.query), state), state.sort, state.query);
}

export interface NoResultHints {
  /** Films matching the search alone, when filters are what ruled everything out. */
  matchesWithoutFilters: number;
  /** Close titles, for likely typos. */
  similarTitles: Film[];
}

/** Help for the empty state: is it the filters, or a typo? */
export function noResultHints(state: DiscoveryState, films: Film[] = getAllFilms()): NoResultHints {
  const query = state.query.trim();
  const matchesWithoutFilters = query && countActiveFilters(state) > 0 ? searchFilms(films, query).length : 0;
  return { matchesWithoutFilters, similarTitles: query ? suggestTitles(query, films) : [] };
}

export function countActiveFilters(state: DiscoveryState): number {
  return (
    state.genres.length +
    [state.language, state.year, state.rating, state.status].filter((value) => value !== null).length
  );
}

export const isDefaultState = (state: DiscoveryState): boolean =>
  state.query.trim() === "" && countActiveFilters(state) === 0 && state.sort === DEFAULT_SORT;

// Filter options, derived from the catalogue

const RATING_ORDER: AgeRating[] = ["G", "PG", "12", "12A", "15", "18"];

export interface DiscoveryOptions {
  genres: { slug: GenreSlug; name: string }[];
  languages: Language[];
  years: number[];
  ratings: AgeRating[];
  statuses: FilmStatus[];
}

let discoveryOptions: DiscoveryOptions | undefined;

/** Only values that actually occur in the catalogue are offered. */
export function getDiscoveryOptions(): DiscoveryOptions {
  if (discoveryOptions) return discoveryOptions;
  const films = getAllFilms();
  const used = <T>(values: T[]) => [...new Set(values)];
  const usedGenreIds = new Set(films.flatMap((film) => film.genreIds));
  const usedRatings = new Set(films.map((film) => film.ageRating));

  discoveryOptions = {
    genres: getAllGenres()
      .filter((genre) => usedGenreIds.has(genre.id))
      .map(({ slug, name }) => ({ slug, name })),
    languages: used(films.map((film) => film.language)).sort(collator.compare),
    years: used(films.map((film) => film.releaseYear)).sort((a, b) => b - a),
    ratings: RATING_ORDER.filter((rating) => usedRatings.has(rating)),
    statuses: used(films.map((film) => film.status)).sort(),
  };
  return discoveryOptions;
}

// URL state

const MAX_QUERY_LENGTH = 100;

/** Minimal read-only interface shared by URLSearchParams and Next's ReadonlyURLSearchParams. */
export interface SearchParamsLike {
  get(name: string): string | null;
  getAll(name: string): string[];
}

/**
 * Reads discovery state from query parameters. Unknown or malformed values are
 * dropped rather than trusted, so any URL produces a valid state.
 */
export function parseDiscoveryParams(params: SearchParamsLike): DiscoveryState {
  const options = getDiscoveryOptions();
  const pick = <T extends string | number>(raw: string | null, allowed: readonly T[]): T | null => {
    if (raw === null) return null;
    const wanted = normalizeText(raw);
    return allowed.find((value) => normalizeText(String(value)) === wanted) ?? null;
  };

  const genreSlugs = options.genres.map((genre) => genre.slug);
  const genres = [
    ...new Set(
      params
        .getAll("genre")
        .flatMap((value) => value.split(","))
        .map((value) => pick(value, genreSlugs))
        .filter((value): value is GenreSlug => value !== null),
    ),
  ];
  const sort = pick(params.get("sort"), SORT_OPTIONS.map((option) => option.value)) ?? DEFAULT_SORT;

  return {
    query: (params.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH),
    genres,
    language: pick(params.get("language"), options.languages),
    year: pick(params.get("year"), options.years),
    rating: pick(params.get("rating"), options.ratings),
    status: pick(params.get("status"), options.statuses),
    sort,
  };
}

/** Writes state as a canonical query string, omitting defaults. "" means no parameters. */
export function serializeDiscoveryState(state: DiscoveryState): string {
  const params = new URLSearchParams();
  const query = state.query.replace(/\s+/g, " ").trim();
  if (query) params.set("q", query);
  for (const genre of state.genres) params.append("genre", genre);
  if (state.language) params.set("language", state.language);
  if (state.year) params.set("year", String(state.year));
  if (state.rating) params.set("rating", state.rating);
  if (state.status) params.set("status", state.status);
  if (state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
  return params.toString();
}

/** `/films` link for a given state, e.g. `/films?q=love&genre=drama`. */
export function discoveryHref(state: Partial<DiscoveryState>): string {
  const query = serializeDiscoveryState({ ...EMPTY_STATE, ...state });
  return query ? `/films?${query}` : "/films";
}
