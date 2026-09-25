import { assertEquals, assertThrows } from "@std/assert";
import { join } from "@std/path";

import {
  dataPath,
  displayPath,
  loadState,
  resolvePath,
  saveState,
  systemLanguages,
  systemLocale,
} from "./system.ts";
import type { AppState } from "../src/js/lib/types.ts";

const envOf = (values: Record<string, string>) => (name: string) =>
  values[name];

Deno.test("dataPath - XDG config dir, ~/.config or APPDATA", () => {
  assertEquals(
    dataPath(envOf({ HOME: "/home/me", XDG_CONFIG_HOME: "/cfg" }), "linux"),
    "/cfg/subs-tracker/data.json",
  );
  assertEquals(
    dataPath(envOf({ HOME: "/Users/me" }), "darwin"),
    "/Users/me/.config/subs-tracker/data.json",
  );
  assertEquals(
    dataPath(envOf({ APPDATA: "C:\\AppData" }), "windows")
      .endsWith(join("subs-tracker", "data.json")),
    true,
  );
});

Deno.test("dataPath - SUBS_TRACKER_DATA wins", () => {
  assertEquals(
    dataPath(envOf({ SUBS_TRACKER_DATA: "/tmp/x.json", HOME: "/h" }), "linux"),
    "/tmp/x.json",
  );
});

Deno.test("displayPath and resolvePath - home as ~", () => {
  const env = envOf({ HOME: "/home/me" });
  assertEquals(displayPath("/home/me/a.json", env), "~/a.json");
  assertEquals(displayPath("/home/meh/a.json", env), "/home/meh/a.json");
  assertEquals(resolvePath("~/a.json", env), "/home/me/a.json");
  assertEquals(resolvePath(" /tmp/a.json ", env), "/tmp/a.json");
  assertEquals(resolvePath("a.json", env), join(Deno.cwd(), "a.json"));
});

Deno.test("systemLanguages - POSIX locales as language tags", () => {
  const tags = systemLanguages(
    envOf({ LANGUAGE: "fr:de", LANG: "it_IT.UTF-8", LC_ALL: "C" }),
  );
  assertEquals(tags.slice(0, 3), ["fr", "de", "it-IT"]);
});

Deno.test("systemLocale - first supported language", () => {
  assertEquals(systemLocale(envOf({ LANG: "it_IT.UTF-8" })), "it");
  assertEquals(systemLocale(envOf({ LC_ALL: "en_GB.UTF-8" })), "en");
  assertEquals(
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

Deno.test("saveState and loadState - round trip in a new folder", () => {
  const dir = Deno.makeTempDirSync();
  try {
    const file = join(dir, "nested", "data.json");
    assertEquals(loadState(file), null);
    saveState(file, state);
    assertEquals(loadState(file), state);
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("loadState - a broken file is moved aside", () => {
  const dir = Deno.makeTempDirSync();
  try {
    const file = join(dir, "data.json");
    Deno.writeTextFileSync(file, "{ not json");
    assertEquals(loadState(file), null);
    assertEquals(Deno.readTextFileSync(`${file}.bak`), "{ not json");
    assertThrows(() => Deno.statSync(file), Deno.errors.NotFound);
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});
