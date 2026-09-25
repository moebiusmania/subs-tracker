import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import { App } from "./app.ts";
import type { Key } from "./painter.ts";
import { createStore } from "../src/js/lib/store.ts";
import { subs } from "../src/js/lib/mocks.ts";

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
        : Promise.reject(new Deno.errors.NotFound(path)),
    writeFile: (path, content) => {
      if (options.readOnly) throw new Deno.errors.PermissionDenied(path);
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
    changed: () => {},
  });
  const [columns, rows] = options.size ?? [100, 40];
  app.resize(columns, rows);

  const frame = () => app.render();
  const hit = (id: string) => frame().hits.find((h) => h.id === id);
  const texts = () =>
    frame().nodes.flatMap((node) => node.type === "text" ? [node.text] : [])
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
  return { app, store, calls, timers, files, hit, texts, click, press, type };
};

Deno.test("app - empty state loads the example data", () => {
  const { store, calls, texts, click } = setup();
  assertStringIncludes(texts(), "There is nothing here!");

  click("empty.mock");
  assertEquals(store.data.length, 4);
  assertEquals(calls.persist, 1);
  assertStringIncludes(texts(), "Your stats");
  assertStringIncludes(texts(), "Movies streaming");
});

Deno.test("app - dashboard shows the web app's numbers", () => {
  const { texts } = setup({ mock: true });
  // 229.87€ in big digits
  assertStringIncludes(texts(), "┏━┓ ┏━┓ ┏━┓   ┏━┓ ╺━┓ ┏━╸");
  // The description wraps in the tile
  assertStringIncludes(texts(), "with 1 inactive\nsubscriptions");
  assertStringIncludes(texts(), "Expires on May 23, 2022");
});

Deno.test("app - add a subscription with the keyboard", () => {
  const { app, store, calls, press, type } = setup();
  press("a");
  assertEquals(app.screen, "add");
  assertEquals(app.focus, "add.name");

  type("Netflix");
  press("tab");
  assertEquals(app.focus, "add.price");
  press("backspace");
  type("12,5");
  press("tab");
  press("tab");
  assertEquals(app.focus, "add.recurrence");
  press("right");
  press("tab");
  press("tab");
  assertEquals(app.focus, "add.submit");
  press("return");

  assertEquals(app.screen, "home");
  assertEquals(calls.persist, 1);
  assertEquals(store.data.length, 1);
  assertEquals(store.data[0].name, "Netflix");
  assertEquals(store.data[0].price, 12.5);
  assertEquals(store.data[0].recurrence, "yearly");
  assertEquals(store.data[0].isActive, true);
});

Deno.test("app - the form shows what's missing on submit", () => {
  const { app, store, texts, press, type } = setup();
  press("a");
  press("tab");
  press("backspace");
  press("return");

  assertEquals(app.screen, "add");
  assertEquals(app.focus, "add.name");
  assertEquals(app.form?.errors, { name: "required", price: "required" });
  assertStringIncludes(texts(), "Please fill in this field");

  // Errors follow the typing once shown
  type("Netflix");
  assertEquals(app.form?.errors, { price: "required" });
  assertEquals(store.data.length, 0);
});

Deno.test("app - price and date step with the arrows and buttons", () => {
  const { app, click, press } = setup();
  press("a");
  press("tab");
  press("up");
  assertEquals(app.form?.values.price.value, "1.1");
  click("add.price.control0");
  click("add.price.control0");
  assertEquals(app.form?.values.price.value, "0.9");

  const today = app.form!.values.expiration.value;
  press("tab");
  press("up");
  press("pageup");
  assert(app.form!.values.expiration.value > today);
});

Deno.test("app - shortcuts don't fire while typing", () => {
  const { app, store, type, press } = setup();
  press("a");
  type("t");
  type("q");
  assertEquals(app.form?.values.name.value, "tq");
  assertEquals(store.theme, "light");
  press("escape");
  assertEquals(app.screen, "home");
});

Deno.test("app - cards toggle with a click or Enter", () => {
  const { app, store, calls, click, press } = setup({ mock: true });
  click("card.0");
  assertEquals(store.data[0].isActive, false);
  assertEquals(app.focus, "card.0");
  press("return");
  assertEquals(store.data[0].isActive, true);
  assertEquals(calls.persist, 2);
});

Deno.test("app - delete all asks first", () => {
  const { app, store, click, press } = setup({ mock: true });
  click("list.delete");
  assertEquals(app.modal, "delete");
  assertEquals(app.focus, "modal.cancel");
  press("return");
  assertEquals(app.modal, null);
  assertEquals(app.focus, "list.delete");
  assertEquals(store.data.length, 4);

  press("return");
  click("modal.confirm");
  assertEquals(store.data.length, 0);
  assertEquals(app.modal, null);
});

Deno.test("app - dialogs close with Esc or a click outside", () => {
  const { app, click, press } = setup({ mock: true });
  press("e");
  assertEquals(app.modal, "export");
  press("escape");
  assertEquals(app.modal, null);

  press("i");
  click("modal.body");
  assertEquals(app.modal, "import");
  app.click(0, 0);
  assertEquals(app.modal, null);
});

