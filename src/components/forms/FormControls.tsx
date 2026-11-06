"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/auth/formState";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
}

/** Labelled input with its hint and error wired up for screen readers. */
export function TextField({ label, name, error, hint, className = "", ...props }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-cream">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-xl border bg-ink px-4 py-3 text-base text-cream placeholder:text-cream-muted/70 focus:border-gold focus:outline-none ${
          error ? "border-terracotta" : "border-line"
        }`}
        {...props}
      />
      {hint && (
        <p id={hintId} className="mt-2 text-sm text-cream-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-2 text-sm font-medium text-terracotta">
          {error}
        </p>
      )}
    </div>
  );
}

/** Form-level message: errors are announced assertively, successes politely. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;
  const success = state.status === "success";
  return (
    <p
      role={success ? "status" : "alert"}
      className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${
        success ? "border-palm/60 bg-palm-deep/20 text-cream" : "border-terracotta/60 bg-clay/20 text-cream"
      }`}
    >
      {state.message}
    </p>
  );
}

/** Submit button that shows a pending label while its form's action runs. */
export function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-cream disabled:cursor-wait disabled:opacity-70"
    >
      {pending && <Spinner />}
      {pending ? pendingLabel : children}
    </button>
  );
}

export function Spinner() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
}

export function TextArea({ label, name, error, hint, className = "", rows = 4, ...props }: TextAreaProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-cream">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-xl border bg-ink px-4 py-3 text-base text-cream placeholder:text-cream-muted/70 focus:border-gold focus:outline-none ${
          error ? "border-terracotta" : "border-line"
        }`}
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-2 text-sm text-cream-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm font-medium text-terracotta">
          {error}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  error?: string;
  hint?: ReactNode;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function SelectField({ label, name, options, defaultValue, error, hint, placeholder = "Choose…", required, className = "" }: SelectFieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-cream">
        {label}
      </label>
      {/* React doesn't re-apply a select's defaultValue after mount, so remount when it changes (e.g. values echoed back after an error). */}
      <select
        key={defaultValue ?? ""}
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-xl border bg-ink px-4 py-3 text-base text-cream ${error ? "border-terracotta" : "border-line"}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={`${id}-hint`} className="mt-2 text-sm text-cream-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm font-medium text-terracotta">
          {error}
        </p>
      )}
    </div>
  );
}

const chipClass =
  "cursor-pointer rounded-full border border-line px-3 py-1.5 text-sm font-medium text-cream-muted transition-colors hover:text-cream has-checked:border-gold has-checked:bg-gold has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-gold";

/** A group of checkbox chips with a legend and an optional error. */
export function ChipGroup({
  legend,
  name,
  options,
  selected,
  error,
  hint,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  selected: string[];
  error?: string;
  hint?: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold text-cream">{legend}</legend>
      {hint && <p className="mb-3 text-sm text-cream-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.value} className={chipClass}>
            <input type="checkbox" name={name} value={option.value} defaultChecked={selected.includes(option.value)} className="sr-only" />
            {option.label}
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-sm font-medium text-terracotta">{error}</p>}
    </fieldset>
  );
}

/** Two submit buttons: save as draft, or send for review. */
export function DraftOrSubmit({ submitLabel = "Submit for review", draftLabel = "Save draft" }: { submitLabel?: string; draftLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="submit"
        name="intent"
        value="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-cream disabled:cursor-wait disabled:opacity-70"
      >
        {pending && <Spinner />}
        {submitLabel}
      </button>
      <button
        type="submit"
        name="intent"
        value="draft"
        disabled={pending}
        className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-cream transition-colors hover:border-gold disabled:cursor-wait disabled:opacity-70"
      >
        {draftLabel}
      </button>
    </div>
  );
}
