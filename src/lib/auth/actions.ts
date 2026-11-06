"use server";

import type { AuthError } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../supabase/server";
import type { FormState } from "./formState";
import { safeNextPath } from "./paths";
import { getCurrentUser } from "./session";
import {
  field,
  validatePasswordChange,
  validateProfile,
  validateResetRequest,
  validateSignIn,
  validateSignUp,
} from "./validation";

const NOT_CONFIGURED: FormState = {
  status: "error",
  message: "Accounts are not set up on this copy of NaijaScreen yet. See the README for the Supabase setup steps.",
};

const GENERIC_FAILURE = "Something went wrong on our side. Please try again in a moment.";

/** Absolute base URL for links in auth emails. Supabase also checks it against its allow list. */
async function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  // Next rejects Server Action requests whose Origin does not match the host.
  const origin = (await headers()).get("origin");
  return origin ?? "http://localhost:3000";
}

function authMessage(error: AuthError, fallback = GENERIC_FAILURE): string {
  switch (error.code) {
    case "invalid_credentials":
      return "That email and password don't match an account. Check them and try again.";
    case "email_not_confirmed":
      return "Please confirm your email address first. Check your inbox for the link we sent.";
    case "weak_password":
      return "Choose a stronger password: at least 8 characters with letters and numbers.";
    case "same_password":
      return "Your new password must be different from your current one.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "signup_disabled":
      return "New sign-ups are switched off at the moment.";
    default:
      return fallback;
  }
}

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { displayName: field(form, "displayName"), email: field(form, "email") };
  const result = validateSignUp(form);
  if (!result.ok) return { status: "error", message: "Check the highlighted fields.", fieldErrors: result.errors, values };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ...NOT_CONFIGURED, values };

  const next = safeNextPath(field(form, "next"));
  const { displayName, email, password } = result.data;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${await siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { status: "error", message: authMessage(error), values };

  // Email confirmation switched off: the user is already signed in.
  if (data.session) redirect(next);

  // Same message whether or not the address already has an account, so the form can't reveal who is registered.
  return {
    status: "success",
    message: `Check ${email} for a confirmation link. Open it on this device to finish creating your account.`,
  };
}

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { email: field(form, "email") };
  const result = validateSignIn(form);
  if (!result.ok) return { status: "error", message: "Check the highlighted fields.", fieldErrors: result.errors, values };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ...NOT_CONFIGURED, values };

  const { error } = await supabase.auth.signInWithPassword(result.data);
  if (error) return { status: "error", message: authMessage(error), values };

  redirect(safeNextPath(field(form, "next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { email: field(form, "email") };
  const result = validateResetRequest(form);
  if (!result.ok) return { status: "error", message: "Check the highlighted field.", fieldErrors: result.errors, values };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ...NOT_CONFIGURED, values };

  const { error } = await supabase.auth.resetPasswordForEmail(result.data.email, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=${encodeURIComponent("/account/update-password")}`,
  });
  if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
    return { status: "error", message: authMessage(error), values };
  }

  // Same message whether or not the address has an account.
  return {
    status: "success",
    message: `If ${result.data.email} has a NaijaScreen account, a reset link is on its way. It expires in an hour.`,
  };
}

export async function updatePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const result = validatePasswordChange(form);
  if (!result.ok) return { status: "error", message: "Check the highlighted fields.", fieldErrors: result.errors };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;
  if (!(await getCurrentUser())) return { status: "error", message: "Your session has ended. Sign in again to change your password." };

  const { error } = await supabase.auth.updateUser({ password: result.data.password });
  if (error) return { status: "error", message: authMessage(error) };
  return { status: "success", message: "Password updated. Use it the next time you sign in." };
}

export async function updateProfile(_prev: FormState, form: FormData): Promise<FormState> {
  const values = {
    displayName: field(form, "displayName"),
    username: field(form, "username"),
    avatarUrl: field(form, "avatarUrl"),
  };
  const result = validateProfile(form);
  if (!result.ok) return { status: "error", message: "Check the highlighted fields.", fieldErrors: result.errors, values };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ...NOT_CONFIGURED, values };
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Your session has ended. Sign in again to save changes.", values };

  const { displayName, username, avatarUrl } = result.data;
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, username, avatar_url: avatarUrl })
    .eq("id", user.id);

  if (error?.code === "23505") {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors: { username: "That username is taken." }, values };
  }
  if (error) return { status: "error", message: GENERIC_FAILURE, values };

  refresh();
  return {
    status: "success",
    message: "Profile saved.",
    values: { displayName, username: username ?? "", avatarUrl: avatarUrl ?? "" },
  };
}
