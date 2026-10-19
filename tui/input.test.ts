import { assert, test } from "vitest";

import { decodeBuffer, type InputEvent } from "./input.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const decode = (input: string): InputEvent[] => [
  ...decodeBuffer(encoder.encode(input)),
];

test("decodeBuffer - keys and their modifiers", () => {
  const [up] = decode("\x1b[A");
  assert.deepEqual(up?.key, "up");
  const [ctrlRight] = decode("\x1b[1;5C");
  assert.deepEqual(ctrlRight?.key, "right");
  assert.deepEqual(ctrlRight?.ctrl, true);
  assert.deepEqual(decode("\x1b[3~")[0]?.key, "delete");
  assert.deepEqual(decode("\x1b")[0]?.key, "escape");
  assert.deepEqual(decode("A")[0]?.shift, true);
});

test("decodeBuffer - SGR mouse reports", () => {
  const [press] = decode("\x1b[<0;5;3M");
  assert.deepEqual(press, {
    key: "mouse",
    buffer: press!.buffer,
    x: 4,
    y: 2,
    ctrl: false,
    meta: false,
    shift: false,
    drag: false,
    release: false,
    button: 0,
  });
  const [release] = decode("\x1b[<0;5;3m");
  assert.deepEqual("release" in release! && release.release, true);
  const [wheel] = decode("\x1b[<65;1;1M");
  assert.deepEqual("scroll" in wheel! && wheel.scroll, 1);
});

test("decodeBuffer - one event per escape sequence", () => {
  assert.deepEqual(
    decode("\x1b[A\x1b[B\x1b[<35;2;2M").map((event) => event.key),
    ["up", "down", "mouse"],
  );
});

test("decodeBuffer - splits after non-ASCII text on the right byte", () => {
  const events = decode("\x1b[Aè€\x1b[B");
  assert.deepEqual(decoder.decode(events[0]!.buffer), "\x1b[Aè€");
  assert.deepEqual(events[1]?.key, "down");
});
