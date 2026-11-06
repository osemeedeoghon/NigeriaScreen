import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AccountSkeleton from "@/components/account/AccountSkeleton";
import AdminActionButton from "@/components/admin/AdminActionButton";
import { ProviderForm } from "@/components/admin/AdminForms";
import AdminSection from "@/components/admin/AdminSection";
import FilmFinder from "@/components/admin/FilmFinder";
import StatusBadge, { CheckDates } from "@/components/admin/StatusBadge";
import SetupNotice from "@/components/auth/SetupNotice";
import { requireAdmin } from "@/lib/auth/admin";
import { getAllFilms, getFilmById } from "@/lib/catalogue";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ACCESS_LABELS } from "@/lib/viewing/availability";
import { setProviderActive } from "@/lib/viewing/actions";
import { countOptionsByFilm, listProviders, listRecentOptionsForAdmin } from "@/lib/viewing/queries";

export const metadata: Metadata = { title: "Where to watch admin — NaijaScreen" };

export default function AdminViewingPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <Suspense fallback={<AccountSkeleton label="Checking administrator access…" />}>
      <AdminViewingOverview />
    </Suspense>
  );
}

async function AdminViewingOverview() {
  await requireAdmin("/admin/viewing");
  const [providers, recent, counts] = await Promise.all([listProviders(), listRecentOptionsForAdmin(), countOptionsByFilm()]);
  const films = getAllFilms()
    .map((film) => ({ slug: film.slug, title: film.title, year: film.releaseYear, options: counts?.get(film.id) ?? 0 }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-cream">Where to watch</h1>
        <p className="mt-2 max-w-3xl text-cream-muted">
          Add only official, authorised destinations. New links stay pending and hidden until you verify them against the
          provider&rsquo;s own site. The sample catalogue is fictional, so real films need real records before anything here is
          meaningful.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-2">
        <AdminSection id="films-heading" title="Films" description="Open a film to manage its viewing options and trailers.">
          <FilmFinder films={films} />
        </AdminSection>

        <AdminSection id="recent-heading" title="Recently changed options">
          {recent === null ? (
            <LoadError />
          ) : recent.length === 0 ? (
            <p className="text-sm text-cream-muted">No viewing options yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((option) => {
                const film = getFilmById(option.filmId);
                return (
                  <li key={option.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={film ? `/admin/viewing/${film.slug}` : "/admin/viewing"} className="font-semibold text-cream hover:text-gold">
                        {film?.title ?? option.filmId}
                      </Link>
                      <StatusBadge status={option.verificationStatus} active={option.isActive} />
                    </div>
                    <p className="mt-1 text-sm text-cream-muted">
                      {option.provider.name} · {ACCESS_LABELS[option.accessType].label}
                    </p>
                    <CheckDates verifiedAt={option.verifiedAt} lastCheckedAt={option.lastCheckedAt} />
                  </li>
                );
              })}
            </ul>
          )}
        </AdminSection>
      </div>

      <AdminSection id="providers-heading" title="Providers" description="Platforms viewers are sent to. Deactivating one hides all of its links.">
        {providers === null ? (
          <LoadError />
        ) : providers.length === 0 ? (
          <p className="mb-6 text-sm text-cream-muted">No providers yet. Add the first one below.</p>
        ) : (
          <ul className="mb-8 divide-y divide-line rounded-2xl border border-line">
            {providers.map((provider) => (
              <li key={provider.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-cream">
                      {provider.name} {!provider.isActive && <span className="ml-1 text-xs text-cream-muted">(inactive)</span>}
                    </p>
                    <a href={provider.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm break-all text-gold hover:text-cream">
                      {provider.websiteUrl}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </div>
                  {provider.isActive ? (
                    <AdminActionButton
                      label="Deactivate"
                      tone="danger"
                      confirm={`Hide ${provider.name} and all of its links from viewers?`}
                      run={setProviderActive.bind(null, provider.id, false)}
                    />
                  ) : (
                    <AdminActionButton label="Reactivate" tone="positive" run={setProviderActive.bind(null, provider.id, true)} />
                  )}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-cream-muted hover:text-cream">Edit {provider.name}</summary>
                  <div className="mt-4">
                    <ProviderForm provider={provider} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <h3 className="mb-4 font-semibold text-cream">Add a provider</h3>
        <ProviderForm />
      </AdminSection>
    </div>
  );
}

function LoadError() {
  return (
    <p role="alert" className="rounded-xl border border-terracotta/60 bg-clay/20 px-4 py-3 text-sm text-cream">
      This couldn&rsquo;t be loaded. Refresh to try again.
    </p>
  );
}
