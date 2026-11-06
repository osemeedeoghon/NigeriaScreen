/**
 * Relevance ranking for catalogue search. A film must still contain every
 * query word somewhere (see discovery.searchFilms); this decides the order:
 * exact title, then title prefix and phrase, then people, genre, language and
 * finally synopsis words. Pure and deterministic.
 */
import { getAllFilms, getFilmActors, getFilmDirectors, getFilmGenres } from "./catalogue.ts";
import type { Film } from "../types/index.ts";

export const RELEVANCE_WEIGHTS = {
  exactTitle: 100,
  titlePrefix: 60,
  titlePhrase: 45,
  /** Per query word found as a whole word in the title. */
  titleWord: 12,
  /** Per query word that starts a title word ("kan" in "Kano"). */
  titleWordPrefix: 8,
  /** Query equals or contains a full actor or director name. */
  personName: 30,
  /** Per query word matching a word of a cast or director name. */
  personWord: 6,
  genre: 5,
  language: 5,
  /** Per query word found in the synopsis. */
  synopsisWord: 2,
} as const;

interface Fields {
  title: string;
  titleWords: string[];
  people: string[];
  peopleWords: string[];
  genres: string[];
  language: string;
  synopsisWords: Set<string>;
}

/** Lower-cases, strips accents and punctuation, collapses whitespace. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/['-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const words = (text: string) => normalizeSearchText(text).split(" ").filter(Boolean);

let index: Map<string, Fields> | undefined;

function fieldsFor(film: Film): Fields {
  index ??= new Map(
    getAllFilms().map((f) => {
      const people = [...getFilmActors(f.id).map((m) => m.person.name), ...getFilmDirectors(f.id).map((p) => p.name)].map(normalizeSearchText);
      return [
        f.id,
        {
          title: normalizeSearchText(f.title),
          titleWords: words(f.title),
          people,
          peopleWords: people.flatMap((name) => name.split(" ")),
          genres: getFilmGenres(f).map((genre) => normalizeSearchText(genre.name)),
          language: normalizeSearchText(f.language),
          synopsisWords: new Set(words(f.synopsis)),
        },
      ];
    }),
  );
  return (
    index.get(film.id) ?? {
      title: normalizeSearchText(film.title),
      titleWords: words(film.title),
      people: [],
      peopleWords: [],
      genres: [],
      language: normalizeSearchText(film.language),
      synopsisWords: new Set(words(film.synopsis)),
    }
  );
}

/** Relevance of one film to a query; 0 means no measurable match. */
export function relevanceScore(film: Film, query: string): number {
  const q = normalizeSearchText(query);
  if (!q) return 0;
  const terms = q.split(" ");
  const f = fieldsFor(film);
  const w = RELEVANCE_WEIGHTS;
  let score = 0;

  if (f.title === q) score += w.exactTitle;
  else if (f.title.startsWith(`${q} `) || f.title.startsWith(q)) score += w.titlePrefix;
  else if (` ${f.title} `.includes(` ${q} `)) score += w.titlePhrase;

  for (const term of terms) {
    if (f.titleWords.includes(term)) score += w.titleWord;
    else if (f.titleWords.some((word) => word.startsWith(term))) score += w.titleWordPrefix;
    if (f.peopleWords.includes(term)) score += w.personWord;
    if (f.genres.some((genre) => genre === term || genre.split(" ").includes(term))) score += w.genre;
    if (f.language === term || f.language.split(" ").includes(term)) score += w.language;
    if (f.synopsisWords.has(term)) score += w.synopsisWord;
  }
  if (f.people.some((name) => name === q || (q.includes(name) && name.length > 0) || (terms.length > 1 && name.includes(q)))) {
    score += w.personName;
  }
  return score;
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** Most relevant first; ties go to newer films, then title. Returns a new array. */
export function rankByRelevance(films: readonly Film[], query: string): Film[] {
  const scores = new Map(films.map((film) => [film.id, relevanceScore(film, query)]));
  return [...films].sort(
    (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || b.releaseYear - a.releaseYear || collator.compare(a.title, b.title),
  );
}

/** Edit distance, capped for speed: anything beyond `max` returns max + 1. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

/**
 * Titles that look like a typo of the query ("harmatan" → Harmattan Letters),
 * for the no-results state. Each query word must be close to some title word.
 */
export function suggestTitles(query: string, films: readonly Film[] = getAllFilms(), limit = 3): Film[] {
  const terms = words(query).filter((term) => term.length >= 3);
  if (terms.length === 0) return [];
  return films
    .map((film) => {
      const titleWords = fieldsFor(film).titleWords;
      let total = 0;
      for (const term of terms) {
        const allowed = term.length <= 4 ? 1 : 2;
        const best = Math.min(...titleWords.map((word) => distance(term, word.slice(0, term.length + allowed), allowed)));
        if (best > allowed) return null;
        total += best;
      }
      return { film, total };
    })
    .filter((match): match is { film: Film; total: number } => match !== null)
    .sort((a, b) => a.total - b.total || collator.compare(a.film.title, b.film.title))
    .slice(0, limit)
    .map((match) => match.film);
}
