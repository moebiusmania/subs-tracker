import { nextTick, reactive, watchEffect } from "vue";

import { createApp } from "./app.ts";
import { createStore } from "./lib/store.ts";
import { hasData, load, save } from "./lib/storage.ts";
import { createComponents } from "./lib/components.ts";
import { detectLocale } from "./lib/i18n.ts";
import { parseRoute, type Route } from "./lib/route.ts";
import { readShareLink } from "./lib/transfer.ts";
import {
  createInstaller,
  createUpdater,
  registerServiceWorker,
} from "./pwa.ts";
import { supportsPeel } from "./peel.ts";

registerServiceWorker();

// reactive() wraps the store in a proxy: always go through it
const store = reactive(createStore());

// Used until the user picks a language with the switcher
store.setSystemLocale(detectLocale(navigator.languages));

if (hasData()) {
  store.setState(load());
}
document.documentElement.setAttribute("data-theme", store.theme);

// The add and edit forms open in a dialog over home, but keep their own URLs:
// links to them push a history entry, so back closes the dialog, and loading
// one directly (every page renders home) opens it. BASE_URL is the home path,
// with the GitHub Pages prefix.
const base = import.meta.env.BASE_URL;
const currentRoute = (): Route =>
  parseRoute(location.pathname, location.search, base);

const router = reactive({ route: currentRoute() });

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
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const link = (event.target as Element | null)?.closest("a[href]");
  if (
    !(link instanceof HTMLAnchorElement) ||
    link.target ||
    link.origin !== location.origin
  )
    return;
  if (parseRoute(link.pathname, link.search, base).name === "home") return;
  event.preventDefault();
  openForm(link.href);
});

// The QR encoder is its own chunk, fetched the first time a code is shown
type QrModule = typeof import("./lib/qr.ts");
let qrModule: Promise<QrModule> | null = null;
const loadQr = (): Promise<QrModule> => {
  qrModule ??= import("./lib/qr.ts").catch((error) => {
    // Let a later attempt try again
    qrModule = null;
    throw error;
  });
  return qrModule;
};

const reduceMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

// A deleted card's exit and the slide of the ones after it, with the
// --ease-in and --ease-out curves in styles.css
const REMOVE_OUT = 200;
const REMOVE_SHIFT = 340;
const EASE_IN = "cubic-bezier(0.55, 0, 1, 0.45)";
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

const components = createComponents({
  app: () => store,
  persist: () => save(store.getState),
  confirm: (message) => confirm(message),
  closeForm,
  setThemeAttribute: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
  },
  // Cross-fade the whole page between themes where supported. Vue patches
  // the DOM on the next tick: the new state is captured after it
  transition: (update) => {
    if (document.startViewTransition && !reduceMotion()) {
      document.startViewTransition(async () => {
        update();
        await nextTick();
      });
    } else {
      update();
    }
  },
  // The card shrinks and fades out, then the cards after it slide into the
  // gap. Cards are keyed by index, so after the removal each of them shows
  // the item one place further on: it starts from that card's old box (FLIP)
  removeItem: async (index, remove) => {
    const cards = () => [
      ...document.querySelectorAll<HTMLElement>(".subs__grid > .sub-card"),
    ];
    const before = cards();
    const card = before[index];
    if (!card || reduceMotion()) return remove();
    const boxes = before.map((item) => item.getBoundingClientRect());

    card.inert = true;
    const exit = card.animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "scale(0.9)" },
      ],
      { duration: REMOVE_OUT, easing: EASE_IN, fill: "forwards" },
    );
    await exit.finished;
    remove();
    await nextTick();
    // The element now shows the next item (or is gone if it was the last)
    exit.cancel();
    card.inert = false;

    cards()
      .slice(index)
      .forEach((item, offset) => {
        const from = boxes[index + offset + 1];
        if (!from) return;
        const to = item.getBoundingClientRect();
        item.animate(
          [
            {
              transform: `translate(${from.left - to.left}px, ${
                from.top - to.top
              }px)`,
            },
            { transform: "none" },
          ],
          { duration: REMOVE_SHIFT, easing: EASE_OUT },
        );
      });
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
  updater: createUpdater(),
  // Share links open the home page of this same deploy
  shareBase: () => new URL(base, location.origin).href,
  qrSvg: async (text) => (await loadQr()).qrSvg(text),
  copy: async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  },
});

addEventListener("languagechange", () => {
  store.setSystemLocale(detectLocale(navigator.languages));
});

// The header hides while there are no subscriptions, since the empty state
// shows the same controls (index.html sets it before first paint)
watchEffect(() => {
  document.documentElement.toggleAttribute(
    "data-empty",
    store.data.length === 0,
  );
});

watchEffect(() => {
  document.documentElement.lang = store.locale;
  document.title = store.i18n.meta.title;
});

// Replaces the prerendered English shell
createApp({
  store,
  router,
  components,
  base,
  closeForm,
  canPeel: supportsPeel(),
  reduceMotion,
}).mount(document.body);

// A share link (#d=…, from a QR code) opened the app: drop the data from the
// address, so a reload doesn't ask again, and let the transfer dialog ask
// before importing it
const receiveShareLink = (): void => {
  const payload = readShareLink(location.hash);
  if (!payload) return;
  history.replaceState(history.state, "", location.pathname + location.search);
  dispatchEvent(new CustomEvent("transfer-receive", { detail: payload }));
};
// The transfer dialog listens from its onMounted, which has run by now
receiveShareLink();
addEventListener("hashchange", receiveShareLink);

// Set by the inline script in index.html to hide the English markup until
// the app has rendered it in the right language
delete document.documentElement.dataset.i18nPending;
