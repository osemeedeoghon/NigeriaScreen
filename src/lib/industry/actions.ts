"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "../auth/formState";
import { isIndustryRole } from "../auth/roles";
import { getCurrentUser } from "../auth/session";
import { field } from "../auth/validation";
import { getOwnProfile } from "../library/queries";
import { createSupabaseServerClient } from "../supabase/server";
import type { Json } from "@/types/database";
import { intentOf, validateApplication, validateCompany, validateFilmmakerProfile, validatePromotion, validateSubmission } from "./validation";

/**
 * Owner actions for the filmmaker portal. Each re-reads the session; the user
 * id is never taken from the form. RLS and the Stage 7 guard triggers decide
 * what may change, so these checks are for clear messages, not security.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_OUT: FormState = { status: "error", message: "Your session has ended. Sign in again to continue." };
const NOT_MEMBER: FormState = { status: "error", message: "This needs approved filmmaker access. Apply from the onboarding page." };

async function session() {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return null;
  const profile = await getOwnProfile(user.id);
  return { supabase, user, member: isIndustryRole(profile?.role) && !profile?.suspended_at };
}

/** Friendly text for database refusals; our own trigger messages are safe to show. */
function explain(error: PostgrestError, fallback = "That didn't save. Please try again."): string {
  if (error.code === "23505") return "That name or address is already taken.";
  if (error.code === "42501" && error.message && !error.message.startsWith("new row violates")) return error.message;
  if (error.code === "42501") return "You don't have permission to do that.";
  if (error.code === "22023" || error.code === "P0002") return error.message;
  return fallback;
}

const valuesOf = (form: FormData, names: string[]) => Object.fromEntries(names.map((name) => [name, field(form, name)]));

// ---------------------------------------------------------------------------
// Onboarding application
// ---------------------------------------------------------------------------

const APPLICATION_FIELDS = ["accountType", "professionalName", "professionalRole", "companyName", "biography", "country", "city", "portfolioLinks"];

export async function saveApplication(_prev: FormState, form: FormData): Promise<FormState> {
  const values = valuesOf(form, APPLICATION_FIELDS);
  const intent = intentOf(form);
  const result = validateApplication(form, intent);
  if (!result.ok) return { status: "error", message: "Check the highlighted fields.", fieldErrors: result.errors, values };

  const ctx = await session();
  if (!ctx) return { ...SIGNED_OUT, values };
  const d = result.data;
  const row = {
    account_type: d.accountType,
    professional_name: d.professionalName,
    professional_role: d.professionalRole,
    company_name: d.companyName,
    biography: d.biography,
    country: d.country,
    city: d.city,
    portfolio_links: d.portfolioLinks,
    status: d.status,
  };
  const existing = await ctx.supabase.from("industry_applications").select("id").eq("user_id", ctx.user.id).maybeSingle();
  const { error } = existing.data
    ? await ctx.supabase.from("industry_applications").update(row).eq("id", existing.data.id)
    : await ctx.supabase.from("industry_applications").insert(row);
  if (error) return { status: "error", message: explain(error), values };

  refresh();
  return {
    status: "success",
    message: intent === "submit" ? "Application submitted. We'll notify you here when a moderator has reviewed it." : "Draft saved.",
    values,
  };
}

// ---------------------------------------------------------------------------
// Filmmaker profile
// ---------------------------------------------------------------------------

const PROFILE_FIELDS = ["slug", "professionalName", "professionalRole", "expertise", "biography", "avatarUrl", "city", "country", "websiteUrl", "portfolioLinks", "socialLinks", "filmography", "visibility"];

