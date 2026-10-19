// Decodes what the terminal sends to stdin into key presses and mouse events.
// Ported from deno_tui 2.1.11 (src/input_reader), Copyright 2023 Im-Beast,
// MIT license (https://github.com/Im-Beast/deno_tui): the decoder the app
// used before, so the keys it reports stay the same. Unlike there, every
// call returns new objects.
// See https://invisible-island.net/xterm/ctlseqs/ctlseqs.txt for the codes.

export type KeyName =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z"
  | "return"
  | "tab"
  | "backspace"
  | "escape"
  | "space"
  | "up"
  | "down"
  | "left"
  | "right"
  | "clear"
  | "insert"
  | "delete"
  | "pageup"
  | "pagedown"
  | "home"
  | "end"
  | "f1"
  | "f2"
  | "f3"
  | "f4"
  | "f5"
  | "f6"
  | "f7"
  | "f8"
  | "f9"
  | "f10"
  | "f11"
  | "f12"
  // Digits, punctuation and any other printable character
  | (string & {});

export type KeyPressEvent = {
  key: KeyName;
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  buffer: Uint8Array;
};

type MouseBase = {
  key: "mouse";
  buffer: Uint8Array;
  // Cells from the top left corner, from 0
  x: number;
  y: number;
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
};

export type MousePressEvent = MouseBase & {
  drag: boolean;
  release: boolean;
  // undefined on release
  button: 0 | 1 | 2 | undefined;
};

export type MouseScrollEvent = MouseBase & {
  drag: boolean;
  // 1 scrolls down, -1 up
  scroll: 1 | -1;
};

export type MouseEvent = MousePressEvent | MouseScrollEvent;

export type InputEvent = KeyPressEvent | MouseEvent;

const lowerCaseAlphabet = "abcdefghijklmnopqrstuvwxyz";

const FUNCTION_KEYS: Record<string, KeyName> = {
  OP: "f1",
  "[P": "f1",
  OG: "f2",
  "[Q": "f2",
  OR: "f3",
  "[R": "f3",
  OS: "f4",
  "[S": "f4",
  "[15~": "f5",
  "[17~": "f6",
  "[18~": "f7",
  "[19~": "f8",
  "[20~": "f9",
  "[21~": "f10",
  "[23~": "f11",
  "[24~": "f12",
  "[A": "up",
  "[B": "down",
  "[C": "right",
  "[D": "left",
  "[2~": "insert",
  "[3~": "delete",
  "[5~": "pageup",
  "[6~": "pagedown",
  "[H": "home",
  "[F": "end",
  "[E": "clear",
};

export const decodeKey = (buffer: Uint8Array, input: string): KeyPressEvent => {
  const code = input[0] === "\x1b" ? input.slice(1) : input;
  const event: KeyPressEvent = {
    buffer,
    key: code,
    meta: false,
    ctrl: false,
    shift: false,
  };

  switch (code) {
    case "\r":
    case "\n":
      event.key = "return";
      return event;
    case "\t":
      event.key = "tab";
      return event;
    case "\b":
    case "\x7f":
      event.key = "backspace";
      return event;
    case "\x1b":
      event.key = "escape";
      return event;
    case " ":
      event.key = "space";
      return event;
  }

  // Ctrl+letter arrives as 1–26
  if (buffer[0] !== 27) {
    const offset96 = String.fromCharCode(buffer[0]! + 96);
    if (lowerCaseAlphabet.includes(offset96)) {
      event.key = offset96;
      event.ctrl = true;
      return event;
    }
  }

  if (code.length === 1) {
    event.shift = code !== code.toLowerCase();
    event.meta = buffer[0] === 27;
    return event;
  } else if (buffer.length === 1) {
    event.key = "escape";
    return event;
  }

  const modifier = code.match(/\d+.+(\d+)/)?.[1] ?? "";
  if (modifier === "5") event.ctrl = true;
  else if (modifier === "3") event.meta = true;
  else if (modifier === "2") event.shift = true;

  const plain = code
    .replace(`1;${modifier}`, "")
    .replace(`;${modifier}`, "")
    .replace("1;", "");
  event.key = FUNCTION_KEYS[plain] ?? plain;
  return event;
};

// SGR mouse reports (mode 1006): \x1b[<b;x;yM, lowercase m on release
export const decodeMouseSGR = (
  buffer: Uint8Array,
  code: string,
): MouseEvent | undefined => {
  const action = code.at(-1);
  if (!code.startsWith("\x1b[<") || (action !== "m" && action !== "M")) {
    return undefined;
  }

  const release = action === "m";
  const xSeparator = code.indexOf(";");
  let modifiers = +code.slice(3, xSeparator);
  const ySeparator = code.indexOf(";", xSeparator + 1);
  const x = +code.slice(xSeparator + 1, ySeparator) - 1;
  const y = +code.slice(ySeparator + 1, code.length - 1) - 1;

  let scroll: 0 | 1 | -1 = 0;
  if (modifiers >= 64) {
    scroll = modifiers % 2 === 0 ? -1 : 1;
    modifiers -= scroll < 0 ? 64 : 65;
  }
  const drag = modifiers >= 32;
  if (drag) modifiers -= 32;
  const ctrl = modifiers >= 16;
  if (ctrl) modifiers -= 16;
  const meta = modifiers >= 8;
  if (meta) modifiers -= 8;
  const shift = modifiers >= 4;
  if (shift) modifiers -= 4;

  const base = { key: "mouse" as const, buffer, x, y, ctrl, meta, shift };
  if (scroll) return { ...base, drag, scroll };
  return {
    ...base,
    drag,
    release,
    button: modifiers as MousePressEvent["button"],
  };
};

// Older VT200 and UTF-8 mouse reports: \x1b[M and three characters
export const decodeMouseVT_UTF8 = (
  buffer: Uint8Array,
  code: string,
): MouseEvent | undefined => {
  if (!code.startsWith("\x1b[M")) return undefined;

  const modifiers = code.charCodeAt(3);
  const x = code.charCodeAt(4) - 0o41;
  const y = code.charCodeAt(5) - 0o41;

  const buttonInfo = modifiers & 3;
  const release = buttonInfo === 3;
  let button = release ? undefined : (buttonInfo as 0 | 1 | 2);

  const shift = !!(modifiers & 4);
  const meta = !!(modifiers & 8);
  const ctrl = !!(modifiers & 16);
  const scroll =
    button && !!(modifiers & 32) && !!(modifiers & 64)
      ? modifiers & 3
        ? 1
        : -1
      : 0;
  if (scroll) button = undefined;
  const drag = !scroll && !!(modifiers & 64);

  const base = { key: "mouse" as const, buffer, x, y, ctrl, meta, shift };
  if (scroll) return { ...base, drag, scroll };
  return { ...base, drag, release, button };
};

const textDecoder = new TextDecoder();

const ESC = 0x1b;

// One read from stdin can hold several escape sequences: each one is decoded
// on its own. Split on bytes: ESC never appears inside a UTF-8 character, and
// a string index wouldn't match the buffer's after non-ASCII text
export function* decodeBuffer(buffer: Uint8Array): Generator<InputEvent> {
  const lastIndex = buffer.lastIndexOf(ESC);

  if (buffer.indexOf(ESC) !== lastIndex) {
    yield* decodeBuffer(buffer.subarray(0, lastIndex));
    yield* decodeBuffer(buffer.subarray(lastIndex));
  } else {
    const code = textDecoder.decode(buffer);
    yield decodeMouseVT_UTF8(buffer, code) ??
      decodeMouseSGR(buffer, code) ??
      decodeKey(buffer, code);
  }
}
