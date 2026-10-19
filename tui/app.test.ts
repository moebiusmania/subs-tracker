import { assert, test } from "vitest";

import { App } from "./app.ts";
import type { Key } from "./painter.ts";
import { createStore, MAX_SUBSCRIPTIONS } from "../src/lib/store.ts";
import { mockSubs } from "../src/lib/mocks.ts";
import { encodeShare, shareLink, SITE_URL } from "../src/lib/transfer.ts";

const subs = mockSubs();

// What node:fs throws
const fsError = (code: string, path: string) =>
  Object.assign(new Error(`${code}: ${path}`), { code });

// Drives the app like the terminal would, with fake files and timers
const setup = (
  options: {
    files?: Record<string, string>;
    readOnly?: boolean;
    size?: [number, number];
    mock?: boolean;
  } = {},
) => {
  const store = createStore();
  if (options.mock) store.loadMock();
  const files = { ...options.files };
  const timers: (() => void)[] = [];
  // Encoding and reading are asynchronous: settle() waits until the app says
  // it's done (only async work calls changed(), the timers above never run)
  let waiting: (() => void) | null = null;
  const settle = () =>
    new Promise<void>((resolve) => {
      waiting = resolve;
    });
  const calls = {
    persist: 0,
    quit: 0,
    writes: [] as { path: string; content: string }[],
  };

  const app = new App({
    store,
    persist: () => calls.persist++,
    readFile: (path) =>
      path in files
        ? Promise.resolve(files[path])
        : Promise.reject(fsError("ENOENT", path)),
    writeFile: (path, content) => {
      if (options.readOnly) throw fsError("EACCES", path);
      calls.writes.push({ path, content });
    },
    resolvePath: (path) => `/home/me/${path.trim()}`,
    displayPath: (path) => path.replace("/home/me/", "~/"),
    dataFile: "~/.config/subs-tracker/data.json",
    quit: () => calls.quit++,
    schedule: (callback) => {
      timers.push(callback);
      return () => {
        const index = timers.indexOf(callback);
        if (index >= 0) timers.splice(index, 1);
      };
    },
    changed: () => {
      const resolve = waiting;
      waiting = null;
      resolve?.();
    },
  });
  const [columns, rows] = options.size ?? [100, 40];
  app.resize(columns, rows);

  const frame = () => app.render();
  const hit = (id: string) => frame().hits.find((h) => h.id === id);
  const texts = () =>
    frame()
      .nodes.flatMap((node) => (node.type === "text" ? [node.text] : []))
      .join("\n");

  const click = (id: string) => {
    const target = hit(id);
    assert(target?.screen, `${id} is not on screen`);
    app.click(target.screen.column, target.screen.row);
    app.render();
  };
  const press = (key: string, modifiers: Partial<Key> = {}) => {
    app.key({
      key,
      typed: "",
      ctrl: false,
      meta: false,
      shift: false,
      buffer: new Uint8Array(),
      ...modifiers,
    } as Key);
    app.render();
  };
  const type = (text: string) => press(text[0], { typed: text });

  frame();
  return {
    app,
    store,
    calls,
    timers,
    files,
    hit,
    texts,
    click,
    press,
    type,
    settle,
  };
};

test("app - empty state loads the example data", () => {
  const { store, calls, texts, click } = setup();
  assert.include(texts(), "There is nothing here!");

  click("empty.mock");
  assert.deepEqual(store.data.length, 4);
  assert.deepEqual(calls.persist, 1);
  assert.include(texts(), "Your stats");
  assert.include(texts(), "Movies streaming");
});

test("app - the empty state carries the header's controls", () => {
  const { store, hit, click } = setup();
  // No header row: brand and buttons sit in the panel, below the top
  for (const id of ["brand", "lang.it", "theme"]) {
    assert.deepEqual(hit(id)?.layer, "page");
    assert(hit(id)!.screen!.row > 0, `${id} is in the panel`);
  }
  click("theme");
  assert.deepEqual(store.theme, "dark");
  click("lang.it");
  assert.deepEqual(store.locale, "it");

  click("empty.mock");
  for (const id of ["brand", "lang.it", "theme"]) {
    assert.deepEqual(hit(id)?.layer, "header");
    assert.deepEqual(hit(id)!.screen!.row, 0);
  }
});

