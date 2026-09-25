import { assertEquals } from "@std/assert";

import {
  center,
  padEnd,
  parseStrong,
  textWidth,
  truncate,
  wrap,
  wrapSpans,
} from "./text.ts";

Deno.test("truncate - keeps text that fits", () => {
  assertEquals(truncate("Netflix", 7), "Netflix");
  assertEquals(truncate("Netflix", 20), "Netflix");
});

Deno.test("truncate - cuts with an ellipsis", () => {
  assertEquals(truncate("Movies streaming", 8), "Movies …");
  assertEquals(truncate("Netflix", 1), "…");
  assertEquals(truncate("Netflix", 0), "");
});

Deno.test("truncate - counts wide characters as two cells", () => {
  assertEquals(textWidth("日本"), 4);
  assertEquals(truncate("日本語", 5), "日本…");
});

Deno.test("padEnd and center fill up to the width", () => {
  assertEquals(padEnd("ab", 4), "ab  ");
  assertEquals(center("ab", 6), "  ab  ");
  assertEquals(center("ab", 5), " ab  ");
  assertEquals(center("toolong", 3), "toolong");
});

Deno.test("parseStrong - splits the add.intro markup", () => {
  assertEquals(parseStrong("will be <strong>stored locally</strong>. Done"), [
    { text: "will be " },
    { text: "stored locally", bold: true },
    { text: ". Done" },
  ]);
  assertEquals(parseStrong("<em>plain</em>"), [{ text: "plain" }]);
});

Deno.test("wrap - breaks on spaces", () => {
  assertEquals(wrap("one two three four", 9), ["one two", "three", "four"]);
  assertEquals(wrap("short", 20), ["short"]);
  assertEquals(wrap("", 10), [""]);
});

Deno.test("wrap - splits words longer than a line", () => {
  assertEquals(wrap("abcdefghij kl", 4), ["abcd", "efgh", "ij", "kl"]);
});

Deno.test("wrapSpans - keeps styles across lines", () => {
  const lines = wrapSpans(parseStrong("a <strong>bold word</strong> end"), 6);
  assertEquals(lines, [
    [{ text: "a " }, { text: "bold", bold: true }],
    [{ text: "word", bold: true }],
    [{ text: "end" }],
  ]);
});
