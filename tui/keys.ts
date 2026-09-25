// Turns what deno_tui reads from stdin into the app's keys. One read can hold
// several keys (fast typing, a paste with a newline, "⌫⌫" held down), which
// deno_tui reports as a single unknown key.
import type { KeyPressEvent } from "deno_tui/src/input_reader/types.ts";
import type { Key } from "./painter.ts";

type Named = Pick<Key, "key"> & Partial<Pick<Key, "shift" | "ctrl">>;

// Sequences deno_tui's decoder doesn't name (xterm and tmux variants)
const SEQUENCES: Record<string, Named> = {
  "\x1b[Z": { key: "tab", shift: true },
  "\x1bOA": { key: "up" },
  "\x1bOB": { key: "down" },
  "\x1bOC": { key: "right" },
  "\x1bOD": { key: "left" },
  "\x1bOH": { key: "home" },
  "\x1bOF": { key: "end" },
  "\x1b[1~": { key: "home" },
  "\x1b[7~": { key: "home" },
  "\x1b[4~": { key: "end" },
  "\x1b[8~": { key: "end" },
};

const CONTROLS: Record<string, Named> = {
  "\r": { key: "return" },
  "\n": { key: "return" },
  "\t": { key: "tab" },
  "\x7f": { key: "backspace" },
  "\b": { key: "backspace" },
};

const decoder = new TextDecoder();

const make = (
  event: KeyPressEvent,
  named: Partial<Key>,
  typed = "",
): Key => ({
  ...event,
  meta: false,
  ctrl: false,
  shift: false,
  ...named,
  typed,
} as Key);

// deno-lint-ignore no-control-regex
const CONTROL = /[\x00-\x1f\x7f]/;

export const toKeys = (event: KeyPressEvent): Key[] => {
  const raw = decoder.decode(event.buffer);

  const sequence = SEQUENCES[raw];
  if (sequence) return [make(event, sequence)];

  // Escape sequences, and single keys deno_tui already understood
  if (raw.startsWith("\x1b") || raw.length <= 1 && CONTROL.test(raw)) {
    return [{ ...event, typed: "" }];
  }
  if (!CONTROL.test(raw)) {
    // Printable text, typed or pasted: the key is its first character
    return [{ ...event, key: event.key, typed: raw }];
  }

  // Printable runs and control keys mixed up: one key each
  const keys: Key[] = [];
  let run = "";
  const flush = () => {
    if (run) keys.push(make(event, { key: run[0] as Key["key"] }, run));
    run = "";
  };
  for (const char of raw) {
    if (!CONTROL.test(char)) {
      run += char;
      continue;
    }
    flush();
    const control = CONTROLS[char];
    if (control) keys.push(make(event, control));
    else {
      // Ctrl+letter arrives as 1–26
      const letter = String.fromCharCode(char.charCodeAt(0) + 96);
      if (/[a-z]/.test(letter)) {
        keys.push(make(event, { key: letter as Key["key"], ctrl: true }));
      }
    }
  }
  flush();
  return keys;
};
