import "server-only";
import { createPublicSupabaseClient } from "../supabase/public";
import { createSupabaseServerClient } from "../supabase/server";
import type { Database } from "@/types/database";
import type { FilmographyEntry, ViewingLink } from "./validation";

type Tables = Database["public"]["Tables"];
export type Application = Tables["industry_applications"]["Row"];
export type FilmmakerProfileRow = Tables["filmmaker_profiles"]["Row"];
export type Company = Tables["production_companies"]["Row"];
export type CompanyMember = Tables["company_members"]["Row"];
export type Submission = Tables["film_submissions"]["Row"];
export type SubmissionEvent = Tables["submission_events"]["Row"];
export type PromotionRequest = Tables["promotion_requests"]["Row"];
export type PublishedFilm = Tables["published_films"]["Row"];
export type Notification = Tables["notifications"]["Row"];
export type PublicFilmmaker = Database["public"]["Functions"]["get_public_filmmakers"]["Returns"][number];
export type PublicCompany = Database["public"]["Functions"]["get_public_companies"]["Returns"][number];

export const asFilmography = (value: unknown): FilmographyEntry[] => (Array.isArray(value) ? (value as FilmographyEntry[]) : []);
export const asViewingLinks = (value: unknown): ViewingLink[] => (Array.isArray(value) ? (value as ViewingLink[]) : []);

// ---------------------------------------------------------------------------
// The signed-in user's own records (RLS limits every query to them)
// ---------------------------------------------------------------------------

async function client() {
  return createSupabaseServerClient();
}

export async function getOwnApplication(userId: string): Promise<Application | null> {
  const supabase = await client();
  if (!supabase) return null;
  return (await supabase.from("industry_applications").select("*").eq("user_id", userId).maybeSingle()).data;
}

export async function getOwnFilmmakerProfile(userId: string): Promise<FilmmakerProfileRow | null> {
  const supabase = await client();
  if (!supabase) return null;
  return (await supabase.from("filmmaker_profiles").select("*").eq("user_id", userId).maybeSingle()).data;
}

export type RosterEntry = Database["public"]["Functions"]["get_company_roster"]["Returns"][number];

export interface OwnCompany {
  company: Company;
  membership: CompanyMember;
  roster: RosterEntry[];
}

/** Companies the user owns, manages, belongs to or is invited to, with their rosters. */
export async function getOwnCompanies(userId: string): Promise<OwnCompany[]> {
  const supabase = await client();
  if (!supabase) return [];
  const { data: memberships } = await supabase.from("company_members").select("*").eq("user_id", userId);
  if (!memberships?.length) return [];
  const { data: companies } = await supabase
    .from("production_companies")
    .select("*")
    .in("id", memberships.map((m) => m.company_id))
    .order("name");
  return Promise.all(
    (companies ?? []).map(async (company) => ({
      company,
      membership: memberships.find((m) => m.company_id === company.id)!,
      roster: (await supabase.rpc("get_company_roster", { p_company_id: company.id })).data ?? [],
    })),
  );
}

export async function getOwnSubmissions(): Promise<Submission[] | null> {
  const supabase = await client();
  if (!supabase) return null;
  const { data, error } = await supabase.from("film_submissions").select("*").order("updated_at", { ascending: false });
  return error ? null : data;
}

export async function getSubmissionWithHistory(id: string) {
  const supabase = await client();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [{ data: submission }, { data: events }] = await Promise.all([
    supabase.from("film_submissions").select("*").eq("id", id).maybeSingle(),
    supabase.from("submission_events").select("*").eq("submission_id", id).order("created_at"),
  ]);
  return submission ? { submission, events: events ?? [] } : null;
}

/** Published films from the user's own submissions (the only ones they may promote). */
export async function getOwnPublishedFilms(): Promise<PublishedFilm[]> {
  const supabase = await client();
  if (!supabase) return [];
  const { data: subs } = await supabase.from("film_submissions").select("published_film_id").not("published_film_id", "is", null);
  const ids = (subs ?? []).map((s) => s.published_film_id!).filter(Boolean);
  if (!ids.length) return [];
  return (await supabase.from("published_films").select("*").in("id", ids).eq("is_active", true).order("title")).data ?? [];
}

export async function getOwnPromotions(): Promise<PromotionRequest[] | null> {
  const supabase = await client();
  if (!supabase) return null;
  const { data, error } = await supabase.from("promotion_requests").select("*").order("created_at", { ascending: false });
  return error ? null : data;
}

export async function getOwnNotifications(limit = 50): Promise<Notification[] | null> {
  const supabase = await client();
  if (!supabase) return null;
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(limit);
  return error ? null : data;
}

export async function countUnreadNotifications(): Promise<number> {
  const supabase = await client();
  if (!supabase) return 0;
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Public directory (security definer functions; approved, visible records only)
// ---------------------------------------------------------------------------

export interface FilmmakerFilters {
  role?: string | null;
  country?: string | null;
  city?: string | null;
  language?: string | null;
  company?: string | null;
}

export async function getPublicFilmmakers(filters: FilmmakerFilters): Promise<PublicFilmmaker[]> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_public_filmmakers", {
    p_role: filters.role ?? null,
    p_country: filters.country ?? null,
    p_city: filters.city ?? null,
    p_language: filters.language ?? null,
    p_company_slug: filters.company ?? null,
  });
  return error ? [] : data;
}

export async function getPublicFilmmaker(slug: string): Promise<{ filmmaker: PublicFilmmaker; companies: { slug: string; name: string }[] } | null> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const [{ data }, { data: companies }] = await Promise.all([
    supabase.rpc("get_public_filmmakers", { p_slug: slug }),
    supabase.rpc("get_public_filmmaker_companies", { p_filmmaker_slug: slug }),
  ]);
  return data?.[0] ? { filmmaker: data[0], companies: companies ?? [] } : null;
}

export async function getPublicCompanies(filters: { country?: string | null; city?: string | null }): Promise<PublicCompany[]> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_public_companies", { p_country: filters.country ?? null, p_city: filters.city ?? null });
  return error ? [] : data;
}

export async function getPublicCompany(slug: string) {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const [{ data }, { data: members }] = await Promise.all([
    supabase.rpc("get_public_companies", { p_slug: slug }),
    supabase.rpc("get_public_company_members", { p_company_slug: slug }),
  ]);
  const company = data?.[0];
  if (!company) return null;
  const { data: films } = await supabase
    .from("published_films")
    .select("*")
    .eq("company_id", company.id)
    .eq("is_active", true)
    .order("release_year", { ascending: false });
  return { company, members: members ?? [], films: films ?? [] };
}

export async function getPublishedFilmBySlug(slug: string): Promise<PublishedFilm | null> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.from("published_films").select("*").eq("slug", slug).eq("is_active", true).maybeSingle();
  return data;
}

export async function getRecentPublishedFilms(limit = 12): Promise<PublishedFilm[]> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data } = await supabase.from("published_films").select("*").eq("is_active", true).order("published_at", { ascending: false }).limit(limit);
  return data ?? [];
}
