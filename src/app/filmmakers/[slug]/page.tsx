import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar, VerifiedBadge } from "@/components/industry/DirectoryCards";
import { ROLE_LABELS, type ProfessionalRole } from "@/lib/industry/constants";
import { asFilmography, getPublicFilmmaker } from "@/lib/industry/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { countryName } from "@/lib/viewing/countries";
import { languageName } from "@/lib/viewing/languages";

export async function generateMetadata({ params }: PageProps<"/filmmakers/[slug]">): Promise<Metadata> {
  const found = isSupabaseConfigured() ? await getPublicFilmmaker((await params).slug) : null;
  return { title: found ? `${found.filmmaker.professional_name} — NaijaScreen` : "Filmmaker — NaijaScreen" };
}

export default function FilmmakerPage({ params }: PageProps<"/filmmakers/[slug]">) {
  if (!isSupabaseConfigured()) notFound();
  return (
    <main id="main" className="relative">
      <Suspense fallback={<p className="mx-auto max-w-5xl px-4 py-16 text-cream-muted" role="status">Loading profile…</p>}>
        <Profile params={params} />
      </Suspense>
    </main>
  );
}

const External = ({ href }: { href: string }) => (
  <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-gold hover:text-cream">
    {href.replace(/^https:\/\//, "").replace(/\/$/, "")}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);

async function Profile({ params }: { params: Promise<{ slug: string }> }) {
  const found = await getPublicFilmmaker((await params).slug);
  if (!found) notFound();
  const { filmmaker: p, companies } = found;
  const filmography = asFilmography(p.filmography);
  const place = [p.city, p.country ? countryName(p.country) : null].filter(Boolean).join(", ");

  return (
    <article className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-cream-muted">
        <Link href="/industry" className="hover:text-gold">
          Industry
        </Link>{" "}
        /{" "}
        <Link href="/industry/filmmakers" className="hover:text-gold">
          Filmmakers
        </Link>
      </nav>
      <header className="flex flex-wrap items-center gap-6">
        <Avatar src={p.avatar_url} name={p.professional_name} size="lg" />
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-cream sm:text-5xl">{p.professional_name}</h1>
          <p className="mt-1 text-lg text-gold">{ROLE_LABELS[p.professional_role as ProfessionalRole] ?? p.professional_role}</p>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-cream-muted">
            {place && <span>{place}</span>}
            {p.verified ? <VerifiedBadge /> : <span>Not verified</span>}
          </p>
        </div>
      </header>

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_18rem]">
        <div className="space-y-8">
          {p.biography && <p className="text-lg leading-relaxed whitespace-pre-line text-cream">{p.biography}</p>}
          {filmography.length > 0 && (
            <section aria-labelledby="filmography">
              <h2 id="filmography" className="mb-3 font-display text-2xl font-semibold text-cream">
                Selected filmography
              </h2>
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {filmography.map((entry) => (
                  <li key={`${entry.title}-${entry.year}-${entry.role}`} className="flex justify-between gap-4 px-4 py-3 text-sm">
                    <span className="text-cream">
                      {entry.title} <span className="text-cream-muted">({entry.year})</span>
                    </span>
                    <span className="text-cream-muted">{entry.role}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-cream-muted">Credits as listed by {p.professional_name}.</p>
            </section>
          )}
        </div>
        <aside className="space-y-6 text-sm">
          {p.expertise.length > 0 && (
            <div>
              <h2 className="font-semibold text-cream">Expertise</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {p.expertise.map((item) => (
                  <li key={item} className="rounded-full border border-line px-3 py-1 text-cream-muted">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.languages.length > 0 && (
            <div>
              <h2 className="font-semibold text-cream">Languages</h2>
              <p className="mt-1 text-cream-muted">{p.languages.map((code) => languageName(code) ?? code).join(", ")}</p>
            </div>
          )}
          {companies.length > 0 && (
            <div>
              <h2 className="font-semibold text-cream">Companies</h2>
              <ul className="mt-1 space-y-1">
                {companies.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/companies/${c.slug}`} className="text-gold hover:text-cream">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(p.website_url || p.portfolio_links.length > 0 || p.social_links.length > 0) && (
            <div>
              <h2 className="font-semibold text-cream">Links</h2>
              <ul className="mt-1 space-y-1">
                {[...(p.website_url ? [p.website_url] : []), ...p.portfolio_links, ...p.social_links].map((link) => (
                  <li key={link}>
                    <External href={link} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}
