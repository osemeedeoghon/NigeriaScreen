import type { Metadata } from "next";
import { Suspense } from "react";
import { FilmmakerCard } from "@/components/industry/DirectoryCards";
import DirectoryFilters, { FilterSelect, FilterText } from "@/components/industry/DirectoryFilters";
import { EmptyState } from "@/components/industry/Panel";
import { PROFESSIONAL_ROLES, ROLE_LABELS } from "@/lib/industry/constants";
import { countryOptions, languageOptions } from "@/lib/industry/options";
import { getPublicCompanies, getPublicFilmmakers } from "@/lib/industry/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isCountryCode } from "@/lib/viewing/countries";
import { isLanguageCode } from "@/lib/viewing/languages";

export const metadata: Metadata = { title: "Filmmakers — NaijaScreen" };

export default function FilmmakersPage({ searchParams }: PageProps<"/industry/filmmakers">) {
  if (!isSupabaseConfigured()) return <EmptyState title="The directory isn't connected yet" />;
  return (
    <Suspense fallback={<p className="text-sm text-cream-muted" role="status">Loading filmmakers…</p>}>
      <Filmmakers searchParams={searchParams} />
    </Suspense>
  );
}

async function Filmmakers({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const get = (key: string) => (typeof params[key] === "string" ? (params[key] as string).trim().slice(0, 80) : "");
  // Unknown values are ignored rather than passed on.
  const role = (PROFESSIONAL_ROLES as readonly string[]).includes(get("role")) ? get("role") : "";
  const country = isCountryCode(get("country").toUpperCase()) ? get("country").toUpperCase() : "";
  const language = isLanguageCode(get("language")) ? get("language") : "";
  const city = get("city");
  const company = /^[a-z0-9-]+$/.test(get("company")) ? get("company") : "";

  const [people, companies] = await Promise.all([
    getPublicFilmmakers({ role: role || null, country: country || null, city: city || null, language: language || null, company: company || null }),
    getPublicCompanies({}),
  ]);
  const active = Boolean(role || country || city || language || company);

  return (
    <div>
      <DirectoryFilters action="/industry/filmmakers" active={active}>
        <FilterSelect label="Role" name="role" value={role} anyLabel="Any role" options={PROFESSIONAL_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
        <FilterSelect label="Country" name="country" value={country} anyLabel="Any country" options={countryOptions()} />
        <FilterText label="City" name="city" value={city} />
        <FilterSelect label="Language" name="language" value={language} anyLabel="Any language" options={languageOptions()} />
        <FilterSelect label="Company" name="company" value={company} anyLabel="Any company" options={companies.map((c) => ({ value: c.slug, label: c.name }))} />
      </DirectoryFilters>
      <p role="status" className="mb-4 text-sm text-cream-muted">
        {people.length} {people.length === 1 ? "filmmaker" : "filmmakers"}
      </p>
      {people.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => (
            <FilmmakerCard key={p.slug} person={p} />
          ))}
        </ul>
      ) : (
        <EmptyState title={active ? "No filmmakers match these filters" : "No public filmmaker profiles yet"}>
          {active ? "Try removing a filter." : "Approved filmmakers appear here once they make their profile public."}
        </EmptyState>
      )}
    </div>
  );
}
