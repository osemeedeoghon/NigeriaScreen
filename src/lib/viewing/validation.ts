/**
 * Validation for where-to-watch and trailer records. Every admin Server Action
 * runs these before writing; the database repeats the key rules as check
 * constraints. Pure functions, so they run in `node --test`.
 */
import { field, type FieldErrors, type Validated } from "../auth/validation.ts";
import { getFilmById } from "../catalogue.ts";
import { ACCESS_TYPES, VERIFICATION_STATUSES, type AccessType, type VerificationStatus } from "../../types/viewing.ts";
import { isCountryCode } from "./countries.ts";
import { isLanguageCode } from "./languages.ts";
import { parseTrailerUrl, type ParsedTrailer } from "./trailers.ts";

export const URL_MAX = 2000;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

/**
 * Accepts only absolute https URLs to a public host and returns the normalised
 * form. Rejects javascript:, data:, file:, http: and every other scheme, plus
 * embedded credentials, local hosts and control characters.
 */
export function checkHttpsUrl(value: string): UrlCheck {
  const raw = value.trim();
  if (!raw) return { ok: false, error: "Enter a link." };
  if (raw.length > URL_MAX) return { ok: false, error: "That link is too long." };
  if (CONTROL_CHARS.test(raw) || /\s/.test(raw)) return { ok: false, error: "Links can't contain spaces or hidden characters." };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "Enter a full link that starts with https://." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Only secure https:// links are allowed." };
  if (url.username || url.password) return { ok: false, error: "Links can't include a username or password." };

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    !host.includes(".") ||
    /^[\d.]+$/.test(host) ||
    host.startsWith("[")
  ) {
    return { ok: false, error: "Use the public address of the official site, not a local or numeric address." };
  }
  const normalised = url.toString();
  if (normalised.length > URL_MAX) return { ok: false, error: "That link is too long." };
  return { ok: true, url: normalised };
}

/** Same as checkHttpsUrl, but an empty value means "not set". */
function optionalUrl(value: string): { url: string | null; error?: string } {
  if (!value.trim()) return { url: null };
  const result = checkHttpsUrl(value);
  return result.ok ? { url: result.url } : { url: null, error: result.error };
}

