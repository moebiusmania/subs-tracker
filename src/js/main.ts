// @ts-types="npm:@types/alpinejs@^3"
import Alpine from "alpinejs";

import type { Subscription } from "./lib/types.ts";
import { createStore, type Store } from "./lib/store.ts";
import { hasData, load, save } from "./lib/storage.ts";
import {
  formatDate,
  getInactives,
  getMonthlyCost,
  getTranslation,
  getYearlyCost,
} from "./lib/index.ts";

const store: Store = createStore();

if (hasData()) {
  store.setState(load());
}
document.documentElement.setAttribute("data-theme", store.theme);

Alpine.store("app", store);

// Alpine.store() wraps the object in a reactive proxy: always go through it
const app = (): Store => Alpine.store("app") as Store;
const persist = (): void => save(app().getState);

Alpine.data("header", () => ({
  toggleTheme(): void {
    const update: "dark" | "light" = app().theme === "light" ? "dark" : "light";
    const apply = (): void => {
      app().setTheme(update);
      document.documentElement.setAttribute("data-theme", update);
      persist();
    };

    // Cross-fade the whole page between themes where supported
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduceMotion) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  },
}));

Alpine.data("empty", () => ({
  useMock(): void {
    app().loadMock();
    persist();
  },
}));

Alpine.data("dashboard", () => ({
  get total(): number {
    return app().data.length;
  },
  get inactives(): string {
    return getTranslation(
      app().i18n.main.inactives,
      getInactives(app().data).length,
    );
  },
  get monthly(): string {
    return `${getMonthlyCost(app().data)}€`;
  },
  get yearly(): string {
    return `${getYearlyCost(app().data)}€`;
  },
}));

Alpine.data("list", () => ({
  toggleActive(index: number): void {
    app().toggleActive(index);
    persist();
  },
  deleteAll(): void {
    if (confirm("Sure you want to delete all subscriptions data?")) {
      app().deleteSubs();
      persist();
    }
  },
}));

Alpine.data("backup", () => ({
  exportData(): void {
    const json = JSON.stringify(app().getState.data);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "subscriptions.json";
    a.click();

    URL.revokeObjectURL(url);
  },
  importData(): void {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            app().importSubs(JSON.parse(reader.result));
            persist();
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  },
}));

Alpine.data("addForm", (homeUrl: string) => ({
  item: {
    name: "",
    price: 1,
    currency: "€",
    isActive: true,
    expiration: new Date(),
    recurrence: "monthly",
  } as Subscription,
  formatDate,
  submit(): void {
    app().addSubscription(this.item);
    persist();
    location.href = homeUrl;
  },
}));

Alpine.start();
