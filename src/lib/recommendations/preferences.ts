/** Validation for the discovery preferences form. Pure, so it runs in node --test. */
import { field, type Validated } from "../auth/validation.ts";
import { getAllGenres } from "../catalogue.ts";
import { LANGUAGE_CODES } from "../catalogueLanguages.ts";
import type { GenreSlug } from "../../types/index.ts";
import type { DiscoveryPreferences } from "./types.ts";

const LANGUAGE_VALUES = new Set(Object.values(LANGUAGE_CODES));

/** Only languages and genres that exist in the catalogue can be saved. */
export function validatePreferences(form: FormData): Validated<DiscoveryPreferences, "languages" | "genres"> {
  const genreSlugs = new Set<string>(getAllGenres().map((genre) => genre.slug));
  const languages = [...new Set(form.getAll("languages").filter((v): v is string => typeof v === "string"))];
  const genres = [...new Set(form.getAll("genres").filter((v): v is string => typeof v === "string"))];

  const badLanguages = languages.filter((code) => !LANGUAGE_VALUES.has(code));
  const badGenres = genres.filter((slug) => !genreSlugs.has(slug));
  if (badLanguages.length || badGenres.length) {
    return {
      ok: false,
      errors: {
        languages: badLanguages.length ? "Choose languages from the list." : undefined,
        genres: badGenres.length ? "Choose genres from the list." : undefined,
      },
    };
  }
  // Keep a stable order so saved preferences don't churn.
  const languageOrder = Object.values(LANGUAGE_CODES);
  const genreOrder = getAllGenres().map((genre) => genre.slug as string);
  return {
    ok: true,
    data: {
      languages: languages.sort((a, b) => languageOrder.indexOf(a) - languageOrder.indexOf(b)),
      genres: genres.sort((a, b) => genreOrder.indexOf(a) - genreOrder.indexOf(b)) as GenreSlug[],
      includeWatched: field(form, "includeWatched") === "on",
    },
  };
}
