/** Select options shared by the portal forms and directory filters. */
import { getAllGenres } from "../catalogue.ts";
import { LANGUAGE_CODES } from "../catalogueLanguages.ts";
import { COUNTRY_CODES, PRIORITY_COUNTRIES, countryName } from "../viewing/countries.ts";
import { COMMON_LANGUAGES, languageName } from "../viewing/languages.ts";

export function countryOptions() {
  const rest = [...COUNTRY_CODES].filter((code) => !PRIORITY_COUNTRIES.includes(code)).sort((a, b) => countryName(a).localeCompare(countryName(b)));
  return [...PRIORITY_COUNTRIES, ...rest].map((code) => ({ value: code, label: countryName(code) }));
}

/** Catalogue languages first, then other common ones. */
export function languageOptions() {
  const codes = [...new Set([...Object.values(LANGUAGE_CODES), ...COMMON_LANGUAGES])];
  return codes.map((code) => ({ value: code, label: languageName(code) ?? code }));
}

export function genreOptions() {
  return getAllGenres().map((genre) => ({ value: genre.slug, label: genre.name }));
}
