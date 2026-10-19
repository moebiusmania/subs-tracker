import { assert, test } from "vitest";

import { bigText } from "./widgets.ts";

test("bigText - three rows per value", () => {
  assert.deepEqual(bigText("1€"), ["╺┓  ┏━╸", " ┃  ╋━╸", "╺┻╸ ┗━╸"]);
  assert.deepEqual(bigText("0.5$")?.length, 3);
});

test("bigText - null without a glyph", () => {
  assert.deepEqual(bigText("12£"), null);
});
