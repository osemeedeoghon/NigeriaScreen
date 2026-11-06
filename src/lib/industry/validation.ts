/**
 * Validation for every industry form. Server Actions run these before
 * writing; the Stage 7 check constraints repeat the key limits. Pure, so they
 * run under `node --test`.
 */
import { field, type FieldErrors, type Validated } from "../auth/validation.ts";
import { getAllGenres, getFilmBySlug } from "../catalogue.ts";
import { isCountryCode } from "../viewing/countries.ts";
import { isLanguageCode } from "../viewing/languages.ts";
import { checkHttpsUrl, slugify } from "../viewing/validation.ts";
import {
  ACCOUNT_TYPES,
  MAX_PROMOTION_DAYS,
  PLACEMENTS,
  PROFESSIONAL_ROLES,
  type AccountType,
  type Placement,
  type ProfessionalRole,
} from "./constants.ts";

export type Intent = "draft" | "submit";

const clean = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
const cleanText = (value: string) =>
  value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Reads the intent button: "submit" sends for review, anything else saves a draft. */
export function intentOf(form: FormData): Intent {
  return field(form, "intent") === "submit" ? "submit" : "draft";
}

function finish<T, F extends string>(errors: FieldErrors<F>, data: T): Validated<T, F> {
  const present = Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as FieldErrors<F>;
  return Object.keys(present).length ? { ok: false, errors: present } : { ok: true, data };
}

/** One https link per line (or comma-separated); returns normalised links or the first problem. */
export function parseLinkLines(value: string, max: number): { links: string[]; error?: string } {
  const raw = value
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (raw.length > max) return { links: [], error: `Add at most ${max} links.` };
  const links: string[] = [];
  for (const line of raw) {
    const result = checkHttpsUrl(line);
    if (!result.ok) return { links: [], error: `${line.slice(0, 60)}: ${result.error}` };
    if (!links.includes(result.url)) links.push(result.url);
  }
  return { links };
}

function optionalUrl(value: string): { url: string | null; error?: string } {
  if (!value.trim()) return { url: null };
  const result = checkHttpsUrl(value);
  return result.ok ? { url: result.url } : { url: null, error: result.error };
}

/** Short names or phrases, one per line or comma-separated. */
export function parseNameList(value: string, max: number, maxLength = 120): { names: string[]; error?: string } {
  const names = [...new Set(value.split(/[\n,]+/).map(clean).filter(Boolean))];
  if (names.length > max) return { names: [], error: `Add at most ${max}.` };
  const long = names.find((name) => name.length > maxLength);
  if (long) return { names: [], error: `"${long.slice(0, 30)}…" is longer than ${maxLength} characters.` };
  return { names };
}

const isRole = (value: string): value is ProfessionalRole => (PROFESSIONAL_ROLES as readonly string[]).includes(value);

