import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <main id="main" className="relative overflow-hidden">
        <div aria-hidden="true" className="texture-adire absolute inset-0" />
        <div className="relative mx-auto flex min-h-[60vh] max-w-3xl flex-col items-start justify-center px-4 py-20 sm:px-6">
          <p className="text-xs font-semibold tracking-[0.25em] text-gold uppercase">404 · Not found</p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-cream sm:text-5xl">
            This reel seems to be missing.
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-cream-muted">
            We couldn&rsquo;t find that film, genre or page in the NaijaScreen catalogue. It may have moved, or the link may be
            mistyped.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/films"
              className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-cream"
            >
              Browse all films
            </Link>
            <Link
              href="/"
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:border-gold"
            >
              Back to home
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
