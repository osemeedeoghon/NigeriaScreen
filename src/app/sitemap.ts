import type { MetadataRoute } from "next";
import { getAllFilms, getAllGenres } from "@/lib/catalogue";
import { getSiteUrl } from "@/lib/supabase/config";

/**
 * Public, catalogue-backed pages. Database-backed pages (filmmaker-listed
 * films, profiles, companies) aren't listed yet; see the README.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const pages = ["", "/films", "/industry", "/industry/filmmakers", "/industry/companies"].map((path) => ({ url: `${base}${path}` }));
  const films = getAllFilms().map((film) => ({ url: `${base}/films/${film.slug}`, lastModified: film.createdAt }));
  const genres = getAllGenres().map((genre) => ({ url: `${base}/genres/${genre.slug}` }));
  return [...pages, ...films, ...genres];
}
