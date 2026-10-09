// "How it works": a short motion graphic opened from the empty state. It's
// its own bundle (js/tour.js), imported by main.ts only when someone opens
// it, so it adds nothing to the page load.
//
// The scene is one SVG (640×360 user units) coloured with the app's CSS
// tokens, so it follows the theme. Every move is a Web Animation created up
// front with an absolute delay and fill "forwards": seeking or pausing the
// whole film is setting currentTime or calling pause() on all of them, and an
// element's starting look is its own attributes (anything appearing later
// starts at opacity 0). The cards have googly eyes: they're the
// subscriptions, first nibbling at the wallet, then tamed into the
// dashboard.

import type { I18n } from "./lib/types.ts";

export type TourState = {
  playing: boolean;
  scene: number;
  ended: boolean;
};

export type TourOptions = {
  // Read at every caption change, so a language switch shows up there
  strings: () => I18n;
  onChange: (state: TourState) => void;
  // Start paused on the first scene's last frame, and move scene by scene
  still: boolean;
};

export type Tour = {
  play: () => void;
  pause: () => void;
  // Jumps to a scene: its start when playing, its last frame when still
  goTo: (scene: number) => void;
  destroy: () => void;
};

type SceneName = keyof I18n["tour"]["scenes"];

// Each scene's start and the moment that sums it up (the still frame for
// reduced motion), in seconds, and the film's length
const SCENES: { name: SceneName; at: number; still: number }[] = [
  { name: "nibble", at: 0, still: 5.4 },
  { name: "add", at: 6.5, still: 11.0 },
  { name: "totals", at: 15, still: 20.4 },
  { name: "due", at: 22, still: 24.6 },
  { name: "inactive", at: 28, still: 32.0 },
  { name: "local", at: 34, still: 37.9 },
  { name: "end", at: 39, still: 41.8 },
];
const LENGTH = 43;

export const sceneCount = SCENES.length;

const NS = "http://www.w3.org/2000/svg";
const BOUNCE = "cubic-bezier(0.34, 1.45, 0.64, 1)";
const OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const IN = "cubic-bezier(0.55, 0, 1, 0.45)";

// Only for the elements drawn here: the dialog around them is in styles.css
const STYLE = `
.tour-svg { display: block; width: 100%; height: auto; font-family: var(--font-sans); }
.tour-svg text { fill: var(--color-text); }
.tour-svg .muted { fill: var(--color-text-muted); }
.tour-svg .serif { font-family: var(--font-serif); letter-spacing: -0.03em; }
.tour-svg .ember { fill: var(--color-accent-strong); }
.tour-svg .on-accent { fill: var(--color-on-accent); }
.tour-svg .move { transform-box: fill-box; transform-origin: center; }
.tour-svg .move-bottom { transform-box: fill-box; transform-origin: 50% 100%; }
.tour-svg .move-left { transform-box: fill-box; transform-origin: 0 50%; }
.tour-svg .move-right { transform-box: fill-box; transform-origin: 100% 50%; }
`;

type Attrs = Record<string, string | number>;

const svg = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  parent?: Element,
): SVGElementTagNameMap[K] => {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    element.setAttribute(name, String(value));
  }
  parent?.append(element);
  return element;
};

const label = (
  parent: Element,
  x: number,
  y: number,
  content: string,
  attrs: Attrs = {},
): SVGTextElement => {
  const text = svg("text", { x, y, ...attrs }, parent);
  text.textContent = content;
  return text;
};

// A group placed at (x, y) by attribute, with an inner group for CSS
// transforms: animating transform would otherwise drop the placement
const place = (
  parent: Element,
  x: number,
  y: number,
  origin = "move",
): SVGGElement => {
  const outer = svg("g", { transform: `translate(${x} ${y})` }, parent);
  return svg("g", { class: origin }, outer);
};

const hidden = (element: SVGElement): SVGElement => {
  element.style.opacity = "0";
  return element;
};

// Googly eyes: whites, pupils that can look around, lids for blinking
const eyes = (parent: Element, x: number, y: number, size = 7) => {
  const group = place(parent, x, y);
  const pupils: SVGGElement[] = [];
  for (const dx of [-size - 2, size + 2]) {
    svg("circle", {
      cx: dx,
      cy: 0,
      r: size,
      fill: "#ffffff",
      stroke: "var(--color-text)",
      "stroke-width": 1.5,
    }, group);
    const pupil = place(group, dx, 0);
    svg("circle", { cx: 0, cy: 0, r: size * 0.45, fill: "#22201d" }, pupil);
    pupils.push(pupil);
  }
  return { group, pupils };
};

