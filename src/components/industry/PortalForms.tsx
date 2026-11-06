"use client";

import { useActionState } from "react";
import { IDLE, type FormState } from "@/lib/auth/formState";
import { inviteMember, requestPromotion, saveApplication, saveCompany, saveFilmmakerProfile, saveSubmission } from "@/lib/industry/actions";
import { PLACEMENTS, PLACEMENT_LABELS, PROFESSIONAL_ROLES, ROLE_LABELS, MAX_PROMOTION_DAYS } from "@/lib/industry/constants";
import { ChipGroup, DraftOrSubmit, FormMessage, SelectField, SubmitButton, TextArea, TextField } from "../forms/FormControls";

export interface Option {
  value: string;
  label: string;
}

const roleOptions = PROFESSIONAL_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));
const v = (state: FormState, initial: Record<string, string>, name: string) => state.values?.[name] ?? initial[name] ?? "";

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export function ApplicationForm({ initial, countries }: { initial: Record<string, string>; countries: Option[] }) {
  const [state, action] = useActionState(saveApplication, IDLE);
  const value = (name: string) => v(state, initial, name);
  return (
    <form action={action} noValidate className="space-y-6">
      <FormMessage state={state} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-cream">I&rsquo;m applying as</legend>
        <div className="flex flex-wrap gap-4 text-sm text-cream">
          <label className="flex items-center gap-2">
            <input type="radio" name="accountType" value="filmmaker" defaultChecked={value("accountType") !== "company"} /> An individual film professional
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="accountType" value="company" defaultChecked={value("accountType") === "company"} /> A production company
          </label>
        </div>
        {state.fieldErrors?.accountType && <p className="mt-2 text-sm text-terracotta">{state.fieldErrors.accountType}</p>}
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Professional name" name="professionalName" required maxLength={80} defaultValue={value("professionalName")} error={state.fieldErrors?.professionalName} hint="The name you're credited under." />
        <SelectField label="Main professional role" name="professionalRole" options={roleOptions} defaultValue={value("professionalRole")} error={state.fieldErrors?.professionalRole} />
      </div>
      <TextField
        label="Company name (production companies only)"
        name="companyName"
        maxLength={120}
        defaultValue={value("companyName")}
        error={state.fieldErrors?.companyName}
      />
      <TextArea
        label="Short biography"
        name="biography"
        rows={5}
        maxLength={2000}
        defaultValue={value("biography")}
        error={state.fieldErrors?.biography}
        hint="Your work so far and what you're making. At least 20 characters to submit."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Country you mainly work in" name="country" options={countries} defaultValue={value("country")} error={state.fieldErrors?.country} />
        <TextField label="City (optional)" name="city" maxLength={80} defaultValue={value("city")} error={state.fieldErrors?.city} />
      </div>
      <TextArea
        label="Portfolio or professional links (optional)"
        name="portfolioLinks"
        rows={3}
        defaultValue={value("portfolioLinks")}
        error={state.fieldErrors?.portfolioLinks}
        hint="One https:// link per line: showreel, IMDb page, company site. These help moderators confirm who you are."
        placeholder="https://"
      />
      <p className="text-xs text-cream-muted">
        We only use this to review your application. Your email address is never shown publicly.
      </p>
      <DraftOrSubmit submitLabel="Submit application" />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Filmmaker profile
// ---------------------------------------------------------------------------

export function FilmmakerProfileForm({
  initial,
  countries,
  languages,
  selectedLanguages,
}: {
  initial: Record<string, string>;
  countries: Option[];
  languages: Option[];
  selectedLanguages: string[];
}) {
  const [state, action] = useActionState(saveFilmmakerProfile, IDLE);
  const value = (name: string) => v(state, initial, name);
  return (
    <form action={action} noValidate className="space-y-6">
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Professional name" name="professionalName" required maxLength={80} defaultValue={value("professionalName")} error={state.fieldErrors?.professionalName} />
        <SelectField label="Main professional role" name="professionalRole" options={roleOptions} defaultValue={value("professionalRole")} error={state.fieldErrors?.professionalRole} />
      </div>
      <TextField
        label="Profile address"
        name="slug"
        maxLength={60}
        defaultValue={value("slug")}
        error={state.fieldErrors?.slug}
        hint="naijascreen…/filmmakers/your-address. Made from your name if left empty."
      />
      <TextArea label="Biography" name="biography" rows={6} maxLength={3000} defaultValue={value("biography")} error={state.fieldErrors?.biography} />
      <TextField
        label="Areas of expertise (optional)"
        name="expertise"
        defaultValue={value("expertise")}
        error={state.fieldErrors?.expertise}
        hint="Comma-separated, e.g. Period drama, Stunt coordination, Yoruba dialogue."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Country (optional)" name="country" options={countries} defaultValue={value("country")} error={state.fieldErrors?.country} placeholder="Not shown" />
        <TextField label="City (optional)" name="city" maxLength={80} defaultValue={value("city")} error={state.fieldErrors?.city} hint="City or country level only, never an address." />
      </div>
      <ChipGroup legend="Languages you work in" name="languages" options={languages} selected={selectedLanguages} error={state.fieldErrors?.languages} />
      <TextField
        label="Profile image link (optional)"
        name="avatarUrl"
        type="url"
        placeholder="https://"
        defaultValue={value("avatarUrl")}
        error={state.fieldErrors?.avatarUrl}
        hint="A photo you have the right to use. File uploads aren't available yet."
      />
      <TextField label="Website (optional)" name="websiteUrl" type="url" placeholder="https://" defaultValue={value("websiteUrl")} error={state.fieldErrors?.websiteUrl} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextArea label="Portfolio links" name="portfolioLinks" rows={3} placeholder="https://" defaultValue={value("portfolioLinks")} error={state.fieldErrors?.portfolioLinks} hint="One per line." />
        <TextArea label="Professional social links" name="socialLinks" rows={3} placeholder="https://" defaultValue={value("socialLinks")} error={state.fieldErrors?.socialLinks} hint="One per line." />
      </div>
      <TextArea
        label="Selected filmography (optional)"
        name="filmography"
        rows={5}
        defaultValue={value("filmography")}
        error={state.fieldErrors?.filmography}
        hint="One per line: Title | Year | Your role. Only credits you actually hold."
        placeholder="Harmattan Letters | 2025 | Director"
      />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-cream">Visibility</legend>
        <div className="flex flex-wrap gap-4 text-sm text-cream">
          <label className="flex items-center gap-2">
            <input type="radio" name="visibility" value="private" defaultChecked={value("visibility") !== "public"} /> Private (only you)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="visibility" value="public" defaultChecked={value("visibility") === "public"} /> Public in the industry directory
          </label>
        </div>
      </fieldset>
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------

export function CompanyForm({
  initial,
  countries,
  companyId,
  canSubmit,
  locked = false,
}: {
  initial: Record<string, string>;
  countries: Option[];
  companyId?: string;
  canSubmit: boolean;
  /** In review or rejected: shown read-only. */
  locked?: boolean;
}) {
  const [state, action] = useActionState(saveCompany, IDLE);
  const value = (name: string) => v(state, initial, name);
  if (locked) {
    return (
      <p className="rounded-xl border border-line px-4 py-3 text-sm text-cream-muted">
        {initial.reviewStatus === "rejected" ? "This company wasn't approved, so it can't be edited." : "This company is with the moderators. You can edit it again once they decide."}
      </p>
    );
  }
  return (
    <form action={action} noValidate className="space-y-6">
      <FormMessage state={state} />
      {companyId && <input type="hidden" name="id" value={companyId} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Company name" name="name" required maxLength={120} defaultValue={value("name")} error={state.fieldErrors?.name} />
        {companyId ? (
          <TextField label="Company address" name="slug" readOnly defaultValue={value("slug")} hint="The address can't change after creation." />
        ) : (
          <TextField label="Company address (optional)" name="slug" maxLength={60} defaultValue={value("slug")} error={state.fieldErrors?.slug} hint="/companies/your-address" />
        )}
      </div>
      <TextArea label="Description" name="description" rows={5} maxLength={3000} defaultValue={value("description")} error={state.fieldErrors?.description} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Country" name="country" options={countries} defaultValue={value("country")} error={state.fieldErrors?.country} />
        <TextField label="City (optional)" name="city" maxLength={80} defaultValue={value("city")} error={state.fieldErrors?.city} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Logo link (optional)" name="logoUrl" type="url" placeholder="https://" defaultValue={value("logoUrl")} error={state.fieldErrors?.logoUrl} />
        <TextField label="Website (optional)" name="websiteUrl" type="url" placeholder="https://" defaultValue={value("websiteUrl")} error={state.fieldErrors?.websiteUrl} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Public contact email (optional)"
          name="publicEmail"
          type="email"
          defaultValue={value("publicEmail")}
          error={state.fieldErrors?.publicEmail}
          hint="Shown publicly. Use a business address, not a personal one."
        />
        <TextField label="Public phone (optional)" name="publicPhone" type="tel" defaultValue={value("publicPhone")} error={state.fieldErrors?.publicPhone} hint="Shown publicly." />
      </div>
      <TextArea label="Social links (optional)" name="socialLinks" rows={3} placeholder="https://" defaultValue={value("socialLinks")} error={state.fieldErrors?.socialLinks} hint="One per line." />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-cream">Visibility once approved</legend>
        <div className="flex flex-wrap gap-4 text-sm text-cream">
          <label className="flex items-center gap-2">
            <input type="radio" name="visibility" value="public" defaultChecked={value("visibility") !== "private"} /> Public
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="visibility" value="private" defaultChecked={value("visibility") === "private"} /> Private
          </label>
        </div>
      </fieldset>
      {canSubmit ? (
        <DraftOrSubmit submitLabel="Submit for review" />
      ) : (
        <div className="sm:max-w-56">
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </div>
      )}
    </form>
  );
}

export function InviteForm({ companyId }: { companyId: string }) {
  const [state, action] = useActionState(inviteMember, IDLE);
  return (
    <form key={state.status === "success" ? state.message : "invite"} action={action} noValidate className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="companyId" value={companyId} />
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <TextField
          label="Their public profile address"
          name="filmmakerSlug"
          placeholder="/filmmakers/ada-obi"
          defaultValue={state.values?.filmmakerSlug}
          error={state.fieldErrors?.filmmakerSlug}
          hint="Invitations go to filmmakers with a public NaijaScreen profile. No email needed."
        />
        <SelectField
          label="Role"
          name="memberRole"
          defaultValue="member"
          placeholder="Member"
          options={[
            { value: "member", label: "Member" },
            { value: "manager", label: "Manager (can edit)" },
          ]}
        />
      </div>
      <div className="sm:max-w-48">
        <SubmitButton pendingLabel="Sending…">Send invitation</SubmitButton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Film submission
// ---------------------------------------------------------------------------

export function SubmissionForm({
  initial,
  submissionId,
  countries,
  languages,
  genres,
  selectedGenres,
  companies,
}: {
  initial: Record<string, string>;
  submissionId?: string;
  countries: Option[];
  languages: Option[];
  genres: Option[];
  selectedGenres: string[];
  companies: Option[];
}) {
  const [state, action] = useActionState(saveSubmission, IDLE);
  const value = (name: string) => v(state, initial, name);
  return (
    <form action={action} noValidate className="space-y-6">
      <FormMessage state={state} />
      {submissionId && <input type="hidden" name="id" value={submissionId} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Film title" name="title" required maxLength={160} defaultValue={value("title")} error={state.fieldErrors?.title} />
        <TextField label="Original title (optional)" name="originalTitle" maxLength={160} defaultValue={value("originalTitle")} error={state.fieldErrors?.originalTitle} />
      </div>
      <TextArea label="Synopsis" name="synopsis" rows={5} maxLength={3000} defaultValue={value("synopsis")} error={state.fieldErrors?.synopsis} hint="Spoiler-free. At least 20 characters to submit." />
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField label="Release year" name="releaseYear" inputMode="numeric" defaultValue={value("releaseYear")} error={state.fieldErrors?.releaseYear} />
        <TextField label="Runtime (minutes)" name="runtimeMinutes" inputMode="numeric" defaultValue={value("runtimeMinutes")} error={state.fieldErrors?.runtimeMinutes} />
        <SelectField label="Main language" name="language" options={languages} defaultValue={value("language")} error={state.fieldErrors?.language} />
      </div>
      <ChipGroup legend="Genres (up to three)" name="genres" options={genres} selected={selectedGenres} error={state.fieldErrors?.genres} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Country of production" name="country" options={countries} defaultValue={value("country")} error={state.fieldErrors?.country} />
        <SelectField
          label="Production company (optional)"
          name="companyId"
          options={companies}
          defaultValue={value("companyId")}
          error={state.fieldErrors?.companyId}
          placeholder={companies.length ? "None" : "You aren't in a company yet"}
        />
      </div>
      <TextField label="Director" name="director" maxLength={120} defaultValue={value("director")} error={state.fieldErrors?.director} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextArea label="Producers (optional)" name="producers" rows={3} defaultValue={value("producers")} error={state.fieldErrors?.producers} hint="One per line." />
        <TextArea label="Principal cast (optional)" name="castNames" rows={3} defaultValue={value("castNames")} error={state.fieldErrors?.castNames} hint="One per line." />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField label="Official trailer link" name="trailerUrl" type="url" placeholder="https://" defaultValue={value("trailerUrl")} error={state.fieldErrors?.trailerUrl} hint="YouTube or Vimeo upload by the rights holder." />
        <TextField label="Official poster link" name="posterUrl" type="url" placeholder="https://" defaultValue={value("posterUrl")} error={state.fieldErrors?.posterUrl} />
        <TextField label="Official website" name="websiteUrl" type="url" placeholder="https://" defaultValue={value("websiteUrl")} error={state.fieldErrors?.websiteUrl} />
      </div>
      <TextArea
        label="Authorised viewing destinations (optional)"
        name="viewingLinks"
        rows={3}
        defaultValue={value("viewingLinks")}
        error={state.fieldErrors?.viewingLinks}
        hint="One per line: Platform | https://link. Moderators check each before anything is shown."
        placeholder="Platform name | https://"
      />
      <fieldset className="rounded-2xl border border-gold/50 p-5">
        <legend className="px-2 text-sm font-semibold text-gold">Rights and authorisation</legend>
        <label className="flex items-start gap-3 text-sm text-cream">
          <input type="checkbox" name="rightsConfirmed" defaultChecked={initial.rightsConfirmed === "on"} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />
          <span>
            I own this film or am authorised by its rights holder to submit it, its artwork, trailer and viewing links to NaijaScreen.
            <span className="block text-cream-muted">NaijaScreen lists films and links out; it never hosts or streams them.</span>
          </span>
        </label>
        {state.fieldErrors?.rightsConfirmed && <p className="mt-2 text-sm text-terracotta">{state.fieldErrors.rightsConfirmed}</p>}
        <div className="mt-4">
          <TextArea
            label="How are you authorised? (optional)"
            name="rightsStatement"
            rows={2}
            maxLength={1000}
            defaultValue={value("rightsStatement")}
            error={state.fieldErrors?.rightsStatement}
            hint="e.g. I'm the producer; distribution handled by our company."
          />
        </div>
      </fieldset>
      <TextArea label="Notes for the moderators (optional)" name="notesForAdmins" rows={3} maxLength={2000} defaultValue={value("notesForAdmins")} error={state.fieldErrors?.notesForAdmins} />
      <DraftOrSubmit />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Promotion
// ---------------------------------------------------------------------------

export function PromotionForm({ films, genres, today }: { films: Option[]; genres: Option[]; today: string }) {
  const [state, action] = useActionState(requestPromotion, IDLE);
  const value = (name: string) => state.values?.[name] ?? "";
  return (
    <form key={state.status === "success" ? state.message : "promo"} action={action} noValidate className="space-y-5">
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Film" name="filmId" options={films} defaultValue={value("filmId")} error={state.fieldErrors?.filmId} />
        <SelectField
          label="Placement"
          name="placement"
          options={PLACEMENTS.map((p) => ({ value: p, label: PLACEMENT_LABELS[p] }))}
          defaultValue={value("placement")}
          error={state.fieldErrors?.placement}
        />
      </div>
      <SelectField label="Genre (genre spotlight only)" name="genre" options={genres} defaultValue={value("genre")} error={state.fieldErrors?.genre} placeholder="Not a genre spotlight" />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Start date" name="startsOn" type="date" min={today} defaultValue={value("startsOn")} error={state.fieldErrors?.startsOn} />
        <TextField label="End date" name="endsOn" type="date" min={today} defaultValue={value("endsOn")} error={state.fieldErrors?.endsOn} hint={`Up to ${MAX_PROMOTION_DAYS} days.`} />
      </div>
      <TextArea label="Why now? (optional)" name="message" rows={3} maxLength={1000} defaultValue={value("message")} error={state.fieldErrors?.message} hint="e.g. a festival screening or release date." />
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Sending…">Request placement</SubmitButton>
      </div>
    </form>
  );
}