test("app - dashboard shows the web app's numbers", () => {
  const { texts } = setup({ mock: true });
  // 229,87€ in big digits
  assert.include(texts(), "┏━┓ ┏━┓ ┏━┓   ┏━┓ ╺━┓ ┏━╸");
  // The description wraps in the tile
  assert.include(texts(), "with 1 inactive\nsubscriptions");
  const date = subs[0].expiration.toLocaleDateString("en", {
    dateStyle: "medium",
  });
  assert.include(texts(), `Expires on ${date}`);
});

test("app - cards expiring this month get a badge", () => {
  const { texts } = setup({ mock: true });
  // Only the first example item expires in the current month
  assert.deepEqual(texts().split(" Due this month ").length - 1, 1);
});

test("app - add a subscription with the keyboard", () => {
  const { app, store, calls, press, type } = setup();
  press("a");
  assert.deepEqual(app.screen, "add");
  assert.deepEqual(app.focus, "add.name");

  type("Netflix");
  press("tab");
  assert.deepEqual(app.focus, "add.price");
  press("backspace");
  type("12,5");
  press("tab");
  press("tab");
  assert.deepEqual(app.focus, "add.recurrence");
  press("right");
  press("tab");
  press("tab");
  assert.deepEqual(app.focus, "add.submit");
  press("return");

  assert.deepEqual(app.screen, "home");
  assert.deepEqual(calls.persist, 1);
  assert.deepEqual(store.data.length, 1);
  assert.deepEqual(store.data[0].name, "Netflix");
  assert.deepEqual(store.data[0].price, 12.5);
  assert.deepEqual(store.data[0].recurrence, "yearly");
  assert.deepEqual(store.data[0].isActive, true);
});

test("app - the form shows what's missing on submit", () => {
  const { app, store, texts, press, type } = setup();
  press("a");
  press("tab");
  press("backspace");
  press("return");

  assert.deepEqual(app.screen, "add");
  assert.deepEqual(app.focus, "add.name");
  assert.deepEqual(app.form?.errors, { name: "required", price: "required" });
  assert.include(texts(), "Please fill in this field");

  // Errors follow the typing once shown
  type("Netflix");
  assert.deepEqual(app.form?.errors, { price: "required" });
  assert.deepEqual(store.data.length, 0);
});

test("app - price and date step with the arrows and buttons", () => {
  const { app, click, press } = setup();
  press("a");
  press("tab");
  press("up");
  assert.deepEqual(app.form?.values.price.value, "1,1");
  click("add.price.control0");
  click("add.price.control0");
  assert.deepEqual(app.form?.values.price.value, "0,9");

  const today = app.form!.values.expiration.value;
  press("tab");
  press("up");
  press("pageup");
  assert(app.form!.values.expiration.value > today);
});

test("app - shortcuts don't fire while typing", () => {
  const { app, store, type, press } = setup();
  press("a");
  type("t");
  type("q");
  assert.deepEqual(app.form?.values.name.value, "tq");
  assert.deepEqual(store.theme, "light");
  press("escape");
  assert.deepEqual(app.screen, "home");
});

test("app - cards toggle with a click or Enter", () => {
  const { app, store, calls, click, press } = setup({ mock: true });
  click("card.0");
  assert.deepEqual(store.data[0].isActive, false);
  assert.deepEqual(app.focus, "card.0");
  press("return");
  assert.deepEqual(store.data[0].isActive, true);
  assert.deepEqual(calls.persist, 2);
});

