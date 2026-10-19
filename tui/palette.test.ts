import { assert, test } from "vitest";

import {
  createStyler,
  mix,
  palettes,
  supportsTrueColor,
  to256,
} from "./palette.ts";

test("palettes - both themes have the same colours", () => {
  const keys = (value: object) => Object.keys(value).sort();
  assert.deepEqual(keys(palettes.light), keys(palettes.dark));
  assert.deepEqual(keys(palettes.light.illo), keys(palettes.dark.illo));
  assert.deepEqual(palettes.light.tints.length, 6);
});

test("to256 - nearest xterm colour", () => {
  assert.deepEqual(to256("#000000"), 16);
  assert.deepEqual(to256("#ffffff"), 231);
  assert.deepEqual(to256("#ff0000"), 196);
  // Greys use the grey ramp
  assert.deepEqual(to256("#808080"), 244);
});

test("mix - like color-mix in srgb", () => {
  assert.deepEqual(mix("#000000", "#ffffff", 0.5), "#808080");
  assert.deepEqual(mix("#cbbcff", "#2a2433", 0), "#cbbcff");
  assert.deepEqual(mix("#cbbcff", "#2a2433", 1), "#2a2433");
});

test("createStyler - 24-bit or 256 colours", () => {
  const style = { fg: "#ff0000", bg: "#000000", bold: true };
  assert.deepEqual(
    createStyler(true)(style)("x"),
    "\x1b[1;38;2;255;0;0;48;2;0;0;0mx\x1b[0m",
  );
  assert.deepEqual(
    createStyler(false)(style)("x"),
    "\x1b[1;38;5;196;48;5;16mx\x1b[0m",
  );
  assert.deepEqual(createStyler(true)({})("x"), "x");
});

test("supportsTrueColor - from the environment", () => {
  const env = (values: Record<string, string>) => (name: string) =>
    values[name];
  assert.deepEqual(supportsTrueColor(env({ COLORTERM: "truecolor" })), true);
  assert.deepEqual(supportsTrueColor(env({ TERM_PROGRAM: "iTerm.app" })), true);
  assert.deepEqual(supportsTrueColor(env({ TERM: "xterm-kitty" })), true);
  assert.deepEqual(supportsTrueColor(env({ TERM: "xterm-256color" })), false);
});