/** "ng, GH  gb" -> ["NG", "GH", "GB"]. Reports unknown codes by name. */
export function parseCountryList(value: string): { codes: string[]; invalid: string[] } {
  const tokens = value
    .split(/[\s,;]+/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
  const codes = [...new Set(tokens.filter(isCountryCode))];
  const invalid = [...new Set(tokens.filter((token) => !isCountryCode(token)))];
  return { codes, invalid };
}

/** "en, YO pcm" -> ["en", "yo", "pcm"]. */
export function parseLanguageList(value: string): { codes: string[]; invalid: string[] } {
  const tokens = value
    .split(/[\s,;]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const codes = [...new Set(tokens.filter(isLanguageCode))];
  const invalid = [...new Set(tokens.filter((token) => !isLanguageCode(token)))];
  return { codes, invalid };
}

export function isAccessType(value: unknown): value is AccessType {
  return typeof value === "string" && (ACCESS_TYPES as readonly string[]).includes(value);
}

export function isVerificationStatus(value: unknown): value is VerificationStatus {
  return typeof value === "string" && (VERIFICATION_STATUSES as readonly string[]).includes(value);
}

/** Only films in the catalogue can have viewing options or trailers. */
export function isKnownFilmId(value: unknown): value is string {
  return typeof value === "string" && getFilmById(value) !== undefined;
}

/** Lower-case, hyphenated slug from a provider name. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

const clean = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

type ProviderField = "name" | "slug" | "websiteUrl" | "logoUrl" | "description";

export interface ProviderInput {
  name: string;
  slug: string;
  websiteUrl: string;
  logoUrl: string | null;
  description: string | null;
}

export function validateProvider(form: FormData): Validated<ProviderInput, ProviderField> {
  const name = clean(field(form, "name"));
  const slug = field(form, "slug").trim() || slugify(name);
  const website = checkHttpsUrl(field(form, "websiteUrl"));
  const logo = optionalUrl(field(form, "logoUrl"));
  const description = clean(field(form, "description"));

  const errors: FieldErrors<ProviderField> = {
    name: !name ? "Enter the provider's name." : name.length > 80 ? "Keep the name to 80 characters or fewer." : undefined,
    slug: !SLUG_PATTERN.test(slug) || slug.length > 60 ? "Use lower-case letters, numbers and hyphens." : undefined,
    websiteUrl: website.ok ? undefined : website.error,
    logoUrl: logo.error,
    description: description.length > 500 ? "Keep the description to 500 characters or fewer." : undefined,
  };
  return finish(errors, {
    name,
    slug,
    websiteUrl: website.ok ? website.url : "",
    logoUrl: logo.url,
    description: description || null,
  });
}

// ---------------------------------------------------------------------------
// Viewing options
// ---------------------------------------------------------------------------

type OptionField =
  | "filmId"
  | "providerId"
  | "destinationUrl"
  | "accessType"
  | "countries"
  | "audioLanguages"
  | "subtitleLanguages"
  | "availabilityNotes";

export interface ViewingOptionInput {
  filmId: string;
  providerId: string;
  destinationUrl: string;
  accessType: AccessType;
  countries: string[];
  audioLanguages: string[];
  subtitleLanguages: string[];
  availabilityNotes: string | null;
}

export interface ViewingOptionContext {
  /** Ids of providers that exist (active or not). */
  providerIds: ReadonlySet<string>;
  /** Existing options for the same film, used to catch duplicates before the database does. */
  existing?: ReadonlyArray<{ id: string; providerId: string; accessType: string; destinationUrl: string }>;
  /** When editing, the option being edited is not a duplicate of itself. */
  editingId?: string;
}

export function validateViewingOption(form: FormData, context: ViewingOptionContext): Validated<ViewingOptionInput, OptionField> {
  const filmId = field(form, "filmId");
  const providerId = field(form, "providerId");
  const accessType = field(form, "accessType");
  const destination = checkHttpsUrl(field(form, "destinationUrl"));
  const countries = parseCountryList(field(form, "countries"));
  const audio = parseLanguageList(field(form, "audioLanguages"));
  const subtitles = parseLanguageList(field(form, "subtitleLanguages"));
  const notes = clean(field(form, "availabilityNotes"));

  const duplicate =
    destination.ok &&
    context.existing?.some(
      (option) =>
        option.id !== context.editingId &&
        option.providerId === providerId &&
        option.accessType === accessType &&
        option.destinationUrl === destination.url,
    );

  const errors: FieldErrors<OptionField> = {
    filmId: isKnownFilmId(filmId) ? undefined : "Choose a film from the catalogue.",
    providerId: context.providerIds.has(providerId) ? undefined : "Choose a provider.",
    accessType: isAccessType(accessType) ? undefined : "Choose how viewers get access.",
    destinationUrl: !destination.ok
      ? destination.error
      : duplicate
        ? "This film already has this link for the same provider and access type."
        : undefined,
    countries:
      countries.invalid.length > 0
        ? `Not ISO country codes: ${countries.invalid.join(", ")}. Use two letters, like NG or GB.`
        : countries.codes.length === 0
          ? "List at least one country where this link has been checked, like NG."
          : undefined,
    audioLanguages: audio.invalid.length > 0 ? `Unknown language codes: ${audio.invalid.join(", ")}.` : undefined,
    subtitleLanguages: subtitles.invalid.length > 0 ? `Unknown language codes: ${subtitles.invalid.join(", ")}.` : undefined,
    availabilityNotes: notes.length > 500 ? "Keep notes to 500 characters or fewer." : undefined,
  };

  return finish(errors, {
    filmId,
    providerId,
    destinationUrl: destination.ok ? destination.url : "",
    accessType: accessType as AccessType,
    countries: countries.codes,
    audioLanguages: audio.codes,
    subtitleLanguages: subtitles.codes,
    availabilityNotes: notes || null,
  });
}

// ---------------------------------------------------------------------------
// Trailers
// ---------------------------------------------------------------------------

type TrailerField = "filmId" | "title" | "videoUrl" | "thumbnailUrl" | "publishedOn";

export interface TrailerInput {
  filmId: string;
  title: string;
  video: ParsedTrailer;
  embeddable: boolean;
  thumbnailUrl: string | null;
  publishedOn: string | null;
}

export function validateTrailer(form: FormData): Validated<TrailerInput, TrailerField> {
  const filmId = field(form, "filmId");
  const title = clean(field(form, "title"));
  const video = parseTrailerUrl(field(form, "videoUrl"));
  const thumbnail = optionalUrl(field(form, "thumbnailUrl"));
  const publishedOn = field(form, "publishedOn").trim();

  const errors: FieldErrors<TrailerField> = {
    filmId: isKnownFilmId(filmId) ? undefined : "Choose a film from the catalogue.",
    title: !title ? "Enter a title for the trailer." : title.length > 120 ? "Keep the title to 120 characters or fewer." : undefined,
    videoUrl: video ? undefined : "Use a YouTube or Vimeo video link. Other sites can't be embedded.",
    thumbnailUrl: thumbnail.error,
    publishedOn: publishedOn && !isIsoDate(publishedOn) ? "Use a real date." : undefined,
  };
  return finish(errors, {
    filmId,
    title,
    video: video ?? { provider: "youtube", videoId: "", canonicalUrl: "" },
    embeddable: field(form, "embeddable") !== "off",
    thumbnailUrl: thumbnail.url,
    publishedOn: publishedOn || null,
  });
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) && date.getUTCFullYear() >= 1950;
}

function finish<T, Field extends string>(errors: FieldErrors<Field>, data: T): Validated<T, Field> {
  const present = Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as FieldErrors<Field>;
  return Object.keys(present).length > 0 ? { ok: false, errors: present } : { ok: true, data };
}
