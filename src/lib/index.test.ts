import { assert, test } from "vitest";

import { mockSubs } from "./mocks.ts";

const subs = mockSubs();
import {
  addMonths,
  formatDate,
  formatPrice,
  getInactives,
  getMonthlyCost,
  getTranslation,
  getYearlyCost,
  isExpiringThisMonth,
  parsePrice,
} from "./index.ts";

test("formatDate", () => {
  const test = new Date(2022, 10, 21);
  assert.deepEqual(formatDate(test), "2022-11-21");
});

test("getInactives", () => {
  const inactives = getInactives(subs);
  assert.deepEqual(inactives.length, 1);
  assert.deepEqual(inactives[0].name, "App hosting");
});

test("getMonthlyCost", () => {
  assert.deepEqual(getMonthlyCost(subs), 14.99);
});

test("getYearlyCost", () => {
  assert.deepEqual(getYearlyCost(subs), 229.87);
});

test("getTranslation", () => {
  assert.deepEqual(
    getTranslation("with {{value}} inactive", 2),
    "with 2 inactive",
  );
});

test("getMonthlyCost - no active monthly subscriptions", () => {
  const yearly = subs.filter((item) => item.recurrence === "yearly");
  assert.deepEqual(getMonthlyCost(yearly), 0);
  assert.deepEqual(getYearlyCost(yearly), 49.99);
});

test("costs - empty list", () => {
  assert.deepEqual(getMonthlyCost([]), 0);
  assert.deepEqual(getYearlyCost([]), 0);
});

test("formatDate - pads single digit months and days", () => {
  assert.deepEqual(formatDate(new Date(2023, 0, 5)), "2023-01-05");
});

test("getInactives - empty when everything is active", () => {
  assert.deepEqual(
    getInactives(subs.filter((item) => item.isActive)).length,
    0,
  );
});

test("getYearlyCost - ignores inactive subscriptions", () => {
  const onlyInactive = subs.filter((item) => !item.isActive);
  assert.deepEqual(getYearlyCost(onlyInactive), 0);
});

test("costs - rounded to two decimals", () => {
  const items = [0.1, 0.2].map((price) => ({ ...subs[0], price }));
  assert.deepEqual(getMonthlyCost(items), 0.3);
  assert.deepEqual(getYearlyCost(items), 3.6);
});

test("isExpiringThisMonth - same month and year only", () => {
  const now = new Date(2026, 8, 25);
  const at = (expiration: Date | string) =>
    isExpiringThisMonth({ ...subs[0], expiration: expiration as Date }, now);
  assert.deepEqual(at(new Date(2026, 8, 1)), true);
  assert.deepEqual(at(new Date(2026, 8, 30)), true);
  assert.deepEqual(at(new Date(2026, 9, 1)), false);
  assert.deepEqual(at(new Date(2025, 8, 25)), false);
  // Dates read back from localStorage are strings
  assert.deepEqual(
    at(JSON.parse(JSON.stringify(new Date(2026, 8, 10, 12)))),
    true,
  );
});

test("addMonths - same day, last day of shorter months", () => {
  assert.deepEqual(
    formatDate(addMonths(new Date(2026, 9, 10), 1)),
    "2026-11-10",
  );
  assert.deepEqual(
    formatDate(addMonths(new Date(2026, 0, 31), 1)),
    "2026-02-28",
  );
  assert.deepEqual(
    formatDate(addMonths(new Date(2026, 11, 15), 1)),
    "2027-01-15",
  );
  assert.deepEqual(
    formatDate(addMonths(new Date(2026, 2, 31), -1)),
    "2026-02-28",
  );
});

test("parsePrice - accepts a decimal comma", () => {
  assert.deepEqual(parsePrice("12.5"), 12.5);
  assert.deepEqual(parsePrice("12,5"), 12.5);
  assert.deepEqual(parsePrice(".5"), 0.5);
  assert.deepEqual(parsePrice("12a"), null);
  assert.deepEqual(parsePrice("-3"), null);
  assert.deepEqual(parsePrice("1.234"), null);
});

test("formatPrice - shows a decimal comma", () => {
  assert.deepEqual(formatPrice(9.99, "€"), "9,99€");
  assert.deepEqual(formatPrice(5, "€"), "5€");
  assert.deepEqual(formatPrice(0.5), "0,5");
});
