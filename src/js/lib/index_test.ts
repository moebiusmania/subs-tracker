import { assertEquals } from "@std/assert";

import { subs } from "./mocks.ts";
import {
  formatDate,
  getInactives,
  getMonthlyCost,
  getTranslation,
  getYearlyCost,
} from "./index.ts";

Deno.test("formatDate", () => {
  const test = new Date(2022, 10, 21);
  assertEquals(formatDate(test), "2022-11-21");
});

Deno.test("getInactives", () => {
  const inactives = getInactives(subs);
  assertEquals(inactives.length, 1);
  assertEquals(inactives[0].name, "App hosting");
});

Deno.test("getMonthlyCost", () => {
  assertEquals(getMonthlyCost(subs), 14.99);
});

Deno.test("getYearlyCost", () => {
  assertEquals(getYearlyCost(subs), 229.87);
});

Deno.test("getTranslation", () => {
  assertEquals(getTranslation("with {{value}} inactive", 2), "with 2 inactive");
});

Deno.test("getMonthlyCost - no active monthly subscriptions", () => {
  const yearly = subs.filter((item) => item.recurrence === "yearly");
  assertEquals(getMonthlyCost(yearly), 0);
  assertEquals(getYearlyCost(yearly), 49.99);
});

Deno.test("costs - empty list", () => {
  assertEquals(getMonthlyCost([]), 0);
  assertEquals(getYearlyCost([]), 0);
});

Deno.test("formatDate - pads single digit months and days", () => {
  assertEquals(formatDate(new Date(2023, 0, 5)), "2023-01-05");
});

Deno.test("getInactives - empty when everything is active", () => {
  assertEquals(getInactives(subs.filter((item) => item.isActive)).length, 0);
});

Deno.test("getYearlyCost - ignores inactive subscriptions", () => {
  const onlyInactive = subs.filter((item) => !item.isActive);
  assertEquals(getYearlyCost(onlyInactive), 0);
});

Deno.test("costs - rounded to two decimals", () => {
  const items = [0.1, 0.2].map((price) => ({ ...subs[0], price }));
  assertEquals(getMonthlyCost(items), 0.3);
  assertEquals(getYearlyCost(items), 3.6);
});
