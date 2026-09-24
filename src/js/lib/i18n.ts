import type { I18n, Locale } from "./types.ts";

import en from "../../_data/i18n/en.json" with { type: "json" };
import it from "../../_data/i18n/it.json" with { type: "json" };

export const DEFAULT_LOCALE: Locale = "en";

// Also exposed to the templates as `i18n` (one file per locale in _data/i18n)
export const translations: Record<Locale, I18n> = { en, it };

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && Object.hasOwn(translations, value);

// First supported language among the browser's preferred ones ("it-IT" → "it").
// The inline script in layouts/base.vto repeats this before first paint.
export const detectLocale = (languages: readonly string[]): Locale =>
  languages
    .map((language) => language.toLowerCase().split("-")[0])
    .find(isLocale) ?? DEFAULT_LOCALE;
