"use client";

import { useActionState, useId } from "react";
import { IDLE, type FormState } from "@/lib/auth/formState";
import { saveProvider, saveTrailer, saveViewingOption } from "@/lib/viewing/actions";
import { ACCESS_LABELS } from "@/lib/viewing/availability";
import { ACCESS_TYPES, type AccessType, type FilmTrailer, type FilmViewingOption, type ViewingProvider } from "@/types/viewing";
import { FormMessage, SubmitButton, TextField } from "../forms/FormControls";

/** Keeps a successful "add" form empty, and an edit form showing what was saved. */
function valuesOf(state: FormState, initial: Record<string, string>) {
  return state.values ?? initial;
}

export function ProviderForm({ provider }: { provider?: ViewingProvider }) {
  const [state, action] = useActionState(saveProvider, IDLE);
  const values = valuesOf(state, {
    name: provider?.name ?? "",
    slug: provider?.slug ?? "",
    websiteUrl: provider?.websiteUrl ?? "",
    logoUrl: provider?.logoUrl ?? "",
    description: provider?.description ?? "",
  });
  return (
    // The key resets fields after a successful add.
    <form key={state.status === "success" && !provider ? state.message : "form"} action={action} noValidate className="space-y-4">
      <FormMessage state={state} />
      {provider && <input type="hidden" name="id" value={provider.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Name" name="name" required maxLength={80} defaultValue={values.name} error={state.fieldErrors?.name} />
        <TextField
          label="Slug (optional)"
          name="slug"
          maxLength={60}
          defaultValue={values.slug}
          error={state.fieldErrors?.slug}
          hint="Made from the name if left empty."
        />
      </div>
      <TextField
        label="Official website"
        name="websiteUrl"
        type="url"
        required
        placeholder="https://"
        defaultValue={values.websiteUrl}
        error={state.fieldErrors?.websiteUrl}
        hint="The provider's real homepage. Never guess it."
      />
      <TextField
        label="Logo image link (optional)"
        name="logoUrl"
        type="url"
        placeholder="https://"
        defaultValue={values.logoUrl}
        error={state.fieldErrors?.logoUrl}
        hint="Only a logo you have permission to use, such as one from the provider's press kit."
      />
      <TextField label="Description (optional)" name="description" maxLength={500} defaultValue={values.description} error={state.fieldErrors?.description} />
      <div className="sm:max-w-48">
        <SubmitButton pendingLabel="Saving…">{provider ? "Save provider" : "Add provider"}</SubmitButton>
      </div>
    </form>
  );
}

interface ViewingOptionFormProps {
  filmId: string;
  providers: ViewingProvider[];
  option?: FilmViewingOption;
}

export function ViewingOptionForm({ filmId, providers, option }: ViewingOptionFormProps) {
  const [state, action] = useActionState(saveViewingOption, IDLE);
  const ids = { provider: useId(), access: useId() };
  const values = valuesOf(state, {
    providerId: option?.provider.id ?? "",
    destinationUrl: option?.destinationUrl ?? "",
    accessType: option?.accessType ?? "",
    countries: option?.countries.join(", ") ?? "",
    audioLanguages: option?.audioLanguages.join(", ") ?? "",
    subtitleLanguages: option?.subtitleLanguages.join(", ") ?? "",
    availabilityNotes: option?.availabilityNotes ?? "",
  });
  const selectable = providers.filter((provider) => provider.isActive || provider.id === option?.provider.id);

  if (selectable.length === 0) {
    return <p className="text-sm text-cream-muted">Add an active provider on the overview page before adding viewing options.</p>;
  }

  return (
    <form key={state.status === "success" && !option ? state.message : "form"} action={action} noValidate className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="filmId" value={filmId} />
      {option && <input type="hidden" name="id" value={option.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          id={ids.provider}
          label="Provider"
          name="providerId"
          defaultValue={values.providerId}
          error={state.fieldErrors?.providerId}
          options={selectable.map((provider) => ({ value: provider.id, label: provider.isActive ? provider.name : `${provider.name} (inactive)` }))}
        />
        <Select
          id={ids.access}
          label="Access type"
          name="accessType"
          defaultValue={values.accessType}
          error={state.fieldErrors?.accessType}
          options={ACCESS_TYPES.map((type: AccessType) => ({ value: type, label: ACCESS_LABELS[type].label }))}
        />
      </div>
      <TextField
        label="Official destination link"
        name="destinationUrl"
        type="url"
        required
        placeholder="https://"
        defaultValue={values.destinationUrl}
        error={state.fieldErrors?.destinationUrl}
        hint="The film's page on the provider's own site or official channel."
      />
      <TextField
        label="Countries"
        name="countries"
        required
        placeholder="NG, GH, GB"
        defaultValue={values.countries}
        error={state.fieldErrors?.countries}
        hint="ISO two-letter codes, separated by commas. Only countries you have checked."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Audio languages (optional)"
          name="audioLanguages"
          placeholder="en, yo"
          defaultValue={values.audioLanguages}
          error={state.fieldErrors?.audioLanguages}
          hint="ISO 639 codes: en, yo, ig, ha, pcm…"
        />
        <TextField
          label="Subtitle languages (optional)"
          name="subtitleLanguages"
          placeholder="en, fr"
          defaultValue={values.subtitleLanguages}
          error={state.fieldErrors?.subtitleLanguages}
        />
      </div>
      <TextField
        label="Availability notes (optional)"
        name="availabilityNotes"
        maxLength={500}
        defaultValue={values.availabilityNotes}
        error={state.fieldErrors?.availabilityNotes}
        hint="Shown to viewers, e.g. “Included with the standard plan”."
      />
      <p className="text-xs text-cream-muted">
        {option ? "Saving changes returns this option to pending." : "New options are saved as pending and stay hidden until you verify them."}
      </p>
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Saving…">{option ? "Save changes" : "Save as pending"}</SubmitButton>
      </div>
    </form>
  );
}

export function TrailerForm({ filmId, trailer }: { filmId: string; trailer?: FilmTrailer }) {
  const [state, action] = useActionState(saveTrailer, IDLE);
  const values = valuesOf(state, {
    title: trailer?.title ?? "",
    videoUrl: trailer?.videoUrl ?? "",
    thumbnailUrl: trailer?.thumbnailUrl ?? "",
    publishedOn: trailer?.publishedOn ?? "",
    embeddable: trailer && !trailer.embeddable ? "off" : "on",
  });
  return (
    <form key={state.status === "success" && !trailer ? state.message : "form"} action={action} noValidate className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="filmId" value={filmId} />
      {trailer && <input type="hidden" name="id" value={trailer.id} />}
      <TextField label="Title" name="title" required maxLength={120} defaultValue={values.title} error={state.fieldErrors?.title} placeholder="Official trailer" />
      <TextField
        label="YouTube or Vimeo link"
        name="videoUrl"
        type="url"
        required
        readOnly={Boolean(trailer)}
        placeholder="https://www.youtube.com/watch?v=…"
        defaultValue={values.videoUrl}
        error={state.fieldErrors?.videoUrl}
        hint={trailer ? "To use a different video, add a new trailer." : "Only an official upload by the film's owner or distributor."}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Thumbnail link (optional)"
          name="thumbnailUrl"
          type="url"
          placeholder="https://"
          defaultValue={values.thumbnailUrl}
          error={state.fieldErrors?.thumbnailUrl}
        />
        <TextField label="Published on (optional)" name="publishedOn" type="date" defaultValue={values.publishedOn} error={state.fieldErrors?.publishedOn} />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-cream">Embedding</legend>
        <div className="flex flex-wrap gap-4 text-sm text-cream">
          <label className="flex items-center gap-2">
            <input type="radio" name="embeddable" value="on" defaultChecked={values.embeddable !== "off"} /> Embed the player
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="embeddable" value="off" defaultChecked={values.embeddable === "off"} /> Link only (owner disabled embedding)
          </label>
        </div>
      </fieldset>
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Saving…">{trailer ? "Save trailer" : "Save as pending"}</SubmitButton>
      </div>
    </form>
  );
}

interface SelectProps {
  id: string;
  label: string;
  name: string;
  defaultValue: string;
  error?: string;
  options: { value: string; label: string }[];
}

function Select({ id, label, name, defaultValue, error, options }: SelectProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-cream">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-xl border bg-ink px-4 py-3 text-base text-cream ${error ? "border-terracotta" : "border-line"}`}
      >
        <option value="">Choose…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm font-medium text-terracotta">
          {error}
        </p>
      )}
    </div>
  );
}
