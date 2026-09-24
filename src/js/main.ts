// @ts-types="npm:@types/alpinejs@^3"
import Alpine from "alpinejs";

import { createStore, type Store } from "./lib/store.ts";
import { hasData, load, save } from "./lib/storage.ts";
import { createComponents } from "./lib/components.ts";
import { createInstaller, registerServiceWorker } from "./pwa.ts";

registerServiceWorker();

const store: Store = createStore();

if (hasData()) {
  store.setState(load());
}
document.documentElement.setAttribute("data-theme", store.theme);

Alpine.store("app", store);

// Alpine.store() wraps the object in a reactive proxy: always go through it
const app = (): Store => Alpine.store("app") as Store;

const components = createComponents({
  app,
  persist: () => save(app().getState),
  confirm: (message) => confirm(message),
  navigate: (url) => {
    location.href = url;
  },
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
Alpine.data("install", components.install);

Alpine.start();
