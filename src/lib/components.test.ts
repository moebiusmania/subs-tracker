import { assert, test } from "vitest";

import type { Subscription } from "./types.ts";
import { createStore, MAX_SUBSCRIPTIONS, type Store } from "./store.ts";
import { encodeShare, shareLink } from "./transfer.ts";
import { createComponents, type Deps, type Installer } from "./components.ts";
import { addMonths, formatDate } from "./index.ts";

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
    // qrSvg rejects, like a code too big or a bundle that can't load
    qrFails?: boolean;
  } = {},
) => {
  const install = fakeInstaller(options.installer);
  const store: Store = createStore();
  const calls = {
    persist: 0,
    confirm: [] as string[],
    closed: 0,
    theme: [] as string[],
    transitions: 0,
    removed: [] as number[],
    downloads: [] as { filename: string; content: string }[],
    accept: [] as string[],
    reloads: 0,
    qr: [] as string[],
    copied: [] as string[],
  };
  // The service worker reporting a newer version
  const update = { ready: () => {} };
  const deps: Deps = {
    app: () => store,
    persist: () => calls.persist++,
    confirm: (message) => {
      calls.confirm.push(message);
      return options.confirm ?? true;
    },
    closeForm: () => calls.closed++,
    setThemeAttribute: (theme) => calls.theme.push(theme),
    transition: (update) => {
      calls.transitions++;
      update();
    },
    removeItem: (index, remove) => {
      calls.removed.push(index);
      remove();
      return Promise.resolve();
    },
    download: (filename, content) =>
      calls.downloads.push({ filename, content }),
    pickFile: (accept) => {
      calls.accept.push(accept);
      return Promise.resolve(options.file ?? null);
    },
    installer: install.installer,
    updater: {
      onUpdate: (callback) => {
        update.ready = callback;
      },
      reload: () => calls.reloads++,
    },
    shareBase: () => "https://example.com/app/",
    qrSvg: (text) => {
      calls.qr.push(text);
      return options.qrFails
        ? Promise.reject(new Error("too big"))
        : Promise.resolve("<svg></svg>");
    },
    copy: (text) => {
      calls.copied.push(text);
      return Promise.resolve(true);
    },
  };
  return {
    store,
    calls,
    install,
    update,
    deps,
    components: createComponents(deps),
  };
};

const netflix: Subscription = {
  name: "Netflix",
  price: 12.5,
  currency: "€",
  isActive: true,
  recurrence: "monthly",
  expiration: new Date("2027-01-15T00:00:00.000Z"),
};

test("header - toggleTheme switches theme inside a transition", () => {
  const { store, calls, components } = setup();
  const header = components.header();

  header.toggleTheme();
  assert.deepEqual(store.theme, "dark");
  assert.deepEqual(calls.theme, ["dark"]);
  assert.deepEqual(calls.transitions, 1);
  assert.deepEqual(calls.persist, 1);

  header.toggleTheme();
  assert.deepEqual(store.theme, "light");
  assert.deepEqual(calls.theme, ["dark", "light"]);
  assert.deepEqual(calls.persist, 2);
});

test("header - setLocale switches language inside a transition", () => {
  const { store, calls, components } = setup();
  const header = components.header();

  header.setLocale("it");
  assert.deepEqual(store.language, "it");
  assert.deepEqual(store.locale, "it");
  assert.deepEqual(store.i18n.main.title, "Le tue statistiche");
  assert.deepEqual(calls.transitions, 1);
  assert.deepEqual(calls.persist, 1);
});

test("header - setLocale does nothing for the current language", () => {
  const { store, calls, components } = setup();
  components.header().setLocale("en");
  assert.deepEqual(store.locale, "en");
  assert.deepEqual(calls.transitions, 0);
  assert.deepEqual(calls.persist, 0);
});

test("empty - useMock loads the example data and persists", () => {
  const { store, calls, components } = setup();
  components.empty().useMock();
  assert.deepEqual(store.data.length, 4);
  assert.deepEqual(calls.persist, 1);
});

test("dashboard - computes totals from the store", () => {
  const { store, components } = setup();
  store.loadMock();
  const dashboard = components.dashboard();

  assert.deepEqual(dashboard.total, 4);
  assert.deepEqual(dashboard.inactives, "with 1 inactive subscriptions");
  assert.deepEqual(dashboard.monthly, "14,99€");
  assert.deepEqual(dashboard.yearly, "229,87€");
});