export async function saveFilmmakerProfile(_prev: FormState, form: FormData): Promise<FormState> {
  const values = valuesOf(form, PROFILE_FIELDS);
  const result = validateFilmmakerProfile(form);
  if (!result.ok) return { status: "error", message: "Check the highlighted fields.", fieldErrors: result.errors, values };

  const ctx = await session();
  if (!ctx) return { ...SIGNED_OUT, values };
  if (!ctx.member) return { ...NOT_MEMBER, values };
  const d = result.data;
  const row = {
    slug: d.slug,
    professional_name: d.professionalName,
    professional_role: d.professionalRole,
    expertise: d.expertise,
    biography: d.biography,
    avatar_url: d.avatarUrl,
    city: d.city,
    country: d.country,
    languages: d.languages,
    website_url: d.websiteUrl,
    portfolio_links: d.portfolioLinks,
    social_links: d.socialLinks,
    filmography: d.filmography as unknown as Json,
    visibility: d.visibility,
  };
  const existing = await ctx.supabase.from("filmmaker_profiles").select("id").eq("user_id", ctx.user.id).maybeSingle();
  const { error } = existing.data
    ? await ctx.supabase.from("filmmaker_profiles").update(row).eq("id", existing.data.id)
    : await ctx.supabase.from("filmmaker_profiles").insert(row);
  if (error?.code === "23505") {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors: { slug: "That profile address is taken. Try another." }, values };
  }
  if (error) return { status: "error", message: explain(error), values };

  refresh();
  return {
    status: "success",
    message: d.visibility === "public" ? `Profile saved and public at /filmmakers/${d.slug}.` : "Profile saved. It's private until you make it public.",
    values,
  };
}

export async function requestProfileVerification(): Promise<{ ok: boolean; message: string }> {
  const ctx = await session();
  if (!ctx) return { ok: false, message: SIGNED_OUT.message! };
  if (!ctx.member) return { ok: false, message: NOT_MEMBER.message! };
  const { data, error } = await ctx.supabase
    .from("filmmaker_profiles")
    .update({ verification_status: "pending" })
    .eq("user_id", ctx.user.id)
    .in("verification_status", ["unverified", "rejected"])
    .select("id");
  if (error) return { ok: false, message: explain(error) };
  if (!data?.length) return { ok: false, message: "Create your profile first, or wait for the current request to be reviewed." };
  refresh();
  return { ok: true, message: "Verification requested. A moderator will check your professional links." };
}

// ---------------------------------------------------------------------------
// Production company
// ---------------------------------------------------------------------------

const COMPANY_FIELDS = ["name", "slug", "logoUrl", "description", "country", "city", "websiteUrl", "publicEmail", "publicPhone", "socialLinks", "visibility"];

export async function saveCompany(_prev: FormState, form: FormData): Promise<FormState> {
  const values = valuesOf(form, COMPANY_FIELDS);
  const id = field(form, "id");
  if (id && !UUID.test(id)) return { status: "error", message: "That company doesn't exist.", values };
  const intent = intentOf(form);
  const result = validateCompany(form, intent);
  if (!result.ok) return { status: "error", message: "Check the highlighted fields.", fieldErrors: result.errors, values };

  const ctx = await session();
  if (!ctx) return { ...SIGNED_OUT, values };
  if (!ctx.member) return { ...NOT_MEMBER, values };
  const d = result.data;
  const details = {
    name: d.name,
    logo_url: d.logoUrl,
    description: d.description,
    country: d.country,
    city: d.city,
    website_url: d.websiteUrl,
    public_email: d.publicEmail,
    public_phone: d.publicPhone,
    social_links: d.socialLinks,
    visibility: d.visibility,
  };

  let error: PostgrestError | null;
  if (id) {
    const current = await ctx.supabase.from("production_companies").select("review_status").eq("id", id).maybeSingle();
    if (!current.data) return { status: "error", message: "That company doesn't exist.", values };
    // Approved companies keep their status; drafts and returned ones may be submitted.
    const editable = current.data.review_status === "draft" || current.data.review_status === "changes_requested";
    ({ error } = await ctx.supabase
      .from("production_companies")
      .update(editable ? { ...details, review_status: d.reviewStatus } : details)
      .eq("id", id));
  } else {
    ({ error } = await ctx.supabase.from("production_companies").insert({ ...details, slug: d.slug, review_status: d.reviewStatus }));
  }
  if (error) return { status: "error", message: explain(error), values };

  refresh();
  const after = id ? (await ctx.supabase.from("production_companies").select("review_status").eq("id", id).maybeSingle()).data : null;
  return {
    status: "success",
    message:
      intent === "submit" || after?.review_status === "pending_review"
        ? "Saved and sent to the moderators for review."
        : "Company saved.",
    values,
  };
}

