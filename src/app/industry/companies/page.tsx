import type { Metadata } from "next";
import { Suspense } from "react";
import { CompanyCard } from "@/components/industry/DirectoryCards";
import DirectoryFilters, { FilterSelect, FilterText } from "@/components/industry/DirectoryFilters";
import { EmptyState } from "@/components/industry/Panel";
import { countryOptions } from "@/lib/industry/options";
import { getPublicCompanies } from "@/lib/industry/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isCountryCode } from "@/lib/viewing/countries";

export const metadata: Metadata = { title: "Production companies — NaijaScreen" };

export default function CompaniesPage({ searchParams }: PageProps<"/industry/companies">) {
  if (!isSupabaseConfigured()) return <EmptyState title="The directory isn't connected yet" />;
  return (
    <Suspense fallback={<p className="text-sm text-cream-muted" role="status">Loading companies…</p>}>
      <Companies searchParams={searchParams} />
    </Suspense>
  );
}

async function Companies({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const get = (key: string) => (typeof params[key] === "string" ? (params[key] as string).trim().slice(0, 80) : "");
  const country = isCountryCode(get("country").toUpperCase()) ? get("country").toUpperCase() : "";
  const city = get("city");
  const companies = await getPublicCompanies({ country: country || null, city: city || null });
  const active = Boolean(country || city);
  return (
    <div>
      <DirectoryFilters action="/industry/companies" active={active}>
        <FilterSelect label="Country" name="country" value={country} anyLabel="Any country" options={countryOptions()} />
        <FilterText label="City" name="city" value={city} />
      </DirectoryFilters>
      <p role="status" className="mb-4 text-sm text-cream-muted">
        {companies.length} {companies.length === 1 ? "company" : "companies"}
      </p>
      {companies.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <CompanyCard key={c.slug} company={c} />
          ))}
        </ul>
      ) : (
        <EmptyState title={active ? "No companies match these filters" : "No approved companies yet"} />
      )}
    </div>
  );
}
