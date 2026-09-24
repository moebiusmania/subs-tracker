import type { Locale, Subscription } from "./types.ts";
import type { Store } from "./store.ts";
import {
  formatDate,
  getInactives,
  getMonthlyCost,
  getTranslation,
  getYearlyCost,
} from "./index.ts";

type Theme = "light" | "dark";

// Install banner: "prompt" where the browser can show its own install
// dialog, "manual" on iOS where users add the app from the Share menu
export type InstallMode = "" | "prompt" | "manual";

export type Installer = {
  // Already running as an installed app
  installed: () => boolean;
  // Installing only works by hand (iOS has no install prompt)
  manual: () => boolean;
  // The user closed the banner before
  dismissed: () => boolean;
  dismiss: () => void;
  // Called when the browser's install prompt becomes available
  onPrompt: (callback: () => void) => void;
  onInstalled: (callback: () => void) => void;
  // Shows the browser's install prompt, resolves to true if accepted
  prompt: () => Promise<boolean>;
};

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
  installer: Installer;
};

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
      setLocale(locale: Locale): void {
        if (app().locale === locale) return;
        deps.transition(() => {
          app().setLocale(locale);
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
      status(item: Subscription): string {
        const { main } = app().i18n;
        return item.isActive ? main.active : main.inactive;
      },
      statusLabel(item: Subscription): string {
        const toggle = getTranslation(app().i18n.main.toggle, item.name);
        return `${this.status(item)}, ${toggle}`;
      },
      recurrence(item: Subscription): string {
        return app().i18n.recurrence[item.recurrence];
      },
      // Dates come back from localStorage as strings
      expiration(item: Subscription): string {
        return new Date(item.expiration).toLocaleDateString(app().locale, {
          dateStyle: "medium",
        });
      },
      toggleActive(index: number): void {
        app().toggleActive(index);
        persist();
      },
      deleteAll(): void {
        if (deps.confirm(app().i18n.main.confirmDelete)) {
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

    install: () => ({
      mode: "" as InstallMode,
      init(): void {
        const { installer } = deps;
        if (installer.installed() || installer.dismissed()) return;
        if (installer.manual()) this.mode = "manual";
        installer.onPrompt(() => {
          this.mode = "prompt";
        });
        installer.onInstalled(() => {
          this.mode = "";
        });
      },
      async install(): Promise<void> {
        this.mode = "";
        // A declined prompt counts as "not now": don't nag again
        if (!(await deps.installer.prompt())) deps.installer.dismiss();
      },
      dismiss(): void {
        this.mode = "";
        deps.installer.dismiss();
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
