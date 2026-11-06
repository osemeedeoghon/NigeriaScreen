"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/lib/auth/actions";
import { IDLE, type FormState } from "@/lib/auth/formState";
import { safeNextPath } from "@/lib/auth/paths";
import { PASSWORD_MIN } from "@/lib/auth/validation";
import { FormMessage, SubmitButton, TextField } from "../forms/FormControls";

const LINK_ERROR: FormState = {
  status: "error",
  message: "That link has expired or was already used. Sign in, or request a new password reset link.",
};

/** Reads `?next=` and `?error=` once the page hydrates; the static shell renders the plain form. */
export function useAuthParams() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), "");
  return { next, initial: params.get("error") === "link" ? LINK_ERROR : IDLE };
}

export function LoginForm({ next = "", initial = IDLE }: { next?: string; initial?: FormState }) {
  const [state, action] = useActionState(signIn, initial);
  return (
    <form action={action} noValidate className="space-y-5">
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
        hint={
          <Link href="/forgot-password" className="font-semibold text-gold hover:text-cream">
            Forgotten your password?
          </Link>
        }
      />
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function LoginFormWithParams() {
  const { next, initial } = useAuthParams();
  return <LoginForm next={next} initial={initial} />;
}

export function SignUpForm({ next = "" }: { next?: string }) {
  const [state, action] = useActionState(signUp, IDLE);

  if (state.status === "success") {
    return (
      <div className="space-y-5">
        <FormMessage state={state} />
        <p className="text-sm text-cream-muted">
          Didn&rsquo;t get it? Check your spam folder. Already confirmed?{" "}
          <Link href="/login" className="font-semibold text-gold hover:text-cream">
            Sign in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-5">
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <TextField
        label="Display name"
        name="displayName"
        autoComplete="nickname"
        maxLength={50}
        required
        defaultValue={state.values?.displayName}
        error={state.fieldErrors?.displayName}
        hint="Shown next to your reviews."
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        required
        error={state.fieldErrors?.password}
        hint={`At least ${PASSWORD_MIN} characters, with letters and numbers.`}
      />
      <TextField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}

export function SignUpFormWithParams() {
  const { next } = useAuthParams();
  return <SignUpForm next={next} />;
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, IDLE);
  if (state.status === "success") return <FormMessage state={state} />;
  return (
    <form action={action} noValidate className="space-y-5">
      <FormMessage state={state} />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingLabel="Sending link…">Send reset link</SubmitButton>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePassword, IDLE);
  return (
    <form action={action} noValidate className="space-y-5">
      <FormMessage state={state} />
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        required
        error={state.fieldErrors?.password}
        hint={`At least ${PASSWORD_MIN} characters, with letters and numbers.`}
      />
      <TextField
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
    </form>
  );
}
