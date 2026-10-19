// Terminal version of Subscriptions tracker: `bun run tui`, or compiled to a
// single binary with `bun run tui:build`. Same features and data format as
// the web app, saved to a JSON file instead of localStorage.
import { readFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";

import { createStore } from "../src/lib/store.ts";
import { App } from "./app.ts";
import { decodeBuffer, type MouseEvent } from "./input.ts";
import { toKeys } from "./keys.ts";
import { Scene } from "./scene.ts";
import { createStyler, supportsTrueColor } from "./palette.ts";
import {
  dataPath,
  displayPath,
  loadState,
  resolvePath,
  saveState,
  systemLocale,
} from "./system.ts";

const env = (name: string): string | undefined => process.env[name];

const { stdin, stdout } = process;

if (!stdin.isTTY || !stdout.isTTY) {
  console.error("Subscriptions tracker needs an interactive terminal.");
  process.exit(1);
}

const file = dataPath(env, process.platform);
const store = createStore();
store.setSystemLocale(systemLocale(env));
const saved = loadState(file);
if (saved) store.setState(saved);

const write = (text: string) => stdout.write(text);

// The alternate screen, without a cursor, keeps the shell's scrollback as
// it was. Any-motion mouse tracking (1003) for hover, reported as SGR (1006)
const SETUP = "\x1b[?1049h\x1b[?25l\x1b[?1000h\x1b[?1003h\x1b[?1006h";
const RESTORE = "\x1b[?1006l\x1b[?1003l\x1b[?1000l\x1b[0m\x1b[?25h\x1b[?1049l";

const scene = new Scene(write, createStyler(supportsTrueColor(env)));

let queued = false;
const draw = () => {
  // Batch everything that happens in one tick into a single render
  if (queued) return;
  queued = true;
  setTimeout(() => {
    queued = false;
    scene.render(app.render().nodes);
  });
};

let running = true;
// Restores the terminal and exits on quit, Ctrl+C and SIGTERM
const quit = () => {
  if (!running) return;
  running = false;
  write(RESTORE);
  stdin.setRawMode(false);
  process.exit(0);
};

const app = new App({
  store,
  persist: () => saveState(file, store.getState),
  readFile: (path) => readFile(path, "utf8"),
  writeFile: (path, content) => writeFileSync(path, content),
  resolvePath: (path) => resolvePath(path, env),
  displayPath: (path) => displayPath(path, env),
  dataFile: displayPath(file, env),
  quit,
  schedule: (callback, ms) => {
    const id = setTimeout(callback, ms);
    return () => clearTimeout(id);
  },
  changed: draw,
  animate: true,
});

process.on("SIGTERM", quit);
process.on("SIGINT", quit);
// Leave the terminal usable even if something throws
process.on("exit", () => {
  if (running) write(RESTORE);
});

const resize = () => {
  const { columns, rows } = stdout;
  app.resize(columns, rows);
  scene.resize(columns, rows);
};
resize();
stdout.on("resize", () => {
  resize();
  draw();
});

// Returns true when the screen needs a redraw: moving the pointer only
// does when the hover changes
const mouse = (event: MouseEvent): boolean => {
  if ("scroll" in event) {
    app.wheel(event.x, event.y, event.scroll);
    return true;
  }
  const { x, y, button, release, drag } = event;
  if (button === 0 && !release && !drag) {
    app.click(x, y);
    return true;
  }
  return app.move(x, y);
};

stdin.setRawMode(true);
stdin.on("data", (buffer: Buffer) => {
  for (const event of decodeBuffer(new Uint8Array(buffer))) {
    if (event.key === "mouse") {
      if (mouse(event as MouseEvent)) draw();
      continue;
    }
    for (const key of toKeys(event)) app.key(key);
    draw();
  }
});

write(SETUP);
scene.render(app.render().nodes);
