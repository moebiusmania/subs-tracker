// Colours of the web app (the light-dark() tokens in src/styles.css), so both
// versions share the same warm cream / plum-ink look in either theme
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
    bg: "#fbf8f3",
    surface: "#ffffff",
    surface2: "#f5f0e9",
    border: "#ece4da",
    fieldBorder: "#968c9f",
    text: "#2a2433",
    muted: "#665d70",
    accent: "#cbbcff",
    onAccent: "#2a2433",
    accentSoft: "#efe9ff",
    accentStrong: "#5a44a6",
    success: "#1d6644",
    successSoft: "#dcf3e8",
    danger: "#a3283d",
    dangerSoft: "#fde6ea",
    illo: {
      blob: "#efe9ff",
      stroke: "#2a2433",
      card: "#ffffff",
      line: "#e6dff0",
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
    lav: "#2f2945",
    mint: "#1f3a30",
    peach: "#3d2c25",
    sky: "#1e2f40",
    butter: "#393222",
    pink: "#3d2330",
  },
  palette: {
    bg: "#17141f",
    surface: "#211d2b",
    surface2: "#2a2536",
    border: "#332d40",
    fieldBorder: "#7d738c",
    text: "#efeaf6",
    muted: "#b3aac0",
    accent: "#c9b8ff",
    onAccent: "#17141f",
    accentSoft: "#2f2945",
    accentStrong: "#cfc2ff",
    success: "#8fdcb4",
    successSoft: "#1f3a30",
    danger: "#ffa3b1",
    dangerSoft: "#3d2330",
    illo: {
      blob: "#262036",
      stroke: "#0e0c13",
      card: "#2f2a3b",
      line: "#443c54",
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
