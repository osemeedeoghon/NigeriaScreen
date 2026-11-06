/** Names for codes the browser's built-in list doesn't know. */
const EXTRA_LANGUAGES: Record<string, string> = {
  ijc: "Izon (Ijaw)",
  ibb: "Ibibio",
  tiv: "Tiv",
  bin: "Edo (Bini)",
  urh: "Urhobo",
  kcg: "Tyap",
};

const languageNames = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });

/** Languages offered first in pickers and examples. */
export const COMMON_LANGUAGES = ["en", "yo", "ig", "ha", "pcm", "fr", "efi", "ijc"];

/** True for an ISO 639-1 or 639-3 code that has a known English name. */
export function isLanguageCode(value: string): boolean {
  return /^[a-z]{2,3}$/.test(value) && languageName(value) !== undefined;
}

export function languageName(code: string): string | undefined {
  return EXTRA_LANGUAGES[code] ?? languageNames.of(code);
}
