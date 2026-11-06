"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { IDLE } from "@/lib/auth/formState";
import { REVIEW_MAX } from "@/lib/auth/validation";
import { deleteReview, saveReview } from "@/lib/library/actions";
import { FormMessage, Spinner, SubmitButton } from "../forms/FormControls";

interface ReviewFormProps {
  filmId: string;
  filmTitle: string;
  existing: { rating: number; body: string | null } | null;
}

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Create, edit or delete the signed-in user's review of one film. */
export default function ReviewForm({ filmId, filmTitle, existing }: ReviewFormProps) {
  const [state, action] = useActionState(saveReview, IDLE);
  const [editing, setEditing] = useState(existing === null);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const ids = { rating: useId(), body: useId(), count: useId(), ratingError: useId(), bodyError: useId() };

  const remove = () =>
    startDelete(async () => {
      const result = await deleteReview(filmId);
      if (result.ok) {
        setRating(0);
        setBody("");
        setConfirmingDelete(false);
        setEditing(true);
        setDeleteError(null);
      } else {
        setDeleteError(result.reason === "signed-out" ? "Sign in again to delete your review." : "Your review couldn't be deleted. Please try again.");
      }
    });

  if (existing && !editing && state.status !== "error") {
    return (
      <div className="space-y-3">
        {state.status === "success" && <FormMessage state={state} />}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-cream transition-colors hover:border-gold"
          >
            Edit your review
          </button>
          {confirmingDelete ? (
            <>
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-ink disabled:opacity-70"
              >
                {deleting && <Spinner />}
                {deleting ? "Deleting…" : "Yes, delete it"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="rounded-full px-4 py-2 text-sm font-semibold text-cream-muted hover:text-cream"
              >
                Keep it
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-terracotta hover:text-cream"
            >
              Delete
            </button>
          )}
        </div>
        {deleteError && (
          <p role="alert" className="text-sm text-terracotta">
            {deleteError}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      action={(form) => {
        action(form);
        setEditing(false);
      }}
      noValidate
      className="space-y-5"
    >
      <FormMessage state={state} />
      <input type="hidden" name="filmId" value={filmId} />

      <fieldset aria-describedby={state.fieldErrors?.rating ? ids.ratingError : undefined}>
        <legend className="mb-2 text-sm font-semibold text-cream">Your rating of {filmTitle}</legend>
        <div className="flex flex-wrap items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="cursor-pointer rounded-md p-1 text-gold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-gold"
            >
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only"
              />
              <span className="sr-only">
                {n} {n === 1 ? "star" : "stars"}, {RATING_WORDS[n]}
              </span>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8" fill={n <= rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                <path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z" strokeLinejoin="round" />
              </svg>
            </label>
          ))}
          <span aria-hidden="true" className="ml-2 text-sm text-cream-muted">
            {rating ? RATING_WORDS[rating] : "Choose 1–5 stars"}
          </span>
        </div>
        {state.fieldErrors?.rating && (
          <p id={ids.ratingError} className="mt-2 text-sm font-medium text-terracotta">
            {state.fieldErrors.rating}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor={ids.body} className="mb-2 block text-sm font-semibold text-cream">
          Your review (optional)
        </label>
        <textarea
          id={ids.body}
          name="body"
          rows={5}
          maxLength={REVIEW_MAX}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-invalid={state.fieldErrors?.body ? true : undefined}
          aria-describedby={[ids.count, state.fieldErrors?.body && ids.bodyError].filter(Boolean).join(" ")}
          placeholder="What stayed with you? Avoid spoilers for people who haven't seen it."
          className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-base text-cream placeholder:text-cream-muted/70 focus:border-gold focus:outline-none"
        />
        <p id={ids.count} className="mt-1 text-right text-xs text-cream-muted">
          {body.length} / {REVIEW_MAX}
        </p>
        {state.fieldErrors?.body && (
          <p id={ids.bodyError} className="mt-1 text-sm font-medium text-terracotta">
            {state.fieldErrors.body}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-auto">
          <SubmitButton pendingLabel="Saving…">{existing ? "Update review" : "Post review"}</SubmitButton>
        </div>
        {existing && (
          <button
            type="button"
            onClick={() => {
              setRating(existing.rating);
              setBody(existing.body ?? "");
              setEditing(false);
            }}
            className="rounded-full px-4 py-2 text-sm font-semibold text-cream-muted hover:text-cream"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