Deno.test("app - Tab stays inside a dialog", () => {
  const { app, press } = setup({ mock: true });
  press("e");
  assertEquals(app.focus, "modal.path");
  press("tab");
  assertEquals(app.focus, "modal.cancel");
  press("tab");
  assertEquals(app.focus, "modal.confirm");
  press("tab");
  assertEquals(app.focus, "modal.path");
});

Deno.test("app - export writes the web app's JSON", () => {
  const { app, store, calls, timers, press, type } = setup({ mock: true });
  press("e");
  press("return");
  assertEquals(calls.writes, [{
    path: "/home/me/subscriptions.json",
    content: JSON.stringify(store.data),
  }]);
  assertEquals(app.modal, null);
  assertEquals(app.toast, {
    kind: "success",
    text: "Data saved to ~/subscriptions.json",
  });

  // The toast goes away by itself
  timers.forEach((timer) => timer());
  assertEquals(app.toast, null);

  press("e");
  for (let i = 0; i < 18; i++) press("backspace");
  type("backup.json");
  press("return");
  assertEquals(calls.writes[1].path, "/home/me/backup.json");
});

Deno.test("app - export errors stay in the dialog", () => {
  const { app, texts, press } = setup({ mock: true, readOnly: true });
  press("e");
  press("return");
  assertEquals(app.modal, "export");
  assertStringIncludes(texts(), "Can't write ~/subscriptions.json");
});

Deno.test("app - import checks the file", async () => {
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
  assertStringIncludes(texts(), "Can't read ~/missing.json");
  press("escape");

  await importFile("bad.json");
  assertStringIncludes(texts(), "doesn't contain subscriptions data");
  press("escape");

  await importFile("other.json");
  assertStringIncludes(texts(), "doesn't contain subscriptions data");
  press("escape");
  assertEquals(store.data.length, 4);
  assertEquals(calls.persist, 0);

  await importFile("good.json");
  assertEquals(app.modal, null);
  assertEquals(store.data.length, 2);
  assertEquals(calls.persist, 1);
  assertEquals(app.toast?.text, "Data imported from ~/good.json");
});

Deno.test("app - theme and language, from keys and the header", () => {
  const { store, calls, texts, click, press } = setup({ mock: true });
  press("t");
  assertEquals(store.theme, "dark");
  press("l");
  assertEquals(store.locale, "it");
  assertStringIncludes(texts(), "Le tue statistiche");
  assertStringIncludes(texts(), "Scade il 23 mag 2022");

  click("lang.en");
  assertEquals(store.language, "en");
  click("theme");
  assertEquals(store.theme, "light");
  assertEquals(calls.persist, 4);
});

Deno.test("app - Tab starts from the header, like a web page", () => {
  const { app, press } = setup({ mock: true });
  press("tab");
  assertEquals(app.focus, "brand");
  press("tab");
  assertEquals(app.focus, "lang.en");

  press("escape");
  press("tab", { shift: true });
  assertEquals(app.focus, "list.delete");
});

Deno.test("app - arrows move between cards", () => {
  const { app, press } = setup({ mock: true, size: [100, 60] });
  press("down");
  assertEquals(app.focus, "list.add");
  press("down");
  assertEquals(app.focus, "card.2");
  press("left");
  assertEquals(app.focus, "card.1");
  press("left");
  assertEquals(app.focus, "card.0");
  press("down");
  assertEquals(app.focus, "card.3");
  press("up");
  assertEquals(app.focus, "card.0");
});

Deno.test("app - the page scrolls and keeps the focus in view", () => {
  const { app, press, hit } = setup({ mock: true, size: [80, 20] });
  app.wheel(10, 10, 1);
  assertEquals(app.scroll, 3);
  app.wheel(10, 10, -1);
  app.wheel(10, 10, -1);
  assertEquals(app.scroll, 0);

  press("tab", { shift: true });
  assertEquals(app.focus, "list.delete");
  const button = hit("list.delete")!;
  assert(button.screen, "the focused button is scrolled into view");

  press("end");
  const bottom = app.scroll;
  press("pagedown");
  assertEquals(app.scroll, bottom);
});

Deno.test("app - hovering reports changes only", () => {
  const { app, hit } = setup({ mock: true });
  const { column, row } = hit("list.add")!.screen!;
  assertEquals(app.move(column, row), true);
  assertEquals(app.move(column + 1, row), false);
  assertEquals(app.move(0, row + 30), true);
});

Deno.test("app - quits with q or Ctrl+C", () => {
  const { calls, press, type } = setup();
  press("q");
  press("a");
  type("q");
  press("c", { ctrl: true });
  assertEquals(calls.quit, 2);
});

Deno.test("app - asks for a bigger terminal", () => {
  const { texts, hit } = setup({ size: [30, 10] });
  assertStringIncludes(texts(), "44×14");
  assertEquals(hit("empty.mock"), undefined);
});
