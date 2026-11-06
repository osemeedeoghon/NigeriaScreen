import type { PosterArtwork, PosterMotif } from "@/types";

interface PosterArtProps {
  art: PosterArtwork;
  title: string;
  year?: number;
  /** Larger type for hero and featured placements. */
  size?: "sm" | "lg";
  className?: string;
}

/**
 * Original, code-generated poster artwork. Each film gets a geometric motif
 * in its own palette, so no copyrighted posters or photographs are needed.
 */
export default function PosterArt({ art, title, year, size = "sm", className = "" }: PosterArtProps) {
  const [bg, mid, accent] = art.palette;

  return (
    <div
      role="img"
      aria-label={`Illustrated poster for ${title}: ${art.description}.`}
      className={`relative isolate aspect-[2/3] overflow-hidden rounded-lg ${className}`}
      style={{ background: `linear-gradient(170deg, ${bg} 0%, ${bg} 45%, ${mid} 140%)` }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 200 300"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <Motif motif={art.motif} mid={mid} accent={accent} />
      </svg>
      <div aria-hidden="true" className="grain absolute inset-0 opacity-40" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-3 pt-12 sm:p-4 sm:pt-16"
      >
        <p
          className={`font-display leading-[1.05] font-semibold text-cream ${
            size === "lg" ? "text-2xl sm:text-3xl" : "text-base sm:text-lg"
          }`}
        >
          {title}
        </p>
        {year && <p className="mt-1 text-[0.65rem] tracking-[0.25em] text-cream/80 uppercase">{year}</p>}
      </div>
    </div>
  );
}

function Motif({ motif, mid, accent }: { motif: PosterMotif; mid: string; accent: string }) {
  switch (motif) {
    case "sun":
      return (
        <>
          <circle cx="100" cy="120" r="62" fill={accent} opacity="0.92" />
          <path d="M0 180 Q60 150 120 175 T200 165 V300 H0Z" fill={mid} opacity="0.85" />
          <path d="M0 215 Q70 190 140 212 T200 205 V300 H0Z" fill={mid} opacity="0.55" />
        </>
      );
    case "arch":
      return (
        <>
          <path d="M50 300 V130 A50 50 0 0 1 150 130 V300Z" fill={mid} opacity="0.9" />
          <path d="M72 300 V140 A28 28 0 0 1 128 140 V300Z" fill={accent} opacity="0.85" />
          <circle cx="100" cy="58" r="10" fill={accent} opacity="0.7" />
        </>
      );
    case "stripes":
      return (
        <g transform="rotate(-24 100 150)">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x="-60"
              y={20 + i * 46}
              width="320"
              height="22"
              fill={i % 2 ? accent : mid}
              opacity={0.85 - i * 0.08}
            />
          ))}
        </g>
      );
    case "rings":
      return (
        <g fill="none" stroke={accent}>
          {[18, 36, 54, 72, 90, 108].map((r, i) => (
            <circle key={r} cx="100" cy="125" r={r} strokeWidth={i === 0 ? 6 : 1.5} opacity={0.9 - i * 0.12} />
          ))}
          <circle cx="100" cy="125" r="140" stroke={mid} strokeWidth="30" opacity="0.5" />
        </g>
      );
    case "horizon":
      return (
        <>
          <rect x="0" y="150" width="200" height="150" fill={mid} opacity="0.6" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <line
              key={i}
              x1={-20 + i * 36}
              y1="150"
              x2={i * 60 - 100}
              y2="300"
              stroke={accent}
              strokeWidth="1.5"
              opacity="0.6"
            />
          ))}
          <rect x="0" y="146" width="200" height="4" fill={accent} />
          <circle cx="150" cy="80" r="14" fill={accent} opacity="0.8" />
        </>
      );
    case "diamond":
      return (
        <g>
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2].map((col) => (
              <path
                key={`${row}-${col}`}
                d={`M${col * 70 + (row % 2 ? 35 : 0)} ${row * 70 + 10} l35 35 l-35 35 l-35 -35Z`}
                fill={(row + col) % 2 ? accent : mid}
                opacity="0.8"
              />
            )),
          )}
        </g>
      );
  }
}