type Card = {
  root: SVGGElement;
  body: SVGGElement;
  eyes: ReturnType<typeof eyes>;
  glow: SVGElement;
  sleep: SVGElement;
  zzz: SVGGElement;
  active: SVGElement;
  inactive: SVGElement;
  sweat: SVGGElement;
};

const CARD = { width: 170, height: 112 };

// One subscription card, as on the dashboard, with eyes on top
const card = (
  parent: Element,
  x: number,
  y: number,
  info: { name: string; price: string; recurrence: string; tint: string },
  t: I18n,
): Card => {
  const root = place(parent, x, y, "move-bottom");
  const body = svg("g", { class: "move" }, root);
  const glow = hidden(svg("rect", {
    x: -5,
    y: -5,
    width: CARD.width + 10,
    height: CARD.height + 10,
    rx: 16,
    fill: "none",
    stroke: "var(--color-accent)",
    "stroke-width": 8,
    "stroke-opacity": 0.35,
  }, body));
  svg("rect", {
    x: 0.5,
    y: 0.5,
    width: CARD.width - 1,
    height: CARD.height - 1,
    rx: 12,
    fill: "var(--color-surface)",
    stroke: "var(--color-border)",
  }, body);
  const sleep = hidden(svg("rect", {
    x: 0.5,
    y: 0.5,
    width: CARD.width - 1,
    height: CARD.height - 1,
    rx: 12,
    fill: "var(--color-surface-2)",
    stroke: "var(--color-field-border)",
    "stroke-dasharray": "5 4",
  }, body));
  svg("circle", { cx: 26, cy: 28, r: 15, fill: info.tint }, body);
  label(body, 26, 34, info.name.charAt(0), {
    class: "serif",
    "font-size": 17,
    "text-anchor": "middle",
  });
  label(body, 50, 26, info.name, { "font-size": 12.5, "font-weight": 500 });
  label(body, 50, 42, info.recurrence, { class: "muted", "font-size": 10.5 });
  label(body, 14, 80, info.price, { class: "serif", "font-size": 24 });
  svg("rect", { x: 14, y: 90, width: CARD.width - 28, height: 1 }, body)
    .setAttribute("fill", "var(--color-border)");

  // Status pill, both states drawn, one shown
  const pill = place(body, CARD.width - 52, 100);
  const active = svg("g", {}, pill);
  svg("rect", {
    x: -32,
    y: -9,
    width: 76,
    height: 18,
    rx: 9,
    fill: "var(--color-success-soft)",
  }, active);
  svg(
    "circle",
    { cx: -22, cy: 0, r: 2.5, fill: "var(--color-success)" },
    active,
  );
  label(active, -15, 3.5, t.main.active, {
    "font-size": 9.5,
    "font-weight": 500,
    style: "fill: var(--color-success)",
  });
  const inactive = hidden(svg("g", {}, pill));
  svg("rect", {
    x: -32,
    y: -9,
    width: 76,
    height: 18,
    rx: 9,
    fill: "var(--color-surface)",
    stroke: "var(--color-border)",
  }, inactive);
  svg("circle", {
    cx: -22,
    cy: 0,
    r: 2.5,
    fill: "none",
    stroke: "var(--color-text-muted)",
  }, inactive);
  label(inactive, -15, 3.5, t.main.inactive, {
    class: "muted",
    "font-size": 9.5,
    "font-weight": 500,
  });

  const cardEyes = eyes(root, CARD.width - 34, 0);
  const sweat = place(root, CARD.width - 6, 6);
  hidden(sweat);
  svg("path", {
    d: "M0 -7 C4 -1 5 2 0 5 C-5 2 -4 -1 0 -7Z",
    fill: "#8ec5ff",
    stroke: "#3b78b8",
    "stroke-width": 1,
  }, sweat);
  const zzz = place(root, CARD.width - 18, -18);
  hidden(zzz);
  label(zzz, 0, 0, "z", { class: "serif muted", "font-size": 14 });
  label(zzz, 10, -10, "z", { class: "serif muted", "font-size": 11 });
  label(zzz, 18, -18, "z", { class: "serif muted", "font-size": 8 });

  return {
    root,
    body,
    eyes: cardEyes,
    glow,
    sleep,
    zzz,
    active,
    inactive,
    sweat,
  };
};

// A text box that types its value: a cover in the field's colour shrinks
// from the left, in steps, like a caret moving on
const typing = (parent: Element, x: number, y: number, value: string) => {
  const group = svg("g", {}, parent);
  label(group, x, y, value, { "font-size": 12 });
  const width = value.length * 7.2 + 4;
  const cover = place(group, x - 1, y - 12, "move-right");
  svg("rect", {
    x: 0,
    y: 0,
    width,
    height: 16,
    fill: "var(--color-surface)",
  }, cover);
  return { cover, steps: value.length };
};

