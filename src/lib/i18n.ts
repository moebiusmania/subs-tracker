import type { I18n, Locale } from "./types.ts";

import en from "../i18n/en.json" with { type: "json" };
import it from "../i18n/it.json" with { type: "json" };

export const DEFAULT_LOCALE: Locale = "en";

// One file per locale in src/i18n
export const translations: Record<Locale, I18n> = { en, it };

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && Object.hasOwn(translations, value);

// First supported language among the browser's preferred ones ("it-IT" → "it").
// The inline script in index.html repeats this before first paint.
export const detectLocale = (languages: readonly string[]): Locale =>
  languages
    .map((language) => language.toLowerCase().split("-")[0])
    .find(isLocale) ?? DEFAULT_LOCALE;
