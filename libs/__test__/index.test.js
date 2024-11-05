import { expect, test } from "vitest";

import { subs } from "./../mocks";
import {
  getInactives,
  getMonthlyCost,
  getYearlyCost,
  formatDate,
} from "./../index";

test("formatDate", () => {
  const test = new Date("11-21-2022");
  expect(formatDate(test)).toBe("2022-11-21");
});

test("getInactives", () => {
  const inactives = getInactives(subs);
  expect(inactives.length).toBe(1);
  expect(inactives[0].name).toBe("App hosting");
});

test("getMonthlyCost", () => {
  expect(getMonthlyCost(subs)).toBe(14.99);
});

test("getYearlyCost", () => {
  expect(getYearlyCost(subs)).toBe(229.87);
});
