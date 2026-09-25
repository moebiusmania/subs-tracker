import { assertEquals } from "@std/assert";

import { bigText } from "./widgets.ts";

Deno.test("bigText - three rows per value", () => {
  assertEquals(bigText("1€"), ["╺┓  ┏━╸", " ┃  ╋━╸", "╺┻╸ ┗━╸"]);
  assertEquals(bigText("0.5$")?.length, 3);
});

Deno.test("bigText - null without a glyph", () => {
  assertEquals(bigText("12£"), null);
});
