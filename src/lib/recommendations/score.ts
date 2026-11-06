/**
 * Scores candidate films against a taste profile. Each component is in -1..1,
 * multiplied by its weight, and recorded as a Reason so the explanation shown
 * to the user always comes from a real, measured match.
 */
import type { FilmFeatures, Reason, Recommendation, UserActivity } from "./types.ts";
import type { TasteProfile } from "./taste.ts";
import { SCORE_WEIGHTS, TUNING } from "./weights.ts";

/** "Yoruba dramas", "Hausa crime films". */
const GENRE_PLURALS: Record<string, string> = {
  drama: "dramas",
  romance: "romances",
  comedy: "comedies",
  thriller: "thrillers",
  action: "action films",
  family: "family films",
  historical: "historical films",
  crime: "crime films",
};

export const genrePlural = (slug: string, name: string) => GENRE_PLURALS[slug] ?? `${name.toLowerCase()} films`;

/** Similarity of two films: shared genres (Jaccard) plus a little for the same language. */
export function filmSimilarity(a: FilmFeatures, b: FilmFeatures): number {
  const left = new Set(a.genres.map((genre) => genre.slug));
  const right = new Set(b.genres.map((genre) => genre.slug));
  const shared = [...left].filter((slug) => right.has(slug)).length;
  const union = new Set([...left, ...right]).size || 1;
  return Math.min(1, (shared / union) * 0.8 + (a.languageCode === b.languageCode ? 0.2 : 0));
}

export interface ScoredFilm extends Recommendation {
  /** Component values before weighting, for sections that rank by one component. */
  components: { genre: number; language: number; people: number; watchlist: number; favouriteGenre: number; preferredLanguage: number };
  /** Most similar watchlist film, if any. */
  closestWatchlistFilm?: FilmFeatures;
}

