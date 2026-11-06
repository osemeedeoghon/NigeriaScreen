"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { adminClientForAction } from "../auth/admin";
import type { FormState } from "../auth/formState";
import { field } from "../auth/validation";
import { decisionNeedsReason } from "./status";
import { validatePublishSlug } from "./validation";

/**
 * Moderation actions. Each re-checks the admin role on the server, then calls
 * a security definer function that checks is_admin() again, refuses
 * self-review, records history and notifies the person affected.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_ALLOWED = "You need administrator access to do that.";
/** Decisions that need an explicit confirmation tick. */
const DESTRUCTIVE = new Set(["rejected", "expired", "verification_rejected", "unverified"]);
const NOTE_SUBJECTS = new Set(["application", "profile", "company", "submission", "promotion", "account"]);

export type ModerationResult = { ok: boolean; message: string };

function explain(error: PostgrestError): string {
  // Messages raised by the moderation functions are written for moderators.
  if (["42501", "22023", "P0002"].includes(error.code ?? "")) return error.message;
  if (error.code === "23505") return "That address is already used by another listing.";
  return "That didn't save. Please try again.";
}

function decisionForm(form: FormData) {
  return { id: field(form, "id"), decision: field(form, "decision"), feedback: field(form, "feedback").trim() };
}

async function run(form: FormData, allowed: string[], call: (input: ReturnType<typeof decisionForm>) => PromiseLike<{ error: PostgrestError | null }>): Promise<FormState> {
  const input = decisionForm(form);
  if (!UUID.test(input.id) || !allowed.includes(input.decision)) return { status: "error", message: "Choose a decision." };
  if (decisionNeedsReason(input.decision) && !input.feedback) {
    return { status: "error", message: "Explain the decision to the person affected.", fieldErrors: { feedback: "A reason is required." } };
  }
  if (input.feedback.length > 2000) return { status: "error", message: "Keep the message to 2,000 characters." };
  if (DESTRUCTIVE.has(input.decision) && field(form, "confirm") !== "yes") {
    return { status: "error", message: "Tick the confirmation box to go ahead.", fieldErrors: { confirm: "Please confirm." } };
  }
  const { error } = await call(input);
  if (error) return { status: "error", message: explain(error) };
  refresh();
  return { status: "success", message: "Decision saved and the person has been notified." };
}

export async function moderateApplication(_prev: FormState, form: FormData): Promise<FormState> {
  const supabase = await adminClientForAction();
  if (!supabase) return { status: "error", message: NOT_ALLOWED };
  return run(form, ["approved", "rejected", "changes_requested"], ({ id, decision, feedback }) =>
    supabase.rpc("moderate_application", { p_id: id, p_decision: decision, p_feedback: feedback || null }),
  );
}

export async function moderateProfile(_prev: FormState, form: FormData): Promise<FormState> {
  const supabase = await adminClientForAction();
  if (!supabase) return { status: "error", message: NOT_ALLOWED };
  return run(form, ["verified", "rejected", "unverified"], ({ id, decision, feedback }) =>
    supabase.rpc("moderate_profile_verification", { p_profile_id: id, p_decision: decision, p_feedback: feedback || null }),
  );
}

export async function moderateCompany(_prev: FormState, form: FormData): Promise<FormState> {
  const supabase = await adminClientForAction();
  if (!supabase) return { status: "error", message: NOT_ALLOWED };
  return run(form, ["approved", "rejected", "changes_requested", "verified", "unverified", "verification_rejected"], ({ id, decision, feedback }) =>
    supabase.rpc("moderate_company", { p_id: id, p_decision: decision, p_feedback: feedback || null }),
  );
}

export async function moderateSubmission(_prev: FormState, form: FormData): Promise<FormState> {
  const supabase = await adminClientForAction();
  if (!supabase) return { status: "error", message: NOT_ALLOWED };
  let slug: string | null = null;
  if (field(form, "decision") === "approved") {
    const check = validatePublishSlug(field(form, "slug"));
    if (!check.ok) return { status: "error", message: "Check the highlighted field.", fieldErrors: { slug: check.error } };
    slug = check.slug;
  }
  return run(form, ["under_review", "approved", "rejected", "changes_requested"], ({ id, decision, feedback }) =>
    supabase.rpc("moderate_submission", { p_id: id, p_decision: decision, p_feedback: feedback || null, p_slug: slug }),
  );
}

export async function moderatePromotion(_prev: FormState, form: FormData): Promise<FormState> {
  const supabase = await adminClientForAction();
  if (!supabase) return { status: "error", message: NOT_ALLOWED };
  return run(form, ["approved", "rejected", "expired"], ({ id, decision, feedback }) =>
    supabase.rpc("moderate_promotion", { p_id: id, p_decision: decision, p_feedback: feedback || null }),
  );
}

export async function setPublishedFilmActive(filmId: string, active: boolean): Promise<ModerationResult> {
  if (!/^film-[a-z0-9]+(-[a-z0-9]+)*$/.test(filmId) || typeof active !== "boolean") return { ok: false, message: "That film doesn't exist." };
  const supabase = await adminClientForAction();
  if (!supabase) return { ok: false, message: NOT_ALLOWED };
  const { error } = await supabase.rpc("set_published_film_active", { p_film_id: filmId, p_active: active });
  if (error) return { ok: false, message: explain(error) };
  refresh();
  return { ok: true, message: active ? "Listing restored." : "Listing hidden from the public." };
}

export async function setSuspension(_prev: FormState, form: FormData): Promise<FormState> {
  const supabase = await adminClientForAction();
  if (!supabase) return { status: "error", message: NOT_ALLOWED };
  const userId = field(form, "userId");
  const suspend = field(form, "suspend") === "yes";
  const reason = field(form, "reason").trim();
  if (!UUID.test(userId)) return { status: "error", message: "That account doesn't exist." };
  if (suspend && !reason) return { status: "error", message: "Give a reason.", fieldErrors: { reason: "A reason is required to suspend an account." } };
  if (suspend && field(form, "confirm") !== "yes") return { status: "error", message: "Tick the confirmation box to suspend.", fieldErrors: { confirm: "Please confirm." } };
  const { error } = await supabase.rpc("set_account_suspension", { p_user_id: userId, p_suspend: suspend, p_reason: reason || null });
  if (error) return { status: "error", message: explain(error) };
  refresh();
  return { status: "success", message: suspend ? "Account suspended. Their public listings are hidden." : "Account restored." };
}

export async function addModerationNote(_prev: FormState, form: FormData): Promise<FormState> {
  const supabase = await adminClientForAction();
  if (!supabase) return { status: "error", message: NOT_ALLOWED };
  const subjectType = field(form, "subjectType");
  const subjectId = field(form, "subjectId");
  const note = field(form, "note").trim();
  if (!NOTE_SUBJECTS.has(subjectType) || !UUID.test(subjectId)) return { status: "error", message: "Unknown record." };
  if (!note || note.length > 2000) return { status: "error", message: "Write a note of up to 2,000 characters.", fieldErrors: { note: "Required." } };
  const { error } = await supabase.from("moderation_notes").insert({ subject_type: subjectType, subject_id: subjectId, note });
  if (error) return { status: "error", message: explain(error) };
  refresh();
  return { status: "success", message: "Note added. Only administrators can see it." };
}
