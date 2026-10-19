// @vitest-environment happy-dom
import { afterEach, assert, beforeEach, test } from "vitest";

import type { AppState } from "./types.ts";
import { createStore } from "./store.ts";
import { hasData, load, save } from "./storage.ts";

const KEY = "subs-tracker";

// Start every test from a clean slate
beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

const state = (): AppState => {
  const store = createStore();
  store.loadMock();
  store.setTheme("dark");
  store.setLocale("it");
  return store.getState;
};

test("hasData - false when nothing is saved", () => {
  assert.deepEqual(hasData(), false);
});

test("hasData - false for an empty string", () => {
  localStorage.setItem(KEY, "");
  assert.deepEqual(hasData(), false);
});

test("hasData - true after save", () => {
  save(state());
  assert.deepEqual(hasData(), true);
});

test("save - stores JSON under the subs-tracker key", () => {
  save(state());
  const raw = JSON.parse(localStorage.getItem(KEY)!);
  assert.deepEqual(raw.theme, "dark");
  assert.deepEqual(raw.data.length, 4);
});

test("load - round-trips what was saved", () => {
  const saved = state();
  save(saved);
  const loaded = load();

  assert.deepEqual(loaded.theme, "dark");
  assert.deepEqual(loaded.language, saved.language);
  assert.deepEqual(loaded.currency, saved.currency);
  assert.deepEqual(
    loaded.data.map((item) => item.name),
    saved.data.map((item) => item.name),
  );
});

test("load - dates come back as ISO strings", () => {
  const saved = state();
  save(saved);
  const expiration: unknown = load().data[0].expiration;
  assert.deepEqual(expiration, saved.data[0].expiration.toISOString());
});

test("save - overwrites the previous state", () => {
  save(state());
  const empty = createStore().getState;
  save(empty);
  assert.deepEqual(load().data.length, 0);
  assert.deepEqual(load().theme, "light");
});
