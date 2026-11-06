import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CompanyCard, FilmmakerCard, PublishedFilmCard } from "@/components/industry/DirectoryCards";
import { EmptyState } from "@/components/industry/Panel";
import { getPublicCompanies, getPublicFilmmakers, getRecentPublishedFilms } from "@/lib/industry/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Industry directory — NaijaScreen" };

export default function IndustryPage() {
  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold/50 p-6">
        <p className="max-w-2xl text-cream">Work in film? Apply for a filmmaker account to list your profile, your company and your films.</p>
        <Link href="/filmmaker/onboarding" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink hover:bg-cream">
          Apply for filmmaker access
        </Link>
      </div>
      {isSupabaseConfigured() ? (
        <Suspense fallback={<p className="text-sm text-cream-muted" role="status">Loading the directory…</p>}>
          <Overview />
        </Suspense>
      ) : (
        <EmptyState title="The directory isn't connected yet">It fills in once accounts are switched on.</EmptyState>
      )}
    </div>
  );
}

async function Overview() {
  const [filmmakers, companies, films] = await Promise.all([getPublicFilmmakers({}), getPublicCompanies({}), getRecentPublishedFilms(6)]);
  return (
    <>
      <section aria-labelledby="ov-filmmakers">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="ov-filmmakers" className="font-display text-2xl font-semibold text-cream">
            Filmmakers
          </h2>
          <Link href="/industry/filmmakers" className="text-sm font-semibold text-gold hover:text-cream">
            See all {filmmakers.length} →
          </Link>
        </div>
        {filmmakers.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filmmakers.slice(0, 6).map((p) => (
              <FilmmakerCard key={p.slug} person={p} />
            ))}
          </ul>
        ) : (
          <EmptyState title="No public filmmaker profiles yet">Approved filmmakers appear here once they make their profile public.</EmptyState>
        )}
      </section>
      <section aria-labelledby="ov-companies">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="ov-companies" className="font-display text-2xl font-semibold text-cream">
            Production companies
          </h2>
          <Link href="/industry/companies" className="text-sm font-semibold text-gold hover:text-cream">
            See all {companies.length} →
          </Link>
        </div>
        {companies.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.slice(0, 6).map((c) => (
              <CompanyCard key={c.slug} company={c} />
            ))}
          </ul>
        ) : (
          <EmptyState title="No approved companies yet" />
        )}
      </section>
      {films.length > 0 && (
        <section aria-labelledby="ov-films">
          <h2 id="ov-films" className="mb-4 font-display text-2xl font-semibold text-cream">
            Newly listed by filmmakers
          </h2>
          <ul className="grid grid-cols-2 gap-x-2 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            {films.map((f) => (
              <PublishedFilmCard key={f.id} film={f} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
