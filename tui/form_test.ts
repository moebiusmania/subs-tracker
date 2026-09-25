import { assertEquals } from "@std/assert";

import {
  backspace,
  deleteForward,
  field,
  type FormValues,
  initialValues,
  insert,
  isSubscriptionList,
  moveCursor,
  parseDate,
  parsePrice,
  stepDate,
  stepPrice,
  toSubscription,
  validate,
} from "./form.ts";
import { subs } from "../src/js/lib/mocks.ts";

Deno.test("field - typing inserts at the cursor", () => {
  let f = field("Netlix");
  f = moveCursor(moveCursor(moveCursor(f, "left"), "left"), "left");
  f = insert(f, "f");
  assertEquals(f, { value: "Netflix", cursor: 4 });
});

Deno.test("field - control characters are dropped", () => {
  assertEquals(insert(field(), "a\tb\x1b[A"), { value: "ab[A", cursor: 4 });
});

Deno.test("field - backspace and delete remove whole graphemes", () => {
  const emoji = field("a👍🏽b");
  assertEquals(backspace(moveCursor(emoji, "left")).value, "ab");
  assertEquals(
    deleteForward(moveCursor(moveCursor(emoji, "home"), "right")).value,
    "ab",
  );
  assertEquals(backspace(field()), field());
  assertEquals(deleteForward(field("x")), field("x"));
});

Deno.test("field - home, end and bounds", () => {
  const f = field("abc");
  assertEquals(moveCursor(f, "home").cursor, 0);
  assertEquals(moveCursor(moveCursor(f, "home"), "end").cursor, 3);
  assertEquals(moveCursor(f, "right").cursor, 3);
  assertEquals(moveCursor(moveCursor(f, "home"), "left").cursor, 0);
});

Deno.test("parseDate - only real calendar dates", () => {
  const date = parseDate("2027-01-15")!;
  assertEquals(
    [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()],
    [2027, 0, 15, 0],
  );
  assertEquals(parseDate("2027-02-30"), null);
  assertEquals(parseDate("15/01/2027"), null);
  assertEquals(parseDate(""), null);
});

Deno.test("parsePrice - accepts a decimal comma", () => {
  assertEquals(parsePrice("12.5"), 12.5);
  assertEquals(parsePrice("12,5"), 12.5);
  assertEquals(parsePrice(".5"), 0.5);
  assertEquals(parsePrice("12a"), null);
  assertEquals(parsePrice("-3"), null);
});

const values = (overrides: Partial<Record<string, string>> = {}) => ({
  name: field(overrides.name ?? "Netflix"),
  price: field(overrides.price ?? "12.5"),
  expiration: field(overrides.expiration ?? "2027-01-15"),
  recurrence: "monthly",
  isActive: true,
} as FormValues);

Deno.test("validate - a complete form has no errors", () => {
  assertEquals(validate(values()), {});
});

Deno.test("validate - required fields, price and date", () => {
  assertEquals(validate(values({ name: "  ", price: "", expiration: "" })), {
    name: "required",
    price: "required",
    expiration: "required",
  });
  assertEquals(validate(values({ price: "0.05" })), { price: "invalidPrice" });
  assertEquals(validate(values({ price: "abc" })), { price: "invalidPrice" });
  assertEquals(validate(values({ expiration: "2027-13-01" })), {
    expiration: "invalidDate",
  });
});

Deno.test("toSubscription - builds the item the store saves", () => {
  const item = toSubscription(
    values({ name: " Netflix ", price: "9,99" }),
    "€",
  );
  assertEquals(item.name, "Netflix");
  assertEquals(item.price, 9.99);
  assertEquals(item.currency, "€");
  assertEquals(item.isActive, true);
  assertEquals(item.recurrence, "monthly");
  assertEquals(item.expiration.getDate(), 15);
});

Deno.test("initialValues - starts from the web form defaults", () => {
  const form = initialValues(subs[1]);
  assertEquals(form.name.value, "Music streaming");
  assertEquals(form.price.value, "49.99");
  assertEquals(form.recurrence, "yearly");
  assertEquals(form.expiration.value.length, 10);
});

Deno.test("stepPrice - steps by 0.1, never under the minimum", () => {
  assertEquals(stepPrice("9.99", 1), "10.09");
  assertEquals(stepPrice("1", -1), "0.9");
  assertEquals(stepPrice("0.1", -1), "0.1");
  assertEquals(stepPrice("", 1), "0.1");
});

Deno.test("stepDate - days, months and month ends", () => {
  assertEquals(stepDate("2026-12-31", 1), "2027-01-01");
  assertEquals(stepDate("2026-03-01", -1), "2026-02-28");
  assertEquals(stepDate("2026-01-31", 0, 1), "2026-02-28");
  assertEquals(stepDate("2026-05-15", 0, -1), "2026-04-15");
  assertEquals(stepDate("nope", 1, 0, new Date(2026, 8, 25)), "2026-09-25");
});

Deno.test("isSubscriptionList - what the web app exports", () => {
  const exported = JSON.parse(JSON.stringify(subs));
  assertEquals(isSubscriptionList(exported), true);
  assertEquals(isSubscriptionList([]), true);
  assertEquals(isSubscriptionList({ data: exported }), false);
  assertEquals(isSubscriptionList([{ ...exported[0], price: "9" }]), false);
  assertEquals(
    isSubscriptionList([{ ...exported[0], recurrence: "weekly" }]),
    false,
  );
  assertEquals(
    isSubscriptionList([{ ...exported[0], expiration: "someday" }]),
    false,
  );
});
