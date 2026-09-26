import { assertEquals, assertNotEquals } from "@std/assert";

import type { Subscription } from "./types.ts";
import { createStore } from "./store.ts";
import type { AppState, Locale } from "./types.ts";
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
    language: null,
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

Deno.test("locale - follows the system language until one is picked", () => {
  const app = createStore();
  app.setSystemLocale("it");
  assertEquals(app.locale, "it");
  assertEquals(app.i18n, translations.it);

  app.setLocale("en");
  assertEquals(app.locale, "en");
  app.setSystemLocale("it");
  assertEquals(app.locale, "en");
});

Deno.test("getState - saves only the picked language, not the strings", () => {
  const app = createStore();
  app.setSystemLocale("it");
  assertEquals(app.getState.language, null);
  app.setLocale("it");
  assertEquals(app.getState.language, "it");
  assertEquals("i18n" in app.getState, false);
  assertEquals("locale" in app.getState, false);
});

Deno.test("setState - restores the picked language", () => {
  const app = createStore();
  app.setState({ ...app.getState, language: "it" });
  assertEquals(app.locale, "it");
  assertEquals(app.i18n, translations.it);
});

Deno.test("setState - older saves follow the system language", () => {
  const app = createStore();
  app.setSystemLocale("it");
  // Before the switcher every save had locale: "en", never picked by the user
  const old = { locale: "en", theme: "light", currency: "€", data: [] };
  app.setState(old as unknown as AppState);
  assertEquals(app.language, null);
  assertEquals(app.locale, "it");
});

Deno.test("setState - an unknown language follows the system language", () => {
  const app = createStore();
  app.setSystemLocale("it");
  app.setLocale("en");
  app.setState({ ...app.getState, language: "fr" as Locale });
  assertEquals(app.locale, "it");
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

Deno.test("deleteSubscription - removes only the item at that index", () => {
  const app = createStore();
  app.addSubscription({ ...testSubscription, name: "A" });
  app.addSubscription({ ...testSubscription, name: "B" });
  app.addSubscription({ ...testSubscription, name: "C" });
  app.deleteSubscription(1);
  assertEquals(app.data.map((item) => item.name), ["A", "C"]);
});

Deno.test("deleteSubscription - an index out of range changes nothing", () => {
  const app = createStore();
  app.addSubscription({ ...testSubscription, name: "A" });
  app.deleteSubscription(3);
  assertEquals(app.data.map((item) => item.name), ["A"]);
});

Deno.test("getState - reflects later changes", () => {
  const app = createStore();
  app.setTheme("dark");
  app.addSubscription(testSubscription);
  assertEquals(app.getState.theme, "dark");
  assertEquals(app.getState.data.length, 1);
});
