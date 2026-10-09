import type { Locale, Subscription } from "./types.ts";
import type { Store } from "./store.ts";
import {
  formatDate,
  getInactives,
  getMonthlyCost,
  getTranslation,
  getYearlyCost,
  isExpiringThisMonth,
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

// A newer deploy taking over while the app is open (the service worker
// tells the page); the TUI has nothing to update
export type Updater = {
  // Called once a newer version is ready
  onUpdate: (callback: () => void) => void;
  // Loads the new version
  reload: () => void;
};

// Browser side effects are injected so the components stay plain objects
// that can be unit tested; main.ts provides the real implementations.
export type Deps = {
  app: () => Store;
  persist: () => void;
  confirm: (message: string) => boolean;
  // Leaves the add or edit form: the web closes its dialog, the TUI goes
  // back to the home screen
  closeForm: () => void;
  setThemeAttribute: (theme: Theme) => void;
  transition: (update: () => void) => void;
  download: (filename: string, content: string) => void;
  pickFile: (accept: string) => Promise<string | null>;
  installer: Installer;
  updater: Updater;
};

// What the add form starts with
const newItem = (): Subscription => ({
  name: "",
  price: 1,
  currency: "€",
  isActive: true,
  expiration: new Date(),
  recurrence: "monthly",
});

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
      expiresThisMonth(item: Subscription): boolean {
        return isExpiringThisMonth(item);
      },
      toggleActive(index: number): void {
        app().toggleActive(index);
        persist();
      },
      editLabel(item: Subscription): string {
        return getTranslation(app().i18n.main.editItem, item.name);
      },
      deleteLabel(item: Subscription): string {
        return getTranslation(app().i18n.main.deleteItem, item.name);
      },
      deleteItem(index: number): void {
        const item = app().data[index];
        if (!item) return;
        const message = getTranslation(
          app().i18n.main.confirmDeleteItem,
          item.name,
        );
        if (deps.confirm(message)) {
          app().deleteSubscription(index);
          persist();
        }
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

    // "New version" banner. It only offers the reload: reloading by itself
    // could throw away a form being filled in
    update: () => ({
      available: false,
      init(): void {
        deps.updater.onUpdate(() => {
          this.available = true;
        });
      },
      reload(): void {
        deps.updater.reload();
      },
      dismiss(): void {
        this.available = false;
      },
    }),

    addForm: () => ({
      item: newItem(),
      formatDate,
      submit(): void {
        app().addSubscription(this.item);
        persist();
        deps.closeForm();
      },
    }),

    // Same fields as addForm, filled with the item at that index. An index
    // with no item (a stale link, data deleted meanwhile) closes the form.
    editForm: (index: number) => {
      const saved = Number.isInteger(index) ? app().data[index] : undefined;
      return {
        found: saved !== undefined,
        // A copy, so leaving without saving changes nothing. Dates come back
        // from localStorage as strings
        item: saved
          ? { ...saved, expiration: new Date(saved.expiration) }
          : newItem(),
        formatDate,
        init(): void {
          if (!this.found) deps.closeForm();
        },
        submit(): void {
          if (!this.found) return deps.closeForm();
          app().updateSubscription(index, this.item);
          persist();
          deps.closeForm();
        },
      };
    },
  };
};
