/**
 * How verified viewing options are chosen and presented. Pure functions shared
 * by the film page and tests.
 */
import type { AccessType, FilmViewingOption } from "../../types/viewing.ts";
import { countryName } from "./countries.ts";

export const ACCESS_LABELS: Record<AccessType, { label: string; action: string }> = {
  subscription: { label: "Subscription", action: "Watch now" },
  free: { label: "Free", action: "Watch free" },
  free_with_ads: { label: "Free with ads", action: "Watch free" },
  rental: { label: "Rent", action: "Rent" },
  purchase: { label: "Buy", action: "Buy" },
  other: { label: "Other", action: "View options" },
};

/** Free first, then subscription, rental, purchase. */
const ACCESS_ORDER: AccessType[] = ["free", "free_with_ads", "subscription", "rental", "purchase", "other"];

/**
 * Options that may be presented as confirmed. The database already filters
 * these for visitors; this is a second check so an administrator's view of
 * the public page never shows unconfirmed links.
 */
export function confirmedOptions(options: FilmViewingOption[]): FilmViewingOption[] {
  return options
    .filter((option) => option.isActive && option.verificationStatus === "verified" && option.provider.isActive)
    .sort(
      (a, b) =>
        ACCESS_ORDER.indexOf(a.accessType) - ACCESS_ORDER.indexOf(b.accessType) ||
        a.provider.name.localeCompare(b.provider.name),
    );
}

/** Options verified for one country. `null` means "all countries". */
export function filterByCountry(options: FilmViewingOption[], country: string | null): FilmViewingOption[] {
  return country ? options.filter((option) => option.countries.includes(country)) : options;
}

/** Every country covered by at least one option, sorted by name. */
export function coveredCountries(options: FilmViewingOption[]): { code: string; name: string }[] {
  const codes = new Set(options.flatMap((option) => option.countries));
  return [...codes].map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
}

/** "Nigeria, Ghana and 3 more" for compact display. */
export function summariseCountries(codes: string[], limit = 3): string {
  const names = codes.map(countryName);
  if (names.length <= limit) return listFormat.format(names);
  return `${names.slice(0, limit).join(", ")} and ${names.length - limit} more`;
}

const listFormat = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
