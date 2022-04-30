import { defineStore, acceptHMRUpdate } from "pinia";

import { AppState, Subscription } from "./../libs/types";
import { subs as mock } from "./../libs/mocks";

export const useMainStore = defineStore("app", {
  state: (): AppState => ({
    locale: "en-EN",
    theme: "light",
    currency: "€",
    data: [],
  }),
  getters: {
    getState(): AppState {
      return {
        locale: this.locale,
        theme: this.theme,
        currency: this.currency,
        data: this.data,
      };
    },
  },
  actions: {
    loadMock(): void {
      this.data = mock;
    },
    addSubscription(item: Subscription): void {
      this.data.push(item);
    },
    toggleActive(index: number): void {
      const items: Subscription[] = [...this.data];
      const actives: number = items.filter(
        (e: Subscription) => e.isActive
      ).length;
      items[index].isActive = actives > 1 ? !items[index].isActive : true;
      this.data = items;
    },
    setTheme(value: "light" | "dark"): void {
      this.theme = value;
    },
    deleteSubs(): void {
      this.data = [];
    },
    setState({ locale, theme, currency, data }: AppState): void {
      console.log(theme);
      this.locale = locale;
      this.currency = currency;
      this.theme = theme;
      this.data = data;
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMainStore, import.meta.hot));
}
