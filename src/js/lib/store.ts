import type { AppState, Subscription } from "./types.ts";
import { subs as mock } from "./mocks.ts";

import en from "../../_data/i18n.json" with { type: "json" };

export type Store = AppState & {
  readonly getState: AppState;
  loadMock(): void;
  addSubscription(item: Subscription): void;
  toggleActive(index: number): void;
  setTheme(value: "light" | "dark"): void;
  deleteSubs(): void;
  importSubs(data: Subscription[]): void;
  setState(state: AppState): void;
};

// Plain object so it can be unit tested; main.ts registers it with
// Alpine.store(), which makes it reactive.
export const createStore = (): Store => ({
  locale: "en",
  i18n: en,
  theme: "light",
  currency: "€",
  data: [],

  get getState(): AppState {
    return {
      locale: this.locale,
      i18n: this.i18n,
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
  deleteSubs(): void {
    this.data = [];
  },
  importSubs(data: Subscription[]): void {
    this.data = data;
  },
  setState({ locale, theme, currency, data }: AppState): void {
    this.locale = locale;
    this.currency = currency;
    this.theme = theme;
    this.data = data;
  },
});
