import { setActivePinia, createPinia } from "pinia";
import { describe, expect, beforeEach, test } from "vitest";

import { useMainStore } from "../index";

const testSubscription = {
  name: "Test",
  price: 9.99,
  currency: "€",
  isActive: true,
  recurrence: "monthly",
  expiration: new Date("2022-11-21T19:31:26.925Z"),
};

describe("Application Store", () => {
  beforeEach(() => {
    // creates a fresh pinia and make it active so it's automatically picked
    // up by any useStore() call without having to pass it to it:
    // `useStore(pinia)`
    setActivePinia(createPinia());
  });

  describe("Getters", () => {
    test("getState", () => {
      const app = useMainStore();
      expect(app.getState).toEqual({
        locale: "en-EN",
        theme: "light",
        currency: "€",
        data: [],
      });
    });
  });

  describe("Mutations", () => {
    test("loadMock", () => {
      const app = useMainStore();
      expect(app.data.length).toBe(0);
      app.loadMock();
      expect(app.data.length).toBe(4);
    });

    test("setTheme", () => {
      const app = useMainStore();
      expect(app.theme).toBe("light");
      app.setTheme("dark");
      expect(app.theme).toBe("dark");
    });

    test("deleteSubs", () => {
      const app = useMainStore();
      expect(app.data.length).toBe(0);
      app.loadMock();
      expect(app.data.length).toBe(4);
      app.deleteSubs();
      expect(app.data.length).toBe(0);
    });

    test("addSubscription", () => {
      const app = useMainStore();
      expect(app.data.length).toBe(0);
      app.addSubscription(testSubscription);
      expect(app.data.length).toBe(1);
      expect(app.data[0].name).toBe("Test");
      expect(app.data[0].price).toBe(9.99);
    });

    test("toggleActive - normal behavior", () => {
      const app = useMainStore();
      expect(app.data.length).toBe(0);
      app.addSubscription(testSubscription);
      app.addSubscription(testSubscription);
      expect(app.data[0].isActive).toBe(true);
      app.toggleActive(0);
      expect(app.data[0].isActive).toBe(false);
      app.toggleActive(0);
      expect(app.data[0].isActive).toBe(true);
    });

    test("toggleActive - don't update isActive if there is only 1 element", () => {
      const app = useMainStore();
      expect(app.data.length).toBe(0);
      app.addSubscription(testSubscription);
      expect(app.data[0].isActive).toBe(true);
      app.toggleActive(0);
      expect(app.data[0].isActive).not.toBe(false);
    });
  });
});
