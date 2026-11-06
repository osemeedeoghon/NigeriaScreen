import type { ReactNode } from "react";
import { getFilmViewing } from "@/lib/viewing/queries";
import { trailerEmbedUrl, isApprovedEmbedUrl, TRAILER_PROVIDER_NAMES } from "@/lib/viewing/trailers";
import type { Film } from "@/types";
import TrailerPlayer from "./TrailerPlayer";
import ViewingOptionList from "./ViewingOptionList";

const EMPTY = "We haven't confirmed an authorised viewing option for this film yet. Check back later.";

/**
 * "Where to Watch" and trailer for a film page. Reads Supabase, so it streams
 * in behind a Suspense boundary. Only active, verified records are shown.
 */
export default async function WhereToWatch({ film }: { film: Film }) {
  const viewing = await getFilmViewing(film.id);

  if (viewing.status !== "ok") {
    return (
      <Frame>
        {viewing.status === "error" ? (
          <p role="alert" className="rounded-2xl border border-terracotta/60 bg-clay/20 px-5 py-4 text-sm text-cream">
            Viewing options couldn&rsquo;t be loaded just now. Refresh the page to try again.
          </p>
        ) : (
          <Empty />
        )}
      </Frame>
    );
  }

  const trailer = viewing.trailers[0];
  const embed = trailer?.embeddable ? trailerEmbedUrl(trailer.videoProvider, trailer.videoId) : null;

  return (
    <Frame
      trailer={
        trailer && (
          <TrailerPlayer
            title={trailer.title}
            filmTitle={film.title}
            embedUrl={embed && isApprovedEmbedUrl(embed) ? embed : null}
            watchUrl={trailer.videoUrl}
            providerName={TRAILER_PROVIDER_NAMES[trailer.videoProvider]}
            thumbnailUrl={trailer.thumbnailUrl}
          />
        )
      }
    >
      {viewing.options.length > 0 ? <ViewingOptionList options={viewing.options} filmTitle={film.title} /> : <Empty />}
    </Frame>
  );
}

function Frame({ children, trailer }: { children: ReactNode; trailer?: ReactNode }) {
  return (
    <section id="where-to-watch" aria-labelledby="where-to-watch-heading" className="scroll-mt-24">
      <div className={`grid gap-10 ${trailer ? "lg:grid-cols-[1fr_minmax(0,28rem)]" : ""}`}>
        <div>
          <h2 id="where-to-watch-heading" className="font-display text-3xl font-semibold tracking-tight text-cream">
            Where to Watch
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-cream-muted">
            Official, authorised destinations that NaijaScreen has checked. We link out; we don&rsquo;t host films.
          </p>
          <div className="mt-6">{children}</div>
        </div>
        {trailer && <div>{trailer}</div>}
      </div>
    </section>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-8">
      <p className="text-cream">{EMPTY}</p>
      <p className="mt-2 text-sm text-cream-muted">
        That doesn&rsquo;t mean it can&rsquo;t be watched anywhere, only that we haven&rsquo;t verified a link yet.
      </p>
    </div>
  );
}

/** Placeholder while viewing options stream in. */
export function WhereToWatchSkeleton() {
  return (
    <Frame>
      <div role="status" className="space-y-3">
        <span className="sr-only">Loading viewing options…</span>
        <div aria-hidden="true" className="h-24 animate-pulse rounded-2xl bg-surface" />
        <div aria-hidden="true" className="h-24 animate-pulse rounded-2xl bg-surface" />
      </div>
    </Frame>
  );
}
