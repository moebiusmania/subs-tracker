import type { Subscription } from "./types.ts";

const pad = (value: number): string => value.toString().padStart(2, "0");

const formatDate = (value: Date): string =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

const getInactives = (data: Subscription[]): Subscription[] =>
  data.filter((item: Subscription): boolean => !item.isActive);

const getMonthlyCost = (data: Subscription[]): number => {
  const value: string = data
    .filter(
      (item: Subscription): boolean =>
        item.isActive && item.recurrence === "monthly",
    )
    .map((item: Subscription): number => item.price)
    .reduce((a: number, b: number): number => a + b, 0)
    .toFixed(2);
  return parseFloat(value);
};

const getYearlyCost = (data: Subscription[]): number => {
  const value: string = data
    .filter((item: Subscription): boolean => item.isActive)
    .map((item: Subscription): number =>
      item.recurrence === "monthly" ? item.price * 12 : item.price
    )
    .reduce((a: number, b: number): number => a + b, 0)
    .toFixed(2);
  return parseFloat(value);
};

// deno-lint-ignore no-explicit-any
const getTranslation = (key: string, value: any): string =>
  key.replace("{{value}}", value);

export {
  formatDate,
  getInactives,
  getMonthlyCost,
  getTranslation,
  getYearlyCost,
};
