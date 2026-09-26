import { assertEquals, assertMatch } from "@std/assert";

import type { Subscription } from "./types.ts";
import { createStore, type Store } from "./store.ts";
import { createComponents, type Deps, type Installer } from "./components.ts";

type InstallerOptions = {
  installed?: boolean;
  manual?: boolean;
  dismissed?: boolean;
  accept?: boolean;
};

// Fake install prompt: fire() and install() stand in for the browser events
const fakeInstaller = (options: InstallerOptions = {}) => {
  const calls = { dismiss: 0, prompt: 0 };
  let promptCallback = () => {};
  let installedCallback = () => {};
  const installer: Installer = {
    installed: () => options.installed ?? false,
    manual: () => options.manual ?? false,
    dismissed: () => options.dismissed ?? false,
    dismiss: () => calls.dismiss++,
    onPrompt: (callback) => {
      promptCallback = callback;
    },
    onInstalled: (callback) => {
      installedCallback = callback;
    },
    prompt: () => {
      calls.prompt++;
      return Promise.resolve(options.accept ?? true);
    },
  };
  return {
    installer,
    calls,
    fire: () => promptCallback(),
    install: () => installedCallback(),
  };
};

// Fake browser side effects, recording every call
const setup = (
  options: {
    confirm?: boolean;
    file?: string | null;
    installer?: InstallerOptions;
  } = {},
) => {
  const install = fakeInstaller(options.installer);
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
    installer: install.installer,
  };
  return { store, calls, install, components: createComponents(deps) };
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

Deno.test("header - setLocale switches language inside a transition", () => {
  const { store, calls, components } = setup();
  const header = components.header();

  header.setLocale("it");
  assertEquals(store.language, "it");
  assertEquals(store.locale, "it");
  assertEquals(store.i18n.main.title, "Le tue statistiche");
  assertEquals(calls.transitions, 1);
  assertEquals(calls.persist, 1);
});

Deno.test("header - setLocale does nothing for the current language", () => {
  const { store, calls, components } = setup();
  components.header().setLocale("en");
  assertEquals(store.locale, "en");
  assertEquals(calls.transitions, 0);
  assertEquals(calls.persist, 0);
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

Deno.test("list - expiresThisMonth flags the current month", () => {
  const { store, components } = setup();
  store.loadMock();
  const list = components.list();
  assertEquals(store.data.map((item) => list.expiresThisMonth(item)), [
    true,
    false,
    false,
    false,
  ]);
});

Deno.test("list - deleteAll clears data after confirmation", () => {
  const { store, calls, components } = setup({ confirm: true });
  store.loadMock();
  components.list().deleteAll();
  assertEquals(calls.confirm, [
    "Sure you want to delete all subscriptions data?",
  ]);
  assertEquals(store.data.length, 0);
  assertEquals(calls.persist, 1);
});

Deno.test("list - deleteAll asks in the current language", () => {
  const { store, calls, components } = setup({ confirm: false });
  store.setLocale("it");
  components.list().deleteAll();
  assertEquals(calls.confirm, [
    "Vuoi davvero eliminare tutti i dati degli abbonamenti?",
  ]);
});

Deno.test("list - deleteItem removes one item after confirmation", () => {
  const { store, calls, components } = setup({ confirm: true });
  store.loadMock();
  const [first, second] = store.data.map((item) => item.name);
  components.list().deleteItem(0);
  assertEquals(calls.confirm, [
    `Sure you want to delete ${first}? This can't be undone.`,
  ]);
  assertEquals(store.data.length, 3);
  assertEquals(store.data[0].name, second);
  assertEquals(calls.persist, 1);
});

Deno.test("list - deleteItem keeps the item when not confirmed", () => {
  const { store, calls, components } = setup({ confirm: false });
  store.loadMock();
  store.setLocale("it");
  components.list().deleteItem(1);
  assertEquals(calls.confirm, [
    `Vuoi davvero eliminare ${store.data[1].name}? Non si potrà annullare.`,
  ]);
  assertEquals(store.data.length, 4);
  assertEquals(calls.persist, 0);
});

Deno.test("list - deleteLabel names the item", () => {
  const { components } = setup();
  assertEquals(components.list().deleteLabel(netflix), "Delete Netflix");
});

Deno.test("list - status, recurrence and dates follow the locale", () => {
  const { store, components } = setup();
  const list = components.list();
  const paused = { ...netflix, isActive: false, recurrence: "yearly" as const };

  assertEquals(list.status(netflix), "Active");
  assertEquals(list.statusLabel(paused), "Inactive, toggle Netflix");
  assertEquals(list.recurrence(netflix), "Monthly");
  assertEquals(list.expiration(netflix), "Jan 15, 2027");

  store.setLocale("it");
  assertEquals(list.status(netflix), "Attivo");
  assertEquals(
    list.statusLabel(paused),
    "Non attivo, cambia lo stato di Netflix",
  );
  assertEquals(list.recurrence(paused), "Annuale");
  assertEquals(list.expiration(netflix), "15 gen 2027");
});

Deno.test("list - expiration accepts the string dates from localStorage", () => {
  const { components } = setup();
  const saved = { ...netflix, expiration: "2027-01-15T00:00:00.000Z" };
  assertEquals(
    components.list().expiration(saved as unknown as Subscription),
    "Jan 15, 2027",
  );
});

Deno.test("dashboard - inactives follows the locale", () => {
  const { store, components } = setup();
  store.loadMock();
  store.setLocale("it");
  assertEquals(components.dashboard().inactives, "di cui 1 non attivi");
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

Deno.test("install - hidden until the browser offers its prompt", () => {
  const { install, components } = setup();
  const banner = components.install();

  banner.init();
  assertEquals(banner.mode, "");

  install.fire();
  assertEquals(banner.mode, "prompt");
});

Deno.test("install - shows the manual steps on iOS", () => {
  const { components } = setup({ installer: { manual: true } });
  const banner = components.install();

  banner.init();
  assertEquals(banner.mode, "manual");
});

Deno.test("install - stays hidden when installed or dismissed", () => {
  for (const installer of [{ installed: true }, { dismissed: true }]) {
    const { install, components } = setup({
      installer: { ...installer, manual: true },
    });
    const banner = components.install();

    banner.init();
    install.fire();
    assertEquals(banner.mode, "");
  }
});

Deno.test("install - accepted prompt hides the banner for good", async () => {
  const { install, components } = setup();
  const banner = components.install();

  banner.init();
  install.fire();
  await banner.install();
  assertEquals(banner.mode, "");
  assertEquals(install.calls.prompt, 1);
  assertEquals(install.calls.dismiss, 0);
});

Deno.test("install - declined prompt counts as dismissed", async () => {
  const { install, components } = setup({ installer: { accept: false } });
  const banner = components.install();

  banner.init();
  install.fire();
  await banner.install();
  assertEquals(banner.mode, "");
  assertEquals(install.calls.dismiss, 1);
});

Deno.test("install - dismiss hides and remembers it", () => {
  const { install, components } = setup({ installer: { manual: true } });
  const banner = components.install();

  banner.init();
  banner.dismiss();
  assertEquals(banner.mode, "");
  assertEquals(install.calls.dismiss, 1);
});

Deno.test("install - hides once the app gets installed", () => {
  const { install, components } = setup();
  const banner = components.install();

  banner.init();
  install.fire();
  install.install();
  assertEquals(banner.mode, "");
});
