import Link from "next/link";
import { getFilmActors, getFilmDirectors, getFilmGenres } from "@/lib/catalogue";
import { filmHref } from "@/lib/format";
import type { Film } from "@/types";
import PosterArt from "./PosterArt";

export default function FeaturedFilm({ film }: { film: Film }) {
  const directors = getFilmDirectors(film.id);
  const cast = getFilmActors(film.id);

  return (
    <section id="featured" aria-labelledby="featured-title" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-ink-2">
        <div aria-hidden="true" className="weave-bar h-1 w-full" />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-60"
          style={{ background: `radial-gradient(80% 90% at 85% 20%, ${film.artwork.palette[1]}55, transparent 70%)` }}
        />
        <div className="relative grid gap-8 p-6 sm:p-10 md:grid-cols-[minmax(0,18rem)_1fr] md:gap-12 lg:p-14">
          <PosterArt
            art={film.artwork}
            title={film.title}
            year={film.releaseYear}
            size="lg"
            className="mx-auto w-full max-w-[15rem] shadow-2xl shadow-black/60 md:max-w-none"
          />

          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold tracking-[0.25em] text-gold uppercase">Featured this week</p>
            <h2 id="featured-title" className="mt-3 font-display text-4xl font-semibold tracking-tight text-cream sm:text-5xl">
              {film.title}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2 text-sm text-cream-muted" aria-label="Film details">
              <li className="rounded-md border border-line px-2 py-0.5">{film.releaseYear}</li>
              <li className="rounded-md border border-line px-2 py-0.5">Rated {film.ageRating}</li>
              <li className="rounded-md border border-line px-2 py-0.5">{film.runtimeMinutes} min</li>
              <li className="rounded-md border border-line px-2 py-0.5">{film.language}</li>
              {getFilmGenres(film).map((genre) => (
                <li key={genre.id} className="rounded-md border border-terracotta/50 px-2 py-0.5 text-terracotta">
                  {genre.name}
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-cream">{film.synopsis}</p>

            <dl className="mt-6 grid max-w-xl grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-cream-muted">Director</dt>
                <dd className="mt-1 font-semibold text-cream">{directors.map((p) => p.name).join(", ")}</dd>
              </div>
              <div>
                <dt className="text-cream-muted">Starring</dt>
                <dd className="mt-1 font-semibold text-cream">{cast.map((m) => m.person.name).join(", ")}</dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={filmHref(film.slug)}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-cream"
              >
                View film details <span aria-hidden="true">→</span>
              </Link>
              <Link href={`${filmHref(film.slug)}#where-to-watch`} className="rounded-full px-4 py-2.5 text-sm font-semibold text-gold hover:text-cream">
                Where to watch
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
