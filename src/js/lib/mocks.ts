import type { Subscription } from "./types.ts";

// A day `months` after `now`'s month, clamped to that month's length, at
// noon so time zones never move it to another day
const inMonths = (now: Date, months: number, day: number): Date => {
  const year = now.getFullYear();
  const month = now.getMonth() + months;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay), 12);
};

// Example data with expirations relative to `now`: one later this month,
// one next month and the others further ahead
export const mockSubs = (now: Date = new Date()): Subscription[] => [
  {
    name: "Movies streaming",
    price: 9.99,
    currency: "€",
    isActive: true,
    recurrence: "monthly",
    expiration: inMonths(now, 0, now.getDate() + 5),
  },
  {
    name: "Music streaming",
    price: 49.99,
    currency: "€",
    isActive: true,
    recurrence: "yearly",
    expiration: inMonths(now, 5, 23),
  },
  {
    name: "App hosting",
    price: 5,
    currency: "$",
    isActive: false,
    recurrence: "monthly",
    expiration: inMonths(now, 2, 12),
  },
  {
    name: "Gaming bundles",
    price: 5,
    currency: "€",
    isActive: true,
    recurrence: "monthly",
    expiration: inMonths(now, 1, 18),
  },
];
