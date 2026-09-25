import { assertEquals } from "@std/assert";

import {
  createStyler,
  mix,
  palettes,
  supportsTrueColor,
  to256,
} from "./palette.ts";

Deno.test("palettes - both themes have the same colours", () => {
  const keys = (value: object) => Object.keys(value).sort();
  assertEquals(keys(palettes.light), keys(palettes.dark));
  assertEquals(keys(palettes.light.illo), keys(palettes.dark.illo));
  assertEquals(palettes.light.tints.length, 6);
});

Deno.test("to256 - nearest xterm colour", () => {
  assertEquals(to256("#000000"), 16);
  assertEquals(to256("#ffffff"), 231);
  assertEquals(to256("#ff0000"), 196);
  // Greys use the grey ramp
  assertEquals(to256("#808080"), 244);
});

Deno.test("mix - like color-mix in srgb", () => {
  assertEquals(mix("#000000", "#ffffff", 0.5), "#808080");
  assertEquals(mix("#cbbcff", "#2a2433", 0), "#cbbcff");
  assertEquals(mix("#cbbcff", "#2a2433", 1), "#2a2433");
});

Deno.test("createStyler - 24-bit or 256 colours", () => {
  const style = { fg: "#ff0000", bg: "#000000", bold: true };
  assertEquals(
    createStyler(true)(style)("x"),
    "\x1b[1;38;2;255;0;0;48;2;0;0;0mx\x1b[0m",
  );
  assertEquals(
    createStyler(false)(style)("x"),
    "\x1b[1;38;5;196;48;5;16mx\x1b[0m",
  );
  assertEquals(createStyler(true)({})("x"), "x");
});

Deno.test("supportsTrueColor - from the environment", () => {
  const env = (values: Record<string, string>) => (name: string) =>
    values[name];
  assertEquals(supportsTrueColor(env({ COLORTERM: "truecolor" })), true);
  assertEquals(supportsTrueColor(env({ TERM_PROGRAM: "iTerm.app" })), true);
  assertEquals(supportsTrueColor(env({ TERM: "xterm-kitty" })), true);
  assertEquals(supportsTrueColor(env({ TERM: "xterm-256color" })), false);
});
