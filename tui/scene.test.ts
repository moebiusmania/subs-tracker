import { assert, test } from "vitest";

import { type Node, Scene } from "./scene.ts";

// Writes go to a list; styles show up as <fg>text</> to keep them readable
const setup = (columns = 6, rows = 2) => {
  const writes: string[] = [];
  const scene = new Scene(
    (text) => writes.push(text),
    (options) => (text) => (options.fg ? `<${options.fg}>${text}</>` : text),
  );
  scene.resize(columns, rows);
  return { scene, writes };
};

const text = (key: string, column: number, row: number, value: string, z = 1) =>
  ({ type: "text", key, column, row, text: value, style: {}, z }) as Node;

test("scene - the first frame clears and draws every cell", () => {
  const { scene, writes } = setup(3, 1);
  scene.render([text("a", 1, 0, "hi")]);
  assert.deepEqual(writes, ["\x1b[0m\x1b[2J\x1b[1;1H hi"]);
});

test("scene - later frames write only the cells that changed", () => {
  const { scene, writes } = setup();
  scene.render([text("a", 0, 0, "abc")]);
  scene.render([text("a", 0, 0, "abd")]);
  assert.deepEqual(writes[1], "\x1b[1;3Hd");
  scene.render([text("a", 0, 0, "abd")]);
  assert.deepEqual(writes.length, 2);
  // Gone: blanked
  scene.render([]);
  assert.deepEqual(writes[2], "\x1b[1;1H   ");
});

test("scene - higher z on top, then list order", () => {
  const { scene, writes } = setup(3, 1);
  scene.render([
    text("top", 0, 0, "T", 2),
    {
      type: "box",
      key: "box",
      rect: { column: 0, row: 0, width: 3, height: 1 },
      style: { fg: "#fff" },
      z: 0,
      filler: "-",
    },
    text("b", 1, 0, "b"),
    text("c", 1, 0, "c"),
  ]);
  assert.deepEqual(writes[0], "\x1b[0m\x1b[2J\x1b[1;1HTc<#fff>-</>");
});

test("scene - wide characters take two cells", () => {
  const { scene, writes } = setup(4, 1);
  scene.render([text("a", 0, 0, "日x")]);
  assert.deepEqual(writes[0], "\x1b[0m\x1b[2J\x1b[1;1H日x ");
  // Covering half of it blanks the other half
  scene.render([text("a", 0, 0, "日x"), text("b", 1, 0, "y")]);
  assert.deepEqual(writes[1], "\x1b[1;1H y");
});

test("scene - a resize draws everything again", () => {
  const { scene, writes } = setup(2, 1);
  scene.render([]);
  scene.resize(3, 1);
  scene.render([]);
  assert.deepEqual(writes[1], "\x1b[0m\x1b[2J\x1b[1;1H   ");
});

test("scene - keys are unique", () => {
  const { scene } = setup();
  assert.throws(
    () => scene.render([text("a", 0, 0, "x"), text("a", 1, 0, "y")]),
    /Duplicate scene key: a/,
  );
});
