"use client";

import Form from "next/form";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { getAllFilms, getAllPeople, getFeaturedPeople, getFilmGenres, getFilmsByPerson } from "@/lib/catalogue";
import { discoveryHref, normalizeText, searchFilms } from "@/lib/discovery";
import { rankByRelevance } from "@/lib/searchRelevance";
import { filmHref, professionLabel } from "@/lib/format";

const suggestions = ["Romance", "Lagos", "Historical", "Zainab Musa-Lawal"];
const MAX_FILM_PREVIEWS = 4;
const MAX_PEOPLE_PREVIEWS = 2;

interface Result {
  id: string;
  label: string;
  detail: string;
  href: string;
}

const featuredPersonIds = new Set(getFeaturedPeople().map((person) => person.id));

// People are matched by name and profession; films use the shared discovery search.
const people = getAllPeople().map((person) => {
  const films = getFilmsByPerson(person.id);
  return {
    id: person.id,
    label: person.name,
    detail: `${professionLabel(person.profession)} · ${films.slice(0, 2).map((film) => film.title).join(", ")}`,
    // Featured people have a card on the homepage; others link to their newest film.
    href: featuredPersonIds.has(person.id) || films.length === 0 ? `/#person-${person.id}` : filmHref(films[0].slug),
    haystack: normalizeText(`${person.name} ${professionLabel(person.profession)}`),
  };
});

/**
 * Homepage search. Shows a live preview while typing; submitting opens the
 * full results on /films (and works without JavaScript).
 */
export default function SearchBar() {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const statusId = useId();

  const { films, results } = useMemo(() => {
    const term = normalizeText(query);
    if (term.length < 2) return { films: [], results: [] as Result[] };
    // Best matches first, the same order /films uses by default.
    const films = rankByRelevance(searchFilms(getAllFilms(), term), term);
    const filmResults: Result[] = films.slice(0, MAX_FILM_PREVIEWS).map((film) => ({
      id: film.id,
      label: film.title,
      detail: `Film · ${film.releaseYear} · ${getFilmGenres(film).map((genre) => genre.name).join(", ")}`,
      href: filmHref(film.slug),
    }));
    const peopleResults = people.filter((person) => person.haystack.includes(term)).slice(0, MAX_PEOPLE_PREVIEWS);
    return { films, results: [...filmResults, ...peopleResults] };
  }, [query]);

  const hasQuery = query.trim().length >= 2;

  return (
    <div id="discover" className="w-full max-w-xl">
      <Form action="/films" role="search">
        <label htmlFor={inputId} className="sr-only">
          Search films, genres, actors and directors
        </label>
        <div className="flex items-center gap-2 rounded-full border border-line bg-ink-2/90 p-1.5 pl-5 shadow-lg shadow-black/30 focus-within:border-gold">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-cream-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            id={inputId}
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search films, genres, actors, directors"
            autoComplete="off"
            aria-describedby={statusId}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-cream placeholder:text-cream-muted/80 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-cream"
          >
            Search
          </button>
        </div>
      </Form>

      <p id={statusId} aria-live="polite" className="sr-only">
        {hasQuery ? `${results.length} result${results.length === 1 ? "" : "s"} found` : ""}
      </p>

      {hasQuery ? (
        <div className="mt-3 rounded-2xl border border-line bg-ink-2/95 p-2">
          {results.length > 0 ? (
            <ul>
              {results.map((result) => (
                <li key={result.id}>
                  <Link href={result.href} className="block rounded-xl px-4 py-3 hover:bg-surface">
                    <span className="block font-semibold text-cream">{result.label}</span>
                    <span className="block text-sm text-cream-muted">{result.detail}</span>
                  </Link>
                </li>
              ))}
              {films.length > 0 && (
                <li className="mt-1 border-t border-line pt-1">
                  <Link
                    href={discoveryHref({ query })}
                    className="block rounded-xl px-4 py-3 text-sm font-semibold text-gold hover:bg-surface"
                  >
                    See all {films.length} matching {films.length === 1 ? "film" : "films"}{" "}
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              )}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-cream-muted">
              No films or people match “{query.trim()}”. Try a genre, a language or a city.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-cream-muted">Try:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setQuery(suggestion)}
              className="rounded-full border border-line px-3 py-1 text-cream-muted transition-colors hover:border-gold hover:text-cream"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
