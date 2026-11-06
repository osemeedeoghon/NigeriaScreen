import "server-only";
import { createSupabaseServerClient } from "../supabase/server";
import type { Database } from "@/types/database";
import type { Application, Company, FilmmakerProfileRow, PromotionRequest, PublishedFilm, Submission } from "./queries";

/**
 * Reads for the moderation dashboard. They use the admin's own session, so RLS
 * (is_admin()) is what makes every row visible; a non-admin gets only their
 * own rows back, and the pages also call requireAdmin() first.
 */

export type ModerationNote = Database["public"]["Tables"]["moderation_notes"]["Row"];
export type IndustryAccount = Database["public"]["Functions"]["admin_list_industry_accounts"]["Returns"][number];

const like = (q: string) => `%${q.replace(/[%_,()]/g, " ").trim()}%`;

export async function adminApplications(status: string | null, q: string): Promise<Application[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  let query = supabase.from("industry_applications").select("*").order("submitted_at", { ascending: true, nullsFirst: false }).limit(100);
  if (status) query = query.eq("status", status);
  else query = query.neq("status", "draft");
  if (q) query = query.or(`professional_name.ilike.${like(q)},company_name.ilike.${like(q)}`);
  return (await query).data ?? [];
}

export async function adminProfiles(status: string | null, q: string): Promise<FilmmakerProfileRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  let query = supabase.from("filmmaker_profiles").select("*").order("updated_at", { ascending: false }).limit(100);
  if (status) query = query.eq("verification_status", status);
  if (q) query = query.ilike("professional_name", like(q));
  return (await query).data ?? [];
}

export async function adminCompanies(status: string | null, q: string): Promise<Company[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  let query = supabase.from("production_companies").select("*").order("updated_at", { ascending: false }).limit(100);
  if (status) query = query.eq("review_status", status);
  else query = query.neq("review_status", "draft");
  if (q) query = query.ilike("name", like(q));
  return (await query).data ?? [];
}

export async function adminSubmissions(status: string | null, q: string): Promise<Submission[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  let query = supabase.from("film_submissions").select("*").order("submitted_at", { ascending: true, nullsFirst: false }).limit(100);
  if (status) query = query.eq("status", status);
  else query = query.neq("status", "draft");
  if (q) query = query.or(`title.ilike.${like(q)},director.ilike.${like(q)}`);
  return (await query).data ?? [];
}

export async function adminSubmission(id: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [{ data: submission }, { data: events }, { data: notes }] = await Promise.all([
    supabase.from("film_submissions").select("*").eq("id", id).maybeSingle(),
    supabase.from("submission_events").select("*").eq("submission_id", id).order("created_at"),
    supabase.from("moderation_notes").select("*").eq("subject_type", "submission").eq("subject_id", id).order("created_at"),
  ]);
  if (!submission) return null;
  const company = submission.company_id
    ? (await supabase.from("production_companies").select("name, slug").eq("id", submission.company_id).maybeSingle()).data
    : null;
  return { submission, events: events ?? [], notes: notes ?? [], company };
}

export async function adminPromotions(status: string | null): Promise<(PromotionRequest & { filmTitle: string })[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  let query = supabase.from("promotion_requests").select("*").order("starts_on").limit(100);
  if (status) query = query.eq("status", status);
  const requests = (await query).data ?? [];
  const ids = [...new Set(requests.map((r) => r.film_id))];
  const films = ids.length ? (await supabase.from("published_films").select("id, title").in("id", ids)).data ?? [] : [];
  const titles = new Map(films.map((f) => [f.id, f.title]));
  return requests.map((r) => ({ ...r, filmTitle: titles.get(r.film_id) ?? r.film_id }));
}

export async function adminPublishedFilms(q: string): Promise<PublishedFilm[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  let query = supabase.from("published_films").select("*").order("published_at", { ascending: false }).limit(100);
  if (q) query = query.ilike("title", like(q));
  return (await query).data ?? [];
}

export async function adminAccounts(): Promise<IndustryAccount[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("admin_list_industry_accounts");
  return error ? [] : data;
}

export async function adminNotesFor(subjectType: string, ids: string[]): Promise<Map<string, ModerationNote[]>> {
  const supabase = await createSupabaseServerClient();
  const map = new Map<string, ModerationNote[]>();
  if (!supabase || !ids.length) return map;
  const { data } = await supabase.from("moderation_notes").select("*").eq("subject_type", subjectType).in("subject_id", ids).order("created_at");
  for (const note of data ?? []) map.set(note.subject_id, [...(map.get(note.subject_id) ?? []), note]);
  return map;
}

/** Pending counts for the dashboard tabs. */
export async function adminCounts() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const count = async (table: "industry_applications" | "film_submissions" | "promotion_requests" | "production_companies" | "filmmaker_profiles", column: string, values: string[]) =>
    (await supabase.from(table).select("id", { count: "exact", head: true }).in(column, values)).count ?? 0;
  const [applications, submissions, promotions, companies, profiles] = await Promise.all([
    count("industry_applications", "status", ["pending_review"]),
    count("film_submissions", "status", ["pending_review", "under_review"]),
    count("promotion_requests", "status", ["pending"]),
    count("production_companies", "review_status", ["pending_review"]),
    count("filmmaker_profiles", "verification_status", ["pending"]),
  ]);
  return { applications, submissions, promotions, companies, profiles };
}