function optionalCountry(value: string): { country: string | null; error?: string } {
  const code = value.trim().toUpperCase();
  if (!code) return { country: null };
  return isCountryCode(code) ? { country: code } : { country: null, error: "Choose a country." };
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

type ApplicationField = "accountType" | "professionalName" | "professionalRole" | "companyName" | "biography" | "country" | "city" | "portfolioLinks";

export interface ApplicationInput {
  accountType: AccountType;
  professionalName: string;
  professionalRole: ProfessionalRole;
  companyName: string | null;
  biography: string;
  country: string | null;
  city: string | null;
  portfolioLinks: string[];
  status: "draft" | "pending_review";
}

export function validateApplication(form: FormData, intent: Intent): Validated<ApplicationInput, ApplicationField> {
  const accountType = field(form, "accountType") || "filmmaker";
  const professionalName = clean(field(form, "professionalName"));
  const professionalRole = field(form, "professionalRole");
  const companyName = clean(field(form, "companyName"));
  const biography = cleanText(field(form, "biography"));
  const country = optionalCountry(field(form, "country"));
  const city = clean(field(form, "city"));
  const links = parseLinkLines(field(form, "portfolioLinks"), 10);
  const submitting = intent === "submit";

  const errors: FieldErrors<ApplicationField> = {
    accountType: (ACCOUNT_TYPES as readonly string[]).includes(accountType) ? undefined : "Choose an account type.",
    professionalName: !professionalName ? "Enter the name you work under." : professionalName.length > 80 ? "Keep it to 80 characters." : undefined,
    professionalRole: isRole(professionalRole) ? undefined : "Choose your main role.",
    companyName:
      accountType === "company" && !companyName ? "Enter the company's name." : companyName.length > 120 ? "Keep it to 120 characters." : undefined,
    biography:
      biography.length > 2000 ? "Keep it to 2,000 characters." : submitting && biography.length < 20 ? "Write at least a sentence or two (20 characters)." : undefined,
    country: country.error ?? (submitting && !country.country ? "Choose the country you mainly work in." : undefined),
    city: city.length > 80 ? "Keep it to 80 characters." : undefined,
    portfolioLinks: links.error,
  };

  return finish(errors, {
    accountType: accountType as AccountType,
    professionalName,
    professionalRole: professionalRole as ProfessionalRole,
    companyName: accountType === "company" ? companyName || null : null,
    biography,
    country: country.country,
    city: city || null,
    portfolioLinks: links.links,
    status: submitting ? "pending_review" : "draft",
  });
}

// ---------------------------------------------------------------------------
// Filmmaker profiles
// ---------------------------------------------------------------------------

export interface FilmographyEntry {
  title: string;
  year: number;
  role: string;
}

/** "Title | 2021 | Director", one per line. */
export function parseFilmography(value: string, max = 30): { entries: FilmographyEntry[]; error?: string } {
  const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length > max) return { entries: [], error: `Add at most ${max} titles.` };
  const entries: FilmographyEntry[] = [];
  for (const line of lines) {
    const [title = "", year = "", role = ""] = line.split("|").map(clean);
    const y = Number(year);
    if (!title || title.length > 120 || !Number.isInteger(y) || y < 1950 || y > 2039 || !role || role.length > 80) {
      return { entries: [], error: `Use "Title | Year | Role" on each line. Check: ${line.slice(0, 60)}` };
    }
    entries.push({ title, year: y, role });
  }
  return { entries };
}

export const formatFilmography = (entries: FilmographyEntry[]) => entries.map((e) => `${e.title} | ${e.year} | ${e.role}`).join("\n");

type ProfileField =
  | "slug"
  | "professionalName"
  | "professionalRole"
  | "expertise"
  | "biography"
  | "avatarUrl"
  | "city"
  | "country"
  | "languages"
  | "websiteUrl"
  | "portfolioLinks"
  | "socialLinks"
  | "filmography";

export interface FilmmakerProfileInput {
  slug: string;
  professionalName: string;
  professionalRole: ProfessionalRole;
  expertise: string[];
  biography: string;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  languages: string[];
  websiteUrl: string | null;
  portfolioLinks: string[];
  socialLinks: string[];
  filmography: FilmographyEntry[];
  visibility: "private" | "public";
}

export function validateFilmmakerProfile(form: FormData): Validated<FilmmakerProfileInput, ProfileField> {
  const professionalName = clean(field(form, "professionalName"));
  const slug = (field(form, "slug").trim() || slugify(professionalName)).toLowerCase();
  const professionalRole = field(form, "professionalRole");
  const expertise = parseNameList(field(form, "expertise"), 10, 40);
  const biography = cleanText(field(form, "biography"));
  const avatar = optionalUrl(field(form, "avatarUrl"));
  const website = optionalUrl(field(form, "websiteUrl"));
  const city = clean(field(form, "city"));
  const country = optionalCountry(field(form, "country"));
  const languages = [...new Set(form.getAll("languages").filter((v): v is string => typeof v === "string"))];
  const portfolio = parseLinkLines(field(form, "portfolioLinks"), 10);
  const social = parseLinkLines(field(form, "socialLinks"), 10);
  const filmography = parseFilmography(field(form, "filmography"));

  const errors: FieldErrors<ProfileField> = {
    slug: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 60 ? undefined : "Use lower-case letters, numbers and hyphens.",
    professionalName: !professionalName ? "Enter your professional name." : professionalName.length > 80 ? "Keep it to 80 characters." : undefined,
    professionalRole: isRole(professionalRole) ? undefined : "Choose your main role.",
    expertise: expertise.error,
    biography: biography.length > 3000 ? "Keep it to 3,000 characters." : undefined,
    avatarUrl: avatar.error,
    city: city.length > 80 ? "Keep it to 80 characters." : undefined,
    country: country.error,
    languages: languages.every(isLanguageCode) && languages.length <= 10 ? undefined : "Choose languages from the list.",
    websiteUrl: website.error,
    portfolioLinks: portfolio.error,
    socialLinks: social.error,
    filmography: filmography.error,
  };

  return finish(errors, {
    slug,
    professionalName,
    professionalRole: professionalRole as ProfessionalRole,
    expertise: expertise.names,
    biography,
    avatarUrl: avatar.url,
    city: city || null,
    country: country.country,
    languages,
    websiteUrl: website.url,
    portfolioLinks: portfolio.links,
    socialLinks: social.links,
    filmography: filmography.entries,
    visibility: field(form, "visibility") === "public" ? "public" : "private",
  });
}

