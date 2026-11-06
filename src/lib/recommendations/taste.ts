/**
 * Turns a user's activity into a taste profile: how strongly they lean towards
 * each genre, language and person, plus which films must never be suggested.
 */
import type { FeedbackKind, FilmFeatures, UserActivity } from "./types.ts";
import { SIGNAL_WEIGHTS, TUNING } from "./weights.ts";

export type PersonSource = "rated-highly" | "watched";

export interface TasteProfile {
  /** -1..1 per genre slug. */
  genres: Map<string, number>;
  /** Number of watched or rated films with a positive signal per genre (for "Because you like…"). */
  genreSupport: Map<string, number>;
  /** Genres and languages backed by films the user watched or rated, not only saved. */
  enjoyedGenres: Set<string>;
  enjoyedLanguages: Set<string>;
  /** "drama|ha": a genre and language enjoyed together in the same film. */
  enjoyedPairs: Set<string>;
  /** -1..1 per language code. */
  languages: Map<string, number>;
  /** 0..1 per person id, from films the user liked, with the strongest source. */
  people: Map<string, { affinity: number; source: PersonSource; name: string; role: "actor" | "director" }>;
  /** Films to leave out of recommendations, and why. */
  excluded: Map<string, "watched" | "rated-poorly" | "watchlist" | FeedbackKind>;
  /** Watchlist films (features), for similarity. */
  watchlist: FilmFeatures[];
  /** Films with a positive signal, newest activity first, for "Continue exploring". */
  liked: { features: FilmFeatures; source: PersonSource }[];
  /** True when there is any activity or preference to personalise with. */
  hasSignals: boolean;
}

/** 1 - e^(-|x|/s), keeping the sign: repeated activity counts but levels off. */
export function saturate(total: number, saturation: number = TUNING.saturation): number {
  return Math.sign(total) * (1 - Math.exp(-Math.abs(total) / saturation));
}

const DAY = 24 * 60 * 60 * 1000;

export function buildTasteProfile(activity: UserActivity, catalogue: FilmFeatures[], now: Date): TasteProfile {
  const byId = new Map(catalogue.map((features) => [features.film.id, features]));

  // One signal per film: a rating beats "watched", which beats "watchlist".
  const signal = new Map<string, number>();
  const sources = new Map<string, PersonSource>();
  for (const { filmId } of activity.watchlist) signal.set(filmId, SIGNAL_WEIGHTS.watchlist);
  for (const { filmId } of activity.watched) {
    signal.set(filmId, SIGNAL_WEIGHTS.watched);
    sources.set(filmId, "watched");
  }
  for (const { filmId, rating } of activity.ratings) {
    const weight = SIGNAL_WEIGHTS.rating[rating];
    if (weight === undefined) continue;
    signal.set(filmId, weight);
    if (rating >= TUNING.highRating) sources.set(filmId, "rated-highly");
    else sources.delete(filmId);
  }
  for (const { filmId, kind } of activity.feedback) {
    if (kind === "not_interested" && !signal.has(filmId)) signal.set(filmId, SIGNAL_WEIGHTS.notInterested);
  }

  const genreTotals = new Map<string, number>();
  const genreSupport = new Map<string, number>();
  const enjoyedGenres = new Set<string>();
  const enjoyedLanguages = new Set<string>();
  const enjoyedPairs = new Set<string>();
  const languageTotals = new Map<string, number>();
  const peopleTotals = new Map<string, { total: number; source: PersonSource; name: string; role: "actor" | "director" }>();

  // Iterate in a fixed order so floating-point sums are identical every time.
  for (const [filmId, weight] of [...signal].sort(([a], [b]) => a.localeCompare(b))) {
    const features = byId.get(filmId);
    if (!features) continue;
    // A film with three genres spreads its weight rather than tripling it.
    const perGenre = weight / Math.max(features.genres.length, 1);
    const source = sources.get(filmId);
    const enjoyed = weight > 0 && source !== undefined;
    for (const { slug } of features.genres) {
      genreTotals.set(slug, (genreTotals.get(slug) ?? 0) + perGenre);
      if (enjoyed) {
        genreSupport.set(slug, (genreSupport.get(slug) ?? 0) + 1);
        enjoyedGenres.add(slug);
        enjoyedPairs.add(`${slug}|${features.languageCode}`);
      }
    }
    languageTotals.set(features.languageCode, (languageTotals.get(features.languageCode) ?? 0) + weight);
    if (enjoyed) enjoyedLanguages.add(features.languageCode);

    if (weight > 0 && source) {
      const personWeight = source === "rated-highly" ? weight : weight * 0.5;
      for (const person of features.people) {
        const current = peopleTotals.get(person.id);
        peopleTotals.set(person.id, {
          total: (current?.total ?? 0) + personWeight,
          source: current?.source === "rated-highly" || source === "rated-highly" ? "rated-highly" : "watched",
          name: person.name,
          role: current?.role === "director" ? "director" : person.role,
        });
      }
    }
  }

  const excluded: TasteProfile["excluded"] = new Map();
  for (const { filmId } of activity.watchlist) excluded.set(filmId, "watchlist");
  if (!activity.preferences.includeWatched) {
    for (const { filmId } of activity.watched) excluded.set(filmId, "watched");
    for (const { filmId } of activity.ratings) excluded.set(filmId, "watched");
  }
  for (const { filmId, rating } of activity.ratings) if (rating <= TUNING.poorRating) excluded.set(filmId, "rated-poorly");
  for (const { filmId, kind, updatedAt } of activity.feedback) {
    if (kind === "not_interested") excluded.set(filmId, "not_interested");
    else if (now.getTime() - new Date(updatedAt).getTime() < TUNING.dismissDays * DAY) excluded.set(filmId, "dismissed");
  }

  const watchedOrder = new Map(activity.watched.map(({ filmId, watchedAt }) => [filmId, watchedAt]));
  for (const { filmId, updatedAt } of activity.ratings) if (!watchedOrder.has(filmId)) watchedOrder.set(filmId, updatedAt);
  const liked = [...sources]
    .filter(([filmId]) => (signal.get(filmId) ?? 0) > 0 && byId.has(filmId))
    .map(([filmId, source]) => ({ features: byId.get(filmId)!, source, at: watchedOrder.get(filmId) ?? "" }))
    .sort((a, b) => b.at.localeCompare(a.at) || a.features.film.id.localeCompare(b.features.film.id))
    .map(({ features, source }) => ({ features, source }));

  const map = (totals: Map<string, number>) => new Map([...totals].map(([key, total]) => [key, saturate(total)]));
  const prefs = activity.preferences;

  return {
    genres: map(genreTotals),
    genreSupport,
    enjoyedGenres,
    enjoyedLanguages,
    enjoyedPairs,
    languages: map(languageTotals),
    people: new Map(
      [...peopleTotals].map(([id, value]) => [id, { affinity: saturate(value.total), source: value.source, name: value.name, role: value.role }]),
    ),
    excluded,
    watchlist: activity.watchlist
      .map(({ filmId }) => byId.get(filmId))
      .filter((features): features is FilmFeatures => features !== undefined),
    liked,
    hasSignals: signal.size > 0 || prefs.languages.length > 0 || prefs.genres.length > 0,
  };
}
