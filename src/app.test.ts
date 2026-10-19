// @vitest-environment happy-dom
// The Vue templates against the real components, store and route, with the
// browser side effects faked like in lib/components.test.ts
import { afterEach, assert, test } from "vitest";
import { nextTick, reactive } from "vue";

import { createApp } from "./app.ts";
import { createStore } from "./lib/store.ts";
import { createComponents } from "./lib/components.ts";
import type { Route } from "./lib/route.ts";

const setup = (options: { mock?: boolean } = {}) => {
  const store = reactive(createStore());
  if (options.mock) store.loadMock();
  const router = reactive({ route: { name: "home" } as Route });
  const calls = { persist: 0, closeForm: 0 };
  const closeForm = () => {
    calls.closeForm++;
    router.route = { name: "home" };
  };
  const components = createComponents({
    app: () => store,
    persist: () => calls.persist++,
    confirm: () => true,
    closeForm,
    setThemeAttribute: () => {},
    transition: (update) => update(),
    removeItem: (_index, remove) => Promise.resolve(remove()),
    download: () => {},
    pickFile: () => Promise.resolve(null),
    installer: {
      installed: () => true,
      manual: () => false,
      dismissed: () => true,
      dismiss: () => {},
      onPrompt: () => {},
      onInstalled: () => {},
      prompt: () => Promise.resolve(false),
    },
    updater: { onUpdate: () => {}, reload: () => {} },
    shareBase: () => "https://example.com/",
    qrSvg: () => Promise.resolve("<svg></svg>"),
    copy: () => Promise.resolve(true),
  });
  const app = createApp({
    store,
    router,
    components,
    base: "/subs-tracker/",
    closeForm,
    canPeel: false,
    reduceMotion: () => true,
  });
  app.mount(document.body);
  const $ = <T extends Element = HTMLElement>(selector: string) =>
    document.querySelector<T>(selector);
  const $$ = (selector: string) => [...document.querySelectorAll(selector)];
  const text = (selector: string) => $(selector)?.textContent?.trim() ?? "";
  return { app, store, router, calls, $, $$, text };
};

let unmount = () => {};
afterEach(() => unmount());

const mounted = (options?: { mock?: boolean }) => {
  const result = setup(options);
  unmount = () => result.app.unmount();
  return result;
};

test("app - the body holds the skip link, header, main, footer and banners", () => {
  const { $$ } = mounted();
  assert.deepEqual(
    $$("body > *").map((element) => element.className || element.tagName),
    ["skip-link", "site-header", "container", "site-footer", "banners"],
  );
});

test("app - the empty state, with links under the base path", async () => {
  const { store, $, $$, text, calls } = mounted();
  assert.deepEqual(text(".empty h1"), "There is nothing here!");
  assert.deepEqual(
    $<HTMLAnchorElement>(".empty .btn--primary")?.getAttribute("href"),
    "/subs-tracker/add/",
  );
  // The example data button
  $<HTMLButtonElement>(".empty__actions button")!.click();
  await nextTick();
  assert.deepEqual(store.data.length, 4);
  assert.deepEqual(calls.persist, 1);
  assert.deepEqual($$(".subs__grid > .sub-card").length, 4);
  assert.deepEqual($(".empty"), null);
});

test("app - the dashboard and the cards", async () => {
  const { store, $, $$, text } = mounted({ mock: true });
  assert.deepEqual(
    $$(".stat__value").map((element) => element.textContent),
    ["4", "14,99€", "229,87€"],
  );
  assert.deepEqual(text(".stat__desc"), "with 1 inactive subscriptions");
  assert.deepEqual(text(".subs__count"), "4");

  const [first] = $$(".sub-card");
  assert.deepEqual(first?.querySelector("h3")?.textContent, "Movies streaming");
  assert.deepEqual(first?.classList.contains("is-due"), true);
  assert.deepEqual(
    first?.querySelector(".icon-btn")?.getAttribute("href"),
    "/subs-tracker/edit/?item=0",
  );
  assert.deepEqual(
    $$(".sub-card.is-inactive").map(
      (card) => card.querySelector("h3")?.textContent,
    ),
    ["App hosting"],
  );

  first!.querySelector<HTMLButtonElement>(".status")!.click();
  await nextTick();
  assert.deepEqual(store.data[0]?.isActive, false);
  assert.deepEqual(first!.classList.contains("is-inactive"), true);
});

test("app - the edit dialog follows the route and edits a copy", async () => {
  const { store, router, $, calls } = mounted({ mock: true });
  router.route = { name: "edit", index: 1 };
  await new Promise((resolve) => setTimeout(resolve));
  const dialog = $<HTMLDialogElement>("dialog.sheet")!;
  assert.deepEqual(dialog.open, true);
  assert.deepEqual($("#sheet-title")?.textContent, "Edit the subscription");
  const name = $<HTMLInputElement>("#name")!;
  assert.deepEqual(name.value, "Music streaming");
  assert.deepEqual($<HTMLInputElement>("#price")!.value, "49,99");

  name.value = "Music";
  name.dispatchEvent(new Event("input"));
  $<HTMLInputElement>("#price")!.value = "45,5";
  $<HTMLInputElement>("#price")!.dispatchEvent(new Event("input"));
  // Not saved until submitted
  assert.deepEqual(store.data[1]?.name, "Music streaming");
  $<HTMLFormElement>("form.form")!.dispatchEvent(new Event("submit"));
  assert.deepEqual(store.data[1]?.name, "Music");
  assert.deepEqual(store.data[1]?.price, 45.5);
  assert.deepEqual(calls.closeForm, 1);
});

test("app - a missing item closes the edit dialog", async () => {
  const { router, $, calls } = mounted({ mock: true });
  router.route = { name: "edit", index: 9 };
  await new Promise((resolve) => setTimeout(resolve));
  assert.deepEqual(calls.closeForm, 1);
  assert.deepEqual($<HTMLDialogElement>("dialog.sheet")!.open, false);
});

test("app - theme and language switch from the header", async () => {
  const { store, $, text } = mounted({ mock: true });
  const toggle = $<HTMLButtonElement>(".site-header .theme-toggle")!;
  assert.deepEqual(toggle.getAttribute("aria-pressed"), "false");
  toggle.click();
  await nextTick();
  assert.deepEqual(store.theme, "dark");
  assert.deepEqual(toggle.getAttribute("aria-pressed"), "true");

  $<HTMLButtonElement>('.site-header [lang="it"]')!.click();
  await nextTick();
  assert.deepEqual(text("#stats-title"), "Le tue statistiche");
  assert.deepEqual(
    $('.site-header [lang="it"]')?.getAttribute("aria-pressed"),
    "true",
  );
});
