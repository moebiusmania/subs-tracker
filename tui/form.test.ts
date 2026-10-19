import { assert, test } from "vitest";

import {
  backspace,
  deleteForward,
  field,
  type FormValues,
  initialValues,
  insert,
  moveCursor,
  parseDate,
  stepDate,
  stepPrice,
  toSubscription,
  validate,
} from "./form.ts";
import { mockSubs } from "../src/lib/mocks.ts";

const subs = mockSubs();

test("field - typing inserts at the cursor", () => {
  let f = field("Netlix");
  f = moveCursor(moveCursor(moveCursor(f, "left"), "left"), "left");
  f = insert(f, "f");
  assert.deepEqual(f, { value: "Netflix", cursor: 4 });
});

test("field - control characters are dropped", () => {
  assert.deepEqual(insert(field(), "a\tb\x1b[A"), { value: "ab[A", cursor: 4 });
});

test("field - backspace and delete remove whole graphemes", () => {
  const emoji = field("a👍🏽b");
  assert.deepEqual(backspace(moveCursor(emoji, "left")).value, "ab");
  assert.deepEqual(
    deleteForward(moveCursor(moveCursor(emoji, "home"), "right")).value,
    "ab",
  );
  assert.deepEqual(backspace(field()), field());
  assert.deepEqual(deleteForward(field("x")), field("x"));
});

test("field - home, end and bounds", () => {
  const f = field("abc");
  assert.deepEqual(moveCursor(f, "home").cursor, 0);
  assert.deepEqual(moveCursor(moveCursor(f, "home"), "end").cursor, 3);
  assert.deepEqual(moveCursor(f, "right").cursor, 3);
  assert.deepEqual(moveCursor(moveCursor(f, "home"), "left").cursor, 0);
});

test("parseDate - only real calendar dates", () => {
  const date = parseDate("2027-01-15")!;
  assert.deepEqual(
    [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()],
    [2027, 0, 15, 0],
  );
  assert.deepEqual(parseDate("2027-02-30"), null);
  assert.deepEqual(parseDate("15/01/2027"), null);
  assert.deepEqual(parseDate(""), null);
});

const values = (overrides: Partial<Record<string, string>> = {}) =>
  ({
    name: field(overrides.name ?? "Netflix"),
    price: field(overrides.price ?? "12.5"),
    expiration: field(overrides.expiration ?? "2027-01-15"),
    recurrence: "monthly",
    isActive: true,
  }) as FormValues;

test("validate - a complete form has no errors", () => {
  assert.deepEqual(validate(values()), {});
});

test("validate - required fields, price and date", () => {
  assert.deepEqual(
    validate(values({ name: "  ", price: "", expiration: "" })),
    {
      name: "required",
      price: "required",
      expiration: "required",
    },
  );
  assert.deepEqual(validate(values({ price: "0.00" })), {});
  assert.deepEqual(validate(values({ price: "0,05" })), {});
  assert.deepEqual(validate(values({ price: "0.001" })), {
    price: "invalidPrice",
  });
  assert.deepEqual(validate(values({ price: "-1" })), {
    price: "invalidPrice",
  });
  assert.deepEqual(validate(values({ price: "abc" })), {
    price: "invalidPrice",
  });
  assert.deepEqual(validate(values({ expiration: "2027-13-01" })), {
    expiration: "invalidDate",
  });
});

test("toSubscription - builds the item the store saves", () => {
  const item = toSubscription(
    values({ name: " Netflix ", price: "9,99" }),
    "€",
  );
  assert.deepEqual(item.name, "Netflix");
  assert.deepEqual(item.price, 9.99);
  assert.deepEqual(item.currency, "€");
  assert.deepEqual(item.isActive, true);
  assert.deepEqual(item.recurrence, "monthly");
  assert.deepEqual(item.expiration.getDate(), 15);
});

test("initialValues - starts from the web form defaults", () => {
  const form = initialValues(subs[1]);
  assert.deepEqual(form.name.value, "Music streaming");
  assert.deepEqual(form.price.value, "49,99");
  assert.deepEqual(form.recurrence, "yearly");
  assert.deepEqual(form.expiration.value.length, 10);
});

test("stepPrice - steps by 0.1, never under the minimum", () => {
  assert.deepEqual(stepPrice("9.99", 1), "10,09");
  assert.deepEqual(stepPrice("9,99", -1), "9,89");
  assert.deepEqual(stepPrice("1", -1), "0,9");
  assert.deepEqual(stepPrice("0.1", -1), "0");
  assert.deepEqual(stepPrice("0.05", -1), "0");
  assert.deepEqual(stepPrice("", 1), "0,1");
});

test("stepDate - days, months and month ends", () => {
  assert.deepEqual(stepDate("2026-12-31", 1), "2027-01-01");
  assert.deepEqual(stepDate("2026-03-01", -1), "2026-02-28");
  assert.deepEqual(stepDate("2026-01-31", 0, 1), "2026-02-28");
  assert.deepEqual(stepDate("2026-05-15", 0, -1), "2026-04-15");
  assert.deepEqual(stepDate("nope", 1, 0, new Date(2026, 8, 25)), "2026-09-25");
});