export async function requestCompanyVerification(companyId: string): Promise<{ ok: boolean; message: string }> {
  if (!UUID.test(companyId)) return { ok: false, message: "That company doesn't exist." };
  const ctx = await session();
  if (!ctx?.member) return { ok: false, message: NOT_MEMBER.message! };
  const { data, error } = await ctx.supabase
    .from("production_companies")
    .update({ verification_status: "pending" })
    .eq("id", companyId)
    .in("verification_status", ["unverified", "rejected"])
    .select("id");
  if (error) return { ok: false, message: explain(error) };
  if (!data?.length) return { ok: false, message: "Only approved companies can ask to be verified." };
  refresh();
  return { ok: true, message: "Verification requested." };
}

export async function inviteMember(_prev: FormState, form: FormData): Promise<FormState> {
  const companyId = field(form, "companyId");
  const slug = field(form, "filmmakerSlug").trim().toLowerCase().replace(/^.*\/filmmakers\//, "").replace(/\/$/, "");
  const role = field(form, "memberRole") === "manager" ? "manager" : "member";
  const values = { filmmakerSlug: field(form, "filmmakerSlug") };
  if (!UUID.test(companyId)) return { status: "error", message: "That company doesn't exist.", values };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return { status: "error", message: "Check the highlighted field.", fieldErrors: { filmmakerSlug: "Paste their NaijaScreen profile address, e.g. /filmmakers/ada-obi." }, values };
  }
  const ctx = await session();
  if (!ctx?.member) return { ...NOT_MEMBER, values };
  const { error } = await ctx.supabase.rpc("invite_company_member", { p_company_id: companyId, p_filmmaker_slug: slug, p_member_role: role });
  if (error) return { status: "error", message: explain(error, "That invitation couldn't be sent."), values };
  refresh();
  return { status: "success", message: "Invitation sent. They'll see it in their notifications." };
}

export async function acceptInvite(memberId: string): Promise<{ ok: boolean; message: string }> {
  if (!UUID.test(memberId)) return { ok: false, message: "That invitation doesn't exist." };
  const ctx = await session();
  if (!ctx) return { ok: false, message: SIGNED_OUT.message! };
  const { data, error } = await ctx.supabase.from("company_members").update({ status: "active" }).eq("id", memberId).eq("user_id", ctx.user.id).select("id");
  if (error || !data?.length) return { ok: false, message: error ? explain(error) : "That invitation doesn't exist." };
  refresh();
  return { ok: true, message: "You've joined the company." };
}

/** Managers remove members; anyone may leave (owners can't be removed). */
export async function removeMember(memberId: string): Promise<{ ok: boolean; message: string }> {
  if (!UUID.test(memberId)) return { ok: false, message: "That member doesn't exist." };
  const ctx = await session();
  if (!ctx) return { ok: false, message: SIGNED_OUT.message! };
  const { data, error } = await ctx.supabase.from("company_members").delete().eq("id", memberId).select("id");
  if (error || !data?.length) return { ok: false, message: error ? explain(error) : "You can't remove that member." };
  refresh();
  return { ok: true, message: "Removed." };
}

// ---------------------------------------------------------------------------
// Film submissions
// ---------------------------------------------------------------------------

const SUBMISSION_FIELDS = ["title", "originalTitle", "synopsis", "releaseYear", "runtimeMinutes", "language", "country", "director", "producers", "castNames", "companyId", "trailerUrl", "posterUrl", "websiteUrl", "viewingLinks", "rightsStatement", "notesForAdmins"];

