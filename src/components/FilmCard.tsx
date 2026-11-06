import Link from "next/link";
import { getFilmGenres } from "@/lib/catalogue";
import { filmHref } from "@/lib/format";
import type { Film } from "@/types";
import LibraryButtons from "./library/LibraryButtons";
import PosterArt from "./PosterArt";

interface FilmCardProps {
  film: Film;
  rank?: number;
}

export default function FilmCard({ film, rank }: FilmCardProps) {
  const genreNames = getFilmGenres(film).map((genre) => genre.name);

  return (
    <article
      id={`film-${film.id}`}
      className="group relative flex h-full flex-col rounded-xl p-2 transition-colors focus-within:bg-surface hover:bg-surface"
    >
      <div className="relative">
        <PosterArt
          art={film.artwork}
          title={film.title}
          year={film.releaseYear}
          className="transition-transform duration-300 group-hover:-translate-y-1"
        />
        {rank && (
          <span className="absolute top-2 left-2 rounded-md bg-ink/85 px-2 py-0.5 font-display text-sm font-semibold text-gold">
            <span className="sr-only">Trending rank </span>
            {rank}
          </span>
        )}
        <span className="absolute top-2 right-2 rounded-md border border-cream/30 bg-ink/70 px-1.5 py-0.5 text-[0.7rem] font-semibold text-cream">
          <span className="sr-only">Rated </span>
          {film.ageRating}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-1 pt-3">
        <h3 className="font-display text-lg leading-snug font-semibold text-cream">
          {/* The link's overlay makes the whole card clickable while keeping one tab stop. */}
          <Link href={filmHref(film.slug)} className="after:absolute after:inset-0 after:rounded-xl">
            {film.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-cream-muted">
          {film.releaseYear} · {genreNames.join(" / ")} · {film.runtimeMinutes} min
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <p className="text-sm text-cream-muted">
            {film.language}
            {film.status === "upcoming" && <span className="block font-semibold text-palm">Coming soon</span>}
          </p>
          <LibraryButtons filmId={film.id} filmTitle={film.title} upcoming={film.status === "upcoming"} />
        </div>
      </div>
    </article>
  );
}
