// Colours of the web app (the light-dark() tokens in src/styles.css), so both
// versions share the same misty sea-glass / slate-ink look in either theme
export type Theme = "light" | "dark";

// Avatar tints cycle in this order, like .sub-card:nth-of-type()
const TINTS = ["lav", "mint", "peach", "sky", "butter", "pink"] as const;
type Tint = typeof TINTS[number];

export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  fieldBorder: string;
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  accentStrong: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  tint: Record<Tint, string>;
  // Same tints as a list, to cycle through
  tints: string[];
  // The empty-state illustration's colours: the web app dropped its
  // illustration, so these only live here
  illo: {
    blob: string;
    stroke: string;
    card: string;
    line: string;
    lav: string;
    mint: string;
    peach: string;
    butter: string;
    pink: string;
  };
};

const light = {
  tint: {
    lav: "#ece6ff",
    mint: "#dcf3e8",
    peach: "#ffe3d3",
    sky: "#dbeafb",
    butter: "#fcefc2",
    pink: "#fbe0eb",
  },
  palette: {
    bg: "#f3f7f6",
    surface: "#ffffff",
    surface2: "#e9f0ee",
    border: "#d9e4e1",
    fieldBorder: "#6c817d",
    text: "#1c2b30",
    muted: "#4f6268",
    accent: "#9fded0",
    onAccent: "#1c2b30",
    accentSoft: "#e0f4ef",
    accentStrong: "#1d6b5f",
    success: "#1d6644",
    successSoft: "#dcf3e8",
    danger: "#a3283d",
    dangerSoft: "#fde6ea",
    illo: {
      blob: "#e0f4ef",
      stroke: "#1c2b30",
      card: "#ffffff",
      line: "#dbe6e3",
      lav: "#cbbcff",
      mint: "#a8e6c9",
      peach: "#ffc9ae",
      butter: "#ffe08a",
      pink: "#f9bcd3",
    },
  },
};

const dark = {
  tint: {
    lav: "#29283f",
    mint: "#1a3530",
    peach: "#3a2b26",
    sky: "#1a2e3e",
    butter: "#353022",
    pink: "#3a2430",
  },
  palette: {
    bg: "#0f1a1d",
    surface: "#16242a",
    surface2: "#1d2e34",
    border: "#27393f",
    fieldBorder: "#6f8a8f",
    text: "#e6f0ef",
    muted: "#a3b6b8",
    accent: "#8fdccb",
    onAccent: "#0f1a1d",
    accentSoft: "#1c3a37",
    accentStrong: "#9fe6d6",
    success: "#8fdcb4",
    successSoft: "#1a3530",
    danger: "#ffa3b1",
    dangerSoft: "#3a2430",
    illo: {
      blob: "#1a2d31",
      stroke: "#081012",
      card: "#203138",
      line: "#36494f",
      lav: "#9d8ae0",
      mint: "#6fbf9b",
      peach: "#d99a80",
      butter: "#e0bf62",
      pink: "#d48aa7",
    },
  },
};

export const palettes: Record<Theme, Palette> = {
  light: {
    ...light.palette,
    tint: light.tint,
    tints: TINTS.map((name) => light.tint[name]),
  },
  dark: {
    ...dark.palette,
    tint: dark.tint,
    tints: TINTS.map((name) => dark.tint[name]),
  },
};

export type StyleOptions = {
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

const rgb = (hex: string): [number, number, number] => {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

// Nearest colour in the xterm 256 palette (6×6×6 cube or grey ramp), for
// terminals without 24-bit colour
const LEVELS = [0, 95, 135, 175, 215, 255];
const nearestLevel = (value: number): number =>
  LEVELS.reduce(
    (best, level, index) =>
      Math.abs(level - value) < Math.abs(LEVELS[best] - value) ? index : best,
    0,
  );

export const to256 = (hex: string): number => {
  const [r, g, b] = rgb(hex);
  const [cr, cg, cb] = [nearestLevel(r), nearestLevel(g), nearestLevel(b)];
  const cube = 16 + 36 * cr + 6 * cg + cb;
  const cubeDistance = (LEVELS[cr] - r) ** 2 + (LEVELS[cg] - g) ** 2 +
    (LEVELS[cb] - b) ** 2;

  const grey = Math.max(
    0,
    Math.min(23, Math.round(((r + g + b) / 3 - 8) / 10)),
  );
  const level = 8 + grey * 10;
  const greyDistance = (level - r) ** 2 + (level - g) ** 2 + (level - b) ** 2;

  return greyDistance < cubeDistance ? 232 + grey : cube;
};

export const supportsTrueColor = (env: (name: string) => string | undefined) =>
  /truecolor|24bit/i.test(env("COLORTERM") ?? "") ||
  // Terminals that support it without saying so
  ["iTerm.app", "WezTerm", "vscode", "ghostty"].includes(
    env("TERM_PROGRAM") ?? "",
  ) || /kitty|ghostty|alacritty|foot/.test(env("TERM") ?? "");

// SGR parameters for a colour: 38/48;2;r;g;b or 38/48;5;n
const colour = (layer: 38 | 48, hex: string, trueColor: boolean): string =>
  trueColor ? `${layer};2;${rgb(hex).join(";")}` : `${layer};5;${to256(hex)}`;

// Builds the escape sequence for a style once, deno_tui calls it per frame
export const createStyler = (trueColor: boolean) => {
  const cache = new Map<string, (text: string) => string>();
  return (options: StyleOptions): (text: string) => string => {
    const key = JSON.stringify(options);
    let style = cache.get(key);
    if (style) return style;

    const codes: string[] = [];
    if (options.bold) codes.push("1");
    if (options.italic) codes.push("3");
    if (options.underline) codes.push("4");
    if (options.fg) codes.push(colour(38, options.fg, trueColor));
    if (options.bg) codes.push(colour(48, options.bg, trueColor));
    const open = `\x1b[${codes.join(";")}m`;
    style = codes.length ? (text) => `${open}${text}\x1b[0m` : (text) => text;
    cache.set(key, style);
    return style;
  };
};

// color-mix(in srgb, a, b amount): used for hover shades, like the web app
export const mix = (a: string, b: string, amount: number): string => {
  const [from, to] = [rgb(a), rgb(b)];
  return "#" + from
    .map((value, index) =>
      Math.round(value + (to[index] - value) * amount)
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
};
