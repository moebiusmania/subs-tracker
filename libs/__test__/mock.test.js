import { expect, test } from "vitest";

import { subs } from "./../mocks";

test("Data length", () => {
  expect(subs.length).toBe(4);
});

test("Data structure", () => {
  const item = subs[0];
  expect(typeof item.name).toBe("string");
  expect(typeof item.price).toBe("number");
  expect(typeof item.currency).toBe("string");
  expect(typeof item.isActive).toBe("boolean");
  expect(typeof item.recurrence).toBe("string");
  expect(typeof item.expiration).toBe("object");
});
