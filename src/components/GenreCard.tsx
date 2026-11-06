import Link from "next/link";
import type { Genre } from "@/types";

interface GenreCardProps {
  genre: Genre;
  filmCount: number;
}

/** Links to the genre's own page. */
export default function GenreCard({ genre, filmCount }: GenreCardProps) {
  const accent = genre.artwork.accent;

  return (
    <Link
      href={`/genres/${genre.slug}`}
      className="group relative flex h-full min-h-40 flex-col justify-between overflow-hidden rounded-2xl border border-line bg-ink-2 p-5 transition-colors hover:border-cream-muted"
    >
      <span
        aria-hidden="true"
        className="absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-25 transition-transform duration-500 group-hover:scale-125"
        style={{ background: accent }}
      />
      <span aria-hidden="true" className="relative block h-1 w-10 rounded-full" style={{ background: accent }} />
      <span className="relative mt-6 block">
        <span className="block font-display text-xl font-semibold text-cream sm:text-2xl">{genre.name}</span>
        <span className="mt-1 block text-sm leading-snug text-cream-muted">{genre.description}</span>
        <span className="mt-3 block text-xs font-semibold tracking-[0.2em] text-gold uppercase">
          {filmCount} {filmCount === 1 ? "film" : "films"}
          <span aria-hidden="true"> →</span>
        </span>
      </span>
    </Link>
  );
}
