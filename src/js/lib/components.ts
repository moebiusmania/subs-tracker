import type { Locale, Subscription } from "./types.ts";
import { MAX_SUBSCRIPTIONS, type Store } from "./store.ts";
import {
  addMonths,
  formatDate,
  getInactives,
  getMonthlyCost,
  getTranslation,
  getYearlyCost,
  isExpiringThisMonth,
} from "./index.ts";
import {
  decodeShare,
  encodeShare,
  type ImportError,
  parseBackup,
  readShareLink,
  shareLink,
} from "./transfer.ts";

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
  // The app's address, the base of share links
  shareBase: () => string;
  // A QR code for the text as SVG markup; rejects when it doesn't fit or
  // the code can't load
  qrSvg: (text: string) => Promise<string>;
  // Copies to the clipboard, resolves to false when that's not allowed
  copy: (text: string) => Promise<boolean>;
};

// The export and import dialog: "export" and "import" let the user pick a
// file or a QR code, "link" asks before importing a share link that opened
// the app
export type TransferMode = "" | "export" | "import" | "link";

// What the add form starts with: renewing a month from today
const newItem = (now = new Date()): Subscription => ({
  name: "",
  price: 1,
  currency: "€",
  isActive: true,
  expiration: addMonths(now, 1),
  recurrence: "monthly",
});

export const createComponents = (deps: Deps) => {
  const { app, persist } = deps;

  const downloadBackup = (): void =>
    deps.download("subscriptions.json", JSON.stringify(app().getState.data));

  // Picks a JSON file and imports it: says whether that happened, or why
  // the file can't be imported
  const importBackup = async (): Promise<
    "imported" | "cancelled" | ImportError
  > => {
    const content = await deps.pickFile(".json");
    if (typeof content !== "string") return "cancelled";
    const result = parseBackup(content);
    if (!result.ok) return result.error;
    app().importSubs(result.data);
    persist();
    return "imported";
  };

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
      get limitText(): string {
        return getTranslation(app().i18n.main.limit, MAX_SUBSCRIPTIONS);
      },
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
      exportData: downloadBackup,
      importData: importBackup,
    }),

    // The dialog behind the export and import buttons, and the one asking
    // before a share link's subscriptions replace the current ones
    transfer: () => ({
      mode: "" as TransferMode,
      // "choose" between file and QR code, or "qr" once the code is shown
      view: "choose" as "choose" | "qr",
      busy: false,
      error: "",
      link: "",
      qr: "",
      copied: false,
      pasted: "",
      // The subscriptions from the link that opened the app
      pending: [] as Subscription[],
      // The pointer went down on the dialog's backdrop
      pressed: false,

      get title(): string {
        const t = app().i18n;
        return this.mode === "link"
          ? t.transfer.confirmTitle
          : this.mode === "import"
          ? t.backup.import
          : t.backup.export;
      },

      reset(mode: TransferMode): void {
        this.mode = mode;
        this.view = "choose";
        this.busy = false;
        this.error = "";
        this.link = "";
        this.qr = "";
        this.copied = false;
        this.pasted = "";
        this.pending = [];
      },
      openExport(): void {
        this.reset("export");
      },
      openImport(): void {
        this.reset("import");
      },
      close(): void {
        this.reset("");
      },
      importError(error: ImportError, source: "file" | "link"): string {
        const t = app().i18n.transfer;
        return error === "tooMany"
          ? getTranslation(t.tooMany, MAX_SUBSCRIPTIONS)
          : source === "file"
          ? t.invalidFile
          : t.invalidLink;
      },
      // A share link opened the app: decode it, then ask
      async receive(payload: string): Promise<void> {
        this.reset("link");
        this.busy = true;
        const result = await decodeShare(payload);
        this.busy = false;
        if (result.ok) this.pending = result.data;
        else this.error = this.importError(result.error, "link");
      },
      get confirmText(): string {
        const t = app().i18n.transfer;
        const count = this.pending.length;
        return getTranslation(
          app().data.length ? t.confirmReplace : t.confirmNew,
          count,
        );
      },
      acceptLink(): void {
        if (!this.pending.length) return this.close();
        app().importSubs(this.pending);
        persist();
        this.close();
      },
      saveFile(): void {
        downloadBackup();
        this.close();
      },
      async showQr(): Promise<void> {
        this.error = "";
        this.busy = true;
        try {
          const payload = await encodeShare(app().getState.data);
          this.link = shareLink(deps.shareBase(), payload);
          this.qr = await deps.qrSvg(this.link);
          this.view = "qr";
        } catch {
          this.error = app().i18n.transfer.qrFailed;
        } finally {
          this.busy = false;
        }
      },
      async copyLink(): Promise<void> {
        this.copied = await deps.copy(this.link);
      },
      back(): void {
        this.view = "choose";
        this.copied = false;
      },
      async openFile(): Promise<void> {
        this.error = "";
        const outcome = await importBackup();
        if (outcome === "imported") this.close();
        else if (outcome !== "cancelled") {
          this.error = this.importError(outcome, "file");
        }
      },
      async importPasted(): Promise<void> {
        this.error = "";
        const payload = readShareLink(this.pasted);
        const result = payload
          ? await decodeShare(payload)
          : { ok: false as const, error: "invalid" as const };
        if (!result.ok) {
          this.error = this.importError(result.error, "link");
          return;
        }
        app().importSubs(result.data);
        persist();
        this.close();
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

    // Full (MAX_SUBSCRIPTIONS): /add/ opened directly closes right away
    addForm: () => ({
      item: newItem(),
      formatDate,
      init(): void {
        if (!app().canAdd) deps.closeForm();
      },
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
