"use client";

import { useMemo, useState } from "react";
import { getAllGenres, getFilmGenreSlugs } from "@/lib/catalogue";
import type { Film, GenreSlug } from "@/types";
import BrowseAllLink from "./BrowseAllLink";
import FilmGrid from "./FilmGrid";
import SectionHeading from "./SectionHeading";

interface FilmSectionProps {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  films: Film[];
  showRank?: boolean;
}

/** A curated grid of films with quick genre chips. Full filtering lives on /films. */
export default function FilmSection({ id, eyebrow, title, description, films, showRank = false }: FilmSectionProps) {
  const [genre, setGenre] = useState<GenreSlug | null>(null);
  const visible = genre ? films.filter((film) => getFilmGenreSlugs(film).includes(genre)) : films;
  const availableGenres = getAllGenres().filter((g) => films.some((film) => film.genreIds.includes(g.id)));
  // Ranks follow the curated order, so they stay stable when a chip filters the list.
  const ranks = useMemo(
    () => (showRank ? new Map(films.map((film, index) => [film.id, index + 1])) : undefined),
    [films, showRank],
  );

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <SectionHeading
        id={`${id}-title`}
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={<BrowseAllLink />}
      />

      <div role="group" aria-label="Filter by genre" className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {[{ slug: null, name: "All" }, ...availableGenres].map((option) => {
          const active = genre === option.slug;
          return (
            <button
              key={option.slug ?? "all"}
              type="button"
              aria-pressed={active}
              onClick={() => setGenre(option.slug)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-gold bg-gold text-ink"
                  : "border-line text-cream-muted hover:border-cream-muted hover:text-cream"
              }`}
            >
              {option.name}
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="sr-only">
        Showing {visible.length} film{visible.length === 1 ? "" : "s"}
      </p>

      {visible.length > 0 ? (
        <FilmGrid films={visible} ranks={ranks} />
      ) : (
        <p className="rounded-xl border border-line p-6 text-cream-muted">
          No trending films in this genre right now. Choose another genre or show all.
        </p>
      )}
    </section>
  );
}