const cursorPath = "M0 0 L0 17 L4.5 13 L7.5 20 L10.5 18.6 L7.6 12 L13 12 Z";

const coin = (parent: Element, x: number, y: number) => {
  const group = place(parent, x, y);
  hidden(group);
  svg("circle", {
    r: 9,
    fill: "var(--color-accent)",
    stroke: "var(--color-accent-strong)",
    "stroke-width": 1.5,
  }, group);
  label(group, 0, 3.5, "€", {
    class: "on-accent",
    "font-size": 10,
    "font-weight": 600,
    "text-anchor": "middle",
  });
  return group;
};

export const createTour = (
  container: HTMLElement,
  options: TourOptions,
): Tour => {
  const t = options.strings();
  const animations: Animation[] = [];

  // Runs keyframes on target from `at` seconds for `duration` seconds
  const play = (
    target: Element,
    keyframes: Keyframe[],
    at: number,
    duration: number,
    extra: KeyframeAnimationOptions = {},
  ) => {
    const animation = target.animate(keyframes, {
      delay: at * 1000,
      duration: duration * 1000,
      fill: "forwards",
      easing: OUT,
      ...extra,
    });
    animation.pause();
    animations.push(animation);
  };
  const show = (target: Element, at: number, duration = 0.4, from = 0.6) =>
    play(
      target,
      [
        { opacity: 0, transform: `scale(${from})` },
        { opacity: 1, transform: "scale(1)" },
      ],
      at,
      duration,
      { easing: BOUNCE },
    );
  const fade = (target: Element, at: number, to = 0, duration = 0.35) =>
    play(target, [{ opacity: to }], at, duration, { easing: "ease" });
  const pop = (target: Element, at: number, scale = 1.12) =>
    play(
      target,
      [
        { transform: "scale(1)" },
        { transform: `scale(${scale})` },
        { transform: "scale(1)" },
      ],
      at,
      0.35,
      { fill: "none", easing: "ease-in-out" },
    );
  const blink = (target: SVGGElement, at: number) =>
    play(
      target,
      [
        { transform: "scaleY(1)" },
        { transform: "scaleY(0.1)" },
        { transform: "scaleY(1)" },
      ],
      at,
      0.22,
      { fill: "none", easing: "ease-in-out" },
    );
  const look = (pupils: SVGGElement[], at: number, dx: number, dy: number) =>
    pupils.forEach((pupil) =>
      play(pupil, [{ transform: `translate(${dx}px, ${dy}px)` }], at, 0.25)
    );
  // A value that crossfades in at `at` and out at `until`
  const swap = (target: Element, at: number, until?: number) => {
    hidden(target as SVGElement);
    play(target, [{ opacity: 0 }, { opacity: 1 }], at, 0.25, {
      easing: "ease",
    });
    if (until !== undefined) fade(target, until, 0, 0.25);
  };

  const style = document.createElement("style");
  style.textContent = STYLE;
  const root = svg("svg", {
    class: "tour-svg",
    viewBox: "0 0 640 360",
    role: "img",
    "aria-label": t.tour.title,
  });
  container.replaceChildren(style, root);
  svg("rect", {
    width: 640,
    height: 360,
    rx: 12,
    fill: "var(--color-bg)",
  }, root);

  // Scene 1: the wallet gets nibbled ------------------------------------

  const intro = svg("g", {}, root);
  const wallet = place(intro, 320, 215);
  hidden(wallet);
  const walletBody = svg("g", { class: "move" }, wallet);
  svg("rect", {
    x: -62,
    y: -42,
    width: 124,
    height: 84,
    rx: 14,
    fill: "var(--color-text)",
  }, walletBody);
  svg("rect", {
    x: 22,
    y: -16,
    width: 48,
    height: 32,
    rx: 10,
    fill: "var(--color-accent)",
  }, walletBody);
  svg("circle", { cx: 38, cy: 0, r: 5, fill: "var(--color-text)" }, walletBody);
  const walletEyes = eyes(walletBody, -22, -8, 8);
  const walletMouth = place(walletBody, -22, 16);
  svg("path", {
    d: "M-10 4 Q0 -4 10 4",
    fill: "none",
    stroke: "#ffffff",
    "stroke-width": 2.5,
    "stroke-linecap": "round",
  }, walletMouth);

  const nibblers = [
    { x: 120, y: 120, letter: "M", tint: "var(--tint-lav)" },
    { x: 520, y: 120, letter: "V", tint: "var(--tint-peach)" },
    { x: 320, y: 70, letter: "C", tint: "var(--tint-sky)" },
  ].map(({ x, y, letter, tint }) => {
    const group = place(intro, x, y);
    hidden(group);
    svg("rect", {
      x: -34,
      y: -24,
      width: 68,
      height: 48,
      rx: 10,
      fill: "var(--color-surface)",
      stroke: "var(--color-border)",
    }, group);
    svg("circle", { cx: -14, cy: 8, r: 10, fill: tint }, group);
    label(group, -14, 12.5, letter, {
      class: "serif",
      "font-size": 12,
      "text-anchor": "middle",
    });
    const mouth = place(group, 12, 10);
    svg("ellipse", { cx: 0, cy: 0, rx: 8, ry: 5, fill: "#22201d" }, mouth);
    const nibblerEyes = eyes(group, 8, -26, 6);
    return { x, y, group, mouth, eyes: nibblerEyes };
  });

  show(wallet, 0.2, 0.5);
  nibblers.forEach((nibbler, index) => {
    show(nibbler.group, 0.7 + index * 0.3, 0.5, 0.2);
    look(nibbler.eyes.pupils, 1.4, nibbler.x < 320 ? 2 : -2, 2);
  });
  look(walletEyes.pupils, 1.4, 0, -2);

  // Coins fly off the wallet in an arc, into a mouth that chomps
  for (let i = 0; i < 6; i++) {
    const nibbler = nibblers[i % 3];
    const at = 1.9 + i * 0.55;
    const flying = coin(intro, 320, 200);
    const dx = nibbler.x + 12 - 320;
    const dy = nibbler.y + 10 - 200;
    play(
      flying,
      [
        { opacity: 1, transform: "translate(0, 0) scale(0.8)" },
        {
          opacity: 1,
          transform: `translate(${dx / 2}px, ${dy / 2 - 50}px) scale(1.1)`,
          offset: 0.5,
        },
        { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(0.5)` },
      ],
      at,
      0.5,
      { easing: "ease-in-out" },
    );
    play(
      nibbler.mouth,
      [
        { transform: "scale(1)" },
        { transform: "scale(1.5, 0.3)" },
        { transform: "scale(1)" },
        { transform: "scale(1.5, 0.3)" },
        { transform: "scale(1)" },
      ],
      at + 0.45,
      0.4,
      { fill: "none", easing: "linear" },
    );
    pop(walletBody, at, 0.94);
  }
  blink(walletEyes.group, 2.6);
  look(walletEyes.pupils, 3.2, -3, 0);
  look(walletEyes.pupils, 4.0, 3, 0);
  // The wallet shrinks and gets worried
  play(walletBody, [{ transform: "scale(0.72)" }], 4.4, 1.2, { easing: OUT });
  play(walletMouth, [{ transform: "scaleY(-1)" }], 4.4, 0.3);
  fade(intro, 6.1);

  // Scene 2: add a subscription -----------------------------------------

  const form = place(root, 170, 36);
  hidden(form);
  svg("rect", {
    x: 0,
    y: 0,
    width: 300,
    height: 278,
    rx: 12,
    fill: "var(--color-surface)",
    stroke: "var(--color-border)",
  }, form);
  label(form, 20, 36, t.add.title, { class: "serif", "font-size": 19 });
  const fields = [
    { name: t.add.name, value: t.tour.video },
    { name: t.add.price, value: "13.99€" },
    { name: t.add.recurrence, value: t.recurrence.monthly },
  ].map(({ name, value }, index) => {
    const y = 64 + index * 58;
    label(form, 20, y, name, { "font-size": 10.5, "font-weight": 500 });
    svg("rect", {
      x: 20,
      y: y + 8,
      width: 260,
      height: 28,
      rx: 8,
      fill: "var(--color-surface)",
      stroke: "var(--color-field-border)",
    }, form);
    return typing(form, 30, y + 27, value);
  });
  const addButton = place(form, 222, 248);
  svg("rect", {
    x: -46,
    y: -16,
    width: 92,
    height: 32,
    rx: 16,
    fill: "var(--color-accent)",
  }, addButton);
  label(addButton, 0, 4.5, t.tour.addButton, {
    class: "on-accent",
    "font-size": 12,
    "font-weight": 500,
    "text-anchor": "middle",
  });

  show(form, 6.6, 0.5, 0.85);
  // Typing, field after field
  [7.5, 9.0, 10.3].forEach((at, index) => {
    const { cover, steps } = fields[index];
    play(
      cover,
      [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }],
      at,
      Math.min(1, steps * 0.07),
      {
        easing: index === 2 ? "ease-out" : `steps(${steps})`,
      },
    );
  });
  pop(addButton, 11.2, 0.9);
  play(
    form,
    [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(0.4) translateY(80px)" },
    ],
    11.5,
    0.45,
    { easing: IN },
  );

  // The dashboard: three cards, the new one drops in --------------------

  const dash = svg("g", { class: "move" }, root);
  hidden(dash);
  const stats = svg("g", {}, dash);
  hidden(stats);
  svg("rect", {
    x: 40.5,
    y: 24.5,
    width: 560,
    height: 92,
    rx: 12,
    fill: "var(--color-surface)",
    stroke: "var(--color-border)",
  }, stats);
  svg("rect", {
    x: 320,
    y: 25,
    width: 1,
    height: 91,
    fill: "var(--color-border)",
  }, stats);
  label(stats, 60, 50, t.main.monthly.toUpperCase(), {
    class: "muted",
    "font-size": 9.5,
    "font-weight": 500,
    "letter-spacing": 0.8,
  });
  label(stats, 340, 50, t.main.yearly.toUpperCase(), {
    class: "muted",
    "font-size": 9.5,
    "font-weight": 500,
    "letter-spacing": 0.8,
  });
  const number = (x: number, value: string) => {
    const group = place(stats, x, 92, "move-left");
    label(group, 0, 0, value, { class: "serif", "font-size": 34 });
    return group;
  };

  const cards = [
    {
      name: t.tour.music,
      price: "10.99€",
      recurrence: t.recurrence.monthly,
      tint: "var(--tint-lav)",
    },
    {
      name: t.tour.video,
      price: "13.99€",
      recurrence: t.recurrence.monthly,
      tint: "var(--tint-peach)",
    },
    {
      name: t.tour.cloud,
      price: "99.99€",
      recurrence: t.recurrence.yearly,
      tint: "var(--tint-sky)",
    },
  ].map((info, index) => card(dash, 40 + index * 195, 160, info, t));
  const [music, video, cloud] = cards;

  fade(dash, 11.8, 1, 0.01);
  hidden(music.root);
  hidden(video.root);
  hidden(cloud.root);
  show(music.root, 11.9, 0.45, 0.8);
  show(cloud.root, 12.05, 0.45, 0.8);
  play(
    video.root,
    [
      { opacity: 0, transform: "translateY(-160px)" },
      { opacity: 1, transform: "translateY(-160px)", offset: 0.1 },
      { opacity: 1, transform: "translateY(0)" },
    ],
    12.2,
    0.7,
    { easing: BOUNCE },
  );
  play(
    video.root,
    [
      { transform: "scale(1, 1)" },
      { transform: "scale(1.06, 0.9)" },
      { transform: "scale(1, 1)" },
    ],
    12.85,
    0.3,
    { fill: "none", easing: "ease-out" },
  );
  cards.forEach((each, index) => {
    blink(each.eyes.group, 13.4 + index * 0.25);
    look(each.eyes.pupils, 13.9, index - 1, -2);
  });

  // Scene 3: the totals count themselves --------------------------------

  show(stats, 15.1, 0.45, 0.9);
  const monthly = [
    number(60, "0.00€"),
    number(60, "10.99€"),
    number(60, "24.98€"),
    number(60, "13.99€"),
  ];
  swap(monthly[0], 15.3, 15.7);
  swap(monthly[1], 15.75, 16.15);
  swap(monthly[2], 16.2, 29.6);
  swap(monthly[3], 29.65);
  pop(music.body, 15.7, 1.06);
  pop(video.body, 16.15, 1.06);
  pop(monthly[2], 16.25, 1.12);

  // ×12 stamped on, then the yearly figure, then the yearly card
  const stamp = place(stats, 250, 74);
  hidden(stamp);
  svg("rect", {
    x: -26,
    y: -15,
    width: 52,
    height: 30,
    rx: 8,
    fill: "none",
    stroke: "var(--color-accent-strong)",
    "stroke-width": 2.5,
  }, stamp);
  label(stamp, 0, 6.5, "×12", {
    class: "serif ember",
    "font-size": 19,
    "text-anchor": "middle",
  });
  play(
    stamp,
    [
      { opacity: 0, transform: "scale(2.6) rotate(-18deg)" },
      { opacity: 1, transform: "scale(1) rotate(-8deg)" },
    ],
    17.0,
    0.3,
    { easing: IN },
  );
  pop(stats, 17.3, 1.02);
  const yearly = [
    number(340, "299.76€"),
    number(340, "399.75€"),
    number(340, "267.87€"),
  ];
  swap(yearly[0], 17.6, 18.5);
  swap(yearly[1], 18.55, 29.6);
  swap(yearly[2], 29.65);
  const plus = place(stats, 470, 62);
  hidden(plus);
  label(plus, 0, 0, "+99.99€", {
    class: "ember",
    "font-size": 12,
    "font-weight": 600,
  });
  play(
    plus,
    [
      { opacity: 0, transform: "translateY(10px)" },
      { opacity: 1, transform: "translateY(0)", offset: 0.3 },
      { opacity: 0, transform: "translateY(-14px)" },
    ],
    18.1,
    1.0,
    { easing: "ease-out" },
  );
  pop(cloud.body, 18.1, 1.06);
  // Gulp: big number, wide eyes, a sweat drop
  play(
    yearly[1],
    [
      { transform: "scale(1)" },
      { transform: "scale(1.25)" },
      { transform: "scale(1.12) rotate(-2deg)" },
      { transform: "scale(1.12) rotate(2deg)" },
      { transform: "scale(1)" },
    ],
    18.8,
    0.9,
    { fill: "none", easing: "ease-in-out" },
  );
  cards.forEach((each, index) => {
    play(
      each.eyes.group,
      [{ transform: "scale(1.25)" }],
      19.0 + index * 0.08,
      0.25,
      { easing: BOUNCE },
    );
    look(each.eyes.pupils, 19.0, 0, -3);
    play(
      each.sweat,
      [
        { opacity: 0, transform: "translateY(-4px)" },
        { opacity: 1, transform: "translateY(0)", offset: 0.2 },
        { opacity: 1, transform: "translateY(18px)", offset: 0.85 },
        { opacity: 0, transform: "translateY(24px)" },
      ],
      19.3 + index * 0.2,
      1.4,
      { easing: "ease-in", fill: "none" },
    );
    play(each.eyes.group, [{ transform: "scale(1)" }], 21.2, 0.3);
    look(each.eyes.pupils, 21.2, 0, 0);
  });
  fade(stamp, 21.5);

  // Scene 4: due this month ---------------------------------------------

  fade(video.glow, 22.3, 1, 0.3);
  play(
    video.glow,
    [
      { strokeOpacity: 0.35 },
      { strokeOpacity: 0.9 },
      { strokeOpacity: 0.35 },
    ],
    22.6,
    1.2,
    { fill: "none", iterations: 4, easing: "ease-in-out" },
  );
  // Left of the card's eyes
  const badge = place(dash, 235 + 62, 146);
  hidden(badge);
  const badgeWidth = t.main.thisMonth.length * 6.4 + 22;
  svg("rect", {
    x: -badgeWidth / 2,
    y: -11,
    width: badgeWidth,
    height: 22,
    rx: 11,
    fill: "var(--color-accent-soft)",
    stroke: "var(--color-accent)",
  }, badge);
  label(badge, 0, 4, t.main.thisMonth.toUpperCase(), {
    class: "ember",
    "font-size": 9,
    "font-weight": 600,
    "letter-spacing": 0.6,
    "text-anchor": "middle",
  });
  show(badge, 22.5, 0.45, 0.4);

  // An alarm clock rattles next to it
  const clock = place(dash, 235 + CARD.width + 18, 140);
  hidden(clock);
  svg(
    "circle",
    { cx: -9, cy: -13, r: 6, fill: "var(--color-accent-strong)" },
    clock,
  );
  svg(
    "circle",
    { cx: 9, cy: -13, r: 6, fill: "var(--color-accent-strong)" },
    clock,
  );
  svg("circle", {
    r: 15,
    fill: "var(--color-surface)",
    stroke: "var(--color-text)",
    "stroke-width": 2.5,
  }, clock);
  svg("path", {
    d: "M0 -8 V0 L6 4",
    fill: "none",
    stroke: "var(--color-text)",
    "stroke-width": 2,
    "stroke-linecap": "round",
  }, clock);
  show(clock, 22.8, 0.4, 0.3);
  play(
    clock,
    [
      { transform: "rotate(0deg)" },
      { transform: "rotate(-14deg)" },
      { transform: "rotate(14deg)" },
      { transform: "rotate(0deg)" },
    ],
    23.3,
    0.18,
    { fill: "none", iterations: 10, easing: "linear" },
  );
  play(
    video.root,
    [
      { transform: "translateY(0)" },
      { transform: "translateY(-6px)" },
      { transform: "translateY(0)" },
    ],
    23.3,
    0.36,
    { fill: "none", iterations: 4, easing: "ease-in-out" },
  );
  look(video.eyes.pupils, 23.3, 3, -3);
  look(video.eyes.pupils, 26.5, 0, 0);
  fade(clock, 27.4);

  // Scene 5: pause one ---------------------------------------------------

  const cursor = place(root, 330, 330, "move");
  hidden(cursor);
  svg("path", {
    d: cursorPath,
    fill: "var(--color-text)",
    stroke: "var(--color-surface)",
    "stroke-width": 1.5,
    "stroke-linejoin": "round",
  }, cursor);
  // The cursor fills in the form in scene 2 too
  fade(cursor, 7.1, 1, 0.2);
  const to = (x: number, y: number, at: number, duration = 0.45) =>
    play(
      cursor,
      [{ transform: `translate(${x - 330}px, ${y - 330}px)` }],
      at,
      duration,
      {
        easing: "ease-in-out",
      },
    );
  const click = (at: number) =>
    play(
      cursor,
      [
        { scale: "1" },
        { scale: "0.8" },
        { scale: "1" },
      ],
      at,
      0.2,
      { fill: "none" },
    );
  to(300, 128, 7.1);
  click(7.4);
  to(300, 186, 8.6);
  click(8.9);
  to(300, 244, 9.9);
  click(10.2);
  to(395, 286, 10.8);
  click(11.15);
  fade(cursor, 11.6);
  fade(cursor, 28.2, 1, 0.2);
  to(150, 262, 28.2, 0.6);
  click(28.9);
  fade(cursor, 29.5);

  fade(music.sleep, 29.1, 1, 0.3);
  play(music.active, [{ opacity: 0 }], 29.05, 0.2);
  fade(music.inactive, 29.1, 1, 0.2);
  play(music.eyes.group, [{ transform: "scaleY(0.12)" }], 29.3, 0.35, {
    easing: "ease-in",
  });
  fade(music.zzz, 29.6, 1, 0.3);
  play(
    music.zzz,
    [
      { transform: "translate(0, 4px)" },
      { transform: "translate(4px, -6px)" },
      { transform: "translate(0, 4px)" },
    ],
    29.6,
    1.6,
    { fill: "none", iterations: 3, easing: "ease-in-out" },
  );
  pop(monthly[3], 29.7, 1.12);
  play(music.body, [{ opacity: 0.75 }], 29.1, 0.3, { composite: "replace" });

  // Scene 6: it all lives on your device ----------------------------------

  const phone = place(root, 320, 186);
  hidden(phone);
  svg("rect", {
    x: -66,
    y: -126,
    width: 132,
    height: 252,
    rx: 22,
    fill: "var(--color-surface)",
    stroke: "var(--color-text)",
    "stroke-width": 4,
  }, phone);
  svg("rect", {
    x: -16,
    y: -114,
    width: 32,
    height: 6,
    rx: 3,
    fill: "var(--color-text)",
  }, phone);
  show(phone, 34.1, 0.5, 0.7);
  play(dash, [{ transform: "translate(0px, 12px) scale(0.2)" }], 34.3, 0.8, {
    easing: OUT,
  });
  fade(music.zzz, 34.3, 0, 0.2);
  fade(badge, 34.3, 0, 0.2);
  fade(video.glow, 34.3, 0, 0.2);

  const lock = place(root, 320, 248);
  hidden(lock);
  svg("path", {
    d: "M-9 -6 V-13 A9 9 0 0 1 9 -13 V-6",
    fill: "none",
    stroke: "var(--color-accent-strong)",
    "stroke-width": 4,
  }, lock);
  svg("rect", {
    x: -15,
    y: -7,
    width: 30,
    height: 24,
    rx: 5,
    fill: "var(--color-accent)",
  }, lock);
  svg("circle", { cx: 0, cy: 4, r: 3.5, fill: "var(--color-on-accent)" }, lock);
  show(lock, 35.3, 0.45, 0.2);

  const file = place(root, 470, 186);
  hidden(file);
  svg("path", {
    d: "M-26 -34 H12 L26 -20 V34 H-26 Z",
    fill: "var(--color-surface)",
    stroke: "var(--color-text)",
    "stroke-width": 2.5,
    "stroke-linejoin": "round",
  }, file);
  svg("path", {
    d: "M12 -34 V-20 H26",
    fill: "none",
    stroke: "var(--color-text)",
    "stroke-width": 2.5,
  }, file);
  label(file, 0, 6, "JSON", {
    "font-size": 11,
    "font-weight": 600,
    "text-anchor": "middle",
  });
  label(file, 0, 56, t.backup.export, {
    class: "muted",
    "font-size": 10.5,
    "text-anchor": "middle",
  });
  const arrow = svg("path", {
    d: "M392 186 H432 M424 178 L432 186 L424 194",
    fill: "none",
    stroke: "var(--color-accent-strong)",
    "stroke-width": 3,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  }, root);
  hidden(arrow);
  fade(arrow, 36.2, 1, 0.3);
  play(
    file,
    [
      { opacity: 0, transform: "translateX(-60px) scale(0.4)" },
      { opacity: 1, transform: "translateX(0) scale(1)" },
    ],
    36.3,
    0.6,
    { easing: BOUNCE },
  );
  pop(file, 37.4, 1.08);

  // Scene 7: your turn ------------------------------------------------------

  fade(phone, 38.9);
  fade(lock, 38.9);
  fade(file, 38.9);
  fade(arrow, 38.9);
  fade(dash, 38.9);

  const finale = place(root, 320, 180);
  hidden(finale);
  label(finale, 0, 10, t.tour.scenes.end, {
    class: "serif",
    "font-size": 46,
    "text-anchor": "middle",
  });
  show(finale, 39.2, 0.6, 0.3);
  const finaleEyes = eyes(root, 320, 120, 12);
  hidden(finaleEyes.group);
  show(finaleEyes.group, 39.5, 0.4, 0.2);
  blink(finaleEyes.group, 40.6);
  look(finaleEyes.pupils, 41.0, -4, 2);
  look(finaleEyes.pupils, 41.6, 4, 2);

  // Confetti in the palette's colours
  const colours = [
    "var(--color-accent)",
    "var(--color-accent-strong)",
    "var(--color-text)",
    "var(--tint-peach)",
    "var(--color-success)",
  ];
  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const distance = 120 + (i * 37) % 140;
    const piece = svg("rect", {
      x: 317,
      y: 167,
      width: 6,
      height: 10,
      rx: 1.5,
      fill: colours[i % colours.length],
      class: "move",
    }, root);
    hidden(piece);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance * 0.6;
    play(
      piece,
      [
        { opacity: 1, transform: "translate(0, 0) rotate(0deg)" },
        {
          opacity: 1,
          transform: `translate(${dx}px, ${dy}px) rotate(${
            (i % 2 ? 1 : -1) * 260
          }deg)`,
          offset: 0.55,
        },
        {
          opacity: 0,
          transform: `translate(${dx * 1.1}px, ${dy + 90}px) rotate(${
            (i % 2 ? 1 : -1) * 420
          }deg)`,
        },
      ],
      39.25 + (i % 6) * 0.03,
      1.9,
      { easing: "ease-out" },
    );
  }

  // Playback ------------------------------------------------------------

  // A silent animation the length of the film: its clock is the film's
  const clockAnimation = root.animate([{ opacity: 1 }, { opacity: 1 }], {
    duration: LENGTH * 1000,
    fill: "forwards",
  });
  clockAnimation.pause();
  const all = [clockAnimation, ...animations];

  let playing = false;
  let frame = 0;
  let scene = -1;
  let ended = false;

  const now = () => Number(clockAnimation.currentTime ?? 0) / 1000;
  const sceneAt = (time: number) =>
    SCENES.reduce((found, each, index) => time >= each.at ? index : found, 0);

  const report = () => {
    options.onChange({ playing, scene, ended });
  };
  const sync = () => {
    const time = now();
    const current = sceneAt(time);
    const finished = time >= LENGTH - 0.01;
    if (current !== scene || finished !== ended) {
      scene = current;
      ended = finished;
      if (ended) playing = false;
      report();
    }
    if (playing) frame = requestAnimationFrame(sync);
  };

  // play() on an animation past its end rewinds it to the start, so only
  // the ones still to come run; the others stay paused on their last frame
  const resume = () => {
    const time = now() * 1000;
    for (const animation of all) {
      const end = Number(animation.effect?.getComputedTiming().endTime ?? 0);
      if (time < end) animation.play();
      else animation.pause();
    }
  };

  const seek = (time: number) => {
    for (const animation of all) animation.currentTime = time * 1000;
    if (playing) resume();
    cancelAnimationFrame(frame);
    sync();
  };

  const tour: Tour = {
    play: () => {
      if (now() >= LENGTH - 0.01) seek(0);
      playing = true;
      resume();
      report();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    },
    pause: () => {
      playing = false;
      for (const animation of all) animation.pause();
      cancelAnimationFrame(frame);
      report();
    },
    goTo: (index) => {
      const target = SCENES[Math.max(0, Math.min(SCENES.length - 1, index))];
      seek(options.still && !playing ? target.still : target.at);
    },
    destroy: () => {
      cancelAnimationFrame(frame);
      for (const animation of all) animation.cancel();
      container.replaceChildren();
    },
  };

  if (options.still) {
    tour.goTo(0);
  } else {
    tour.play();
  }
  return tour;
};

// The caption of a scene, for the dialog to show
export const caption = (t: I18n, scene: number): string =>
  t.tour.scenes[SCENES[Math.max(0, Math.min(SCENES.length - 1, scene))].name];