test("app - a card's ✕ deletes only that card, after asking", () => {
  const { app, store, calls, click, press, texts } = setup({ mock: true });
  click("card.1.delete");
  assert.deepEqual(app.modal, "deleteItem");
  assert.deepEqual(app.focus, "modal.cancel");
  assert.include(texts(), `Delete ${subs[1].name}`);
  // Cancel: nothing changes, focus goes back to the ✕
  press("return");
  assert.deepEqual(app.modal, null);
  assert.deepEqual(app.focus, "card.1.delete");
  assert.deepEqual(store.data.length, 4);
  assert.deepEqual(calls.persist, 0);

  press("return");
  click("modal.confirm");
  assert.deepEqual(app.modal, null);
  assert.deepEqual(
    store.data.map((item) => item.name),
    [subs[0].name, subs[2].name, subs[3].name],
  );
  assert.deepEqual(calls.persist, 1);
  assert.deepEqual(app.focus, "card.1");
});

test("app - a card's ✎ edits that card in the form", () => {
  const { app, store, calls, click, press, type, texts } = setup({
    mock: true,
  });
  click("card.2.edit");
  assert.deepEqual(app.screen, "edit");
  assert.deepEqual(app.focus, "add.name");
  assert.deepEqual(app.form?.values.name.value, subs[2].name);
  assert.include(texts(), "Edit the subscription");

  // Esc leaves without saving, back on the ✎
  type("!");
  press("escape");
  assert.deepEqual(app.screen, "home");
  assert.deepEqual(app.focus, "card.2.edit");
  assert.deepEqual(store.data[2].name, subs[2].name);
  assert.deepEqual(calls.persist, 0);

  press("return");
  type(" Plus");
  click("add.submit");
  assert.deepEqual(app.screen, "home");
  assert.deepEqual(app.focus, "card.2.edit");
  assert.deepEqual(store.data.length, 4);
  assert.deepEqual(store.data[2].name, `${subs[2].name} Plus`);
  assert.deepEqual(store.data[2].price, subs[2].price);
  assert.deepEqual(store.data[1].name, subs[1].name);
  assert.deepEqual(calls.persist, 1);
});

test("app - editing keeps the card's currency", () => {
  const { app, store, click, texts } = setup({ mock: true });
  const dollars = subs.findIndex((item) => item.currency === "$");
  click(`card.${dollars}.edit`);
  assert.include(texts(), "$ Dollar");
  click("add.submit");
  assert.deepEqual(app.screen, "home");
  assert.deepEqual(store.data[dollars].currency, "$");
});

test("app - Delete on a focused card asks first", () => {
  const { app, store, click, press } = setup({ mock: true });
  click("card.3");
  press("delete");
  assert.deepEqual(app.modal, "deleteItem");
  press("escape");
  assert.deepEqual(app.focus, "card.3");
  press("delete");
  press("tab");
  press("return");
  assert.deepEqual(store.data.length, 3);
  // The last card is gone: focus moves to the new last one
  assert.deepEqual(app.focus, "card.2");
});

test("app - delete all asks first", () => {
  const { app, store, click, press } = setup({ mock: true });
  click("list.delete");
  assert.deepEqual(app.modal, "delete");
  assert.deepEqual(app.focus, "modal.cancel");
  press("return");
  assert.deepEqual(app.modal, null);
  assert.deepEqual(app.focus, "list.delete");
  assert.deepEqual(store.data.length, 4);

  press("return");
  click("modal.confirm");
  assert.deepEqual(store.data.length, 0);
  assert.deepEqual(app.modal, null);
});

test("app - dialogs close with Esc or a click outside", () => {
  const { app, click, press } = setup({ mock: true });
  press("e");
  assert.deepEqual(app.modal, "export");
  press("escape");
  assert.deepEqual(app.modal, null);

  press("i");
  click("modal.body");
  assert.deepEqual(app.modal, "import");
  app.click(0, 0);
  assert.deepEqual(app.modal, null);
});

test("app - Tab stays inside a dialog", () => {
  const { app, press } = setup({ mock: true });
  press("e");
  assert.deepEqual(app.focus, "modal.path");
  press("tab");
  assert.deepEqual(app.focus, "modal.cancel");
  press("tab");
  assert.deepEqual(app.focus, "modal.confirm");
  press("tab");
  assert.deepEqual(app.focus, "modal.via");
  press("tab");
  assert.deepEqual(app.focus, "modal.path");
});

