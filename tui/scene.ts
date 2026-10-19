// Draws the screen: every render describes it as a flat list of boxes and
// texts, painted in z order (then list order) into a grid of cells. Only
// the cells that differ from the last frame are written to the terminal.
import type { StyleOptions } from "./palette.ts";
import { textWidth } from "./text.ts";

export type Rect = {
  column: number;
  row: number;
  width: number;
  height: number;
};

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

// A cell as written to the terminal (its character with the style's escape
// codes), or "" for the right half of a wide character
type Cell = string;

const BLANK: Cell = " ";

const segmenter = new Intl.Segmenter();

const moveTo = (column: number, row: number): string =>
  `\x1b[${row + 1};${column + 1}H`;

export class Scene {
  #write: (text: string) => void;
  #styler: Styler;
  #columns = 0;
  #rows = 0;
  // What the terminal shows, null before the first frame after a resize
  #shown: Cell[] | null = null;

  constructor(write: (text: string) => void, styler: Styler) {
    this.#write = write;
    this.#styler = styler;
  }

  // The terminal's size changed: the next render draws everything again
  resize(columns: number, rows: number): void {
    this.#columns = columns;
    this.#rows = rows;
    this.#shown = null;
  }

  render(nodes: Node[]): void {
    const cells = this.#paint(nodes);
    const shown = this.#shown;
    let out = shown ? "" : "\x1b[0m\x1b[2J";
    // Where the terminal's cursor is, to skip moves between adjacent cells
    let cursor = -1;

    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index]!;
      // The right half of a wide character comes with its left half, which
      // changed too and is written just before
      if (cell === "" || (shown && shown[index] === cell)) continue;
      if (cursor !== index) {
        out += moveTo(index % this.#columns, Math.floor(index / this.#columns));
      }
      out += cell;
      cursor = index + (cells[index + 1] === "" ? 2 : 1);
      // Wrapping to the next row isn't reliable at the right edge
      if (cursor % this.#columns === 0) cursor = -1;
    }

    this.#shown = cells;
    if (out) this.#write(out);
  }

  #paint(nodes: Node[]): Cell[] {
    const columns = this.#columns;
    const rows = this.#rows;
    const cells: Cell[] = new Array(columns * rows).fill(BLANK);

    const put = (column: number, row: number, cell: Cell, width: number) => {
      if (row < 0 || row >= rows || column < 0 || column + width > columns) {
        return;
      }
      const index = row * columns + column;
      // Half of a wide character that's being covered: blank the other half
      if (cells[index] === "" && column > 0) cells[index - 1] = BLANK;
      if (cells[index + width] === "") cells[index + width] = BLANK;
      cells[index] = cell;
      if (width === 2) cells[index + 1] = "";
    };

    const seen = new Set<string>();
    const sorted = nodes
      .map((node, order) => ({ node, order }))
      .sort((a, b) => a.node.z - b.node.z || a.order - b.order);

    for (const { node } of sorted) {
      if (seen.has(node.key)) {
        throw new Error(`Duplicate scene key: ${node.key}`);
      }
      seen.add(node.key);
      const style = this.#styler(node.style);

      if (node.type === "box") {
        const { column, row, width, height } = node.rect;
        const filler = style(node.filler ?? " ");
        for (let y = row; y < row + height; y++) {
          for (let x = column; x < column + width; x++) put(x, y, filler, 1);
        }
        continue;
      }

      let x = node.column;
      for (const { segment } of segmenter.segment(node.text)) {
        const width = textWidth(segment);
        if (width === 0) continue;
        put(x, node.row, style(segment), Math.min(width, 2));
        x += width;
      }
    }
    return cells;
  }
}
