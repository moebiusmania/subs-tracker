import { assert, test } from "vitest";

import {
  center,
  padEnd,
  parseStrong,
  textWidth,
  truncate,
  wrap,
  wrapSpans,
} from "./text.ts";

test("truncate - keeps text that fits", () => {
  assert.deepEqual(truncate("Netflix", 7), "Netflix");
  assert.deepEqual(truncate("Netflix", 20), "Netflix");
});

test("truncate - cuts with an ellipsis", () => {
  assert.deepEqual(truncate("Movies streaming", 8), "Movies …");
  assert.deepEqual(truncate("Netflix", 1), "…");
  assert.deepEqual(truncate("Netflix", 0), "");
});

test("truncate - counts wide characters as two cells", () => {
  assert.deepEqual(textWidth("日本"), 4);
  assert.deepEqual(truncate("日本語", 5), "日本…");
});

test("padEnd and center fill up to the width", () => {
  assert.deepEqual(padEnd("ab", 4), "ab  ");
  assert.deepEqual(center("ab", 6), "  ab  ");
  assert.deepEqual(center("ab", 5), " ab  ");
  assert.deepEqual(center("toolong", 3), "toolong");
});

test("parseStrong - splits the add.intro markup", () => {
  assert.deepEqual(
    parseStrong("will be <strong>stored locally</strong>. Done"),
    [
      { text: "will be " },
      { text: "stored locally", bold: true },
      { text: ". Done" },
    ],
  );
  assert.deepEqual(parseStrong("<em>plain</em>"), [{ text: "plain" }]);
});

test("wrap - breaks on spaces", () => {
  assert.deepEqual(wrap("one two three four", 9), ["one two", "three", "four"]);
  assert.deepEqual(wrap("short", 20), ["short"]);
  assert.deepEqual(wrap("", 10), [""]);
});

test("wrap - splits words longer than a line", () => {
  assert.deepEqual(wrap("abcdefghij kl", 4), ["abcd", "efgh", "ij", "kl"]);
});

test("wrapSpans - keeps styles across lines", () => {
  const lines = wrapSpans(parseStrong("a <strong>bold word</strong> end"), 6);
  assert.deepEqual(lines, [
    [{ text: "a " }, { text: "bold", bold: true }],
    [{ text: "word", bold: true }],
    [{ text: "end" }],
  ]);
});