// ---------------------------------------------------------------------------
// Production companies
// ---------------------------------------------------------------------------

type CompanyField = "name" | "slug" | "logoUrl" | "description" | "country" | "city" | "websiteUrl" | "publicEmail" | "publicPhone" | "socialLinks";

export interface CompanyInput {
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string;
  country: string | null;
  city: string | null;
  websiteUrl: string | null;
  publicEmail: string | null;
  publicPhone: string | null;
  socialLinks: string[];
  visibility: "private" | "public";
  reviewStatus: "draft" | "pending_review";
}

export function validateCompany(form: FormData, intent: Intent): Validated<CompanyInput, CompanyField> {
  const name = clean(field(form, "name"));
  const slug = (field(form, "slug").trim() || slugify(name)).toLowerCase();
  const logo = optionalUrl(field(form, "logoUrl"));
  const description = cleanText(field(form, "description"));
  const country = optionalCountry(field(form, "country"));
  const city = clean(field(form, "city"));
  const website = optionalUrl(field(form, "websiteUrl"));
  const publicEmail = field(form, "publicEmail").trim().toLowerCase();
  const publicPhone = clean(field(form, "publicPhone"));
  const social = parseLinkLines(field(form, "socialLinks"), 10);
  const submitting = intent === "submit";

  const errors: FieldErrors<CompanyField> = {
    name: !name ? "Enter the company's name." : name.length > 120 ? "Keep it to 120 characters." : undefined,
    slug: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 60 ? undefined : "Use lower-case letters, numbers and hyphens.",
    logoUrl: logo.error,
    description:
      description.length > 3000 ? "Keep it to 3,000 characters." : submitting && description.length < 20 ? "Describe the company in at least 20 characters." : undefined,
    country: country.error ?? (submitting && !country.country ? "Choose the company's country." : undefined),
    city: city.length > 80 ? "Keep it to 80 characters." : undefined,
    websiteUrl: website.error,
    publicEmail:
      publicEmail && !/^[a-z0-9._+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(publicEmail) ? "Enter a plain email address, or leave it empty." : undefined,
    publicPhone: publicPhone && !/^\+?[0-9 ()-]{6,20}$/.test(publicPhone) ? "Use digits, spaces, +, - or brackets." : undefined,
    socialLinks: social.error,
  };

  return finish(errors, {
    name,
    slug,
    logoUrl: logo.url,
    description,
    country: country.country,
    city: city || null,
    websiteUrl: website.url,
    publicEmail: publicEmail || null,
    publicPhone: publicPhone || null,
    socialLinks: social.links,
    visibility: field(form, "visibility") === "private" ? "private" : "public",
    reviewStatus: submitting ? "pending_review" : "draft",
  });
}

// ---------------------------------------------------------------------------
// Film submissions
// ---------------------------------------------------------------------------

export interface ViewingLink {
  label: string;
  url: string;
}

/** "Platform name | https://…", one per line. */
export function parseViewingLinks(value: string, max = 10): { links: ViewingLink[]; error?: string } {
  const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length > max) return { links: [], error: `Add at most ${max} viewing links.` };
  const links: ViewingLink[] = [];
  for (const line of lines) {
    const [label = "", url = ""] = line.split("|").map((part) => part.trim());
    const check = checkHttpsUrl(url);
    if (!clean(label) || clean(label).length > 80 || !check.ok) {
      return { links: [], error: `Use "Platform | https://link" on each line. Check: ${line.slice(0, 60)}` };
    }
    links.push({ label: clean(label), url: check.url });
  }
  return { links };
}

