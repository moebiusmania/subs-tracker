import { assertEquals } from "@std/assert";

import { subs } from "./mocks.ts";

Deno.test("Data length", () => {
  assertEquals(subs.length, 4);
});

Deno.test("Data structure", () => {
  const item = subs[0];
  assertEquals(typeof item.name, "string");
  assertEquals(typeof item.price, "number");
  assertEquals(typeof item.currency, "string");
  assertEquals(typeof item.isActive, "boolean");
  assertEquals(typeof item.recurrence, "string");
  assertEquals(typeof item.expiration, "object");
});
