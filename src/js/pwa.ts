import type { Installer } from "./lib/components.ts";

// Chromium only, not in the DOM typings yet
type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "subs-tracker:install-dismissed";

// The worker sits at the site root (next to index.html) so it controls every
// page; resolving it from this bundle keeps the GitHub Pages path prefix
export const registerServiceWorker = (): void => {
  if (!("serviceWorker" in navigator)) return;
  addEventListener("load", () => {
    navigator.serviceWorker
      .register(new URL("../sw.js", import.meta.url))
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
