import type { AppState, I18n, Locale, Subscription } from "./types.ts";
import { subs as mock } from "./mocks.ts";
import { DEFAULT_LOCALE, isLocale, translations } from "./i18n.ts";

export type Store = AppState & {
  readonly getState: AppState;
  // Strings for the current locale, derived so they're never persisted
  readonly i18n: I18n;
  loadMock(): void;
  addSubscription(item: Subscription): void;
  toggleActive(index: number): void;
  setTheme(value: "light" | "dark"): void;
  setLocale(value: Locale): void;
  deleteSubs(): void;
  importSubs(data: Subscription[]): void;
  setState(state: AppState): void;
};

// Plain object so it can be unit tested; main.ts registers it with
// Alpine.store(), which makes it reactive.
export const createStore = (): Store => ({
  locale: DEFAULT_LOCALE,
  theme: "light",
  currency: "€",
  data: [],

  get i18n(): I18n {
    return translations[this.locale];
  },

  get getState(): AppState {
    return {
      locale: this.locale,
      theme: this.theme,
      currency: this.currency,
      data: this.data,
    };
  },

  loadMock(): void {
    this.data = structuredClone(mock);
  },
  addSubscription(item: Subscription): void {
    this.data.push(item);
  },
  toggleActive(index: number): void {
    const items: Subscription[] = [...this.data];
    const actives: number = items.filter(
      (e: Subscription) => e.isActive,
    ).length;
    items[index]!.isActive = actives > 1 ? !items[index]!.isActive : true;
    this.data = items;
  },
  setTheme(value: "light" | "dark"): void {
    this.theme = value;
  },
  setLocale(value: Locale): void {
    this.locale = value;
  },
  deleteSubs(): void {
    this.data = [];
  },
  importSubs(data: Subscription[]): void {
    this.data = data;
  },
  setState({ locale, theme, currency, data }: AppState): void {
    // Saved state may predate a locale or name one that no longer exists
    this.locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
    this.currency = currency;
    this.theme = theme;
    this.data = data;
  },
});
