// Text editing and the add form's rules, kept free of any terminal code so
// they can be unit tested.
import type { I18n, Subscription } from "../src/js/lib/types.ts";
import { formatDate } from "../src/js/lib/index.ts";

// A one-line text input: its value and the cursor position (in UTF-16 units,
// always on a grapheme boundary)
export type Field = { value: string; cursor: number };

export const field = (value = ""): Field => ({ value, cursor: value.length });

const segmenter = new Intl.Segmenter();

const boundaries = (value: string): number[] => [
  ...[...segmenter.segment(value)].map(({ index }) => index),
  value.length,
];

// Control characters never reach a field (escape sequences, tabs, newlines)
// deno-lint-ignore no-control-regex
const CONTROL = /[\x00-\x1f\x7f]/g;
const printable = (text: string): string => text.replace(CONTROL, "");

export const insert = (f: Field, text: string): Field => {
  const clean = printable(text);
  return {
    value: f.value.slice(0, f.cursor) + clean + f.value.slice(f.cursor),
    cursor: f.cursor + clean.length,
  };
};

export const backspace = (f: Field): Field => {
  const previous = boundaries(f.value).filter((index) => index < f.cursor)
    .pop();
  if (previous === undefined) return f;
  return {
    value: f.value.slice(0, previous) + f.value.slice(f.cursor),
    cursor: previous,
  };
};

export const deleteForward = (f: Field): Field => {
  const next = boundaries(f.value).find((index) => index > f.cursor);
  if (next === undefined) return f;
  return {
    value: f.value.slice(0, f.cursor) + f.value.slice(next),
    cursor: f.cursor,
  };
};

export const moveCursor = (
  f: Field,
  to: "left" | "right" | "home" | "end",
): Field => {
  const all = boundaries(f.value);
  switch (to) {
    case "left":
      return { ...f, cursor: all.filter((i) => i < f.cursor).pop() ?? 0 };
    case "right":
      return {
        ...f,
        cursor: all.find((i) => i > f.cursor) ?? f.value.length,
      };
    case "home":
      return { ...f, cursor: 0 };
    case "end":
      return { ...f, cursor: f.value.length };
  }
};

// Everything the add form holds, as typed
export type FormValues = {
  name: Field;
  price: Field;
  expiration: Field;
  recurrence: Subscription["recurrence"];
  isActive: boolean;
};

export type FieldName = "name" | "price" | "expiration";

// Keys of i18n.tui with the message for each invalid field
export type Errors = Partial<Record<FieldName, keyof I18n["tui"]>>;

// Same defaults as the web form (components.addForm)
export const initialValues = (item: Subscription): FormValues => ({
  name: field(item.name),
  price: field(item.price.toString()),
  expiration: field(formatDate(new Date(item.expiration))),
  recurrence: item.recurrence,
  isActive: item.isActive,
});

// "2026-09-25" as local midnight, like formatDate() prints it back.
// null unless it's a real calendar date.
export const parseDate = (value: string): Date | null => {
  const match = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 &&
      date.getDate() === day
    ? date
    : null;
};

// Accepts a comma as decimal separator too, as typed with an Italian keyboard
export const parsePrice = (value: string): number | null => {
  const clean = value.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(clean)) return null;
  return parseFloat(clean);
};

// The web form's price input has min="0.1"
export const MIN_PRICE = 0.1;

export const validate = (values: FormValues): Errors => {
  const errors: Errors = {};
  if (!values.name.value.trim()) errors.name = "required";

  const price = parsePrice(values.price.value);
  if (!values.price.value.trim()) errors.price = "required";
  else if (price === null || price < MIN_PRICE) errors.price = "invalidPrice";

  if (!values.expiration.value.trim()) errors.expiration = "required";
  else if (!parseDate(values.expiration.value)) {
    errors.expiration = "invalidDate";
  }
  return errors;
};

export const toSubscription = (
  values: FormValues,
  currency: string,
): Subscription => ({
  name: values.name.value.trim(),
  price: parsePrice(values.price.value)!,
  currency,
  isActive: values.isActive,
  expiration: parseDate(values.expiration.value)!,
  recurrence: values.recurrence,
});

// Up/down on the price, by the web input's step="0.1"
export const stepPrice = (value: string, direction: 1 | -1): string => {
  const price = parsePrice(value) ?? 0;
  const next = Math.max(MIN_PRICE, price + direction * 0.1);
  return parseFloat(next.toFixed(2)).toString();
};

// Up/down on the date, by one day (by a month with PageUp/PageDown).
// An unreadable date starts again from today.
export const stepDate = (
  value: string,
  days: number,
  months = 0,
  today = new Date(),
): string => {
  const date = parseDate(value);
  if (!date) return formatDate(today);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  // Stay on the last day for shorter months (Jan 31 + 1 month = Feb 28)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    .getDate();
  date.setDate(Math.min(day, lastDay) + days);
  return formatDate(date);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// What the web app exports: an array of subscriptions with string dates
export const isSubscriptionList = (value: unknown): value is Subscription[] =>
  Array.isArray(value) &&
  value.every((item) =>
    isRecord(item) &&
    typeof item.name === "string" &&
    typeof item.price === "number" &&
    typeof item.currency === "string" &&
    typeof item.isActive === "boolean" &&
    (item.recurrence === "monthly" || item.recurrence === "yearly") &&
    (typeof item.expiration === "string" ||
      typeof item.expiration === "number") &&
    !isNaN(new Date(item.expiration).getTime())
  );
