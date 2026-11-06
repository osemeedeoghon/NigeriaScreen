import Link from "next/link";
import type { ReactNode } from "react";
import { loginHref, signupHref } from "@/lib/auth/paths";
import { getCurrentUser } from "@/lib/auth/session";
import { getFilmReviews } from "@/lib/library/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { filmHref } from "@/lib/format";
import type { Film } from "@/types";
import ReviewForm from "./ReviewForm";
import Stars from "./Stars";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Member reviews for one film. Only real reviews written by signed-in members
 * are shown; there are no sample ratings. Reads the session, so it streams in
 * behind a Suspense boundary.
 */
export default async function FilmReviews({ film }: { film: Film }) {
  if (!isSupabaseConfigured()) {
    return (
      <ReviewsFrame>
        <Empty text="Member reviews open once accounts are switched on for this copy of NaijaScreen." />
      </ReviewsFrame>
    );
  }
  if (film.status === "upcoming") {
    return (
      <ReviewsFrame>
        <Empty text="Reviews open once the film is released. Add it to your watchlist so you don't miss it." />
      </ReviewsFrame>
    );
  }

  const [user, reviews] = await Promise.all([getCurrentUser(), getFilmReviews(film.id)]);
  const here = filmHref(film.slug);

  if (reviews === null) {
    return (
      <ReviewsFrame>
        <p role="alert" className="rounded-xl border border-terracotta/60 bg-clay/20 px-4 py-3 text-sm text-cream">
          Reviews couldn&rsquo;t be loaded just now. Refresh the page to try again.
        </p>
      </ReviewsFrame>
    );
  }

  const own = reviews.find((review) => review.is_own) ?? null;
  const average = reviews.length > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null;

  return (
    <ReviewsFrame
      summary={
        average !== null && (
          <p className="flex items-center gap-3 text-sm text-cream-muted">
            <Stars rating={average} />
            <span>
              <span className="font-semibold text-cream">{average.toFixed(1)}</span> from {reviews.length} member{" "}
              {reviews.length === 1 ? "review" : "reviews"}
            </span>
          </p>
        )
      }
    >
      <div className="grid gap-10 lg:grid-cols-[22rem_1fr] lg:gap-14">
        <div className="h-fit rounded-2xl border border-line bg-ink-2 p-6">
          <h3 className="font-display text-xl font-semibold text-cream">{own ? "Your review" : "Rate this film"}</h3>
          {user ? (
            <div className="mt-4">
              {own && (
                <div className="mb-4">
                  <Stars rating={own.rating} />
                  {own.body && <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-cream">{own.body}</p>}
                </div>
              )}
              <ReviewForm filmId={film.id} filmTitle={film.title} existing={own && { rating: own.rating, body: own.body }} />
            </div>
          ) : (
            <div className="mt-3 text-sm text-cream-muted">
              <p>Sign in to rate {film.title} and share what you thought.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={loginHref(here)} className="rounded-full bg-gold px-4 py-2 font-semibold text-ink transition-colors hover:bg-cream">
                  Sign in
                </Link>
                <Link href={signupHref(here)} className="rounded-full border border-line px-4 py-2 font-semibold text-cream transition-colors hover:border-gold">
                  Create account
                </Link>
              </div>
            </div>
          )}
        </div>

        {reviews.length === 0 ? (
          <Empty text={`No reviews yet. Be the first member to rate ${film.title}.`} />
        ) : (
          <ol aria-label="Member reviews" className="space-y-4">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-2xl border border-line p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-cream">
                    {review.author_name}
                    {review.is_own && <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold">You</span>}
                  </p>
                  <p className="text-xs text-cream-muted">
                    <time dateTime={review.created_at}>{dateFormat.format(new Date(review.created_at))}</time>
                    {review.updated_at !== review.created_at && " · edited"}
                  </p>
                </div>
                <Stars rating={review.rating} className="mt-2" />
                {review.body && <p className="mt-3 leading-relaxed whitespace-pre-line text-cream">{review.body}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </ReviewsFrame>
  );
}

function ReviewsFrame({ children, summary }: { children: ReactNode; summary?: ReactNode }) {
  return (
    <section aria-labelledby="reviews-heading" className="border-t border-line pt-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="reviews-heading" className="font-display text-3xl font-semibold tracking-tight text-cream">
            Member reviews
          </h2>
          <p className="mt-2 text-sm text-cream-muted">Ratings come only from signed-in NaijaScreen members.</p>
        </div>
        {summary}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-cream-muted">{text}</p>;
}

/** Placeholder while reviews stream in. */
export function FilmReviewsSkeleton() {
  return (
    <ReviewsFrame>
      <div role="status" className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <span className="sr-only">Loading reviews…</span>
        <div aria-hidden="true" className="h-48 animate-pulse rounded-2xl bg-surface" />
        <div aria-hidden="true" className="h-48 animate-pulse rounded-2xl bg-surface" />
      </div>
    </ReviewsFrame>
  );
}
