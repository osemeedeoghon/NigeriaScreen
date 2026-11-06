/**
 * Input validation for account forms and library actions. Runs on the server
 * inside every Server Action; the database constraints repeat the same limits.
 */
import { getFilmById } from "../catalogue.ts";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
export const DISPLAY_NAME_MAX = 50;
export const REVIEW_MAX = 2000;
export const RATING_MIN = 1;
export const RATING_MAX = 5;

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

export type Validated<T, Field extends string> =
  | { ok: true; data: T }
  | { ok: false; errors: FieldErrors<Field> };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
// Control characters except tab, newline and carriage return.
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** Reads a form field as a string; files and missing fields become "". */
export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** Trims, strips control characters and collapses runs of spaces on one line. */
export function cleanLine(value: string): string {
  return value.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
}

/** Like cleanLine but keeps paragraph breaks (at most one blank line in a row). */
export function cleanMultiline(value: string): string {
  return value
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string): string | undefined {
  const email = normalizeEmail(value);
  if (!email) return "Enter your email address.";
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return "Enter a valid email address, like name@example.com.";
  return undefined;
}

export function validateNewPassword(password: string): string | undefined {
  if (!password) return "Choose a password.";
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer.`;
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return "Include at least one letter and one number.";
  return undefined;
}

export function validateDisplayName(value: string): string | undefined {
  const name = cleanLine(value);
  if (!name) return "Enter the name other viewers will see.";
  if (name.length > DISPLAY_NAME_MAX) return `Keep your name to ${DISPLAY_NAME_MAX} characters or fewer.`;
  return undefined;
}

type SignUpField = "displayName" | "email" | "password" | "confirmPassword";

export function validateSignUp(form: FormData): Validated<{ displayName: string; email: string; password: string }, SignUpField> {
  const displayName = cleanLine(field(form, "displayName"));
  const email = normalizeEmail(field(form, "email"));
  const password = field(form, "password");
  const errors: FieldErrors<SignUpField> = {
    displayName: validateDisplayName(displayName),
    email: validateEmail(email),
    password: validateNewPassword(password),
    confirmPassword: password && field(form, "confirmPassword") !== password ? "Passwords do not match." : undefined,
  };
  return finish(errors, { displayName, email, password });
}

type SignInField = "email" | "password";

export function validateSignIn(form: FormData): Validated<{ email: string; password: string }, SignInField> {
  const email = normalizeEmail(field(form, "email"));
  const password = field(form, "password");
  const errors: FieldErrors<SignInField> = {
    email: validateEmail(email),
    password: password ? undefined : "Enter your password.",
  };
  return finish(errors, { email, password });
}

export function validateResetRequest(form: FormData): Validated<{ email: string }, "email"> {
  const email = normalizeEmail(field(form, "email"));
  return finish({ email: validateEmail(email) }, { email });
}

type NewPasswordField = "password" | "confirmPassword";

export function validatePasswordChange(form: FormData): Validated<{ password: string }, NewPasswordField> {
  const password = field(form, "password");
  const errors: FieldErrors<NewPasswordField> = {
    password: validateNewPassword(password),
    confirmPassword: password && field(form, "confirmPassword") !== password ? "Passwords do not match." : undefined,
  };
  return finish(errors, { password });
}

type ProfileField = "displayName" | "username" | "avatarUrl";

export interface ProfileInput {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
}

export function validateProfile(form: FormData): Validated<ProfileInput, ProfileField> {
  const displayName = cleanLine(field(form, "displayName"));
  const username = cleanLine(field(form, "username")).toLowerCase().replace(/^@/, "");
  const avatarUrl = field(form, "avatarUrl").trim();
  const errors: FieldErrors<ProfileField> = {
    displayName: validateDisplayName(displayName),
    username:
      username && !USERNAME_PATTERN.test(username)
        ? "Use 3–20 lowercase letters, numbers or underscores."
        : undefined,
    avatarUrl: avatarUrl ? validateAvatarUrl(avatarUrl) : undefined,
  };
  return finish(errors, { displayName, username: username || null, avatarUrl: avatarUrl || null });
}

function validateAvatarUrl(value: string): string | undefined {
  if (value.length > 500) return "That link is too long.";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "Use a link that starts with https://.";
  } catch {
    return "Enter a full image link, like https://example.com/me.jpg.";
  }
  return undefined;
}

type ReviewField = "rating" | "body";

export function validateReview(form: FormData): Validated<{ rating: number; body: string | null }, ReviewField> {
  const rawRating = field(form, "rating");
  const rating = Number(rawRating);
  const body = cleanMultiline(field(form, "body"));
  const errors: FieldErrors<ReviewField> = {
    rating:
      !rawRating || !Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX
        ? `Choose a rating from ${RATING_MIN} to ${RATING_MAX} stars.`
        : undefined,
    body: body.length > REVIEW_MAX ? `Keep your review to ${REVIEW_MAX} characters or fewer.` : undefined,
  };
  return finish(errors, { rating, body: body || null });
}

/** Only ids that exist in the catalogue may be written to the database. */
export function isCatalogueFilmId(value: unknown): value is string {
  return typeof value === "string" && getFilmById(value) !== undefined;
}

function finish<T, Field extends string>(errors: FieldErrors<Field>, data: T): Validated<T, Field> {
  const present = Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as FieldErrors<Field>;
  return Object.keys(present).length > 0 ? { ok: false, errors: present } : { ok: true, data };
}
