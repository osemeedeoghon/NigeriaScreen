import type { Language } from "@/types";

/** ISO 639 codes for the catalogue's languages, as stored in Supabase preferences. */
export const LANGUAGE_CODES: Record<Language, string> = {
  English: "en",
  Yoruba: "yo",
  Igbo: "ig",
  Hausa: "ha",
  "Nigerian Pidgin": "pcm",
  Efik: "efi",
  Ijaw: "ijc",
};

const BY_CODE = new Map(Object.entries(LANGUAGE_CODES).map(([name, code]) => [code, name as Language]));

export function languageCode(language: Language): string {
  return LANGUAGE_CODES[language];
}

export function languageFromCode(code: string): Language | undefined {
  return BY_CODE.get(code);
}