test("dashboard - reacts to store changes", () => {
  const { store, components } = setup();
  store.loadMock();
  const dashboard = components.dashboard();

  store.toggleActive(0);
  assert.deepEqual(dashboard.inactives, "with 2 inactive subscriptions");
  assert.deepEqual(dashboard.monthly, "5€");
});

test("dashboard - only yearly subscriptions give a zero monthly cost", () => {
  const { store, components } = setup();
  store.addSubscription({ ...netflix, recurrence: "yearly", price: 30 });
  const dashboard = components.dashboard();

  assert.deepEqual(dashboard.monthly, "0€");
  assert.deepEqual(dashboard.yearly, "30€");
});

test("list - toggleActive updates the store and persists", () => {
  const { store, calls, components } = setup();
  store.loadMock();
  components.list().toggleActive(0);
  assert.deepEqual(store.data[0].isActive, false);
  assert.deepEqual(calls.persist, 1);
});

test("list - expiresThisMonth flags the current month", () => {
  const { store, components } = setup();
  store.loadMock();
  const list = components.list();
  assert.deepEqual(
    store.data.map((item) => list.expiresThisMonth(item)),
    [true, false, false, false],
  );
});

test("list - deleteAll clears data after confirmation", () => {
  const { store, calls, components } = setup({ confirm: true });
  store.loadMock();
  components.list().deleteAll();
  assert.deepEqual(calls.confirm, [
    "Sure you want to delete all subscriptions data?",
  ]);
  assert.deepEqual(store.data.length, 0);
  assert.deepEqual(calls.persist, 1);
});

test("list - deleteAll asks in the current language", () => {
  const { store, calls, components } = setup({ confirm: false });
  store.setLocale("it");
  components.list().deleteAll();
  assert.deepEqual(calls.confirm, [
    "Vuoi davvero eliminare tutti i dati degli abbonamenti?",
  ]);
});

test("list - deleteItem removes one item after confirmation", () => {
  const { store, calls, components } = setup({ confirm: true });
  store.loadMock();
  const [first, second] = store.data.map((item) => item.name);
  components.list().deleteItem(0);
  assert.deepEqual(calls.confirm, [
    `Sure you want to delete ${first}? This can't be undone.`,
  ]);
  assert.deepEqual(calls.removed, [0]);
  assert.deepEqual(store.data.length, 3);
  assert.deepEqual(store.data[0].name, second);
  assert.deepEqual(calls.persist, 1);
});

test("list - deleteItem ignores deletes while a card is leaving", async () => {
  const { store, calls, components, deps } = setup();
  store.loadMock();
  const removeItem = deps.removeItem;
  let finish = () => {};
  deps.removeItem = (_index, remove) =>
    new Promise((resolve) => {
      finish = () => {
        remove();
        resolve();
      };
    });
  const list = components.list();
  const first = list.deleteItem(0);
  await list.deleteItem(1);
  assert.deepEqual(store.data.length, 4);
  finish();
  await first;
  assert.deepEqual(store.data.length, 3);
  assert.deepEqual(calls.confirm.length, 1);
  deps.removeItem = removeItem;
  await list.deleteItem(0);
  assert.deepEqual(store.data.length, 2);
});

test("list - deleteItem keeps the item when not confirmed", () => {
  const { store, calls, components } = setup({ confirm: false });
  store.loadMock();
  store.setLocale("it");
  components.list().deleteItem(1);
  assert.deepEqual(calls.confirm, [
    `Vuoi davvero eliminare ${store.data[1].name}? Non si potrà annullare.`,
  ]);
  assert.deepEqual(store.data.length, 4);
  assert.deepEqual(calls.removed, []);
  assert.deepEqual(calls.persist, 0);
});

test("list - deleteLabel names the item", () => {
  const { components } = setup();
  assert.deepEqual(components.list().deleteLabel(netflix), "Delete Netflix");
});

test("list - status, recurrence and dates follow the locale", () => {
  const { store, components } = setup();
  const list = components.list();
  const paused = { ...netflix, isActive: false, recurrence: "yearly" as const };

  assert.deepEqual(list.status(netflix), "Active");
  assert.deepEqual(list.statusLabel(paused), "Inactive, toggle Netflix");
  assert.deepEqual(list.recurrence(netflix), "Monthly");
  assert.deepEqual(list.expiration(netflix), "Jan 15, 2027");

  store.setLocale("it");
  assert.deepEqual(list.status(netflix), "Attivo");
  assert.deepEqual(
    list.statusLabel(paused),
    "Non attivo, cambia lo stato di Netflix",
  );
  assert.deepEqual(list.recurrence(paused), "Annuale");
  assert.deepEqual(list.expiration(netflix), "15 gen 2027");
});

