import Link from "next/link";

/** NaijaScreen wordmark: an aperture-sun mark with a serif logotype. */
export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="NaijaScreen home" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-8 w-8 shrink-0">
        <circle cx="16" cy="16" r="15" fill="none" stroke="var(--color-gold)" strokeWidth="1.5" />
        <path d="M5 20 A11 11 0 0 1 27 20Z" fill="var(--color-terracotta)" />
        <circle cx="16" cy="13" r="4.5" fill="var(--color-gold)" />
        <rect x="5" y="21.5" width="22" height="1.5" fill="var(--color-palm)" />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight text-cream sm:text-2xl">
        Naija<span className="text-gold">Screen</span>
      </span>
    </Link>
  );
}
