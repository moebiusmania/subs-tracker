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