test("list - expiration accepts the string dates from localStorage", () => {
  const { components } = setup();
  const saved = { ...netflix, expiration: "2027-01-15T00:00:00.000Z" };
  assert.deepEqual(
    components.list().expiration(saved as unknown as Subscription),
    "Jan 15, 2027",
  );
});

test("dashboard - inactives follows the locale", () => {
  const { store, components } = setup();
  store.loadMock();
  store.setLocale("it");
  assert.deepEqual(components.dashboard().inactives, "di cui 1 non attivi");
});

test("list - deleteAll keeps data when not confirmed", () => {
  const { store, calls, components } = setup({ confirm: false });
  store.loadMock();
  components.list().deleteAll();
  assert.deepEqual(store.data.length, 4);
  assert.deepEqual(calls.persist, 0);
});

test("backup - exportData downloads the subscriptions as JSON", () => {
  const { store, calls, components } = setup();
  store.addSubscription(netflix);
  components.backup().exportData();

  assert.deepEqual(calls.downloads.length, 1);
  assert.deepEqual(calls.downloads[0].filename, "subscriptions.json");
  assert.deepEqual(calls.downloads[0].content, JSON.stringify([netflix]));
});

test("backup - importData replaces the data with the picked file", async () => {
  const file = JSON.stringify([netflix]);
  const { store, calls, components } = setup({ file });
  store.loadMock();
  await components.backup().importData();

  assert.deepEqual(calls.accept, [".json"]);
  assert.deepEqual(store.data.length, 1);
  assert.deepEqual(store.data[0].name, "Netflix");
  assert.deepEqual(calls.persist, 1);
});

test("backup - importData does nothing when no file is picked", async () => {
  const { store, calls, components } = setup({ file: null });
  store.loadMock();
  await components.backup().importData();
  assert.deepEqual(store.data.length, 4);
  assert.deepEqual(calls.persist, 0);
});

test("backup - export then import round-trips the data", async () => {
  const exporter = setup();
  exporter.store.loadMock();
  exporter.components.backup().exportData();

  const importer = setup({ file: exporter.calls.downloads[0].content });
  await importer.components.backup().importData();
  assert.deepEqual(importer.store.data.length, 4);
  assert.deepEqual(importer.store.data[2].name, "App hosting");
});

test("backup - importData reports a broken or too long file", async () => {
  const broken = setup({ file: "{nope" });
  broken.store.loadMock();
  assert.deepEqual(await broken.components.backup().importData(), "invalid");
  assert.deepEqual(broken.store.data.length, 4);

  const many = Array.from({ length: MAX_SUBSCRIPTIONS + 1 }, () => netflix);
  const long = setup({ file: JSON.stringify(many) });
  assert.deepEqual(await long.components.backup().importData(), "tooMany");
  assert.deepEqual(long.store.data.length, 0);
  assert.deepEqual(long.calls.persist, 0);
});

test("transfer - export to a file closes the dialog", () => {
  const { store, calls, components } = setup();
  store.addSubscription(netflix);
  const transfer = components.transfer();
  transfer.openExport();
  assert.deepEqual(transfer.mode, "export");
  transfer.saveFile();
  assert.deepEqual(calls.downloads[0].content, JSON.stringify([netflix]));
  assert.deepEqual(transfer.mode, "");
});

