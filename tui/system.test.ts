import { assert, test } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  dataPath,
  displayPath,
  loadState,
  resolvePath,
  saveState,
  systemLanguages,
  systemLocale,
} from "./system.ts";
import type { AppState } from "../src/lib/types.ts";

const envOf = (values: Record<string, string>) => (name: string) =>
  values[name];

test("dataPath - XDG config dir, ~/.config or APPDATA", () => {
  assert.deepEqual(
    dataPath(envOf({ HOME: "/home/me", XDG_CONFIG_HOME: "/cfg" }), "linux"),
    "/cfg/subs-tracker/data.json",
  );
  assert.deepEqual(
    dataPath(envOf({ HOME: "/Users/me" }), "darwin"),
    "/Users/me/.config/subs-tracker/data.json",
  );
  assert.deepEqual(
    dataPath(envOf({ APPDATA: "C:\\AppData" }), "win32").endsWith(
      join("subs-tracker", "data.json"),
    ),
    true,
  );
});

test("dataPath - SUBS_TRACKER_DATA wins", () => {
  assert.deepEqual(
    dataPath(envOf({ SUBS_TRACKER_DATA: "/tmp/x.json", HOME: "/h" }), "linux"),
    "/tmp/x.json",
  );
});

test("displayPath and resolvePath - home as ~", () => {
  const env = envOf({ HOME: "/home/me" });
  assert.deepEqual(displayPath("/home/me/a.json", env), "~/a.json");
  assert.deepEqual(displayPath("/home/meh/a.json", env), "/home/meh/a.json");
  assert.deepEqual(resolvePath("~/a.json", env), "/home/me/a.json");
  assert.deepEqual(resolvePath(" /tmp/a.json ", env), "/tmp/a.json");
  assert.deepEqual(resolvePath("a.json", env), join(process.cwd(), "a.json"));
});

test("systemLanguages - POSIX locales as language tags", () => {
  const tags = systemLanguages(
    envOf({ LANGUAGE: "fr:de", LANG: "it_IT.UTF-8", LC_ALL: "C" }),
  );
  assert.deepEqual(tags.slice(0, 3), ["fr", "de", "it-IT"]);
});

test("systemLocale - first supported language", () => {
  assert.deepEqual(systemLocale(envOf({ LANG: "it_IT.UTF-8" })), "it");
  assert.deepEqual(systemLocale(envOf({ LC_ALL: "en_GB.UTF-8" })), "en");
  assert.deepEqual(
    systemLocale(envOf({ LANG: "de_DE@euro", LANGUAGE: "it" })),
    "it",
  );
});

const state: AppState = {
  language: "it",
  theme: "dark",
  currency: "€",
  data: [],
};

test("saveState and loadState - round trip in a new folder", () => {
  const dir = mkdtempSync(join(tmpdir(), "subs-tracker-"));
  try {
    const file = join(dir, "nested", "data.json");
    assert.deepEqual(loadState(file), null);
    saveState(file, state);
    assert.deepEqual(loadState(file), state);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("loadState - a broken file is moved aside", () => {
  const dir = mkdtempSync(join(tmpdir(), "subs-tracker-"));
  try {
    const file = join(dir, "data.json");
    writeFileSync(file, "{ not json");
    assert.deepEqual(loadState(file), null);
    assert.deepEqual(readFileSync(`${file}.bak`, "utf8"), "{ not json");
    assert.throws(() => statSync(file), /ENOENT/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
