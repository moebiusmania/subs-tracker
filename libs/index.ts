import { format } from "date-fns";
import { Subscription } from "./types";

const formatDate = (value: Date): string => format(value, "yyyy-MM-dd");

const getInactives = (data: Subscription[]): Subscription[] =>
  data.filter((item: Subscription): boolean => !item.isActive);

const getMonthlyCost = (data: Subscription[]): number => {
  const value: string = data
    .filter(
      (item: Subscription): boolean =>
        item.isActive && item.recurrence === "monthly"
    )
    .map((item: Subscription): number => item.price)
    .reduce((a: number, b: number): number => a + b)
    .toFixed(2);
  return parseFloat(value);
};

const getYearlyCost = (data: Subscription[]): number => {
  const value: string = data
    .filter((item: Subscription): boolean => item.isActive)
    .map((item: Subscription): number =>
      item.recurrence === "monthly" ? item.price * 12 : item.price
    )
    .reduce((a: number, b: number): number => a + b)
    .toFixed(2);
  return parseFloat(value);
};

const getTranslation = (key: string, value: any): string => key.replace("{{value}}", value);

export { getInactives, getMonthlyCost, getYearlyCost, formatDate, getTranslation };
