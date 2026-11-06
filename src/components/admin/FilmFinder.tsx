"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { normalizeText } from "@/lib/discovery";

export interface FinderFilm {
  slug: string;
  title: string;
  year: number;
  /** Count of viewing options of any status. */
  options: number;
}

/** Searches the local catalogue and links to each film's admin page. */
export default function FilmFinder({ films }: { films: FinderFilm[] }) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const matches = useMemo(() => {
    const q = normalizeText(query);
    return q ? films.filter((film) => normalizeText(film.title).includes(q)) : films;
  }, [films, query]);

  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block text-sm font-semibold text-cream">
        Find a film
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Start typing a title"
        className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-base text-cream placeholder:text-cream-muted/70 focus:border-gold focus:outline-none"
      />
      <p className="mt-2 text-xs text-cream-muted" aria-live="polite">
        {matches.length} of {films.length} films
      </p>
      <ul className="mt-3 max-h-96 divide-y divide-line overflow-y-auto rounded-xl border border-line">
        {matches.map((film) => (
          <li key={film.slug}>
            <Link href={`/admin/viewing/${film.slug}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface">
              <span className="text-cream">
                {film.title} <span className="text-cream-muted">({film.year})</span>
              </span>
              <span className="shrink-0 text-xs text-cream-muted">
                {film.options} {film.options === 1 ? "option" : "options"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
