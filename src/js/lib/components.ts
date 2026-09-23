import type { Subscription } from "./types.ts";
import type { Store } from "./store.ts";
import {
  formatDate,
  getInactives,
  getMonthlyCost,
  getTranslation,
  getYearlyCost,
} from "./index.ts";

type Theme = "light" | "dark";

// Browser side effects are injected so the components stay plain objects
// that can be unit tested; main.ts provides the real implementations.
export type Deps = {
  app: () => Store;
  persist: () => void;
  confirm: (message: string) => boolean;
  navigate: (url: string) => void;
  setThemeAttribute: (theme: Theme) => void;
  transition: (update: () => void) => void;
  download: (filename: string, content: string) => void;
  pickFile: (accept: string) => Promise<string | null>;
};

export const DELETE_MESSAGE = "Sure you want to delete all subscriptions data?";

export const createComponents = (deps: Deps) => {
  const { app, persist } = deps;

  return {
    header: () => ({
      toggleTheme(): void {
        const update: Theme = app().theme === "light" ? "dark" : "light";
        deps.transition(() => {
          app().setTheme(update);
          deps.setThemeAttribute(update);
          persist();
        });
      },
    }),

    empty: () => ({
      useMock(): void {
        app().loadMock();
        persist();
      },
    }),

    dashboard: () => ({
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
    }),

    list: () => ({
      toggleActive(index: number): void {
        app().toggleActive(index);
        persist();
      },
      deleteAll(): void {
        if (deps.confirm(DELETE_MESSAGE)) {
          app().deleteSubs();
          persist();
        }
      },
    }),

    backup: () => ({
      exportData(): void {
        deps.download(
          "subscriptions.json",
          JSON.stringify(app().getState.data),
        );
      },
      async importData(): Promise<void> {
        const content = await deps.pickFile(".json");
        if (typeof content === "string") {
          app().importSubs(JSON.parse(content));
          persist();
        }
      },
    }),

    addForm: (homeUrl: string) => ({
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
        deps.navigate(homeUrl);
      },
    }),
  };
};