export function scoreFilm(candidate: FilmFeatures, taste: TasteProfile, activity: UserActivity): ScoredFilm {
  const reasons: Reason[] = [];
  const prefs = activity.preferences;

  // Genres: average of the film's genre affinities, nudged towards its best one.
  const affinities = candidate.genres.map((genre) => ({ genre, value: taste.genres.get(genre.slug) ?? 0 }));
  const best = affinities.reduce<(typeof affinities)[number] | undefined>(
    (top, item) => (!top || item.value > top.value || (item.value === top.value && item.genre.slug < top.genre.slug) ? item : top),
    undefined,
  );
  const mean = affinities.length ? affinities.reduce((sum, item) => sum + item.value, 0) / affinities.length : 0;
  const genre = best ? (best.value + mean) / 2 : 0;

  const language = taste.languages.get(candidate.languageCode) ?? 0;

  let topPerson: { name: string; role: "actor" | "director"; source: string; affinity: number } | undefined;
  for (const person of candidate.people) {
    const match = taste.people.get(person.id);
    if (match && (!topPerson || match.affinity > topPerson.affinity)) topPerson = { ...match, name: person.name, role: person.role };
  }
  const people = topPerson?.affinity ?? 0;

  let watchlist = 0;
  let closestWatchlistFilm: FilmFeatures | undefined;
  for (const saved of taste.watchlist) {
    if (saved.film.id === candidate.film.id) continue;
    const similarity = filmSimilarity(candidate, saved);
    if (similarity > watchlist) {
      watchlist = similarity;
      closestWatchlistFilm = saved;
    }
  }

  const favourite = candidate.genres.find((g) => (prefs.genres as readonly string[]).includes(g.slug));
  const favouriteGenre = favourite ? 1 : 0;
  const preferredLanguage = prefs.languages.includes(candidate.languageCode) ? 1 : 0;

  const weighted = {
    genre: genre * SCORE_WEIGHTS.genre,
    language: language * SCORE_WEIGHTS.language,
    people: people * SCORE_WEIGHTS.people,
    watchlist: watchlist * SCORE_WEIGHTS.watchlist,
    favouriteGenre: favouriteGenre * SCORE_WEIGHTS.favouriteGenre,
    preferredLanguage: preferredLanguage * SCORE_WEIGHTS.preferredLanguage,
  };

  // Reasons only for components that actually matched.
  // Wording follows the evidence: "enjoy" needs watched or rated films; saved-only signals say "on your watchlist".
  if (best && best.value > 0 && weighted.genre > 0) {
    const plural = genrePlural(best.genre.slug, best.genre.name);
    const enjoyedGenre = taste.enjoyedGenres.has(best.genre.slug);
    // "Hausa dramas" only when the user enjoyed a Hausa drama, not a Hausa comedy and an English drama.
    const enjoyedPair = taste.enjoyedPairs.has(`${best.genre.slug}|${candidate.languageCode}`);
    if (enjoyedPair && language > 0.3) {
      reasons.push({ kind: "genre-language", weight: weighted.genre + weighted.language, text: `Because you enjoy ${candidate.language} ${plural}` });
    } else {
      reasons.push({ kind: "genre", weight: weighted.genre, text: enjoyedGenre ? `Because you enjoy ${plural}` : `Like the ${plural} on your watchlist` });
    }
  }
  if (language > 0 && weighted.language > 0 && !reasons.some((r) => r.kind === "genre-language")) {
    const text = taste.enjoyedLanguages.has(candidate.languageCode)
      ? `In ${candidate.language}, like films you've enjoyed`
      : `In ${candidate.language}, like films on your watchlist`;
    reasons.push({ kind: "language", weight: weighted.language, text });
  }
  if (topPerson && people > 0) {
    const what = topPerson.role === "director" ? `Directed by ${topPerson.name}` : `Features ${topPerson.name}`;
    const from = topPerson.source === "rated-highly" ? "from films you rated highly" : "from films you've watched";
    reasons.push({ kind: "person", weight: weighted.people, text: `${what}, ${from}` });
  }
  if (watchlist > 0 && closestWatchlistFilm) {
    reasons.push({ kind: "watchlist", weight: weighted.watchlist, text: "Similar genres to films in your watchlist" });
  }
  if (favourite) {
    reasons.push({ kind: "favourite-genre", weight: weighted.favouriteGenre, text: `One of your favourite genres: ${favourite.name}` });
  }
  if (preferredLanguage) {
    reasons.push({ kind: "preferred-language", weight: weighted.preferredLanguage, text: `Matches your preferred language, ${candidate.language}` });
  }

  reasons.sort((a, b) => b.weight - a.weight || a.kind.localeCompare(b.kind));
  const score = Object.values(weighted).reduce((sum, value) => sum + value, 0);

  return {
    film: candidate.film,
    score: round(score),
    reasons,
    explanation: reasons[0]?.text ?? "",
    components: { genre, language, people, watchlist, favouriteGenre, preferredLanguage },
    closestWatchlistFilm,
  };
}

/** Deterministic order: score, then editorial rank, then newer, then title, then id. */
export function compareScored(a: ScoredFilm & { editorialRank: number }, b: ScoredFilm & { editorialRank: number }): number {
  return (
    b.score - a.score ||
    a.editorialRank - b.editorialRank ||
    b.film.releaseYear - a.film.releaseYear ||
    a.film.title.localeCompare(b.film.title, "en") ||
    a.film.id.localeCompare(b.film.id)
  );
}

/** Scores every film that may be recommended and drops weak or unexplainable matches. */
export function rankCandidates(catalogue: FilmFeatures[], taste: TasteProfile, activity: UserActivity) {
  return catalogue
    .filter((features) => !taste.excluded.has(features.film.id))
    .map((features) => ({ ...scoreFilm(features, taste, activity), editorialRank: features.editorialRank, features }))
    .filter((item) => item.score >= TUNING.minScore && (item.reasons[0]?.weight ?? 0) >= TUNING.minReasonWeight)
    .sort(compareScored);
}

const round = (value: number) => Math.round(value * 1000) / 1000;