export const formatViewingLinks = (links: ViewingLink[]) => links.map((l) => `${l.label} | ${l.url}`).join("\n");

type SubmissionField =
  | "title"
  | "originalTitle"
  | "synopsis"
  | "releaseYear"
  | "runtimeMinutes"
  | "genres"
  | "language"
  | "country"
  | "director"
  | "producers"
  | "castNames"
  | "companyId"
  | "trailerUrl"
  | "posterUrl"
  | "websiteUrl"
  | "viewingLinks"
  | "rightsConfirmed"
  | "rightsStatement"
  | "notesForAdmins";

export interface SubmissionInput {
  title: string;
  originalTitle: string | null;
  synopsis: string;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  genres: string[];
  language: string | null;
  country: string | null;
  director: string | null;
  producers: string[];
  castNames: string[];
  companyId: string | null;
  trailerUrl: string | null;
  posterUrl: string | null;
  websiteUrl: string | null;
  viewingLinks: ViewingLink[];
  rightsConfirmed: boolean;
  rightsStatement: string | null;
  notesForAdmins: string | null;
  status: "draft" | "pending_review";
}

/** `companyIds` are the companies the submitter actively belongs to. */
export function validateSubmission(form: FormData, intent: Intent, companyIds: ReadonlySet<string>): Validated<SubmissionInput, SubmissionField> {
  const genreSlugs = new Set<string>(getAllGenres().map((genre) => genre.slug));
  const title = clean(field(form, "title"));
  const originalTitle = clean(field(form, "originalTitle"));
  const synopsis = cleanText(field(form, "synopsis"));
  const yearRaw = field(form, "releaseYear").trim();
  const runtimeRaw = field(form, "runtimeMinutes").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const runtime = runtimeRaw ? Number(runtimeRaw) : null;
  const genres = [...new Set(form.getAll("genres").filter((v): v is string => typeof v === "string"))];
  const language = field(form, "language").trim().toLowerCase();
  const country = optionalCountry(field(form, "country"));
  const director = clean(field(form, "director"));
  const producers = parseNameList(field(form, "producers"), 20);
  const cast = parseNameList(field(form, "castNames"), 50);
  const companyId = field(form, "companyId").trim();
  const trailer = optionalUrl(field(form, "trailerUrl"));
  const poster = optionalUrl(field(form, "posterUrl"));
  const website = optionalUrl(field(form, "websiteUrl"));
  const viewing = parseViewingLinks(field(form, "viewingLinks"));
  const rightsConfirmed = field(form, "rightsConfirmed") === "on";
  const rightsStatement = cleanText(field(form, "rightsStatement"));
  const notes = cleanText(field(form, "notesForAdmins"));
  const submitting = intent === "submit";
  const required = (ok: boolean, message: string) => (submitting && !ok ? message : undefined);

  const errors: FieldErrors<SubmissionField> = {
    title: !title ? "Enter the film's title." : title.length > 160 ? "Keep it to 160 characters." : undefined,
    originalTitle: originalTitle.length > 160 ? "Keep it to 160 characters." : undefined,
    synopsis: synopsis.length > 3000 ? "Keep it to 3,000 characters." : required(synopsis.length >= 20, "Write a synopsis of at least 20 characters."),
    releaseYear:
      year !== null && (!Number.isInteger(year) || year < 1950 || year > 2035) ? "Use a year from 1950 to 2035." : required(year !== null, "Enter the release year."),
    runtimeMinutes:
      runtime !== null && (!Number.isInteger(runtime) || runtime < 1 || runtime > 600)
        ? "Enter the runtime in whole minutes (1–600)."
        : required(runtime !== null, "Enter the runtime."),
    genres:
      genres.length > 3 || genres.some((g) => !genreSlugs.has(g)) ? "Choose up to three genres from the list." : required(genres.length > 0, "Choose at least one genre."),
    language: language && !isLanguageCode(language) ? "Choose a language from the list." : required(Boolean(language), "Choose the main language."),
    country: country.error ?? required(Boolean(country.country), "Choose the country of production."),
    director: director.length > 120 ? "Keep it to 120 characters." : required(Boolean(director), "Enter the director."),
    producers: producers.error,
    castNames: cast.error,
    companyId: companyId && !companyIds.has(companyId) ? "Choose a company you belong to." : undefined,
    trailerUrl: trailer.error,
    posterUrl: poster.error,
    websiteUrl: website.error,
    viewingLinks: viewing.error,
    rightsConfirmed: required(rightsConfirmed, "Confirm you have the rights or authorisation to submit this film."),
    rightsStatement: rightsStatement.length > 1000 ? "Keep it to 1,000 characters." : undefined,
    notesForAdmins: notes.length > 2000 ? "Keep it to 2,000 characters." : undefined,
  };

  return finish(errors, {
    title,
    originalTitle: originalTitle || null,
    synopsis,
    releaseYear: year,
    runtimeMinutes: runtime,
    genres,
    language: language || null,
    country: country.country,
    director: director || null,
    producers: producers.names,
    castNames: cast.names,
    companyId: companyId || null,
    trailerUrl: trailer.url,
    posterUrl: poster.url,
    websiteUrl: website.url,
    viewingLinks: viewing.links,
    rightsConfirmed,
    rightsStatement: rightsStatement || null,
    notesForAdmins: notes || null,
    status: submitting ? "pending_review" : "draft",
  });
}

