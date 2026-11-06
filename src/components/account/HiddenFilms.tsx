"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { filmHref } from "@/lib/format";
import { clearFeedback } from "@/lib/recommendations/actions";

interface HiddenFilm {
  filmId: string;
  slug: string;
  title: string;
  kind: "dismissed" | "not_interested";
  until: string | null;
}

/** Films the user has hidden from recommendations, with a way to undo. */
export default function HiddenFilms({ films }: { films: HiddenFilm[] }) {
  const [restored, setRestored] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const visible = films.filter((film) => !restored.has(film.filmId));

  const restore = (film: HiddenFilm) =>
    start(async () => {
      const result = await clearFeedback(film.filmId);
      if (result.ok) {
        setRestored((current) => new Set(current).add(film.filmId));
        setMessage(`${film.title} can be recommended again.`);
      } else {
        setMessage("That didn't save. Please try again.");
      }
    });

  return (
    <div>
      {visible.length === 0 ? (
        <p className="text-sm text-cream-muted">You haven&rsquo;t hidden any recommendations.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {visible.map((film) => (
            <li key={film.filmId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <Link href={filmHref(film.slug)} className="font-semibold text-cream hover:text-gold">
                  {film.title}
                </Link>
                <p className="text-xs text-cream-muted">
                  {film.kind === "not_interested" ? "Not interested" : film.until ? `Hidden until ${film.until}` : "Hidden (expired)"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => restore(film)}
                disabled={pending}
                className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-cream hover:border-gold disabled:opacity-60"
              >
                Show again<span className="sr-only"> {film.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="mt-3 text-sm text-palm">
        {message}
      </p>
    </div>
  );
}
