import { assertEquals } from "@std/assert";

import { mockSubs } from "./mocks.ts";

const subs = mockSubs();

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

Deno.test("Expirations are relative to today", () => {
  const months = (now: Date) =>
    mockSubs(now).map(({ expiration }) =>
      (expiration.getFullYear() - now.getFullYear()) * 12 +
      expiration.getMonth() - now.getMonth()
    );
  // One this month, one next month, the others later
  assertEquals(months(new Date(2026, 8, 25)), [0, 5, 2, 1]);
  // Clamped to the end of short months, even on the last day
  assertEquals(months(new Date(2026, 1, 28)), [0, 5, 2, 1]);
  assertEquals(months(new Date(2026, 11, 31)), [0, 5, 2, 1]);
  assertEquals(mockSubs(new Date(2026, 8, 28))[0].expiration.getDate(), 30);
});
