import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar, PublishedFilmCard, VerifiedBadge } from "@/components/industry/DirectoryCards";
import { ROLE_LABELS, type ProfessionalRole } from "@/lib/industry/constants";
import { getPublicCompany } from "@/lib/industry/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { countryName } from "@/lib/viewing/countries";

export async function generateMetadata({ params }: PageProps<"/companies/[slug]">): Promise<Metadata> {
  const found = isSupabaseConfigured() ? await getPublicCompany((await params).slug) : null;
  return { title: found ? `${found.company.name} — NaijaScreen` : "Production company — NaijaScreen" };
}

export default function CompanyPage({ params }: PageProps<"/companies/[slug]">) {
  if (!isSupabaseConfigured()) notFound();
  return (
    <main id="main">
      <Suspense fallback={<p className="mx-auto max-w-5xl px-4 py-16 text-cream-muted" role="status">Loading company…</p>}>
        <Company params={params} />
      </Suspense>
    </main>
  );
}

async function Company({ params }: { params: Promise<{ slug: string }> }) {
  const found = await getPublicCompany((await params).slug);
  if (!found) notFound();
  const { company: c, members, films } = found;
  const place = [c.city, c.country ? countryName(c.country) : null].filter(Boolean).join(", ");
  const links = [...(c.website_url ? [c.website_url] : []), ...c.social_links];

  return (
    <article className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-cream-muted">
        <Link href="/industry" className="hover:text-gold">
          Industry
        </Link>{" "}
        /{" "}
        <Link href="/industry/companies" className="hover:text-gold">
          Production companies
        </Link>
      </nav>
      <header className="flex flex-wrap items-center gap-6">
        <Avatar src={c.logo_url} name={c.name} size="lg" />
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-cream sm:text-5xl">{c.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-cream-muted">
            {place && <span>{place}</span>}
            {c.verified ? <VerifiedBadge /> : <span>Not verified</span>}
          </p>
        </div>
      </header>

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_18rem]">
        <div className="space-y-10">
          <p className="text-lg leading-relaxed whitespace-pre-line text-cream">{c.description}</p>
          <section aria-labelledby="company-films">
            <h2 id="company-films" className="mb-4 font-display text-2xl font-semibold text-cream">
              Films
            </h2>
            {films.length ? (
              <ul className="grid grid-cols-2 gap-x-2 gap-y-6 sm:grid-cols-3">
                {films.map((f) => (
                  <PublishedFilmCard key={f.id} film={f} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-cream-muted">No approved films listed yet.</p>
            )}
          </section>
          <section aria-labelledby="company-people">
            <h2 id="company-people" className="mb-4 font-display text-2xl font-semibold text-cream">
              People
            </h2>
            {members.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {members.map((m) => (
                  <li key={m.slug} className="rounded-xl border border-line p-4 text-sm">
                    <Link href={`/filmmakers/${m.slug}`} className="font-semibold text-cream hover:text-gold">
                      {m.professional_name}
                    </Link>
                    <p className="text-cream-muted">
                      {ROLE_LABELS[m.professional_role as ProfessionalRole] ?? m.professional_role}
                      {m.member_role === "owner" && " · Owner"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-cream-muted">No public team profiles yet.</p>
            )}
          </section>
        </div>
        <aside className="space-y-6 text-sm">
          {(c.public_email || c.public_phone) && (
            <div>
              <h2 className="font-semibold text-cream">Contact</h2>
              {c.public_email && (
                <p className="mt-1">
                  <a href={`mailto:${encodeURIComponent(c.public_email).replace("%40", "@")}`} className="text-gold hover:text-cream">
                    {c.public_email}
                  </a>
                </p>
              )}
              {c.public_phone && <p className="mt-1 text-cream-muted">{c.public_phone}</p>}
              <p className="mt-1 text-xs text-cream-muted">Published by the company.</p>
            </div>
          )}
          {links.length > 0 && (
            <div>
              <h2 className="font-semibold text-cream">Links</h2>
              <ul className="mt-1 space-y-1">
                {links.map((link) => (
                  <li key={link}>
                    <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-gold hover:text-cream">
                      {link.replace(/^https:\/\//, "").replace(/\/$/, "")}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
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
