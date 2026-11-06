"use client";

import { useState, useTransition } from "react";
import { clearFeedback, recordFeedback } from "@/lib/recommendations/actions";
import type { FeedbackKind, RecommendationSection } from "@/lib/recommendations/types";
import FilmCard from "../FilmCard";
import SectionHeading from "../SectionHeading";

const VISIBLE = 4;

interface Hidden {
  filmId: string;
  title: string;
  kind: FeedbackKind;
}

/**
 * One recommendation section. Signed-in viewers can hide a film for a while
 * or mark it "not interested"; both are saved to their own feedback rows.
 */
export default function RecommendationRow({ section, canGiveFeedback }: { section: RecommendationSection; canGiveFeedback: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState<Map<string, Hidden>>(() => new Map());
  const [notice, setNotice] = useState<{ text: string; undo?: Hidden } | null>(null);
  const [pending, start] = useTransition();

  const items = section.items.filter((item) => !hidden.has(item.film.id));
  const shown = expanded ? items : items.slice(0, VISIBLE);
  const headingId = `rec-${section.id}-title`;

  const hide = (filmId: string, title: string, kind: FeedbackKind) =>
    start(async () => {
      const entry = { filmId, title, kind };
      setHidden((current) => new Map(current).set(filmId, entry));
      const result = await recordFeedback(filmId, kind);
      if (result.ok) {
        setNotice({ text: kind === "dismissed" ? `${title} hidden for 30 days.` : `Got it: we won't suggest ${title} again.`, undo: entry });
      } else {
        setHidden((current) => {
          const next = new Map(current);
          next.delete(filmId);
          return next;
        });
        setNotice({ text: result.reason === "signed-out" ? "Sign in again to hide recommendations." : "That didn't save. Please try again." });
      }
    });

  const undo = (entry: Hidden) =>
    start(async () => {
      const result = await clearFeedback(entry.filmId);
      if (result.ok) {
        setHidden((current) => {
          const next = new Map(current);
          next.delete(entry.filmId);
          return next;
        });
        setNotice({ text: `${entry.title} is back in your recommendations.` });
      } else {
        setNotice({ text: "That didn't undo. Please try again." });
      }
    });

  if (items.length === 0) {
    return (
      <section aria-labelledby={headingId} className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <h2 id={headingId} className="font-display text-2xl font-semibold text-cream">
          {section.title}
        </h2>
        <p className="mt-3 text-sm text-cream-muted" role="status">
          {notice?.text ?? "You've hidden everything here."} Refresh recommendations to see new picks.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId} className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <SectionHeading
        id={headingId}
        eyebrow={section.personalised ? "For you" : "Discover"}
        title={section.title}
        description={section.description}
      />

      <ol aria-label={section.title} className="grid grid-cols-2 gap-x-2 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((item) => (
          <li key={item.film.id} className="flex flex-col">
            <FilmCard film={item.film} />
            <p className="mt-1 px-3 text-sm leading-snug text-gold">{item.explanation}</p>
            {canGiveFeedback && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-3 text-xs">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => hide(item.film.id, item.film.title, "dismissed")}
                  className="font-semibold text-cream-muted hover:text-cream disabled:opacity-60"
                >
                  Hide<span className="sr-only"> {item.film.title} for 30 days</span>
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => hide(item.film.id, item.film.title, "not_interested")}
                  className="font-semibold text-cream-muted hover:text-terracotta disabled:opacity-60"
                >
                  Not interested<span className="sr-only"> in {item.film.title}</span>
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {items.length > VISIBLE && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-cream transition-colors hover:border-gold"
          >
            {expanded ? "Show fewer" : `Show ${items.length - VISIBLE} more`}
          </button>
        )}
        <p role="status" className="text-sm text-cream-muted">
          {notice?.text}
          {notice?.undo && (
            <button type="button" onClick={() => undo(notice.undo!)} disabled={pending} className="ml-2 font-semibold text-gold hover:text-cream">
              Undo
            </button>
          )}
        </p>
      </div>
    </section>
  );
}
