"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  countActiveFilters,
  discoverFilms,
  EMPTY_STATE,
  getDiscoveryOptions,
  noResultHints,
  parseDiscoveryParams,
  serializeDiscoveryState,
  SORT_OPTIONS,
  type DiscoveryState,
  type SortOption,
} from "@/lib/discovery";
import { getAllFilms } from "@/lib/catalogue";
import { filmHref } from "@/lib/format";
import type { AgeRating, FilmStatus, GenreSlug, Language } from "@/types";
import FilmGrid from "./FilmGrid";

const STATUS_LABELS: Record<FilmStatus, string> = { released: "Released", upcoming: "Coming soon" };
const totalFilms = getAllFilms().length;

/** Writes state to the address bar without a server round trip. */
function writeUrl(state: DiscoveryState, mode: "push" | "replace") {
  const query = serializeDiscoveryState(state);
  if (query === window.location.search.slice(1)) return;
  const url = query ? `?${query}` : window.location.pathname;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

/**
 * Search, filter and sort the catalogue. The URL is the source of truth for
 * filters and sorting; the search box keeps local state so typing stays smooth.
 */
export default function FilmDiscovery() {
  const searchParams = useSearchParams();
  const urlState = useMemo(() => parseDiscoveryParams(searchParams), [searchParams]);
  const options = getDiscoveryOptions();

  const [queryInput, setQueryInput] = useState(urlState.query);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ids = { search: useId(), sort: useId(), panel: useId(), status: useId() };

  // Back/forward: the URL changes underneath us, so resync the search box.
  useEffect(() => {
    const sync = () => setQueryInput(parseDiscoveryParams(new URLSearchParams(window.location.search)).query);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  // Rewrite invalid or non-canonical parameters (e.g. ?genre=western) to the clean form.
  useEffect(() => {
    const canonical = serializeDiscoveryState(urlState);
    if (canonical !== new URLSearchParams(window.location.search).toString()) {
      window.history.replaceState(null, "", canonical ? `?${canonical}` : window.location.pathname);
    }
  }, [urlState]);

  const deferredQuery = useDeferredValue(queryInput);
  const results = useMemo(() => discoverFilms({ ...urlState, query: deferredQuery }), [urlState, deferredQuery]);

  const state: DiscoveryState = { ...urlState, query: queryInput };
  const activeFilters = countActiveFilters(state);
  const hasAnything = activeFilters > 0 || queryInput.trim() !== "";

  const update = (patch: Partial<DiscoveryState>) => writeUrl({ ...state, ...patch }, "push");
  const hints = useMemo(
    () => (results.length === 0 ? noResultHints({ ...urlState, query: deferredQuery }) : null),
    [results.length, urlState, deferredQuery],
  );

  const onQueryChange = (value: string) => {
    setQueryInput(value);
    writeUrl({ ...urlState, query: value }, "replace");
  };

  const clearSearch = () => {
    onQueryChange("");
    inputRef.current?.focus();
  };

  const clearAll = () => {
    setQueryInput("");
    writeUrl(EMPTY_STATE, "push");
  };

  const toggleGenre = (slug: GenreSlug) =>
    update({ genres: state.genres.includes(slug) ? state.genres.filter((g) => g !== slug) : [...state.genres, slug] });

  return (
    <div>
      <form role="search" onSubmit={(event) => event.preventDefault()} className="mb-8">
        <label htmlFor={ids.search} className="mb-2 block text-sm font-semibold text-cream">
          Search the catalogue
        </label>
        <div className="flex items-center gap-2 rounded-full border border-line bg-ink-2 p-1.5 pl-5 focus-within:border-gold">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-cream-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            id={ids.search}
            type="search"
            value={queryInput}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && queryInput && clearSearch()}
            placeholder="Title, actor, director, genre or language"
            autoComplete="off"
            aria-describedby={ids.status}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-cream placeholder:text-cream-muted/80 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {queryInput && (
            <button
              type="button"
              onClick={clearSearch}
              className="rounded-full px-4 py-2.5 text-sm font-semibold text-cream-muted transition-colors hover:bg-surface hover:text-cream"
            >
              Clear<span className="sr-only"> search</span>
            </button>
          )}
        </div>
      </form>

      <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-10">
        <aside aria-label="Filters">
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls={ids.panel}
            onClick={() => setFiltersOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-xl border border-line bg-ink-2 px-4 py-3 text-sm font-semibold text-cream lg:hidden"
          >
            <span>
              Filters
              {activeFilters > 0 && <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs text-ink">{activeFilters}</span>}
            </span>
            <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 transition-transform ${filtersOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <div id={ids.panel} className={`${filtersOpen ? "block" : "hidden"} mt-4 space-y-6 lg:mt-0 lg:block`}>
            <fieldset>
              <legend className="mb-3 text-xs font-semibold tracking-[0.2em] text-gold uppercase">Genre</legend>
              <p className="sr-only">Films matching any selected genre are shown.</p>
              <div className="flex flex-wrap gap-2">
                {options.genres.map((genre) => {
                  const checked = state.genres.includes(genre.slug);
                  return (
                    <label
                      key={genre.slug}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-gold ${
                        checked ? "border-gold bg-gold text-ink" : "border-line text-cream-muted hover:border-cream-muted hover:text-cream"
                      }`}
                    >
                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleGenre(genre.slug)} />
                      {genre.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <FilterSelect
              label="Language"
              value={state.language ?? ""}
              anyLabel="Any language"
              onChange={(value) => update({ language: (value || null) as Language | null })}
            >
              {options.languages.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Release year"
              value={state.year ? String(state.year) : ""}
              anyLabel="Any year"
              onChange={(value) => update({ year: value ? Number(value) : null })}
            >
              {options.years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Age rating"
              value={state.rating ?? ""}
              anyLabel="Any rating"
              onChange={(value) => update({ rating: (value || null) as AgeRating | null })}
            >
              {options.ratings.map((rating) => (
                <option key={rating} value={rating}>
                  {rating}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Availability"
              value={state.status ?? ""}
              anyLabel="Released and upcoming"
              onChange={(value) => update({ status: (value || null) as FilmStatus | null })}
            >
              {options.statuses.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </FilterSelect>

            <button
              type="button"
              onClick={clearAll}
              disabled={!hasAnything}
              className="w-full rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-cream transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear all filters
            </button>
          </div>
        </aside>

        <section aria-labelledby={ids.status}>
          <div className="mb-6 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
            <p id={ids.status} role="status" className="text-sm text-cream-muted">
              Showing <span className="font-semibold text-cream">{results.length}</span> of {totalFilms} films
            </p>
            <div className="flex items-center gap-3">
              <label htmlFor={ids.sort} className="text-sm text-cream-muted">
                Sort by
              </label>
              <select
                id={ids.sort}
                value={state.sort}
                onChange={(event) => update({ sort: event.target.value as SortOption })}
                className="rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-cream"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h2 className="sr-only">Results</h2>
          {results.length > 0 ? (
            <FilmGrid films={results} label="Matching films" />
          ) : (
            <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
              <h2 className="font-display text-2xl font-semibold text-cream">No films match</h2>
              <p className="mx-auto mt-2 max-w-md text-cream-muted">
                {queryInput.trim() ? <>Nothing in the catalogue matches &ldquo;{queryInput.trim()}&rdquo;</> : "No films match"}
                {activeFilters > 0 ? " with the selected filters." : "."} Try fewer filters or a different word.
              </p>
              {hints && hints.similarTitles.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm text-cream">Did you mean:</p>
                  <ul className="mt-2 flex flex-wrap justify-center gap-2">
                    {hints.similarTitles.map((film) => (
                      <li key={film.id}>
                        <Link href={filmHref(film.slug)} className="inline-block rounded-full border border-gold/60 px-3 py-1 text-sm font-semibold text-gold hover:bg-gold hover:text-ink">
                          {film.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {hints && hints.matchesWithoutFilters > 0 && (
                <button
                  type="button"
                  onClick={() => update({ genres: [], language: null, year: null, rating: null, status: null })}
                  className="mt-5 text-sm font-semibold text-gold underline-offset-4 hover:underline"
                >
                  Keep the search, clear the filters ({hints.matchesWithoutFilters} {hints.matchesWithoutFilters === 1 ? "film" : "films"})
                </button>
              )}
              <button
                type="button"
                onClick={clearAll}
                className="mt-6 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-cream"
              >
                Clear all filters
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  anyLabel: string;
  onChange: (value: string) => void;
  children: ReactNode;
}

function FilterSelect({ label, value, anyLabel, onChange, children }: FilterSelectProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-semibold tracking-[0.2em] text-gold uppercase">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-sm text-cream"
      >
        <option value="">{anyLabel}</option>
        {children}
      </select>
    </div>
  );
}
