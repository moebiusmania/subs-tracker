// Terminal version of Subscriptions tracker: `deno task tui`, or compiled to a
// single binary with `deno task tui:build`. Same features and data format as
// the web app, saved to a JSON file instead of localStorage.
import { emitInputEvents, Tui } from "deno_tui/mod.ts";
import type {
  MousePressEvent,
  MouseScrollEvent,
} from "deno_tui/src/input_reader/types.ts";
import { createStore } from "../src/js/lib/store.ts";
import { App } from "./app.ts";
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

const env = (name: string): string | undefined => Deno.env.get(name);

if (!Deno.stdin.isTerminal() || !Deno.stdout.isTerminal()) {
  console.error("Subscriptions tracker needs an interactive terminal.");
  Deno.exit(1);
}

const file = dataPath(env, Deno.build.os);
const store = createStore();
store.setSystemLocale(systemLocale(env));
const saved = loadState(file);
if (saved) store.setState(saved);

const encoder = new TextEncoder();
const write = (text: string) => Deno.stdout.writeSync(encoder.encode(text));

// Any-motion mouse tracking (1003) for hover, reported as SGR (1006)
const MOUSE_ON = "\x1b[?1000h\x1b[?1003h\x1b[?1006h";
const MOUSE_OFF = "\x1b[?1006l\x1b[?1003l\x1b[?1000l";

const tui = new Tui({ refreshRate: 1000 / 60 });
const scene = new Scene(tui.canvas, createStyler(supportsTrueColor(env)));

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

const quit = () => tui.emit("destroy");

const app = new App({
  store,
  persist: () => saveState(file, store.getState),
  readFile: (path) => Deno.readTextFile(path),
  writeFile: (path, content) => Deno.writeTextFileSync(path, content),
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

tui.on("destroy", () => {
  write(MOUSE_OFF);
});
// Restores the terminal and exits on quit, Ctrl+C and SIGTERM
tui.dispatch();

const size = tui.canvas.size;
app.resize(size.peek().columns, size.peek().rows);
size.subscribe(({ columns, rows }) => {
  app.resize(columns, rows);
  draw();
});

tui.on("keyPress", (event) => {
  for (const key of toKeys(event)) app.key(key);
  draw();
});

tui.on("mouseEvent", (event) => {
  if ("scroll" in event) {
    const { x, y, scroll } = event as MouseScrollEvent;
    if (scroll) {
      app.wheel(x, y, scroll);
      draw();
    }
    return;
  }
  const { x, y, button, release, drag } = event as MousePressEvent;
  if (button === 0 && !release && !drag) {
    app.click(x, y);
    draw();
  } else if (app.move(x, y)) {
    draw();
  }
});

tui.run();
write(MOUSE_ON);
scene.render(app.render().nodes);
emitInputEvents(tui.stdin, tui, 1000 / 120);
