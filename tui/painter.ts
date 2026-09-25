// Collects what a render draws (scene nodes) and where the user can click,
// scroll or focus (hit regions). A Painter draws in its own coordinates,
// shifted by an offset and cut to a clip rectangle, so the scrolling page and
// the fixed header, status bar and dialogs are all drawn the same way.
import type { KeyPressEvent } from "deno_tui/src/input_reader/types.ts";
import type { Node, Rect } from "./scene.ts";
import type { StyleOptions } from "./palette.ts";
import { textWidth } from "./text.ts";

export type Key = KeyPressEvent & {
  // What was typed, for text fields (a paste arrives as one string)
  typed: string;
};

export type Hit = {
  id: string;
  rect: Rect;
  // Reachable with Tab and the arrow keys
  focusable?: boolean;
  // Text entry: printable keys go to onKey instead of the shortcuts
  input?: boolean;
  // Click position relative to the rect
  onClick?: (x: number, y: number) => void;
  onWheel?: (direction: 1 | -1) => void;
  // Keys while focused, return true when handled
  onKey?: (key: Key) => boolean;
};

export type PlacedHit = Hit & {
  // Visible part on screen, null when scrolled away
  screen: Rect | null;
  // Where it would be on screen without the clip, to scroll it into view
  unclipped: Rect;
  layer: string;
  // The layer's z: higher layers get clicks first
  z: number;
};

type Output = { nodes: Node[]; hits: PlacedHit[] };

const intersect = (a: Rect, b: Rect): Rect | null => {
  const column = Math.max(a.column, b.column);
  const row = Math.max(a.row, b.row);
  const right = Math.min(a.column + a.width, b.column + b.width);
  const bottom = Math.min(a.row + a.height, b.row + b.height);
  return right > column && bottom > row
    ? { column, row, width: right - column, height: bottom - row }
    : null;
};

export const contains = (rect: Rect, x: number, y: number): boolean =>
  x >= rect.column && x < rect.column + rect.width && y >= rect.row &&
  y < rect.row + rect.height;

const segmenter = new Intl.Segmenter();

// The part of a one-line text between two screen columns
const cropText = (
  text: string,
  column: number,
  from: number,
  to: number,
): { text: string; column: number } => {
  let x = column;
  let result = "";
  let start = -1;
  for (const { segment } of segmenter.segment(text)) {
    const width = textWidth(segment);
    if (x >= from && x + width <= to) {
      if (start < 0) start = x;
      result += segment;
    }
    x += width;
  }
  return { text: result, column: start < 0 ? from : start };
};

export class Painter {
  readonly #out: Output;
  readonly layer: string;
  readonly z: number;
  readonly dx: number;
  readonly dy: number;
  readonly clip: Rect;

  constructor(
    options: {
      layer: string;
      z: number;
      clip: Rect;
      dx?: number;
      dy?: number;
    },
    out: Output = { nodes: [], hits: [] },
  ) {
    this.#out = out;
    this.layer = options.layer;
    this.z = options.z;
    this.clip = options.clip;
    this.dx = options.dx ?? 0;
    this.dy = options.dy ?? 0;
  }

  get nodes(): Node[] {
    return this.#out.nodes;
  }

  get hits(): PlacedHit[] {
    return this.#out.hits;
  }

  // Another layer drawing into the same output
  sub(options: {
    layer: string;
    z: number;
    clip: Rect;
    dx?: number;
    dy?: number;
  }): Painter {
    return new Painter(options, this.#out);
  }

  #key(key: string): string {
    return `${this.layer}:${key}`;
  }

  #place(rect: Rect): Rect {
    return { ...rect, column: rect.column + this.dx, row: rect.row + this.dy };
  }

  // z is relative to the layer, so later parts can sit on earlier ones
  box(
    key: string,
    rect: Rect,
    style: StyleOptions,
    options: { z?: number; filler?: string } = {},
  ): void {
    const visible = intersect(this.#place(rect), this.clip);
    if (!visible) return;
    this.#out.nodes.push({
      type: "box",
      key: this.#key(key),
      rect: visible,
      style,
      z: this.z + (options.z ?? 0),
      filler: options.filler,
    });
  }

  text(
    key: string,
    column: number,
    row: number,
    text: string,
    style: StyleOptions,
    z = 1,
  ): number {
    const width = textWidth(text);
    const placed = this.#place({ column, row, width, height: 1 });
    const { clip } = this;
    if (
      !text || placed.row < clip.row || placed.row >= clip.row + clip.height
    ) {
      return width;
    }

    const cropped = cropText(
      text,
      placed.column,
      clip.column,
      clip.column + clip.width,
    );
    if (cropped.text) {
      this.#out.nodes.push({
        type: "text",
        key: this.#key(key),
        column: cropped.column,
        row: placed.row,
        text: cropped.text,
        style,
        z: this.z + z,
      });
    }
    return width;
  }

  // Texts in different styles on one line, returns the width used
  line(
    key: string,
    column: number,
    row: number,
    parts: { text: string; style: StyleOptions }[],
    z = 1,
  ): number {
    let x = column;
    parts.forEach(({ text, style }, index) => {
      x += this.text(`${key}.${index}`, x, row, text, style, z);
    });
    return x - column;
  }

  hit(hit: Hit): void {
    const unclipped = this.#place(hit.rect);
    this.#out.hits.push({
      ...hit,
      screen: intersect(unclipped, this.clip),
      unclipped,
      layer: this.layer,
      z: this.z,
    });
  }
}