/** The public address for an approved submission; must not clash with a catalogue film. */
export function validatePublishSlug(value: string): { ok: true; slug: string } | { ok: false; error: string } {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) return { ok: false, error: "Use lower-case letters, numbers and hyphens." };
  if (getFilmBySlug(slug)) return { ok: false, error: "A catalogue film already uses this address." };
  return { ok: true, slug };
}

// ---------------------------------------------------------------------------
// Promotion requests
// ---------------------------------------------------------------------------

type PromotionField = "filmId" | "placement" | "genre" | "startsOn" | "endsOn" | "message";

export interface PromotionInput {
  filmId: string;
  placement: Placement;
  genre: string | null;
  startsOn: string;
  endsOn: string;
  message: string | null;
}

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** `filmIds` are the published films the requester may promote; `today` is YYYY-MM-DD. */
export function validatePromotion(form: FormData, filmIds: ReadonlySet<string>, today: string): Validated<PromotionInput, PromotionField> {
  const filmId = field(form, "filmId");
  const placement = field(form, "placement");
  const genre = field(form, "genre").trim();
  const startsOn = field(form, "startsOn").trim();
  const endsOn = field(form, "endsOn").trim();
  const message = cleanText(field(form, "message"));
  const genreSlugs = new Set<string>(getAllGenres().map((g) => g.slug));
  const datesOk = isIsoDate(startsOn) && isIsoDate(endsOn);

  const errors: FieldErrors<PromotionField> = {
    filmId: filmIds.has(filmId) ? undefined : "Choose one of your approved films.",
    placement: (PLACEMENTS as readonly string[]).includes(placement) ? undefined : "Choose a placement.",
    genre: placement === "genre_spotlight" && !genreSlugs.has(genre) ? "Choose the genre to spotlight." : undefined,
    startsOn: !isIsoDate(startsOn) ? "Choose a start date." : startsOn < today ? "Start today or later." : undefined,
    endsOn: !isIsoDate(endsOn)
      ? "Choose an end date."
      : datesOk && endsOn < startsOn
        ? "End on or after the start date."
        : datesOk && daysBetween(startsOn, endsOn) > MAX_PROMOTION_DAYS
          ? `Keep it to ${MAX_PROMOTION_DAYS} days or fewer.`
          : undefined,
    message: message.length > 1000 ? "Keep it to 1,000 characters." : undefined,
  };

  return finish(errors, {
    filmId,
    placement: placement as Placement,
    genre: placement === "genre_spotlight" ? genre : null,
    startsOn,
    endsOn,
    message: message || null,
  });
}