test("transfer - showQr encodes a share link and shows its code", async () => {
  const { store, calls, components } = setup();
  store.loadMock();
  const transfer = components.transfer();
  transfer.openExport();
  await transfer.showQr();
  assert.deepEqual(transfer.view, "qr");
  assert.deepEqual(transfer.qr, "<svg></svg>");
  assert.match(transfer.link, /^https:\/\/example\.com\/app\/#d=[\w-]+$/);
  assert.deepEqual(calls.qr, [transfer.link]);

  await transfer.copyLink();
  assert.deepEqual(calls.copied, [transfer.link]);
  assert.deepEqual(transfer.copied, true);
  transfer.back();
  assert.deepEqual(transfer.view, "choose");
});

test("transfer - showQr shows an error when the code fails", async () => {
  const { store, components } = setup({ qrFails: true });
  store.loadMock();
  const transfer = components.transfer();
  transfer.openExport();
  await transfer.showQr();
  assert.deepEqual(transfer.view, "choose");
  assert.deepEqual(transfer.error, store.i18n.transfer.qrFailed);
});

test("transfer - a pasted link imports and closes", async () => {
  const { store, calls, components } = setup();
  const transfer = components.transfer();
  transfer.openImport();
  transfer.pasted = shareLink(
    "https://example.com/",
    await encodeShare([netflix]),
  );
  await transfer.importPasted();
  assert.deepEqual(
    store.data.map((item) => item.name),
    ["Netflix"],
  );
  assert.deepEqual(calls.persist, 1);
  assert.deepEqual(transfer.mode, "");
});

test("transfer - a bad pasted link shows an error", async () => {
  const { store, calls, components } = setup();
  const transfer = components.transfer();
  transfer.openImport();
  transfer.pasted = "https://example.com/#d=nope";
  await transfer.importPasted();
  assert.deepEqual(transfer.error, store.i18n.transfer.invalidLink);
  transfer.pasted = "hello";
  await transfer.importPasted();
  assert.deepEqual(transfer.error, store.i18n.transfer.invalidLink);
  assert.deepEqual(calls.persist, 0);
  assert.deepEqual(transfer.mode, "import");
});

test("transfer - openFile imports or explains what's wrong", async () => {
  const good = setup({ file: JSON.stringify([netflix]) });
  const transfer = good.components.transfer();
  transfer.openImport();
  await transfer.openFile();
  assert.deepEqual(good.store.data.length, 1);
  assert.deepEqual(transfer.mode, "");

  const bad = setup({ file: "[1]" });
  const failing = bad.components.transfer();
  failing.openImport();
  await failing.openFile();
  assert.deepEqual(failing.error, bad.store.i18n.transfer.invalidFile);
  assert.deepEqual(failing.mode, "import");
});

test("transfer - a received link asks before replacing", async () => {
  const { store, calls, components } = setup();
  store.loadMock();
  const transfer = components.transfer();
  await transfer.receive(await encodeShare([netflix]));
  assert.deepEqual(transfer.mode, "link");
  assert.deepEqual(transfer.pending.length, 1);
  assert.match(transfer.confirmText, /1/);
  assert.deepEqual(store.data.length, 4);

  transfer.acceptLink();
  assert.deepEqual(
    store.data.map((item) => item.name),
    ["Netflix"],
  );
  assert.deepEqual(calls.persist, 1);
  assert.deepEqual(transfer.mode, "");
});

test("transfer - a broken received link only shows an error", async () => {
  const { store, components } = setup();
  const transfer = components.transfer();
  await transfer.receive("nope");
  assert.deepEqual(transfer.error, store.i18n.transfer.invalidLink);
  assert.deepEqual(transfer.pending, []);
  transfer.acceptLink();
  assert.deepEqual(transfer.mode, "");
  assert.deepEqual(store.data.length, 0);
});

test("addForm - closes right away when the list is full", () => {
  const { store, calls, components } = setup();
  for (let i = 0; i < MAX_SUBSCRIPTIONS; i++) store.addSubscription(netflix);
  const form = components.addForm();
  form.init();
  assert.deepEqual(calls.closed, 1);
  form.submit();
  assert.deepEqual(store.data.length, MAX_SUBSCRIPTIONS);
});

test("addForm - starts with the default subscription", () => {
  const { components } = setup();
  const form = components.addForm();

  assert.deepEqual(form.item.name, "");
  assert.deepEqual(form.item.price, 1);
  assert.deepEqual(form.item.currency, "€");
  assert.deepEqual(form.item.isActive, true);
  assert.deepEqual(form.item.recurrence, "monthly");
  assert.deepEqual(
    form.formatDate(form.item.expiration),
    formatDate(addMonths(new Date(), 1)),
  );
});

test("addForm - submit adds the item, persists and closes", () => {
  const { store, calls, components } = setup();
  const form = components.addForm();
  form.item = { ...form.item, name: "Netflix", price: 12.5 };

  form.submit();
  assert.deepEqual(store.data.length, 1);
  assert.deepEqual(store.data[0].name, "Netflix");
  assert.deepEqual(calls.persist, 1);
  assert.deepEqual(calls.closed, 1);
});

test("editForm - starts with a copy of the item", () => {
  const { store, components } = setup();
  // As loaded from localStorage, with a string date
  store.importSubs([
    netflix,
    {
      ...netflix,
      name: "Spotify",
      expiration: "2027-02-01" as unknown as Date,
    },
  ]);
  const form = components.editForm(1);

  assert.deepEqual(form.found, true);
  assert.deepEqual(form.item.name, "Spotify");
  assert.deepEqual(form.formatDate(form.item.expiration), "2027-02-01");
  form.item.name = "Changed";
  assert.deepEqual(store.data[1].name, "Spotify");
});

test("editForm - submit updates the item, persists and closes", () => {
  const { store, calls, components } = setup();
  store.importSubs([netflix, { ...netflix, name: "Spotify" }]);
  const form = components.editForm(0);
  form.item = { ...form.item, price: 15, recurrence: "yearly" };

  form.submit();
  assert.deepEqual(store.data.length, 2);
  assert.deepEqual(store.data[0].name, "Netflix");
  assert.deepEqual(store.data[0].price, 15);
  assert.deepEqual(store.data[0].recurrence, "yearly");
  assert.deepEqual(store.data[1].name, "Spotify");
  assert.deepEqual(calls.persist, 1);
  assert.deepEqual(calls.closed, 1);
});

test("editForm - a missing item closes without saving", () => {
  for (const index of [2, -1, NaN, 0.5]) {
    const { store, calls, components } = setup();
    store.importSubs([netflix, { ...netflix, name: "Spotify" }]);
    const form = components.editForm(index);
    assert.deepEqual(form.found, false);

    form.init();
    form.submit();
    assert.deepEqual(calls.closed, 2);
    assert.deepEqual(calls.persist, 0);
    assert.deepEqual(store.data.length, 2);
  }
});

test("list - editLabel names the item", () => {
  const { components } = setup();
  assert.deepEqual(components.list().editLabel(netflix), "Edit Netflix");
});

test("install - hidden until the browser offers its prompt", () => {
  const { install, components } = setup();
  const banner = components.install();

  banner.init();
  assert.deepEqual(banner.mode, "");

  install.fire();
  assert.deepEqual(banner.mode, "prompt");
});

test("install - shows the manual steps on iOS", () => {
  const { components } = setup({ installer: { manual: true } });
  const banner = components.install();

  banner.init();
  assert.deepEqual(banner.mode, "manual");
});

test("install - stays hidden when installed or dismissed", () => {
  for (const installer of [{ installed: true }, { dismissed: true }]) {
    const { install, components } = setup({
      installer: { ...installer, manual: true },
    });
    const banner = components.install();

    banner.init();
    install.fire();
    assert.deepEqual(banner.mode, "");
  }
});

test("install - accepted prompt hides the banner for good", async () => {
  const { install, components } = setup();
  const banner = components.install();

  banner.init();
  install.fire();
  await banner.install();
  assert.deepEqual(banner.mode, "");
  assert.deepEqual(install.calls.prompt, 1);
  assert.deepEqual(install.calls.dismiss, 0);
});

test("install - declined prompt counts as dismissed", async () => {
  const { install, components } = setup({ installer: { accept: false } });
  const banner = components.install();

  banner.init();
  install.fire();
  await banner.install();
  assert.deepEqual(banner.mode, "");
  assert.deepEqual(install.calls.dismiss, 1);
});

test("install - dismiss hides and remembers it", () => {
  const { install, components } = setup({ installer: { manual: true } });
  const banner = components.install();

  banner.init();
  banner.dismiss();
  assert.deepEqual(banner.mode, "");
  assert.deepEqual(install.calls.dismiss, 1);
});

test("install - hides once the app gets installed", () => {
  const { install, components } = setup();
  const banner = components.install();

  banner.init();
  install.fire();
  install.install();
  assert.deepEqual(banner.mode, "");
});

test("update - shows once a newer version is ready", () => {
  const { components, update } = setup();
  const banner = components.update();
  banner.init();
  assert.deepEqual(banner.available, false);

  update.ready();
  assert.deepEqual(banner.available, true);
});

test("update - reload loads the new version", () => {
  const { components, update, calls } = setup();
  const banner = components.update();
  banner.init();
  update.ready();

  banner.reload();
  assert.deepEqual(calls.reloads, 1);
});

test("update - dismiss only hides the banner", () => {
  const { components, update, calls } = setup();
  const banner = components.update();
  banner.init();
  update.ready();

  banner.dismiss();
  assert.deepEqual(banner.available, false);
  assert.deepEqual(calls.reloads, 0);
});
