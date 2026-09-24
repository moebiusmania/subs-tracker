import { assertEquals } from "@std/assert";

import type { AppState } from "./types.ts";
import { createStore } from "./store.ts";
import { hasData, load, save } from "./storage.ts";

const KEY = "subs-tracker";

// Deno provides a persistent localStorage: start every test from a clean slate
const test = (name: string, fn: () => void) =>
  Deno.test(name, () => {
    localStorage.clear();
    try {
      fn();
    } finally {
      localStorage.clear();
    }
  });

const state = (): AppState => {
  const store = createStore();
  store.loadMock();
  store.setTheme("dark");
  store.setLocale("it");
  return store.getState;
};

test("hasData - false when nothing is saved", () => {
  assertEquals(hasData(), false);
});

test("hasData - false for an empty string", () => {
  localStorage.setItem(KEY, "");
  assertEquals(hasData(), false);
});

test("hasData - true after save", () => {
  save(state());
  assertEquals(hasData(), true);
});

test("save - stores JSON under the subs-tracker key", () => {
  save(state());
  const raw = JSON.parse(localStorage.getItem(KEY)!);
  assertEquals(raw.theme, "dark");
  assertEquals(raw.data.length, 4);
});

test("load - round-trips what was saved", () => {
  const saved = state();
  save(saved);
  const loaded = load();

  assertEquals(loaded.theme, "dark");
  assertEquals(loaded.language, saved.language);
  assertEquals(loaded.currency, saved.currency);
  assertEquals(
    loaded.data.map((item) => item.name),
    saved.data.map((item) => item.name),
  );
});

test("load - dates come back as ISO strings", () => {
  save(state());
  const expiration: unknown = load().data[0].expiration;
  assertEquals(expiration, "2022-05-23T19:31:26.925Z");
});

test("save - overwrites the previous state", () => {
  save(state());
  const empty = createStore().getState;
  save(empty);
  assertEquals(load().data.length, 0);
  assertEquals(load().theme, "light");
});
