import { assertEquals } from "@std/assert";

import { mockSubs } from "./mocks.ts";

const subs = mockSubs();
import {
  formatDate,
  getInactives,
  getMonthlyCost,
  getTranslation,
  getYearlyCost,
  isExpiringThisMonth,
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

Deno.test("isExpiringThisMonth - same month and year only", () => {
  const now = new Date(2026, 8, 25);
  const at = (expiration: Date | string) =>
    isExpiringThisMonth({ ...subs[0], expiration: expiration as Date }, now);
  assertEquals(at(new Date(2026, 8, 1)), true);
  assertEquals(at(new Date(2026, 8, 30)), true);
  assertEquals(at(new Date(2026, 9, 1)), false);
  assertEquals(at(new Date(2025, 8, 25)), false);
  // Dates read back from localStorage are strings
  assertEquals(at(JSON.parse(JSON.stringify(new Date(2026, 8, 10, 12)))), true);
});
