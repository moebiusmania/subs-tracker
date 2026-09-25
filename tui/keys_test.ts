import { assertEquals } from "@std/assert";

import { decodeBuffer } from "deno_tui/mod.ts";
import type { KeyPressEvent } from "deno_tui/src/input_reader/types.ts";
import { toKeys } from "./keys.ts";

const encoder = new TextEncoder();

// What the app gets for one read from stdin
const read = (input: string) =>
  [...decodeBuffer(encoder.encode(input))]
    .flatMap((event) => toKeys({ ...event } as KeyPressEvent))
    .map(({ key, typed, ctrl, shift }) => ({ key, typed, ctrl, shift }));

Deno.test("toKeys - a printable key is typed", () => {
  assertEquals(read("a"), [{
    key: "a",
    typed: "a",
    ctrl: false,
    shift: false,
  }]);
  assertEquals(read(" "), [{
    key: "space",
    typed: " ",
    ctrl: false,
    shift: false,
  }]);
  assertEquals(read("è")[0].typed, "è");
});

Deno.test("toKeys - control and named keys type nothing", () => {
  assertEquals(read("\r")[0].key, "return");
  assertEquals(read("\r")[0].typed, "");
  assertEquals(read("\x03"), [{
    key: "c",
    typed: "",
    ctrl: true,
    shift: false,
  }]);
  assertEquals(read("\x1b[A")[0], {
    key: "up",
    typed: "",
    ctrl: false,
    shift: false,
  });
});

Deno.test("toKeys - variants deno_tui doesn't name", () => {
  assertEquals(read("\x1b[Z")[0].key, "tab");
  assertEquals(read("\x1b[Z")[0].shift, true);
  assertEquals(read("\x1bOB")[0].key, "down");
  assertEquals(read("\x1b[1~")[0].key, "home");
});

Deno.test("toKeys - a paste is typed at once", () => {
  assertEquals(read("Prime Video").map((key) => key.typed), ["Prime Video"]);
});

Deno.test("toKeys - several keys in one read are split", () => {
  assertEquals(
    read("\x7f\x7f2.5\r").map(({ key, typed }) => [key, typed]),
    [["backspace", ""], ["backspace", ""], ["2", "2.5"], ["return", ""]],
  );
});
