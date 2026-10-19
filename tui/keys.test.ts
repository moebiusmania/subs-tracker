import { assert, test } from "vitest";

import { decodeBuffer, type KeyPressEvent } from "./input.ts";
import { toKeys } from "./keys.ts";

const encoder = new TextEncoder();

// What the app gets for one read from stdin
const read = (input: string) =>
  [...decodeBuffer(encoder.encode(input))]
    .flatMap((event) => toKeys({ ...event } as KeyPressEvent))
    .map(({ key, typed, ctrl, shift }) => ({ key, typed, ctrl, shift }));

test("toKeys - a printable key is typed", () => {
  assert.deepEqual(read("a"), [
    {
      key: "a",
      typed: "a",
      ctrl: false,
      shift: false,
    },
  ]);
  assert.deepEqual(read(" "), [
    {
      key: "space",
      typed: " ",
      ctrl: false,
      shift: false,
    },
  ]);
  assert.deepEqual(read("è")[0].typed, "è");
});

test("toKeys - control and named keys type nothing", () => {
  assert.deepEqual(read("\r")[0].key, "return");
  assert.deepEqual(read("\r")[0].typed, "");
  assert.deepEqual(read("\x03"), [
    {
      key: "c",
      typed: "",
      ctrl: true,
      shift: false,
    },
  ]);
  assert.deepEqual(read("\x1b[A")[0], {
    key: "up",
    typed: "",
    ctrl: false,
    shift: false,
  });
});

test("toKeys - variants the decoder doesn't name", () => {
  assert.deepEqual(read("\x1b[Z")[0].key, "tab");
  assert.deepEqual(read("\x1b[Z")[0].shift, true);
  assert.deepEqual(read("\x1bOB")[0].key, "down");
  assert.deepEqual(read("\x1b[1~")[0].key, "home");
});

test("toKeys - a paste is typed at once", () => {
  assert.deepEqual(
    read("Prime Video").map((key) => key.typed),
    ["Prime Video"],
  );
});

test("toKeys - several keys in one read are split", () => {
  assert.deepEqual(
    read("\x7f\x7f2.5\r").map(({ key, typed }) => [key, typed]),
    [
      ["backspace", ""],
      ["backspace", ""],
      ["2", "2.5"],
      ["return", ""],
    ],
  );
});
