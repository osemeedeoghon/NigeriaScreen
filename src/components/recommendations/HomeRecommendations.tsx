import Link from "next/link";
import { getHomeRecommendations } from "@/lib/recommendations/queries";
import RecommendationRow from "./RecommendationRow";
import RefreshRecommendations from "./RefreshRecommendations";

/**
 * Personalised and discovery sections for the homepage. Reads the session, so
 * it streams in behind a Suspense boundary; results are computed per request.
 */
export default async function HomeRecommendations() {
  const { signedIn, needsActivity, sections } = await getHomeRecommendations();
  const personal = sections.some((section) => section.personalised);

  return (
    <div className="border-y border-line/60 bg-ink-2/40">
      {signedIn && (
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 pt-10 sm:px-6 lg:px-8">
          <p className="max-w-2xl text-sm text-cream-muted">
            {needsActivity ? (
              <>
                Save, rate or mark a few films as watched, or{" "}
                <Link href="/account/preferences" className="font-semibold text-gold hover:text-cream">
                  choose your favourite genres and languages
                </Link>
                , and we&rsquo;ll start recommending films for you.
              </>
            ) : (
              <>
                Picks based on your own activity, matched by genre, language, cast and director.{" "}
                <Link href="/account/preferences" className="font-semibold text-gold hover:text-cream">
                  Tune your preferences
                </Link>
                .
              </>
            )}
          </p>
          {personal && <RefreshRecommendations />}
        </div>
      )}
      {sections.map((section) => (
        <RecommendationRow key={section.id} section={section} canGiveFeedback={signedIn && section.personalised} />
      ))}
    </div>
  );
}

export function HomeRecommendationsSkeleton() {
  return (
    <div role="status" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <span className="sr-only">Loading recommendations…</span>
      <div aria-hidden="true" className="h-8 w-64 animate-pulse rounded-lg bg-surface" />
      <div aria-hidden="true" className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
    </div>
  );
}
