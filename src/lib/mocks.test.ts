import { assert, test } from "vitest";

import { mockSubs } from "./mocks.ts";

const subs = mockSubs();

test("Data length", () => {
  assert.deepEqual(subs.length, 4);
});

test("Data structure", () => {
  const item = subs[0];
  assert.deepEqual(typeof item.name, "string");
  assert.deepEqual(typeof item.price, "number");
  assert.deepEqual(typeof item.currency, "string");
  assert.deepEqual(typeof item.isActive, "boolean");
  assert.deepEqual(typeof item.recurrence, "string");
  assert.deepEqual(typeof item.expiration, "object");
});

test("Expirations are relative to today", () => {
  const months = (now: Date) =>
    mockSubs(now).map(
      ({ expiration }) =>
        (expiration.getFullYear() - now.getFullYear()) * 12 +
        expiration.getMonth() -
        now.getMonth(),
    );
  // One this month, one next month, the others later
  assert.deepEqual(months(new Date(2026, 8, 25)), [0, 5, 2, 1]);
  // Clamped to the end of short months, even on the last day
  assert.deepEqual(months(new Date(2026, 1, 28)), [0, 5, 2, 1]);
  assert.deepEqual(months(new Date(2026, 11, 31)), [0, 5, 2, 1]);
  assert.deepEqual(mockSubs(new Date(2026, 8, 28))[0].expiration.getDate(), 30);
});
