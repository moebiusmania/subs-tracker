// @ts-types="npm:@types/alpinejs@^3"
import Alpine from "alpinejs";

import { createStore, type Store } from "./lib/store.ts";
import { hasData, load, save } from "./lib/storage.ts";
import { createComponents } from "./lib/components.ts";
import { detectLocale } from "./lib/i18n.ts";
import { parseRoute, type Route } from "./lib/route.ts";
import { createInstaller, registerServiceWorker } from "./pwa.ts";
import { peel, supportsPeel } from "./peel.ts";

registerServiceWorker();

const store: Store = createStore();

// Used until the user picks a language with the switcher
store.setSystemLocale(detectLocale(navigator.languages));

if (hasData()) {
  store.setState(load());
}
document.documentElement.setAttribute("data-theme", store.theme);

Alpine.store("app", store);

// Alpine.store() wraps the object in a reactive proxy: always go through it
const app = (): Store => Alpine.store("app") as Store;

// Templates read the current strings as $t.section.key
Alpine.magic("t", () => app().i18n);

// The add and edit forms open in a dialog over home, but keep their own URLs:
// links to them push a history entry, so back closes the dialog, and loading
// one directly (every page renders home) opens it. main.js lives in /js/, so
// the home path, with the GitHub Pages prefix, is one level up.
const base = new URL("../", import.meta.url).pathname;
const currentRoute = (): Route =>
  parseRoute(location.pathname, location.search, base);

Alpine.store("router", { route: currentRoute() });
const router = Alpine.store("router") as { route: Route };

const openForm = (url: string): void => {
  history.pushState({ form: true }, "", url);
  router.route = currentRoute();
};

// Set while history.back() is on its way, so a second close (Escape fires
// both cancel and close) doesn't step back twice
let leaving = false;

const closeForm = (): void => {
  if (leaving || router.route.name === "home") return;
  // Opened from a link: step back to the home entry it came from
  if ((history.state as { form?: boolean } | null)?.form) {
    leaving = true;
    history.back();
  } else {
    history.replaceState(null, "", base);
    router.route = currentRoute();
  }
};

addEventListener("popstate", () => {
  leaving = false;
  router.route = currentRoute();
});

// Plain clicks on links to /add/ or /edit/ open the dialog instead of loading
// the page; modified clicks (new tab, …) still follow the link
document.addEventListener("click", (event) => {
  if (
    event.defaultPrevented || event.button !== 0 || event.metaKey ||
    event.ctrlKey || event.shiftKey || event.altKey
  ) return;
  const link = (event.target as Element | null)?.closest("a[href]");
  if (
    !(link instanceof HTMLAnchorElement) || link.target ||
    link.origin !== location.origin
  ) return;
  if (parseRoute(link.pathname, link.search, base).name === "home") return;
  event.preventDefault();
  openForm(link.href);
});

const components = createComponents({
  app,
  persist: () => save(app().getState),
  confirm: (message) => confirm(message),
  closeForm,
  setThemeAttribute: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
  },
  // Cross-fade the whole page between themes where supported
  transition: (update) => {
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduceMotion) {
      document.startViewTransition(update);
    } else {
      update();
    }
  },
  download: (filename, content) => {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  },
  pickFile: (accept) =>
    new Promise((resolve) => {
      const input = document.createElement("input");

      input.type = "file";
      input.accept = accept;
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () =>
          resolve(typeof reader.result === "string" ? reader.result : null);
        reader.readAsText(file);
      };
      input.click();
    }),
  installer: createInstaller(),
});

Alpine.data("header", components.header);
Alpine.data("empty", components.empty);
Alpine.data("dashboard", components.dashboard);
Alpine.data("list", components.list);
Alpine.data("backup", components.backup);
Alpine.data("addForm", components.addForm);
// The index comes from /edit/?item=<index> (a static site has no
// /edit/<index> pages). A missing or bad one closes the dialog right away
Alpine.data("editForm", components.editForm);

// The dialog follows the route. Its form is keyed by the route, so every
// opening starts from a fresh copy of the item; the form stays rendered
// until the exit animation is over.
const reduceMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
const canPeel = supportsPeel();
// The CSS fade's length (--duration in styles.css)
const FADE = 200;

Alpine.data("formDialog", () => {
  // Openings and closings run one at a time, each for the route current
  // when it starts. Kept out of the reactive data: the effect below reads it
  let queue = Promise.resolve();
  return {
    // The pointer went down on the backdrop: a drag that started inside the
    // dialog and ended outside doesn't close it
    pressed: false,
    view: null as (Route & { key: string }) | null,
    get views(): (Route & { key: string })[] {
      return this.view ? [this.view] : [];
    },
    close: closeForm,
    init(): void {
      const dialog = this.$el as HTMLDialogElement;
      // With the WebGL peel the panel doesn't fade with CSS
      dialog.classList.toggle("sheet--peel", canPeel);
      Alpine.effect(() => {
        void router.route;
        queue = queue.then(() => this.sync(dialog)).catch(console.error);
      });
    },
    panel(dialog: HTMLDialogElement): HTMLElement | null {
      return dialog.querySelector<HTMLElement>(":scope > .sheet__panel");
    },
    async sync(dialog: HTMLDialogElement): Promise<void> {
      const route = router.route;
      const peeling = canPeel && !reduceMotion();

      if (route.name === "home") {
        if (dialog.open) {
          // The backdrop fades while the panel peels (or fades) away
          dialog.classList.add("is-closing");
          const panel = this.panel(dialog);
          const peeled = peeling && panel && await peel(panel, dialog, "out");
          if (!peeled && !reduceMotion()) {
            await new Promise((resolve) => setTimeout(resolve, FADE));
          }
          dialog.close();
          dialog.classList.remove("is-closing");
        }
        this.view = null;
        return;
      }

      const key = JSON.stringify(route);
      if (this.view?.key === key && dialog.open) return;
      this.view = { ...route, key };
      // After x-for has rendered the form, so showModal() focuses its
      // autofocus field
      await this.$nextTick();
      // editForm may have closed it right away (no such item)
      if (router.route.name === "home" || dialog.open) return;
      const panel = this.panel(dialog);
      if (peeling && panel) panel.style.opacity = "0";
      dialog.showModal();
      if (peeling && panel && !(await peel(panel, dialog, "in"))) {
        panel.style.opacity = "";
      }
    },
  };
});
Alpine.data("install", components.install);

addEventListener("languagechange", () => {
  app().setSystemLocale(detectLocale(navigator.languages));
});

Alpine.effect(() => {
  document.documentElement.lang = app().locale;
  document.title = app().i18n.meta.title;
});

Alpine.start();

// Set by the inline script in layouts/base.vto to hide the English markup
// until Alpine has translated it
delete document.documentElement.dataset.i18nPending;
