// Route existence checks used by src/proxy.ts to return real 404 statuses.
import { getAllFilmSlugs, getAllGenres } from "./catalogue.ts";

const filmSlugs = new Set(getAllFilmSlugs());
const genreSlugs = new Set(getAllGenres().map((genre) => genre.slug));

/**
 * False when the path is a film or genre detail route whose slug is not in the
 * catalogue. Every other path is left to the router.
 */
export function isKnownCatalogueRoute(pathname: string): boolean {
  const match = /^\/(films|genres)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return true;
  let slug: string;
  try {
    slug = decodeURIComponent(match[2]);
  } catch {
    return false;
  }
  return (match[1] === "films" ? filmSlugs : genreSlugs).has(slug);
}

export type DatabaseRoute = { kind: "film" | "filmmaker" | "company"; slug: string };

/**
 * Detail routes whose records live in Supabase: films outside the catalogue
 * (listed from approved submissions), filmmaker profiles and companies. The
 * proxy checks these exist so unknown addresses get a real 404. Returns null
 * for every other path, and for slugs that can't be valid.
 */
export function databaseRoute(pathname: string): DatabaseRoute | null {
  const match = /^\/(films|filmmakers|companies)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(match[2]);
  } catch {
    return null;
  }
  if (match[1] === "films" && filmSlugs.has(slug)) return null;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) return null;
  return { kind: match[1] === "films" ? "film" : match[1] === "filmmakers" ? "filmmaker" : "company", slug };
}
