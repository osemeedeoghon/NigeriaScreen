import type { Metadata } from "next";
import { Suspense } from "react";
import FilmDiscovery from "@/components/FilmDiscovery";
import FilmGrid from "@/components/FilmGrid";
import { getAllFilms } from "@/lib/catalogue";
import { sortFilms } from "@/lib/discovery";

export const metadata: Metadata = {
  title: "Browse films — NaijaScreen",
  description: "Search, filter and sort the NaijaScreen Nollywood catalogue by genre, language, year and more.",
};

export default function FilmsPage() {
  const films = getAllFilms();

  return (
    <main id="main" className="relative">
      <div aria-hidden="true" className="texture-adire absolute inset-x-0 top-0 h-80" />
      <div className="relative mx-auto max-w-7xl px-4 pt-12 pb-20 sm:px-6 sm:pt-16 lg:px-8">
        <header className="mb-10 max-w-2xl">
          <p className="mb-3 flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-gold uppercase">
            <span aria-hidden="true" className="weave-bar h-0.5 w-8 rounded-full" />
            Discover
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-cream sm:text-5xl">Browse the catalogue</h1>
          <p className="mt-4 text-lg leading-relaxed text-cream-muted">
            Search {films.length} Nollywood films by title, cast, director, genre or language, then narrow them down with
            filters.
          </p>
        </header>

        {/* useSearchParams needs a Suspense boundary; the fallback is the full, unfiltered catalogue. */}
        <Suspense fallback={<FilmGrid films={sortFilms(films, "newest")} label="All films" />}>
          <FilmDiscovery />
        </Suspense>
      </div>
    </main>
  );
}
