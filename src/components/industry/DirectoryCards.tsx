import Link from "next/link";
import { ROLE_LABELS, type ProfessionalRole } from "@/lib/industry/constants";
import type { PublicCompany, PublicFilmmaker, PublishedFilm } from "@/lib/industry/queries";
import { countryName } from "@/lib/viewing/countries";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

/** Admin- or owner-supplied https image, or initials on a woven background. */
export function Avatar({ src, name, size = "md" }: { src: string | null; name: string; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-28 w-28 text-3xl" : "h-14 w-14 text-lg";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary https hosts entered by profile owners
    <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" className={`${box} shrink-0 rounded-full bg-surface object-cover`} />
  ) : (
    <span aria-hidden="true" className={`${box} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-terracotta to-gold-deep font-display font-semibold text-ink`}>
      {initials(name)}
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-palm/60 px-2 py-0.5 text-xs font-semibold text-palm">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Verified
    </span>
  );
}

const place = (city: string | null, country: string | null) => [city, country ? countryName(country) : null].filter(Boolean).join(", ");

export function FilmmakerCard({ person }: { person: PublicFilmmaker }) {
  return (
    <li className="relative flex gap-4 rounded-2xl border border-line bg-ink-2 p-5 transition-colors focus-within:border-gold hover:border-gold">
      <Avatar src={person.avatar_url} name={person.professional_name} />
      <div className="min-w-0">
        <h3 className="font-semibold text-cream">
          <Link href={`/filmmakers/${person.slug}`} className="after:absolute after:inset-0 after:rounded-2xl">
            {person.professional_name}
          </Link>
        </h3>
        <p className="text-sm text-gold">{ROLE_LABELS[person.professional_role as ProfessionalRole] ?? person.professional_role}</p>
        <p className="mt-1 text-xs text-cream-muted">{place(person.city, person.country) || "Location not shown"}</p>
        {person.verified && (
          <div className="mt-2">
            <VerifiedBadge />
          </div>
        )}
      </div>
    </li>
  );
}

export function CompanyCard({ company }: { company: PublicCompany }) {
  return (
    <li className="relative flex gap-4 rounded-2xl border border-line bg-ink-2 p-5 transition-colors focus-within:border-gold hover:border-gold">
      <Avatar src={company.logo_url} name={company.name} />
      <div className="min-w-0">
        <h3 className="font-semibold text-cream">
          <Link href={`/companies/${company.slug}`} className="after:absolute after:inset-0 after:rounded-2xl">
            {company.name}
          </Link>
        </h3>
        <p className="mt-1 text-xs text-cream-muted">{place(company.city, company.country) || "Location not shown"}</p>
        <p className="mt-2 line-clamp-2 text-sm text-cream-muted">{company.description}</p>
        {company.verified && (
          <div className="mt-2">
            <VerifiedBadge />
          </div>
        )}
      </div>
    </li>
  );
}

/** Card for a film listed from an approved submission (not part of the sample catalogue). */
export function PublishedFilmCard({ film, label }: { film: PublishedFilm; label?: string }) {
  return (
    <li className="relative flex flex-col rounded-xl p-2 transition-colors focus-within:bg-surface hover:bg-surface">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-gradient-to-br from-clay to-ink">
        {film.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- official poster link supplied with the submission
          <img src={film.poster_url} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div aria-hidden="true" className="texture-adire flex h-full items-end p-4">
            <span className="font-display text-xl font-semibold text-cream">{film.title}</span>
          </div>
        )}
        {label && <span className="absolute top-2 left-2 rounded-md bg-ink/85 px-2 py-0.5 text-xs font-semibold text-gold">{label}</span>}
      </div>
      <h3 className="mt-3 px-1 font-display text-lg leading-snug font-semibold text-cream">
        <Link href={`/films/${film.slug}`} className="after:absolute after:inset-0 after:rounded-xl">
          {film.title}
        </Link>
      </h3>
      <p className="px-1 text-sm text-cream-muted">
        {film.release_year} · {film.runtime_minutes} min
      </p>
    </li>
  );
}
