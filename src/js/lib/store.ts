import type { AppState, I18n, Locale, Subscription } from "./types.ts";
import { mockSubs } from "./mocks.ts";
import { DEFAULT_LOCALE, isLocale, translations } from "./i18n.ts";

export type Store = AppState & {
  readonly getState: AppState;
  // Browser language, used until a language is picked. Not persisted
  systemLocale: Locale;
  // The language in use and its strings, derived so they're never persisted
  readonly locale: Locale;
  readonly i18n: I18n;
  loadMock(): void;
  addSubscription(item: Subscription): void;
  toggleActive(index: number): void;
  setTheme(value: "light" | "dark"): void;
  setLocale(value: Locale): void;
  setSystemLocale(value: Locale): void;
  deleteSubs(): void;
  importSubs(data: Subscription[]): void;
  setState(state: AppState): void;
};

// Plain object so it can be unit tested; main.ts registers it with
// Alpine.store(), which makes it reactive.
export const createStore = (): Store => ({
  language: null,
  systemLocale: DEFAULT_LOCALE,
  theme: "light",
  currency: "€",
  data: [],

  get locale(): Locale {
    return this.language ?? this.systemLocale;
  },
  get i18n(): I18n {
    return translations[this.locale];
  },

  get getState(): AppState {
    return {
      language: this.language,
      theme: this.theme,
      currency: this.currency,
      data: this.data,
    };
  },

  loadMock(): void {
    this.data = mockSubs();
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
    this.language = value;
  },
  setSystemLocale(value: Locale): void {
    this.systemLocale = value;
  },
  deleteSubs(): void {
    this.data = [];
  },
  importSubs(data: Subscription[]): void {
    this.data = data;
  },
  setState({ language, theme, currency, data }: AppState): void {
    // Older saves have no language (their "locale" was just the default) and
    // a saved one may no longer exist: both follow the system language
    this.language = isLocale(language) ? language : null;
    this.currency = currency;
    this.theme = theme;
    this.data = data;
  },
});
