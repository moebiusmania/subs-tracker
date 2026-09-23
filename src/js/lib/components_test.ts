import { assertEquals, assertMatch } from "@std/assert";

import type { Subscription } from "./types.ts";
import { createStore, type Store } from "./store.ts";
import { createComponents, DELETE_MESSAGE, type Deps } from "./components.ts";

// Fake browser side effects, recording every call
const setup = (options: { confirm?: boolean; file?: string | null } = {}) => {
  const store: Store = createStore();
  const calls = {
    persist: 0,
    confirm: [] as string[],
    navigate: [] as string[],
    theme: [] as string[],
    transitions: 0,
    downloads: [] as { filename: string; content: string }[],
    accept: [] as string[],
  };
  const deps: Deps = {
    app: () => store,
    persist: () => calls.persist++,
    confirm: (message) => {
      calls.confirm.push(message);
      return options.confirm ?? true;
    },
    navigate: (url) => calls.navigate.push(url),
    setThemeAttribute: (theme) => calls.theme.push(theme),
    transition: (update) => {
      calls.transitions++;
      update();
    },
    download: (filename, content) =>
      calls.downloads.push({ filename, content }),
    pickFile: (accept) => {
      calls.accept.push(accept);
      return Promise.resolve(options.file ?? null);
    },
  };
  return { store, calls, components: createComponents(deps) };
};

const netflix: Subscription = {
  name: "Netflix",
  price: 12.5,
  currency: "€",
  isActive: true,
  recurrence: "monthly",
  expiration: new Date("2027-01-15T00:00:00.000Z"),
};

Deno.test("header - toggleTheme switches theme inside a transition", () => {
  const { store, calls, components } = setup();
  const header = components.header();

  header.toggleTheme();
  assertEquals(store.theme, "dark");
  assertEquals(calls.theme, ["dark"]);
  assertEquals(calls.transitions, 1);
  assertEquals(calls.persist, 1);

  header.toggleTheme();
  assertEquals(store.theme, "light");
  assertEquals(calls.theme, ["dark", "light"]);
  assertEquals(calls.persist, 2);
});

Deno.test("empty - useMock loads the example data and persists", () => {
  const { store, calls, components } = setup();
  components.empty().useMock();
  assertEquals(store.data.length, 4);
  assertEquals(calls.persist, 1);
});

Deno.test("dashboard - computes totals from the store", () => {
  const { store, components } = setup();
  store.loadMock();
  const dashboard = components.dashboard();

  assertEquals(dashboard.total, 4);
  assertEquals(dashboard.inactives, "with 1 inactive subscriptions");
  assertEquals(dashboard.monthly, "14.99€");
  assertEquals(dashboard.yearly, "229.87€");
});

Deno.test("dashboard - reacts to store changes", () => {
  const { store, components } = setup();
  store.loadMock();
  const dashboard = components.dashboard();

  store.toggleActive(0);
  assertEquals(dashboard.inactives, "with 2 inactive subscriptions");
  assertEquals(dashboard.monthly, "5€");
});

Deno.test("dashboard - only yearly subscriptions give a zero monthly cost", () => {
  const { store, components } = setup();
  store.addSubscription({ ...netflix, recurrence: "yearly", price: 30 });
  const dashboard = components.dashboard();

  assertEquals(dashboard.monthly, "0€");
  assertEquals(dashboard.yearly, "30€");
});

Deno.test("list - toggleActive updates the store and persists", () => {
  const { store, calls, components } = setup();
  store.loadMock();
  components.list().toggleActive(0);
  assertEquals(store.data[0].isActive, false);
  assertEquals(calls.persist, 1);
});

Deno.test("list - deleteAll clears data after confirmation", () => {
  const { store, calls, components } = setup({ confirm: true });
  store.loadMock();
  components.list().deleteAll();
  assertEquals(calls.confirm, [DELETE_MESSAGE]);
  assertEquals(store.data.length, 0);
  assertEquals(calls.persist, 1);
});

Deno.test("list - deleteAll keeps data when not confirmed", () => {
  const { store, calls, components } = setup({ confirm: false });
  store.loadMock();
  components.list().deleteAll();
  assertEquals(store.data.length, 4);
  assertEquals(calls.persist, 0);
});

Deno.test("backup - exportData downloads the subscriptions as JSON", () => {
  const { store, calls, components } = setup();
  store.addSubscription(netflix);
  components.backup().exportData();

  assertEquals(calls.downloads.length, 1);
  assertEquals(calls.downloads[0].filename, "subscriptions.json");
  assertEquals(calls.downloads[0].content, JSON.stringify([netflix]));
});

Deno.test("backup - importData replaces the data with the picked file", async () => {
  const file = JSON.stringify([netflix]);
  const { store, calls, components } = setup({ file });
  store.loadMock();
  await components.backup().importData();

  assertEquals(calls.accept, [".json"]);
  assertEquals(store.data.length, 1);
  assertEquals(store.data[0].name, "Netflix");
  assertEquals(calls.persist, 1);
});

Deno.test("backup - importData does nothing when no file is picked", async () => {
  const { store, calls, components } = setup({ file: null });
  store.loadMock();
  await components.backup().importData();
  assertEquals(store.data.length, 4);
  assertEquals(calls.persist, 0);
});

Deno.test("backup - export then import round-trips the data", async () => {
  const exporter = setup();
  exporter.store.loadMock();
  exporter.components.backup().exportData();

  const importer = setup({ file: exporter.calls.downloads[0].content });
  await importer.components.backup().importData();
  assertEquals(importer.store.data.length, 4);
  assertEquals(importer.store.data[2].name, "App hosting");
});

Deno.test("addForm - starts with the default subscription", () => {
  const { components } = setup();
  const form = components.addForm("/");

  assertEquals(form.item.name, "");
  assertEquals(form.item.price, 1);
  assertEquals(form.item.currency, "€");
  assertEquals(form.item.isActive, true);
  assertEquals(form.item.recurrence, "monthly");
  assertMatch(form.formatDate(form.item.expiration), /^\d{4}-\d{2}-\d{2}$/);
});

Deno.test("addForm - submit adds the item, persists and goes home", () => {
  const { store, calls, components } = setup();
  const form = components.addForm("/subs-tracker/");
  form.item = { ...form.item, name: "Netflix", price: 12.5 };

  form.submit();
  assertEquals(store.data.length, 1);
  assertEquals(store.data[0].name, "Netflix");
  assertEquals(calls.persist, 1);
  assertEquals(calls.navigate, ["/subs-tracker/"]);
});