test("app - export writes the web app's JSON", () => {
  const { app, store, calls, timers, press, type } = setup({ mock: true });
  press("e");
  press("return");
  assert.deepEqual(calls.writes, [
    {
      path: "/home/me/subscriptions.json",
      content: JSON.stringify(store.data),
    },
  ]);
  assert.deepEqual(app.modal, null);
  assert.deepEqual(app.toast, {
    kind: "success",
    text: "Data saved to ~/subscriptions.json",
  });

  // The toast goes away by itself
  timers.forEach((timer) => timer());
  assert.deepEqual(app.toast, null);

  press("e");
  for (let i = 0; i < 18; i++) press("backspace");
  type("backup.json");
  press("return");
  assert.deepEqual(calls.writes[1].path, "/home/me/backup.json");
});

test("app - export errors stay in the dialog", () => {
  const { app, texts, press } = setup({ mock: true, readOnly: true });
  press("e");
  press("return");
  assert.deepEqual(app.modal, "export");
  assert.include(texts(), "Can't write ~/subscriptions.json");
});

test("app - import checks the file", async () => {
  const exported = JSON.stringify(subs.slice(0, 2));
  const { app, store, calls, texts, press, type } = setup({
    mock: true,
    files: {
      "/home/me/bad.json": "{ nope",
      "/home/me/other.json": '{"data": []}',
      "/home/me/good.json": exported,
    },
  });
  const importFile = async (name: string) => {
    press("i");
    for (let i = 0; i < 18; i++) press("backspace");
    type(name);
    press("return");
    // Reading is asynchronous
    await new Promise((resolve) => setTimeout(resolve));
    app.render();
  };

  await importFile("missing.json");
  assert.include(texts(), "Can't read ~/missing.json");
  press("escape");

  await importFile("bad.json");
  assert.include(texts(), "doesn't contain subscriptions data");
  press("escape");

  await importFile("other.json");
  assert.include(texts(), "doesn't contain subscriptions data");
  press("escape");
  assert.deepEqual(store.data.length, 4);
  assert.deepEqual(calls.persist, 0);

  await importFile("good.json");
  assert.deepEqual(app.modal, null);
  assert.deepEqual(store.data.length, 2);
  assert.deepEqual(calls.persist, 1);
  assert.deepEqual(app.toast?.text, "Data imported from ~/good.json");
});

test("app - export shows the share link's QR code", async () => {
  const { app, texts, click, settle } = setup({ mock: true });
  click("backup.export");
  click("modal.via.qr");
  assert.include(texts(), "Show a code to scan");
  click("modal.confirm");
  await settle();
  app.render();
  assert.deepEqual(app.modal, "qr");
  assert.include(texts(), "▀");
  assert.include(texts(), "no server ever sees them");
  click("modal.cancel");
  assert.deepEqual(app.modal, null);
  assert.deepEqual(app.focus, "backup.export");
});

test("app - the QR code asks for a bigger terminal", async () => {
  const { app, texts, click, press, settle } = setup({
    mock: true,
    size: [60, 20],
  });
  press("e");
  click("modal.via.qr");
  click("modal.confirm");
  await settle();
  assert.deepEqual(app.modal, "qr");
  assert.include(texts(), "Make the terminal at least");
});

test("app - import from a pasted link", async () => {
  const { app, store, calls, texts, click, press, type, settle } = setup({
    mock: true,
  });
  click("backup.import");
  click("modal.via.link");
  click("modal.path");
  type("https://example.com/#d=broken");
  press("return");
  await settle();
  app.render();
  assert.include(texts(), "This link doesn't contain subscriptions data");
  assert.deepEqual(store.data.length, 4);

  for (let i = 0; i < 40; i++) press("backspace");
  type(shareLink(SITE_URL, await encodeShare(subs.slice(0, 1))));
  press("return");
  await settle();
  assert.deepEqual(app.modal, null);
  assert.deepEqual(
    store.data.map((item) => item.name),
    [subs[0].name],
  );
  assert.deepEqual(calls.persist, 1);
  assert.deepEqual(app.toast?.text, "Subscriptions imported from the link");
});

