"use client";

import { useState } from "react";

interface TrailerPlayerProps {
  title: string;
  filmTitle: string;
  /** Built on the server from a validated provider and video id, or null when embedding is off. */
  embedUrl: string | null;
  watchUrl: string;
  providerName: string;
  thumbnailUrl: string | null;
}

/**
 * Click-to-play trailer. Nothing loads from the video provider until the
 * viewer presses play, and the iframe is sandboxed. A plain link is always
 * offered, because the owner may remove the video or switch off embedding.
 */
export default function TrailerPlayer({ title, filmTitle, embedUrl, watchUrl, providerName, thumbnailUrl }: TrailerPlayerProps) {
  const [playing, setPlaying] = useState(false);

  return (
    <figure>
      <h3 className="text-sm font-semibold tracking-[0.2em] text-gold uppercase">Trailer</h3>
      <div className="relative mt-3 aspect-video overflow-hidden rounded-2xl border border-line bg-ink-2">
        {playing && embedUrl ? (
          <iframe
            src={embedUrl}
            title={`${title}: ${filmTitle} trailer on ${providerName}`}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
            loading="lazy"
          />
        ) : (
          <>
            {thumbnailUrl ? (
              // Admin-supplied https thumbnail from the video platform.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnailUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-70" />
            ) : (
              <div aria-hidden="true" className="texture-adire absolute inset-0 bg-gradient-to-br from-clay/60 to-ink" />
            )}
            {embedUrl ? (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-cream"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold text-ink shadow-xl shadow-black/50 transition-transform hover:scale-105">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor">
                    <path d="M7 5v14l12-7z" />
                  </svg>
                </span>
                <span className="text-sm font-semibold">
                  Play trailer<span className="sr-only">: {title}</span>
                </span>
              </button>
            ) : (
              <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-cream">
                This trailer can only be watched on {providerName}.
              </p>
            )}
          </>
        )}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-cream">{title}</span>
        <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold hover:text-cream">
          Watch on {providerName}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </figcaption>
      {embedUrl && (
        <p className="mt-1 text-xs text-cream-muted">
          Playing loads {providerName}&rsquo;s player. If it won&rsquo;t play, the owner may have removed or restricted the video.
        </p>
      )}
    </figure>
  );
}
