import { assert, test } from "vitest";

import type { Subscription } from "./types.ts";
import { createStore, MAX_SUBSCRIPTIONS } from "./store.ts";
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

test("getState", () => {
  const app = createStore();
  assert.deepEqual(app.getState, {
    language: null,
    theme: "light",
    currency: "€",
    data: [],
  });
});

test("loadMock", () => {
  const app = createStore();
  assert.deepEqual(app.data.length, 0);
  app.loadMock();
  assert.deepEqual(app.data.length, 4);
});

test("setTheme", () => {
  const app = createStore();
  assert.deepEqual(app.theme, "light");
  app.setTheme("dark");
  assert.deepEqual(app.theme, "dark");
});

test("deleteSubs", () => {
  const app = createStore();
  app.loadMock();
  assert.deepEqual(app.data.length, 4);
  app.deleteSubs();
  assert.deepEqual(app.data.length, 0);
});

test("addSubscription", () => {
  const app = createStore();
  app.addSubscription(testSubscription);
  assert.deepEqual(app.data.length, 1);
  assert.deepEqual(app.data[0].name, "Test");
  assert.deepEqual(app.data[0].price, 9.99);
});

test("toggleActive - normal behavior", () => {
  const app = createStore();
  app.addSubscription({ ...testSubscription });
  app.addSubscription({ ...testSubscription });
  assert.deepEqual(app.data[0].isActive, true);
  app.toggleActive(0);
  assert.deepEqual(app.data[0].isActive, false);
  app.toggleActive(0);
  assert.deepEqual(app.data[0].isActive, true);
});

test("toggleActive - don't update isActive if there is only 1 element", () => {
  const app = createStore();
  app.addSubscription({ ...testSubscription });
  assert.deepEqual(app.data[0].isActive, true);
  app.toggleActive(0);
  assert.notDeepEqual(app.data[0].isActive, false);
});

test("setLocale - switches the strings too", () => {
  const app = createStore();
  assert.deepEqual(app.i18n, translations.en);
  app.setLocale("it");
  assert.deepEqual(app.locale, "it");
  assert.deepEqual(app.i18n, translations.it);
  assert.deepEqual(app.i18n.main.title, "Le tue statistiche");
});

test("locale - follows the system language until one is picked", () => {
  const app = createStore();
  app.setSystemLocale("it");
  assert.deepEqual(app.locale, "it");
  assert.deepEqual(app.i18n, translations.it);

  app.setLocale("en");
  assert.deepEqual(app.locale, "en");
  app.setSystemLocale("it");
  assert.deepEqual(app.locale, "en");
});

test("getState - saves only the picked language, not the strings", () => {
  const app = createStore();
  app.setSystemLocale("it");
  assert.deepEqual(app.getState.language, null);
  app.setLocale("it");
  assert.deepEqual(app.getState.language, "it");
  assert.deepEqual("i18n" in app.getState, false);
  assert.deepEqual("locale" in app.getState, false);
});

test("setState - restores the picked language", () => {
  const app = createStore();
  app.setState({ ...app.getState, language: "it" });
  assert.deepEqual(app.locale, "it");
  assert.deepEqual(app.i18n, translations.it);
});

test("setState - older saves follow the system language", () => {
  const app = createStore();
  app.setSystemLocale("it");
  // Before the switcher every save had locale: "en", never picked by the user
  const old = { locale: "en", theme: "light", currency: "€", data: [] };
  app.setState(old as unknown as AppState);
  assert.deepEqual(app.language, null);
  assert.deepEqual(app.locale, "it");
});

test("setState - an unknown language follows the system language", () => {
  const app = createStore();
  app.setSystemLocale("it");
  app.setLocale("en");
  app.setState({ ...app.getState, language: "fr" as Locale });
  assert.deepEqual(app.locale, "it");
});

test("setState", () => {
  const app = createStore();
  app.setState({ ...app.getState, theme: "dark", data: [testSubscription] });
  assert.deepEqual(app.theme, "dark");
  assert.deepEqual(app.data.length, 1);
});

test("importSubs - replaces the current data", () => {
  const app = createStore();
  app.loadMock();
  app.importSubs([testSubscription]);
  assert.deepEqual(app.data.length, 1);
  assert.deepEqual(app.data[0].name, "Test");
});

test("loadMock - returns a copy, not the shared mock data", () => {
  const first = createStore();
  first.loadMock();
  first.toggleActive(0);

  const second = createStore();
  second.loadMock();
  assert.deepEqual(second.data[0].isActive, true);
});

test("toggleActive - the last active subscription can't be deactivated", () => {
  const app = createStore();
  app.addSubscription({ ...testSubscription, name: "A" });
  app.addSubscription({ ...testSubscription, name: "B", isActive: false });
  app.toggleActive(0);
  assert.deepEqual(app.data[0].isActive, true);
});

test("toggleActive - an inactive subscription can always be re-activated", () => {
  const app = createStore();
  app.addSubscription({ ...testSubscription, name: "A" });
  app.addSubscription({ ...testSubscription, name: "B", isActive: false });
  app.toggleActive(1);
  assert.deepEqual(app.data[1].isActive, true);
});

test("deleteSubscription - removes only the item at that index", () => {
  const app = createStore();
  app.addSubscription({ ...testSubscription, name: "A" });
  app.addSubscription({ ...testSubscription, name: "B" });
  app.addSubscription({ ...testSubscription, name: "C" });
  app.deleteSubscription(1);
  assert.deepEqual(
    app.data.map((item) => item.name),
    ["A", "C"],
  );
});

test("deleteSubscription - an index out of range changes nothing", () => {
  const app = createStore();
  app.addSubscription({ ...testSubscription, name: "A" });
  app.deleteSubscription(3);
  assert.deepEqual(
    app.data.map((item) => item.name),
    ["A"],
  );
});

test("updateSubscription - replaces only the item at that index", () => {
  const app = createStore();
  app.addSubscription({ ...testSubscription, name: "A" });
  app.addSubscription({ ...testSubscription, name: "B" });
  app.updateSubscription(1, { ...testSubscription, name: "B2", price: 5 });
  assert.deepEqual(
    app.data.map((item) => item.name),
    ["A", "B2"],
  );
  assert.deepEqual(app.data[1].price, 5);
});

test("updateSubscription - an index out of range changes nothing", () => {
  const app = createStore();
  app.addSubscription({ ...testSubscription, name: "A" });
  app.updateSubscription(3, { ...testSubscription, name: "B" });
  assert.deepEqual(
    app.data.map((item) => item.name),
    ["A"],
  );
});

test("getState - reflects later changes", () => {
  const app = createStore();
  app.setTheme("dark");
  app.addSubscription(testSubscription);
  assert.deepEqual(app.getState.theme, "dark");
  assert.deepEqual(app.getState.data.length, 1);
});

test("addSubscription - stops at MAX_SUBSCRIPTIONS", () => {
  const app = createStore();
  for (let i = 0; i < MAX_SUBSCRIPTIONS; i++) {
    assert.deepEqual(app.canAdd, true);
    app.addSubscription({ ...testSubscription });
  }
  assert.deepEqual(app.canAdd, false);
  app.addSubscription({ ...testSubscription });
  assert.deepEqual(app.data.length, MAX_SUBSCRIPTIONS);
});
