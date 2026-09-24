import { assertEquals } from "@std/assert";

import { detectLocale, isLocale, translations } from "./i18n.ts";

// Every key path in a translation, e.g. "main.title"
const keys = (value: object, prefix = ""): string[] =>
  Object.entries(value).flatMap(([key, child]) =>
    typeof child === "object"
      ? keys(child, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  ).sort();

Deno.test("translations - every locale has the same keys as English", () => {
  const english = keys(translations.en);
  for (const [locale, strings] of Object.entries(translations)) {
    assertEquals(keys(strings), english, `${locale} is out of sync`);
  }
});

Deno.test("translations - no empty strings", () => {
  for (const strings of Object.values(translations)) {
    const values = keys(strings).map((path) =>
      path.split(".").reduce(
        // deno-lint-ignore no-explicit-any
        (node: any, key) => node[key],
        strings,
      )
    );
    assertEquals(values.filter((value) => !value.trim()), []);
  }
});

Deno.test("translations - placeholders are kept", () => {
  assertEquals(translations.it.main.inactives.includes("{{value}}"), true);
  assertEquals(translations.it.main.toggle.includes("{{value}}"), true);
});

Deno.test("isLocale", () => {
  assertEquals(isLocale("en"), true);
  assertEquals(isLocale("it"), true);
  assertEquals(isLocale("fr"), false);
  assertEquals(isLocale("toString"), false);
  assertEquals(isLocale(undefined), false);
});

Deno.test("detectLocale - first supported browser language wins", () => {
  assertEquals(detectLocale(["it-IT", "en-US"]), "it");
  assertEquals(detectLocale(["fr-FR", "en-GB", "it"]), "en");
  assertEquals(detectLocale(["IT"]), "it");
});

Deno.test("detectLocale - falls back to English", () => {
  assertEquals(detectLocale(["fr-FR", "de"]), "en");
  assertEquals(detectLocale([]), "en");
});
