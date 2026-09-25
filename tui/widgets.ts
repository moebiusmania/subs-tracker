// Building blocks shared by the screens, drawn after the web app's components
// (.btn, .field, .switch…). Each one draws itself and registers its hit
// region; ids are global so focus and hover survive re-renders.
import type { Key, Painter } from "./painter.ts";
import type { Rect } from "./scene.ts";
import { mix, type Palette, type StyleOptions } from "./palette.ts";
import type { Field } from "./form.ts";
import { center, textWidth, truncate } from "./text.ts";

export type Ctx = {
  p: Palette;
  focus: string | null;
  hover: string | null;
};

// Rounded corners like the web app's cards, dashed for inactive ones
const BORDERS = {
  rounded: { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" },
  dashed: { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "╌", v: "┆" },
};

// A border just inside rect, filled with fill. The corners sit on outside,
// the colour behind the frame, so they look round.
export const frame = (
  painter: Painter,
  key: string,
  rect: Rect,
  options: {
    border: string;
    fill: string;
    outside: string;
    dashed?: boolean;
    bold?: boolean;
    z?: number;
  },
): void => {
  const { column, row, width, height } = rect;
  const chars = BORDERS[options.dashed ? "dashed" : "rounded"];
  const z = options.z ?? 0;
  const line: StyleOptions = {
    fg: options.border,
    bg: options.fill,
    bold: options.bold,
  };
  const corner: StyleOptions = {
    fg: options.border,
    bg: options.outside,
    bold: options.bold,
  };

  painter.box(`${key}.fill`, rect, { bg: options.fill }, { z });
  const inner = chars.h.repeat(Math.max(0, width - 2));
  painter.text(`${key}.tl`, column, row, chars.tl, corner, z + 1);
  painter.text(`${key}.top`, column + 1, row, inner, line, z + 1);
  painter.text(`${key}.tr`, column + width - 1, row, chars.tr, corner, z + 1);
  painter.text(`${key}.bl`, column, row + height - 1, chars.bl, corner, z + 1);
  painter.text(
    `${key}.bottom`,
    column + 1,
    row + height - 1,
    inner,
    line,
    z + 1,
  );
  painter.text(
    `${key}.br`,
    column + width - 1,
    row + height - 1,
    chars.br,
    corner,
    z + 1,
  );
  if (height > 2) {
    const sides = { row: row + 1, width: 1, height: height - 2 };
    painter.box(`${key}.left`, { ...sides, column }, line, {
      z: z + 1,
      filler: chars.v,
    });
    painter.box(
      `${key}.right`,
      { ...sides, column: column + width - 1 },
      line,
      {
        z: z + 1,
        filler: chars.v,
      },
    );
  }
};

export type ButtonVariant = "default" | "primary" | "danger" | "ghost";

const buttonColours = (
  ctx: Ctx,
  id: string,
  variant: ButtonVariant,
  bg: string,
): { fg: string; bg: string } => {
  const { p } = ctx;
  if (ctx.focus === id) return { fg: p.bg, bg: p.accentStrong };
  const hover = ctx.hover === id;
  switch (variant) {
    case "primary":
      return {
        fg: p.onAccent,
        bg: hover ? mix(p.accent, p.text, 0.12) : p.accent,
      };
    case "danger":
      return {
        fg: p.danger,
        bg: hover ? mix(p.dangerSoft, p.danger, 0.2) : p.dangerSoft,
      };
    case "ghost":
      return { fg: p.text, bg: hover ? p.surface2 : bg };
    default:
      return { fg: p.text, bg: hover ? p.border : p.surface2 };
  }
};

export const buttonWidth = (label: string, icon?: string): number =>
  textWidth(icon ? `${icon} ${label}` : label) + 4;

// A pill button on one row: half blocks round off its ends
export const button = (
  painter: Painter,
  ctx: Ctx,
  options: {
    id: string;
    column: number;
    row: number;
    label: string;
    icon?: string;
    variant?: ButtonVariant;
    // Colour of what's behind the button
    bg: string;
    onPress: () => void;
    focusable?: boolean;
  },
): number => {
  const { id, column, row, label, icon } = options;
  const colours = buttonColours(
    ctx,
    id,
    options.variant ?? "default",
    options.bg,
  );
  const content = ` ${icon ? `${icon} ${label}` : label} `;
  const width = textWidth(content) + 2;
  const cap = { fg: colours.bg, bg: options.bg };

  painter.line(id, column, row, [
    { text: "▐", style: cap },
    { text: content, style: { ...colours, bold: true } },
    { text: "▌", style: cap },
  ]);
  painter.hit({
    id,
    rect: { column, row, width, height: 1 },
    focusable: options.focusable ?? true,
    onClick: options.onPress,
    onKey: (key) => {
      if (key.key !== "return" && key.key !== "space") return false;
      options.onPress();
      return true;
    },
  });
  return width;
};

// A text input with its label above, like .field in the web form: 4 rows,
// plus one for the error message when there is one
export const input = (
  painter: Painter,
  ctx: Ctx,
  options: {
    id: string;
    column: number;
    row: number;
    width: number;
    label: string;
    field: Field;
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    // Shown in place of the value, for inputs that aren't typed into
    display?: string;
    // Little clickable controls at the right edge (e.g. ‹ ›)
    controls?: { label: string; onPress: () => void }[];
    note?: string;
    onKey?: (key: Key) => boolean;
    onWheel?: (direction: 1 | -1) => void;
    onClick?: (offset: number) => void;
    bg: string;
  },
): number => {
  const { p } = ctx;
  const { id, column, row, width, field } = options;
  const focused = ctx.focus === id;
  const hover = ctx.hover === id;

  painter.text(`${id}.label`, column, row, truncate(options.label, width), {
    fg: options.disabled ? p.muted : p.text,
    bg: options.bg,
    bold: true,
  });

  const border = options.disabled
    ? p.border
    : focused
    ? p.accentStrong
    : options.error
    ? p.danger
    : hover
    ? p.text
    : p.fieldBorder;
  const fill = options.disabled ? p.surface2 : p.surface;
  frame(painter, `${id}.frame`, { column, row: row + 1, width, height: 3 }, {
    border,
    fill,
    outside: options.bg,
    bold: focused,
  });

  // Controls sit at the right end of the box
  const controls = options.controls ?? [];
  let controlsWidth = 0;
  controls.forEach((control, index) => {
    controlsWidth += textWidth(control.label) + (index ? 1 : 0);
  });
  const textWidthAvailable = width - 4 -
    (controlsWidth ? controlsWidth + 1 : 0);
  const textColumn = column + 2;
  const textRow = row + 2;
  const textStyle = {
    fg: options.disabled ? p.muted : p.text,
    bg: fill,
  };

  if (options.display !== undefined) {
    painter.text(
      `${id}.value`,
      textColumn,
      textRow,
      truncate(options.display, textWidthAvailable),
      textStyle,
    );
  } else if (!field.value && options.placeholder) {
    painter.text(
      `${id}.placeholder`,
      textColumn,
      textRow,
      truncate(options.placeholder, textWidthAvailable),
      { fg: p.muted, bg: fill, italic: true },
    );
  }
  if (options.display === undefined && field.value) {
    // Keep the cursor in view: scroll the text when it's longer than the box
    const before = field.value.slice(0, field.cursor);
    const shift = Math.max(0, textWidth(before) - textWidthAvailable + 1);
    let visible = "";
    let skipped = 0;
    for (const { segment } of new Intl.Segmenter().segment(field.value)) {
      if (skipped < shift) {
        skipped += textWidth(segment);
        continue;
      }
      if (textWidth(visible + segment) > textWidthAvailable) break;
      visible += segment;
    }
    painter.text(`${id}.value`, textColumn, textRow, visible, textStyle);
  }
  if (focused && options.display === undefined) {
    // A block cursor: the character under it drawn in reverse
    const before = field.value.slice(0, field.cursor);
    const shift = Math.max(0, textWidth(before) - textWidthAvailable + 1);
    // On an empty field it sits on the placeholder's first letter
    const rest = field.value
      ? field.value.slice(field.cursor)
      : options.placeholder ?? "";
    const under = [...new Intl.Segmenter().segment(rest)][0]?.segment ?? " ";
    painter.text(
      `${id}.cursor`,
      textColumn + textWidth(before) - shift,
      textRow,
      under,
      { fg: fill, bg: field.value ? p.text : p.muted },
      2,
    );
  }
  if (options.note) {
    const note = truncate(options.note, Math.max(0, textWidthAvailable - 2));
    const used = options.display ?? field.value;
    if (textWidth(used) + textWidth(note) + 2 <= textWidthAvailable) {
      painter.text(
        `${id}.note`,
        textColumn + textWidthAvailable - textWidth(note),
        textRow,
        note,
        { fg: p.muted, bg: fill },
      );
    }
  }

  let controlColumn = column + width - 2 - controlsWidth;
  controls.forEach((control, index) => {
    const controlId = `${id}.control${index}`;
    const w = textWidth(control.label);
    painter.text(controlId, controlColumn, textRow, control.label, {
      fg: ctx.hover === controlId ? p.accentStrong : p.muted,
      bg: ctx.hover === controlId ? p.accentSoft : fill,
      bold: true,
    }, 2);
    painter.hit({
      id: controlId,
      rect: { column: controlColumn, row: textRow, width: w, height: 1 },
      onClick: control.onPress,
    });
    controlColumn += w + 1;
  });

  if (!options.disabled) {
    painter.hit({
      id,
      rect: { column, row: row + 1, width, height: 3 },
      focusable: true,
      input: options.display === undefined,
      onKey: options.onKey,
      onWheel: options.onWheel,
      onClick: (x) => options.onClick?.(x - 2),
    });
  }

  if (options.error) {
    painter.line(`${id}.error`, column, row + 4, [
      { text: "! ", style: { fg: p.danger, bg: options.bg, bold: true } },
      {
        text: truncate(options.error, width - 2),
        style: { fg: p.danger, bg: options.bg },
      },
    ]);
    return 5;
  }
  return 4;
};

// On/off switch with its label, like the web form's role="switch" checkbox
export const toggle = (
  painter: Painter,
  ctx: Ctx,
  options: {
    id: string;
    column: number;
    row: number;
    label: string;
    on: boolean;
    bg: string;
    onToggle: () => void;
  },
): number => {
  const { p } = ctx;
  const { id, column, row, on } = options;
  const focused = ctx.focus === id;
  const hover = ctx.hover === id;
  const track = on ? p.accent : hover ? p.fieldBorder : p.border;
  const knob = on ? p.onAccent : p.surface;
  const cap = { fg: track, bg: options.bg };

  const width = painter.line(id, column, row, [
    { text: "▐", style: cap },
    { text: on ? "  " : "", style: { bg: track } },
    { text: "●", style: { fg: knob, bg: track, bold: true } },
    { text: on ? "" : "  ", style: { bg: track } },
    { text: "▌", style: cap },
    { text: " ", style: { bg: options.bg } },
    {
      text: options.label,
      style: {
        fg: focused ? p.accentStrong : p.text,
        bg: options.bg,
        bold: true,
        underline: focused,
      },
    },
  ]);
  painter.hit({
    id,
    rect: { column, row, width, height: 1 },
    focusable: true,
    onClick: options.onToggle,
    onKey: (key) => {
      if (key.key !== "return" && key.key !== "space") return false;
      options.onToggle();
      return true;
    },
  });
  return width;
};

// Radio-like choice between a few options, in a box like the other fields
export const segmented = <T extends string>(
  painter: Painter,
  ctx: Ctx,
  options: {
    id: string;
    column: number;
    row: number;
    width: number;
    label: string;
    value: T;
    choices: { value: T; label: string }[];
    bg: string;
    onChange: (value: T) => void;
  },
): number => {
  const { p } = ctx;
  const { id, column, row, width, value, choices } = options;
  const focused = ctx.focus === id;

  painter.text(`${id}.label`, column, row, truncate(options.label, width), {
    fg: p.text,
    bg: options.bg,
    bold: true,
  });
  frame(painter, `${id}.frame`, { column, row: row + 1, width, height: 3 }, {
    border: focused
      ? p.accentStrong
      : ctx.hover?.startsWith(id)
      ? p.text
      : p.fieldBorder,
    fill: p.surface,
    outside: options.bg,
    bold: focused,
  });

  const cell = Math.floor((width - 2) / choices.length);
  choices.forEach((choice, index) => {
    const choiceId = `${id}.${choice.value}`;
    const selected = choice.value === value;
    const cellColumn = column + 1 + index * cell;
    const cellWidth = index === choices.length - 1
      ? width - 2 - cell * index
      : cell;
    const text = center(
      truncate(`${selected ? "●" : "○"} ${choice.label}`, cellWidth - 2),
      cellWidth - 2,
    );
    const hover = ctx.hover === choiceId;
    const bg = selected ? p.accentSoft : hover ? p.surface2 : p.surface;
    painter.text(choiceId, cellColumn + 1, row + 2, text, {
      fg: selected ? p.accentStrong : p.text,
      bg,
      bold: selected,
    }, 2);
    painter.box(
      `${choiceId}.pad`,
      {
        column: cellColumn,
        row: row + 2,
        width: cellWidth,
        height: 1,
      },
      { bg },
      { z: 1 },
    );
    painter.hit({
      id: choiceId,
      rect: { column: cellColumn, row: row + 1, width: cellWidth, height: 3 },
      onClick: () => options.onChange(choice.value),
    });
  });

  const move = (direction: 1 | -1) => {
    const index = choices.findIndex((choice) => choice.value === value);
    const next = choices[(index + direction + choices.length) % choices.length];
    options.onChange(next.value);
  };
  // Behind the choices, so a click lands on a choice but Tab stops here
  painter.hit({
    id,
    rect: { column, row: row + 1, width, height: 3 },
    focusable: true,
    onWheel: move,
    onKey: (key) => {
      if (key.key === "left") move(-1);
      else if (key.key === "right" || key.key === "space") move(1);
      else return false;
      return true;
    },
  });
  return 4;
};

// Three-row digits for the stat values, like the big numbers on the web
// app's stat tiles
const GLYPHS: Record<string, [string, string, string]> = {
  "0": ["┏━┓", "┃ ┃", "┗━┛"],
  "1": ["╺┓ ", " ┃ ", "╺┻╸"],
  "2": ["┏━┓", "┏━┛", "┗━╸"],
  "3": ["┏━┓", " ━┫", "┗━┛"],
  "4": ["╻ ╻", "┗━┫", "  ╹"],
  "5": ["┏━╸", "┗━┓", "┗━┛"],
  "6": ["┏━╸", "┣━┓", "┗━┛"],
  "7": ["╺━┓", "  ┃", "  ╹"],
  "8": ["┏━┓", "┣━┫", "┗━┛"],
  "9": ["┏━┓", "┗━┫", "╺━┛"],
  ".": [" ", " ", "▪"],
  ",": [" ", " ", "▪"],
  "-": ["   ", "╺━╸", "   "],
  "€": ["┏━╸", "╋━╸", "┗━╸"],
  "$": ["┏╋┓", "┗╋┓", "┗╋┛"],
  " ": [" ", " ", " "],
};

// null when a character has no glyph
export const bigText = (value: string): [string, string, string] | null => {
  const rows: [string, string, string] = ["", "", ""];
  for (const [index, char] of [...value].entries()) {
    const glyph = GLYPHS[char];
    if (!glyph) return null;
    for (let row = 0; row < 3; row++) {
      rows[row] += (index ? " " : "") + glyph[row];
    }
  }
  return rows;
};
