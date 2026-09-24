import { assertEquals, assertNotEquals } from "@std/assert";

import type { Subscription } from "./types.ts";
import { createStore } from "./store.ts";
import type { Locale } from "./types.ts";
import { translations } from "./i18n.ts";

const testSubscription: Subscription = {
  name: "Test",
  price: 9.99,
  currency: "€",
  isActive: true,
  recurrence: "monthly",
  expiration: new Date("2022-11-21T19:31:26.925Z"),
};

Deno.test("getState", () => {
  const app = createStore();
  assertEquals(app.getState, {
    locale: "en",
    theme: "light",
    currency: "€",
    data: [],
  });
});

Deno.test("loadMock", () => {
  const app = createStore();
  assertEquals(app.data.length, 0);
  app.loadMock();
  assertEquals(app.data.length, 4);
});

Deno.test("setTheme", () => {
  const app = createStore();
  assertEquals(app.theme, "light");
  app.setTheme("dark");
  assertEquals(app.theme, "dark");
});

Deno.test("deleteSubs", () => {
  const app = createStore();
  app.loadMock();
  assertEquals(app.data.length, 4);
  app.deleteSubs();
  assertEquals(app.data.length, 0);
});

Deno.test("addSubscription", () => {
  const app = createStore();
  app.addSubscription(testSubscription);
  assertEquals(app.data.length, 1);
  assertEquals(app.data[0].name, "Test");
  assertEquals(app.data[0].price, 9.99);
});

Deno.test("toggleActive - normal behavior", () => {
  const app = createStore();
  app.addSubscription({ ...testSubscription });
  app.addSubscription({ ...testSubscription });
  assertEquals(app.data[0].isActive, true);
  app.toggleActive(0);
  assertEquals(app.data[0].isActive, false);
  app.toggleActive(0);
  assertEquals(app.data[0].isActive, true);
});

Deno.test("toggleActive - don't update isActive if there is only 1 element", () => {
  const app = createStore();
  app.addSubscription({ ...testSubscription });
  assertEquals(app.data[0].isActive, true);
  app.toggleActive(0);
  assertNotEquals(app.data[0].isActive, false);
});

Deno.test("setLocale - switches the strings too", () => {
  const app = createStore();
  assertEquals(app.i18n, translations.en);
  app.setLocale("it");
  assertEquals(app.locale, "it");
  assertEquals(app.i18n, translations.it);
  assertEquals(app.i18n.main.title, "Le tue statistiche");
});

Deno.test("getState - leaves the strings out", () => {
  const app = createStore();
  app.setLocale("it");
  assertEquals(app.getState.locale, "it");
  assertEquals("i18n" in app.getState, false);
});

Deno.test("setState - restores the saved locale", () => {
  const app = createStore();
  app.setState({ ...app.getState, locale: "it" });
  assertEquals(app.locale, "it");
  assertEquals(app.i18n, translations.it);
});

Deno.test("setState - falls back to English for an unknown locale", () => {
  const app = createStore();
  app.setLocale("it");
  app.setState({ ...app.getState, locale: "fr" as Locale });
  assertEquals(app.locale, "en");
});

Deno.test("setState", () => {
  const app = createStore();
  app.setState({ ...app.getState, theme: "dark", data: [testSubscription] });
  assertEquals(app.theme, "dark");
  assertEquals(app.data.length, 1);
});

Deno.test("importSubs - replaces the current data", () => {
  const app = createStore();
  app.loadMock();
  app.importSubs([testSubscription]);
  assertEquals(app.data.length, 1);
  assertEquals(app.data[0].name, "Test");
});

Deno.test("loadMock - returns a copy, not the shared mock data", () => {
  const first = createStore();
  first.loadMock();
  first.toggleActive(0);

  const second = createStore();
  second.loadMock();
  assertEquals(second.data[0].isActive, true);
});

Deno.test("toggleActive - the last active subscription can't be deactivated", () => {
  const app = createStore();
  app.addSubscription({ ...testSubscription, name: "A" });
  app.addSubscription({ ...testSubscription, name: "B", isActive: false });
  app.toggleActive(0);
  assertEquals(app.data[0].isActive, true);
});

Deno.test("toggleActive - an inactive subscription can always be re-activated", () => {
  const app = createStore();
  app.addSubscription({ ...testSubscription, name: "A" });
  app.addSubscription({ ...testSubscription, name: "B", isActive: false });
  app.toggleActive(1);
  assertEquals(app.data[1].isActive, true);
});

Deno.test("getState - reflects later changes", () => {
  const app = createStore();
  app.setTheme("dark");
  app.addSubscription(testSubscription);
  assertEquals(app.getState.theme, "dark");
  assertEquals(app.getState.data.length, 1);
});
