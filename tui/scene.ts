// A tiny declarative layer over deno_tui's draw objects: every render
// describes the whole screen as a flat list of boxes and texts, and the
// scene reuses, updates or erases the objects drawn last time by key. deno_tui
// then repaints only the cells that changed.
import {
  BoxObject,
  type Canvas,
  type DrawObject,
  Signal,
  TextObject,
} from "deno_tui/mod.ts";
import type { Rectangle, TextRectangle } from "deno_tui/mod.ts";
import type { StyleOptions } from "./palette.ts";
import { textWidth } from "./text.ts";

export type Rect = Rectangle;

export type BoxNode = {
  type: "box";
  key: string;
  rect: Rect;
  style: StyleOptions;
  z: number;
  filler?: string;
};

export type TextNode = {
  type: "text";
  key: string;
  column: number;
  row: number;
  text: string;
  style: StyleOptions;
  z: number;
};

export type Node = BoxNode | TextNode;

type Style = (text: string) => string;
type Styler = (options: StyleOptions) => Style;

type Entry = {
  node: Node;
  object: BoxObject | TextObject;
  style: Signal<Style>;
  rect: Signal<Rect>;
  text?: Signal<string>;
};

const area = (node: Node): Rect =>
  node.type === "box" ? node.rect : {
    column: node.column,
    row: node.row,
    width: textWidth(node.text),
    height: 1,
  };

const overlap = (a: Rect, b: Rect): Rect | null => {
  const column = Math.max(a.column, b.column);
  const row = Math.max(a.row, b.row);
  const right = Math.min(a.column + a.width, b.column + b.width);
  const bottom = Math.min(a.row + a.height, b.row + b.height);
  return right > column && bottom > row
    ? { column, row, width: right - column, height: bottom - row }
    : null;
};

const sameRect = (a: Rect, b: Rect): boolean =>
  a.column === b.column && a.row === b.row && a.width === b.width &&
  a.height === b.height;

const sameStyle = (a: StyleOptions, b: StyleOptions): boolean =>
  a.fg === b.fg && a.bg === b.bg && !!a.bold === !!b.bold &&
  !!a.italic === !!b.italic && !!a.underline === !!b.underline;

// The canvas keeps objects sorted by zIndex when they're drawn and a box's
// filler is fixed, so those changes need a new object
const reusable = (previous: Node, node: Node): boolean =>
  previous.type === node.type && previous.z === node.z &&
  (previous.type !== "box" || previous.filler === (node as BoxNode).filler);

export class Scene {
  #entries = new Map<string, Entry>();
  #canvas: Canvas;
  #styler: Styler;

  constructor(canvas: Canvas, styler: Styler) {
    this.#canvas = canvas;
    this.#styler = styler;
  }

  render(nodes: Node[]): void {
    const seen = new Set<string>();
    // Areas whose cells may show something else now
    const dirty: Rect[] = [];

    for (const node of nodes) {
      if (seen.has(node.key)) {
        throw new Error(`Duplicate scene key: ${node.key}`);
      }
      seen.add(node.key);

      const entry = this.#entries.get(node.key);
      if (entry && reusable(entry.node, node)) {
        const before = area(entry.node);
        if (this.#update(entry, node)) {
          dirty.push(before);
          if (!sameRect(before, area(node))) dirty.push(area(node));
        }
      } else {
        if (entry) this.#erase(entry);
        this.#entries.set(node.key, this.#create(node));
        dirty.push(area(node));
        if (entry) dirty.push(area(entry.node));
      }
    }

    for (const [key, entry] of this.#entries) {
      if (seen.has(key)) continue;
      this.#erase(entry);
      this.#entries.delete(key);
      dirty.push(area(entry.node));
    }

    this.#repaint(dirty);
  }

  #erase(entry: Entry): void {
    entry.object.erase();
    // Nothing of it may be drawn again
    entry.object.rerenderCells.length = 0;
  }

  // deno_tui works out which cells of an object are covered by others only
  // when that object moves. When something above it moves, shrinks or goes
  // away, the object underneath would keep skipping those cells: make every
  // object in a changed area check again and repaint its part of it.
  #repaint(dirty: Rect[]): void {
    if (!dirty.length) return;
    const { updateObjects } = this.#canvas;
    for (const object of this.#canvas.drawnObjects as Iterable<DrawObject>) {
      const rect = object.rectangle.peek();
      let touched = false;
      for (const area of dirty) {
        const cells = overlap(rect, area);
        if (!cells) continue;
        touched = true;
        for (let row = cells.row; row < cells.row + cells.height; row++) {
          for (
            let column = cells.column;
            column < cells.column + cells.width;
            column++
          ) {
            object.queueRerender(row, column);
          }
        }
      }
      if (touched) {
        object.moved = true;
        object.updated = false;
        updateObjects.push(object);
      }
    }
  }

  #create(node: Node): Entry {
    const canvas = this.#canvas;
    const style = new Signal(this.#styler(node.style));

    if (node.type === "box") {
      const rect = new Signal({ ...node.rect });
      const object = new BoxObject({
        canvas,
        style,
        rectangle: rect,
        zIndex: node.z,
        filler: node.filler,
      });
      object.draw();
      return { node, object, style, rect };
    }

    const rect = new Signal<Rect>({
      column: node.column,
      row: node.row,
      width: 0,
      height: 1,
    });
    const text = new Signal(node.text);
    const object = new TextObject({
      canvas,
      style,
      // TextObject works out the width itself
      rectangle: rect as unknown as Signal<TextRectangle>,
      value: text,
      zIndex: node.z,
      multiCodePointSupport: true,
    });
    object.draw();
    return { node, object, style, rect, text };
  }

  // Returns true when anything changed
  #update(entry: Entry, node: Node): boolean {
    const previous = entry.node;
    entry.node = node;
    let changed = false;

    if (!sameStyle(previous.style, node.style)) {
      entry.style.value = this.#styler(node.style);
      changed = true;
    }

    if (node.type === "box" && previous.type === "box") {
      const { column, row, width, height } = node.rect;
      const last = previous.rect;
      if (
        column !== last.column || row !== last.row || width !== last.width ||
        height !== last.height
      ) {
        entry.rect.value = { ...node.rect };
        changed = true;
      }
      return changed;
    }

    if (node.type === "text" && previous.type === "text") {
      if (node.text !== previous.text) {
        entry.text!.value = node.text;
        changed = true;
      }
      if (node.column !== previous.column || node.row !== previous.row) {
        entry.rect.value = {
          column: node.column,
          row: node.row,
          width: 0,
          height: 1,
        };
        changed = true;
      }
    }
    return changed;
  }
}