test("app - the empty state imports too", () => {
  const { app, click, press } = setup();
  click("empty.import");
  assert.deepEqual(app.modal, "import");
  press("escape");
  assert.deepEqual(app.focus, "empty.import");
  press("i");
  assert.deepEqual(app.modal, "import");
});

test("app - a full list disables adding", () => {
  const { app, store, hit, texts, press } = setup();
  for (let i = 0; i < MAX_SUBSCRIPTIONS; i++) store.addSubscription(subs[0]);
  app.render();
  assert.deepEqual(hit("list.add"), undefined);
  assert.include(texts(), `limit of ${MAX_SUBSCRIPTIONS} subscriptions`);
  press("a");
  assert.deepEqual(app.screen, "home");
  assert.deepEqual(app.toast?.kind, "error");
});

test("app - theme and language, from keys and the header", () => {
  const { store, calls, texts, click, press } = setup({ mock: true });
  press("t");
  assert.deepEqual(store.theme, "dark");
  press("l");
  assert.deepEqual(store.locale, "it");
  assert.include(texts(), "Le tue statistiche");
  const date = subs[0].expiration.toLocaleDateString("it", {
    dateStyle: "medium",
  });
  assert.include(texts(), `Scade il ${date}`);
  assert.include(texts(), " Scade questo mese ");

  click("lang.en");
  assert.deepEqual(store.language, "en");
  click("theme");
  assert.deepEqual(store.theme, "light");
  assert.deepEqual(calls.persist, 4);
});

test("app - Tab starts from the header, like a web page", () => {
  const { app, press } = setup({ mock: true });
  press("tab");
  assert.deepEqual(app.focus, "brand");
  press("tab");
  assert.deepEqual(app.focus, "lang.en");

  press("escape");
  press("tab", { shift: true });
  assert.deepEqual(app.focus, "list.delete");
});

test("app - arrows move between cards", () => {
  const { app, press } = setup({ mock: true, size: [100, 60] });
  press("down");
  assert.deepEqual(app.focus, "list.add");
  press("down");
  assert.deepEqual(app.focus, "card.2");
  press("left");
  assert.deepEqual(app.focus, "card.1");
  press("left");
  assert.deepEqual(app.focus, "card.0");
  press("down");
  assert.deepEqual(app.focus, "card.3");
  press("up");
  assert.deepEqual(app.focus, "card.0");
});

test("app - arrows skip a card's ✕, moving from it starts at its card", () => {
  const { app, press, click } = setup({ mock: true, size: [100, 60] });
  click("card.0");
  press("tab");
  assert.deepEqual(app.focus, "card.1.delete");
  press("left");
  assert.deepEqual(app.focus, "card.0");
  press("tab");
  press("right");
  assert.deepEqual(app.focus, "card.2");
});

test("app - the page scrolls and keeps the focus in view", () => {
  const { app, press, hit } = setup({ mock: true, size: [80, 20] });
  app.wheel(10, 10, 1);
  assert.deepEqual(app.scroll, 3);
  app.wheel(10, 10, -1);
  app.wheel(10, 10, -1);
  assert.deepEqual(app.scroll, 0);

  press("tab", { shift: true });
  assert.deepEqual(app.focus, "list.delete");
  const button = hit("list.delete")!;
  assert(button.screen, "the focused button is scrolled into view");

  press("end");
  const bottom = app.scroll;
  press("pagedown");
  assert.deepEqual(app.scroll, bottom);
});

test("app - hovering reports changes only", () => {
  const { app, hit } = setup({ mock: true });
  const { column, row } = hit("list.add")!.screen!;
  assert.deepEqual(app.move(column, row), true);
  assert.deepEqual(app.move(column + 1, row), false);
  assert.deepEqual(app.move(0, row + 30), true);
});

test("app - quits with q or Ctrl+C", () => {
  const { calls, press, type } = setup();
  press("q");
  press("a");
  type("q");
  press("c", { ctrl: true });
  assert.deepEqual(calls.quit, 2);
});

test("app - asks for a bigger terminal", () => {
  const { texts, hit } = setup({ size: [30, 10] });
  assert.include(texts(), "44×14");
  assert.deepEqual(hit("empty.mock"), undefined);
});
