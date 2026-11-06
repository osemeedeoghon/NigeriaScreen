"use client";

import { useActionState } from "react";
import { updateProfile } from "@/lib/auth/actions";
import { IDLE } from "@/lib/auth/formState";
import { FormMessage, SubmitButton, TextField } from "../forms/FormControls";

interface ProfileFormProps {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
}

export default function ProfileForm({ displayName, username, avatarUrl }: ProfileFormProps) {
  const [state, action] = useActionState(updateProfile, IDLE);
  const values = state.values ?? { displayName, username: username ?? "", avatarUrl: avatarUrl ?? "" };

  return (
    <form action={action} noValidate className="space-y-5">
      <FormMessage state={state} />
      <TextField
        label="Display name"
        name="displayName"
        autoComplete="nickname"
        maxLength={50}
        required
        defaultValue={values.displayName}
        error={state.fieldErrors?.displayName}
        hint="Shown next to your reviews."
      />
      <TextField
        label="Username (optional)"
        name="username"
        autoComplete="username"
        maxLength={21}
        defaultValue={values.username}
        error={state.fieldErrors?.username}
        hint="3–20 lowercase letters, numbers or underscores. Not shown publicly yet."
      />
      <TextField
        label="Profile image link (optional)"
        name="avatarUrl"
        type="url"
        inputMode="url"
        placeholder="https://"
        defaultValue={values.avatarUrl}
        error={state.fieldErrors?.avatarUrl}
        hint="A link to an image you have the right to use. Uploads come later."
      />
      <div className="sm:max-w-48">
        <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
      </div>
    </form>
  );
}
