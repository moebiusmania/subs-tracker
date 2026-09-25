// Plain-text helpers. Every string drawn on screen is measured in terminal
// cells, so wide characters (CJK, most emoji) count as two.
import { textWidth } from "deno_tui/src/utils/strings.ts";

export { textWidth };

const segmenter = new Intl.Segmenter();

const graphemes = (text: string): string[] =>
  [...segmenter.segment(text)].map(({ segment }) => segment);

// Cuts text to fit in width cells, ending with "…" when it's cut
export const truncate = (text: string, width: number): string => {
  if (width <= 0) return "";
  if (textWidth(text) <= width) return text;

  let result = "";
  for (const char of graphemes(text)) {
    if (textWidth(result + char) > width - 1) break;
    result += char;
  }
  return result + "…";
};

export const padEnd = (text: string, width: number): string =>
  text + " ".repeat(Math.max(0, width - textWidth(text)));

export const center = (text: string, width: number): string => {
  const space = Math.max(0, width - textWidth(text));
  const left = Math.floor(space / 2);
  return " ".repeat(left) + text + " ".repeat(space - left);
};

// A run of text sharing one style, like the <strong> in add.intro
export type Span = { text: string; bold?: boolean };

// The translations only use <strong>, anything else is dropped
export const parseStrong = (html: string): Span[] =>
  html
    .split(/(<strong>.*?<\/strong>)/)
    .filter(Boolean)
    .map((part) => {
      const strong = part.match(/^<strong>(.*?)<\/strong>$/);
      return strong
        ? { text: strong[1], bold: true }
        : { text: part.replace(/<[^>]+>/g, "") };
    });

// Word-wraps spans into lines of at most width cells, keeping each word's
// style. Words longer than a line are split.
export const wrapSpans = (spans: Span[], width: number): Span[][] => {
  const lines: Span[][] = [[]];
  let used = 0;

  const push = (text: string, bold?: boolean) => {
    const line = lines[lines.length - 1];
    const last = line[line.length - 1];
    if (last && !!last.bold === !!bold) last.text += text;
    else line.push(bold ? { text, bold } : { text });
    used += textWidth(text);
  };
  const newLine = () => {
    const line = lines[lines.length - 1];
    const last = line[line.length - 1];
    if (last) {
      last.text = last.text.trimEnd();
      if (!last.text) line.pop();
    }
    lines.push([]);
    used = 0;
  };

  for (const { text, bold } of spans) {
    for (const word of text.split(/(\s+)/)) {
      if (!word) continue;
      if (/^\s+$/.test(word)) {
        if (used > 0 && used < width) push(" ", bold);
        continue;
      }

      let rest = word;
      while (textWidth(rest) > width) {
        if (used > 0) newLine();
        let head = "";
        for (const char of graphemes(rest)) {
          if (textWidth(head + char) > width) break;
          head += char;
        }
        push(head, bold);
        rest = rest.slice(head.length);
        newLine();
      }
      if (!rest) continue;
      if (used + textWidth(rest) > width) newLine();
      push(rest, bold);
    }
  }

  const last = lines[lines.length - 1];
  if (last.length === 0 && lines.length > 1) lines.pop();
  return lines;
};

export const wrap = (text: string, width: number): string[] =>
  wrapSpans([{ text }], width).map((line) =>
    line.map((span) => span.text).join("")
  );