export async function saveSubmission(_prev: FormState, form: FormData): Promise<FormState> {
  const values = valuesOf(form, SUBMISSION_FIELDS);
  const id = field(form, "id");
  if (id && !UUID.test(id)) return { status: "error", message: "That submission doesn't exist.", values };

  const ctx = await session();
  if (!ctx) return { ...SIGNED_OUT, values };
  if (!ctx.member) return { ...NOT_MEMBER, values };

  const { data: memberships } = await ctx.supabase.from("company_members").select("company_id").eq("user_id", ctx.user.id).eq("status", "active");
  const intent = intentOf(form);
  const result = validateSubmission(form, intent, new Set((memberships ?? []).map((m) => m.company_id)));
  if (!result.ok) return { status: "error", message: "Check the highlighted fields.", fieldErrors: result.errors, values };

  const d = result.data;
  const row = {
    title: d.title,
    original_title: d.originalTitle,
    synopsis: d.synopsis,
    release_year: d.releaseYear,
    runtime_minutes: d.runtimeMinutes,
    genres: d.genres,
    language: d.language,
    country: d.country,
    director: d.director,
    producers: d.producers,
    cast_names: d.castNames,
    company_id: d.companyId,
    trailer_url: d.trailerUrl,
    poster_url: d.posterUrl,
    website_url: d.websiteUrl,
    viewing_links: d.viewingLinks as unknown as Json,
    rights_confirmed: d.rightsConfirmed,
    rights_statement: d.rightsStatement,
    notes_for_admins: d.notesForAdmins,
    status: d.status,
  };

  const saved = id
    ? await ctx.supabase.from("film_submissions").update(row).eq("id", id).select("id").maybeSingle()
    : await ctx.supabase.from("film_submissions").insert(row).select("id").single();
  if (saved.error) return { status: "error", message: explain(saved.error), values };
  if (!saved.data) return { status: "error", message: "That submission can't be edited now.", values };

  if (!id) redirect(`/filmmaker/submissions/${saved.data.id}?saved=${intent}`);
  refresh();
  return {
    status: "success",
    message: intent === "submit" ? "Submitted for review. Track its status here." : "Draft saved.",
    values,
  };
}

export async function deleteDraftSubmission(id: string): Promise<{ ok: boolean; message: string }> {
  if (!UUID.test(id)) return { ok: false, message: "That submission doesn't exist." };
  const ctx = await session();
  if (!ctx) return { ok: false, message: SIGNED_OUT.message! };
  const { data, error } = await ctx.supabase.from("film_submissions").delete().eq("id", id).eq("status", "draft").select("id");
  if (error || !data?.length) return { ok: false, message: error ? explain(error) : "Only drafts can be deleted." };
  redirect("/filmmaker/submissions");
}

// ---------------------------------------------------------------------------
// Promotion requests
// ---------------------------------------------------------------------------

export async function requestPromotion(_prev: FormState, form: FormData): Promise<FormState> {
  const values = valuesOf(form, ["filmId", "placement", "genre", "startsOn", "endsOn", "message"]);
  const ctx = await session();
  if (!ctx) return { ...SIGNED_OUT, values };
  if (!ctx.member) return { ...NOT_MEMBER, values };

  const { data: subs } = await ctx.supabase.from("film_submissions").select("published_film_id").not("published_film_id", "is", null);
  const allowed = new Set((subs ?? []).map((s) => s.published_film_id!).filter(Boolean));
  const today = new Date().toISOString().slice(0, 10);
  const result = validatePromotion(form, allowed, today);
  if (!result.ok) return { status: "error", message: "Check the highlighted fields.", fieldErrors: result.errors, values };

  const d = result.data;
  const { error } = await ctx.supabase
    .from("promotion_requests")
    .insert({ film_id: d.filmId, placement: d.placement, genre: d.genre, starts_on: d.startsOn, ends_on: d.endsOn, message: d.message });
  if (error) return { status: "error", message: explain(error), values };
  refresh();
  return { status: "success", message: "Request sent. A moderator will review it; placements are editorial and unpaid." };
}

export async function cancelPromotion(id: string): Promise<{ ok: boolean; message: string }> {
  if (!UUID.test(id)) return { ok: false, message: "That request doesn't exist." };
  const ctx = await session();
  if (!ctx) return { ok: false, message: SIGNED_OUT.message! };
  const { data, error } = await ctx.supabase.from("promotion_requests").update({ status: "cancelled" }).eq("id", id).eq("status", "pending").select("id");
  if (error || !data?.length) return { ok: false, message: error ? explain(error) : "Only pending requests can be cancelled." };
  refresh();
  return { ok: true, message: "Request cancelled." };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markNotificationsRead(ids: string[] | "all"): Promise<{ ok: boolean }> {
  const ctx = await session();
  if (!ctx) return { ok: false };
  let query = ctx.supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (ids !== "all") {
    const valid = ids.filter((id) => UUID.test(id)).slice(0, 100);
    if (!valid.length) return { ok: false };
    query = query.in("id", valid);
  }
  const { error } = await query;
  if (error) return { ok: false };
  refresh();
  return { ok: true };
}
