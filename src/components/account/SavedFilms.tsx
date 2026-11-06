import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getSavedFilms } from "@/lib/library/queries";
import FilmGrid from "../FilmGrid";

interface SavedFilmsProps {
  list: "watchlist" | "watched_films";
  path: string;
  title: string;
  emptyTitle: string;
  emptyText: string;
}

/** A signed-in user's watchlist or watched films, newest first. */
export default async function SavedFilms({ list, path, title, emptyTitle, emptyText }: SavedFilmsProps) {
  await requireUser(path);
  const saved = await getSavedFilms(list);

  return (
    <section aria-labelledby="saved-heading">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="saved-heading" className="font-display text-3xl font-semibold tracking-tight text-cream sm:text-4xl">
            {title}
          </h1>
          {saved && saved.length > 0 && (
            <p className="mt-2 text-cream-muted">
              {saved.length} {saved.length === 1 ? "film" : "films"}, most recent first.
            </p>
          )}
        </div>
      </div>

      {saved === null ? (
        <p role="alert" className="rounded-xl border border-terracotta/60 bg-clay/20 px-4 py-3 text-sm text-cream">
          We couldn&rsquo;t load your films just now. Refresh the page to try again.
        </p>
      ) : saved.length > 0 ? (
        <FilmGrid films={saved.map((entry) => entry.film)} label={title} />
      ) : (
        <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
          <h2 className="font-display text-2xl font-semibold text-cream">{emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-cream-muted">{emptyText}</p>
          <Link
            href="/films"
            className="mt-6 inline-block rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-cream"
          >
            Browse films
          </Link>
        </div>
      )}
    </section>
  );
}
