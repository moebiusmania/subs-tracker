import type { Installer, Updater } from "./lib/components.ts";

// Chromium only, not in the DOM typings yet
type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "subs-tracker:install-dismissed";

// This build's version, the same hash the service worker gets: both are
// filled in at build time (see _config.ts)
const BUILD_VERSION = "__BUILD_VERSION__";

// How often an open app asks for a new service worker, besides every time
// it comes back to the foreground
const UPDATE_INTERVAL = 60 * 60 * 1000;

// The worker sits at the site root (next to index.html) so it controls every
// page; resolving it from this bundle keeps the GitHub Pages path prefix
export const registerServiceWorker = (): void => {
  if (!("serviceWorker" in navigator)) return;
  addEventListener("load", () => {
    navigator.serviceWorker
      .register(new URL("../sw.js", import.meta.url))
      .then((registration) => {
        // Browsers only look for a new sw.js when a page loads, and an open
        // app doesn't load pages: ask again when it's in front of the user
        const check = () => {
          if (document.visibilityState !== "visible") return;
          registration.update().catch(() => {
            // Offline: try again next time
          });
        };
        document.addEventListener("visibilitychange", check);
        setInterval(check, UPDATE_INTERVAL);
      })
      .catch((error) => console.error("Service worker not registered", error));
  });
};

// Must run early: browsers fire beforeinstallprompt once, soon after load
export const createInstaller = (): Installer => {
  let deferred: BeforeInstallPromptEvent | null = null;
  let promptCallback = (): void => {};
  let installedCallback = (): void => {};

  addEventListener("beforeinstallprompt", (event) => {
    // Skip the browser's own mini-infobar, the app shows its banner instead
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    promptCallback();
  });
  addEventListener("appinstalled", () => {
    deferred = null;
    installedCallback();
  });

  return {
    installed: () =>
      matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    // iPadOS reports itself as a Mac, touch support gives it away
    manual: () =>
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1),
    dismissed: () => {
      try {
        return localStorage.getItem(DISMISSED_KEY) !== null;
      } catch {
        return false;
      }
    },
    dismiss: () => {
      try {
        localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
      } catch {
        // Storage unavailable: the banner just comes back next time
      }
    },
    onPrompt: (callback) => {
      promptCallback = callback;
      if (deferred) callback();
    },
    onInstalled: (callback) => {
      installedCallback = callback;
    },
    prompt: async () => {
      if (!deferred) return false;
      const event = deferred;
      // Each event can only prompt once
      deferred = null;
      await event.prompt();
      return (await event.userChoice).outcome === "accepted";
    },
  };
};

// A new service worker announces its version when it takes over. A page
// loaded before that deploy runs older code: offer to reload. A page that
// already got the new files (requests go to the network first) matches it
export const createUpdater = (): Updater => {
  let ready = false;
  let readyCallback = (): void => {};

  navigator.serviceWorker?.addEventListener("message", (event) => {
    const data = event.data as { type?: string; version?: string } | null;
    if (data?.type !== "activated" || data.version === BUILD_VERSION) return;
    ready = true;
    readyCallback();
  });

  return {
    onUpdate: (callback) => {
      readyCallback = callback;
      if (ready) callback();
    },
    reload: () => location.reload(),
  };
};
