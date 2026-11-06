"use client";

import { useTransition } from "react";
import { refreshRecommendations } from "@/lib/recommendations/actions";
import { Spinner } from "../forms/FormControls";

/** Re-runs the recommender on the server with the latest activity and feedback. */
export default function RefreshRecommendations() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => refreshRecommendations())}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full border border-gold/60 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold hover:text-ink disabled:opacity-60"
    >
      {pending && <Spinner />}
      {pending ? "Refreshing…" : "Refresh recommendations"}
    </button>
  );
}
