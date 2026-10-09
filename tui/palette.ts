// Colours of the web app (the light-dark() tokens in src/styles.css), so both
// versions share the same warm linen / ink look with an ember accent in
// either theme
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
  // Same tints as a list, to cycle through (the names are historical: they
  // are ember and linen shades now)
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
    lav: "#fbe5da",
    mint: "#efecea",
    peach: "#f6dccd",
    sky: "#e6e1dc",
    butter: "#f8ece1",
    pink: "#ece4dd",
  },
  palette: {
    bg: "#efecea",
    surface: "#ffffff",
    surface2: "#f7f5f3",
    border: "#dcd9d6",
    fieldBorder: "#8f8c89",
    text: "#22201d",
    muted: "#666461",
    accent: "#ff692d",
    onAccent: "#22201d",
    accentSoft: "#fbe5da",
    accentStrong: "#a83c0e",
    success: "#2c6b3f",
    successSoft: "#e3efe2",
    danger: "#b3262f",
    dangerSoft: "#fbe3e1",
    illo: {
      blob: "#fbe5da",
      stroke: "#22201d",
      card: "#ffffff",
      line: "#dcd9d6",
      lav: "#ff692d",
      mint: "#c9c4bf",
      peach: "#ff9a6e",
      butter: "#ffc4a8",
      pink: "#e6e1dc",
    },
  },
};

const dark = {
  tint: {
    lav: "#3a2519",
    mint: "#34302b",
    peach: "#43291c",
    sky: "#2f2b27",
    butter: "#3b2f25",
    pink: "#36302a",
  },
  palette: {
    bg: "#1c1a17",
    surface: "#24211e",
    surface2: "#2e2a26",
    border: "#3a3631",
    fieldBorder: "#7f7a74",
    text: "#efecea",
    muted: "#a9a49f",
    accent: "#ff7a45",
    onAccent: "#22201d",
    accentSoft: "#3a2519",
    accentStrong: "#ff9a6e",
    success: "#8ad3a0",
    successSoft: "#1f2e23",
    danger: "#ffa3a3",
    dangerSoft: "#3a2222",
    illo: {
      blob: "#3a2519",
      stroke: "#110f0d",
      card: "#2e2a26",
      line: "#4a453f",
      lav: "#ff7a45",
      mint: "#7f7a74",
      peach: "#d9764d",
      butter: "#e0956f",
      pink: "#8f8780",
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
