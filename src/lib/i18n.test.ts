import { assert, test } from "vitest";

import { detectLocale, isLocale, translations } from "./i18n.ts";

// Every key path in a translation, e.g. "main.title"
const keys = (value: object, prefix = ""): string[] =>
  Object.entries(value)
    .flatMap(([key, child]) =>
      typeof child === "object"
        ? keys(child, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    )
    .sort();

test("translations - every locale has the same keys as English", () => {
  const english = keys(translations.en);
  for (const [locale, strings] of Object.entries(translations)) {
    assert.deepEqual(keys(strings), english, `${locale} is out of sync`);
  }
});

test("translations - no empty strings", () => {
  for (const strings of Object.values(translations)) {
    const values = keys(strings).map((path) =>
      path.split(".").reduce(
        // deno-lint-ignore no-explicit-any
        (node: any, key) => node[key],
        strings,
      ),
    );
    assert.deepEqual(
      values.filter((value) => !value.trim()),
      [],
    );
  }
});

test("translations - placeholders are kept", () => {
  assert.deepEqual(translations.it.main.inactives.includes("{{value}}"), true);
  assert.deepEqual(translations.it.main.toggle.includes("{{value}}"), true);
});

test("isLocale", () => {
  assert.deepEqual(isLocale("en"), true);
  assert.deepEqual(isLocale("it"), true);
  assert.deepEqual(isLocale("fr"), false);
  assert.deepEqual(isLocale("toString"), false);
  assert.deepEqual(isLocale(undefined), false);
});

test("detectLocale - first supported browser language wins", () => {
  assert.deepEqual(detectLocale(["it-IT", "en-US"]), "it");
  assert.deepEqual(detectLocale(["fr-FR", "en-GB", "it"]), "en");
  assert.deepEqual(detectLocale(["IT"]), "it");
});

test("detectLocale - falls back to English", () => {
  assert.deepEqual(detectLocale(["fr-FR", "de"]), "en");
  assert.deepEqual(detectLocale([]), "en");
});
