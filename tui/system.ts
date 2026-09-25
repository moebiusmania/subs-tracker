// Where the terminal version keeps its data and which language it starts in.
// The web app uses localStorage; here the same AppState JSON lives in a file.
import { dirname, join, resolve } from "@std/path";
import type { AppState, Locale } from "../src/js/lib/types.ts";
import { detectLocale } from "../src/js/lib/i18n.ts";

type Env = (name: string) => string | undefined;

// SUBS_TRACKER_DATA overrides the default location:
// %APPDATA%\subs-tracker\data.json on Windows,
// $XDG_CONFIG_HOME/subs-tracker/data.json (or ~/.config/…) elsewhere
export const dataPath = (env: Env, os: typeof Deno.build.os): string => {
  const custom = env("SUBS_TRACKER_DATA");
  if (custom) return resolve(custom);

  if (os === "windows") {
    const appData = env("APPDATA") ??
      join(env("USERPROFILE") ?? ".", "AppData", "Roaming");
    return join(appData, "subs-tracker", "data.json");
  }

  const config = env("XDG_CONFIG_HOME") || join(env("HOME") ?? ".", ".config");
  return join(config, "subs-tracker", "data.json");
};

// Home as "~" to keep paths short on screen
export const displayPath = (path: string, env: Env): string => {
  const home = env("HOME") ?? env("USERPROFILE");
  return home && (path.startsWith(home + "/") || path.startsWith(home + "\\"))
    ? "~" + path.slice(home.length)
    : path;
};

// Paths typed in the export/import dialogs: "~/x.json" or relative to the
// directory the app was started from
export const resolvePath = (path: string, env: Env): string => {
  const home = env("HOME") ?? env("USERPROFILE");
  const trimmed = path.trim();
  if (home && (trimmed === "~" || /^~[\\/]/.test(trimmed))) {
    return join(home, trimmed.slice(1));
  }
  return resolve(trimmed);
};

// null when there's no saved data yet. A file that can't be read is moved
// aside to data.json.bak instead of being overwritten on the next save.
export const loadState = (path: string): AppState | null => {
  let text: string;
  try {
    text = Deno.readTextFileSync(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return null;
    throw error;
  }

  try {
    const state = JSON.parse(text);
    if (typeof state === "object" && state && Array.isArray(state.data)) {
      return state as AppState;
    }
  } catch {
    // Handled below
  }
  Deno.renameSync(path, `${path}.bak`);
  return null;
};

// Written to a temporary file first, so a crash never leaves half a file
export const saveState = (path: string, state: AppState): void => {
  Deno.mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  Deno.writeTextFileSync(temporary, JSON.stringify(state));
  Deno.renameSync(temporary, path);
};

// POSIX locales ("it_IT.UTF-8", "en_GB:it") as browser-style tags ("it-IT"),
// in gettext's order of precedence
export const systemLanguages = (env: Env): string[] => {
  const values = [
    ...(env("LANGUAGE")?.split(":") ?? []),
    env("LC_ALL"),
    env("LC_MESSAGES"),
    env("LANG"),
  ];
  const tags = values
    .filter((value): value is string => !!value)
    .map((value) => value.split(/[.@]/)[0].replace("_", "-"))
    .filter((tag) => tag && tag !== "C" && tag !== "POSIX");

  // Windows and some macOS setups have no LANG: ask the OS through ICU
  tags.push(Intl.DateTimeFormat().resolvedOptions().locale);
  return tags;
};

export const systemLocale = (env: Env): Locale =>
  detectLocale(systemLanguages(env));
