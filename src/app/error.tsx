"use client";

import Link from "next/link";

/**
 * Shown when a page fails to render, for example if Supabase is unreachable
 * in a way a section didn't handle. No error details are shown to visitors.
 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="relative overflow-hidden">
      <div aria-hidden="true" className="texture-adire absolute inset-0" />
      <div className="relative mx-auto flex min-h-[60vh] max-w-3xl flex-col items-start justify-center px-4 py-20 sm:px-6">
        <p className="text-xs font-semibold tracking-[0.25em] text-terracotta uppercase">Something went wrong</p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-cream sm:text-5xl">The projector jammed.</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-cream-muted">
          This page couldn&rsquo;t load just now. It&rsquo;s probably temporary, so please try again.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-cream">
            Try again
          </button>
          <Link href="/" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:border-gold">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
