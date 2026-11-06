"use client";

import { useActionState, useState } from "react";
import { IDLE, type FormState } from "@/lib/auth/formState";
import { STATUS_LABELS } from "@/lib/industry/constants";
import { addModerationNote, setSuspension } from "@/lib/industry/adminActions";
import { FormMessage, SubmitButton, TextArea, TextField } from "../forms/FormControls";

const DESTRUCTIVE = new Set(["rejected", "expired", "verification_rejected", "unverified"]);
const NEEDS_REASON = new Set(["rejected", "changes_requested"]);

const DECISION_LABELS: Record<string, string> = {
  ...STATUS_LABELS,
  under_review: "Start review",
  approved: "Approve",
  rejected: "Reject",
  changes_requested: "Request changes",
  verified: "Verify",
  unverified: "Remove verification",
  verification_rejected: "Decline verification",
  expired: "End placement",
};

interface DecisionFormProps {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  id: string;
  decisions: string[];
  /** For approving a submission: the public address to publish under. */
  suggestedSlug?: string;
}

/**
 * A moderation decision. Rejections and other destructive choices need a
 * confirmation tick; rejections and change requests need a message, which the
 * applicant sees.
 */
export function DecisionForm({ action, id, decisions, suggestedSlug }: DecisionFormProps) {
  const [state, formAction] = useActionState(action, IDLE);
  const [decision, setDecision] = useState(decisions[0] ?? "");
  if (!decisions.length) return <p className="text-sm text-cream-muted">No decisions available in this status.</p>;

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={id} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-cream">Decision</legend>
        <div className="flex flex-wrap gap-2">
          {decisions.map((d) => (
            <label
              key={d}
              className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-sm font-medium text-cream-muted has-checked:border-gold has-checked:bg-gold has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-gold"
            >
              <input type="radio" name="decision" value={d} checked={decision === d} onChange={() => setDecision(d)} className="sr-only" />
              {DECISION_LABELS[d] ?? d}
            </label>
          ))}
        </div>
      </fieldset>
      {decision === "approved" && suggestedSlug !== undefined && (
        <TextField
          label="Public address"
          name="slug"
          defaultValue={suggestedSlug}
          error={state.fieldErrors?.slug}
          hint="/films/<address>. Must not match a catalogue film."
        />
      )}
      <TextArea
        label={NEEDS_REASON.has(decision) ? "Message to the person (required)" : "Message to the person (optional)"}
        name="feedback"
        rows={3}
        maxLength={2000}
        error={state.fieldErrors?.feedback}
        hint="They'll see this in their notifications and on their status page."
      />
      {DESTRUCTIVE.has(decision) && (
        <label className="flex items-start gap-3 rounded-xl border border-terracotta/60 p-3 text-sm text-cream">
          <input type="checkbox" name="confirm" value="yes" className="mt-0.5 h-4 w-4" />
          <span>
            I&rsquo;ve reviewed this and want to {(DECISION_LABELS[decision] ?? decision).toLowerCase()}.
            {state.fieldErrors?.confirm && <span className="block text-terracotta">{state.fieldErrors.confirm}</span>}
          </span>
        </label>
      )}
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Saving…">Save decision</SubmitButton>
      </div>
    </form>
  );
}

export function NoteForm({ subjectType, subjectId }: { subjectType: string; subjectId: string }) {
  const [state, action] = useActionState(addModerationNote, IDLE);
  return (
    <form action={action} noValidate className="space-y-3">
      <FormMessage state={state} />
      <input type="hidden" name="subjectType" value={subjectType} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <TextArea label="Private note" name="note" rows={2} maxLength={2000} error={state.fieldErrors?.note} hint="Only administrators can see notes." />
      <div className="sm:max-w-40">
        <SubmitButton pendingLabel="Adding…">Add note</SubmitButton>
      </div>
    </form>
  );
}

export function SuspensionForm({ userId, suspended }: { userId: string; suspended: boolean }) {
  const [state, action] = useActionState(setSuspension, IDLE);
  return (
    <form action={action} noValidate className="space-y-3">
      <FormMessage state={state} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="suspend" value={suspended ? "no" : "yes"} />
      {!suspended && (
        <>
          <TextField label="Reason (shown to them)" name="reason" maxLength={500} error={state.fieldErrors?.reason} />
          <label className="flex items-center gap-2 text-sm text-cream">
            <input type="checkbox" name="confirm" value="yes" /> Confirm suspension
          </label>
          {state.fieldErrors?.confirm && <p className="text-sm text-terracotta">{state.fieldErrors.confirm}</p>}
        </>
      )}
      <div className="sm:max-w-48">
        <SubmitButton pendingLabel="Saving…">{suspended ? "Restore access" : "Suspend industry access"}</SubmitButton>
      </div>
    </form>
  );
}
