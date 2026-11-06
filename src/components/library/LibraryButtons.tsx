"use client";

import type { LibraryList } from "@/lib/library/actions";
import { useLibrary } from "./LibraryProvider";

interface LibraryButtonsProps {
  filmId: string;
  filmTitle: string;
  upcoming: boolean;
  /** "card": icon buttons over a poster. "full": labelled buttons on the detail page. */
  variant?: "card" | "full";
}

/**
 * Watchlist and watched toggles. Visitors get a sign-in prompt instead of a
 * silent failure. Upcoming films can be saved but not marked as watched.
 */
export default function LibraryButtons({ filmId, filmTitle, upcoming, variant = "card" }: LibraryButtonsProps) {
  const library = useLibrary();
  const lists: LibraryList[] = upcoming ? ["watchlist"] : ["watchlist", "watched_films"];

  if (variant === "card") {
    return (
      <div className="relative z-10 flex gap-1.5">
        {lists.map((list) => {
          const on = library.signedIn && library.has(list, filmId);
          return (
            <button
              key={list}
              type="button"
              aria-pressed={library.signedIn ? on : undefined}
              aria-label={label(list, on, filmTitle, library.signedIn)}
              title={label(list, on, filmTitle, library.signedIn)}
              disabled={!library.ready || library.pending(list, filmId)}
              onClick={() => library.toggle(list, filmId, filmTitle)}
              className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-sm transition-colors disabled:cursor-wait disabled:opacity-60 ${
                on ? "border-gold bg-gold text-ink" : "border-cream/30 bg-ink/75 text-cream hover:border-gold hover:text-gold"
              }`}
            >
              <ListIcon list={list} filled={on} />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {lists.map((list) => {
        const on = library.signedIn && library.has(list, filmId);
        return (
          <button
            key={list}
            type="button"
            aria-pressed={library.signedIn ? on : undefined}
            disabled={!library.ready || library.pending(list, filmId)}
            onClick={() => library.toggle(list, filmId, filmTitle)}
            className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
              on ? "border-gold bg-gold text-ink hover:bg-cream" : "border-line text-cream hover:border-gold"
            }`}
          >
            <ListIcon list={list} filled={on} />
            {list === "watchlist" ? (on ? "On your watchlist" : "Add to watchlist") : on ? "Watched" : "Mark as watched"}
          </button>
        );
      })}
      {upcoming && <p className="self-center text-sm text-cream-muted">You can mark it as watched once it&rsquo;s released.</p>}
    </div>
  );
}

function label(list: LibraryList, on: boolean, title: string, signedIn: boolean) {
  if (!signedIn) return list === "watchlist" ? `Save ${title} to your watchlist (sign in required)` : `Mark ${title} as watched (sign in required)`;
  if (list === "watchlist") return on ? `Remove ${title} from your watchlist` : `Add ${title} to your watchlist`;
  return on ? `Unmark ${title} as watched` : `Mark ${title} as watched`;
}

function ListIcon({ list, filled }: { list: LibraryList; filled: boolean }) {
  return list === "watchlist" ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path d="M6 4h12v16l-6-4-6 4z" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      {filled ? (
        <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="2.75" />
        </>
      )}
    </svg>
  );
}
