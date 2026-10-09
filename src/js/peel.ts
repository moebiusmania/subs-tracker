// The form dialog's enter and exit animation: the dialog peels on and off
// the page like a sticker, rendered with WebGL2. Adapted from the Peel
// component of Canvas UI (https://github.com/DavidHDev/canvas-ui,
// src/lib/Peel/PeelVanilla.ts): there the pointer drives the peel of live
// content, here a timed animation drives it on a snapshot of the dialog.
//
// Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0:
// the software may be used, copied, modified, merged, published and
// distributed as part of an application, website or product, provided this
// notice is included; the component itself may not be sold, sublicensed or
// redistributed, alone, in a bundle or as a ported version. THE SOFTWARE IS
// PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
//
// The snapshot needs the experimental html-in-canvas API (drawElementImage,
// Chrome behind the canvas-draw-element flag or an origin trial). Where it
// or WebGL2 is missing, supportsPeel() is false and the dialog slides in
// with CSS instead.

type PaintableCanvas = HTMLCanvasElement & {
  onpaint?: (() => void) | null;
  requestPaint?: () => void;
};

type ElementImageContext = CanvasRenderingContext2D & {
  drawElementImage?: (element: Element, x: number, y: number) => unknown;
};

export const supportsPeel = (): boolean => {
  const canvas = document.createElement("canvas") as PaintableCanvas;
  const context = canvas.getContext("2d") as ElementImageContext | null;
  return typeof context?.drawElementImage === "function" &&
    typeof canvas.requestPaint === "function" &&
    typeof WebGL2RenderingContext === "function";
};

// The sheet is a grid laid over the dialog's rect (uRect) on a canvas that
// covers the viewport (uView), so the peeled part can leave the dialog. It
// peels from the left edge: u runs from that edge, v along it.
const SHEET_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aGrid;
uniform vec2 uView;
uniform vec4 uRect;
uniform float uPeel;
uniform float uReveal;
uniform float uCurl;
uniform float uBow;
uniform float uFocal;
uniform float uBulge;
out vec2 vUv;
out float vShade;
out float vBack;
out vec2 vSide;

const float PI = 3.1415926;

void main () {
  vUv = aGrid;
  vec2 res = uRect.zw;
  float u = aGrid.x * res.x;
  float v = aGrid.y * res.y;

  float A = clamp(uPeel, 0.0, 1.0);
  float R = max(uCurl * A, 0.001);
  // The edge bows out most in the middle, where the shine sits
  float dv = (v - res.y * 0.5) / max(res.y * 0.28, 1.0);
  float c = A * uReveal + R + uBulge * A * exp(-dv * dv);

  float x = u;
  float z = 0.0;
  float sh = 0.0;
  // x grows with u on the flat sheet; where it shrinks the paper has turned
  // over and shows its back
  float slope = 1.0;
  if (A > 0.001 && u < c) {
    float theta = (c - u) / R;
    if (theta <= PI) {
      x = c - R * sin(theta);
      z = R * (1.0 - cos(theta));
      slope = cos(theta);
    } else {
      x = c + (theta - PI) * R;
      z = 2.0 * R;
      slope = -1.0;
    }
    sh = sin(clamp(theta, 0.0, PI));
  }
  z += uBow * A * sin(PI * v / max(res.y, 1.0)) * clamp(z / max(R, 1.0), 0.0, 1.5);
  z = clamp(z, -uFocal * 0.2, uFocal * 0.45);
  vShade = sh * smoothstep(0.0, 0.08, A);
  vBack = slope < 0.0 ? 1.0 : 0.0;
  vSide = vec2(u, v);

  vec2 screen = uRect.xy + vec2(x, v);
  vec2 ndc = (screen / uView) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  float w = (uFocal - z) / uFocal;
  gl_Position = vec4(ndc, -z / uFocal, w);
}`;

const SHEET_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
in float vShade;
in float vBack;
in vec2 vSide;
out vec4 outColor;
uniform sampler2D uContent;
uniform float uShade;
uniform float uShine;
uniform vec3 uShineColor;
uniform vec3 uBackColor;
uniform float uCross;
uniform float uAlpha;

void main () {
  vec4 tex = texture(uContent, clamp(vUv, vec2(0.001), vec2(0.999)));
  // The back of the paper: the card's colour, where the card is
  vec3 base = vBack > 0.5 ? uBackColor : tex.rgb;
  float sh = 1.0 - clamp(uShade, 0.0, 1.0) * 0.7 * pow(max(vShade, 0.0), 1.3);
  float du = max(vSide.x, 0.0);
  float line = exp(-du / 2.5) + exp(-du / 18.0) * 0.25;
  float dv = (vSide.y - uCross * 0.5) / max(uCross * 0.45, 1.0);
  float shine = uShine * line * exp(-dv * dv);
  vec3 rgb = mix(base * sh, uShineColor, clamp(shine, 0.0, 1.0));
  float alpha = tex.a * uAlpha;
  outColor = vec4(rgb * alpha, alpha);
}`;

const SEG = 96;

// Peel strength and timing, in CSS pixels and milliseconds
const SETTINGS = {
  enter: 700,
  exit: 520,
  shade: 0.25,
  shine: 0.6,
  bow: 60,
  bulge: 40,
  perspective: 2000,
};

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInCubic = (t: number) => t ** 3;

// A copy of the dialog to draw: Alpine must not pick it up, and ids,
// templates and autofocus would clash with the real one
const snapshotClone = (panel: HTMLElement): HTMLElement => {
  const clone = panel.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("template").forEach((template) => template.remove());
  for (const element of [clone, ...clone.querySelectorAll("*")]) {
    for (const { name } of [...element.attributes]) {
      if (/^(x-|@|:)|^(id|for|autofocus)$/.test(name)) {
        element.removeAttribute(name);
      }
    }
  }
  // Selected options aren't copied by cloneNode
  const selects = panel.querySelectorAll("select");
  clone.querySelectorAll("select").forEach((select, index) => {
    select.selectedIndex = selects[index]?.selectedIndex ?? 0;
  });
  return clone;
};

// Draws the panel into a canvas: the clone is laid out inside a
// layoutsubtree canvas at the panel's place, then drawElementImage paints it
const capture = async (
  panel: HTMLElement,
  host: HTMLElement,
  rect: DOMRect,
  dpr: number,
): Promise<HTMLCanvasElement | null> => {
  const source = document.createElement("canvas") as PaintableCanvas;
  const context = source.getContext("2d") as ElementImageContext | null;
  if (!context?.drawElementImage || !source.requestPaint) return null;

  const clone = snapshotClone(panel);
  // Two generations of the experimental API
  if ("content" in source) {
    source.setAttribute("content", "drawable");
    clone.setAttribute("drawable", "");
  } else {
    source.setAttribute("layoutsubtree", "");
  }
  source.className = "peel-canvas";
  Object.assign(source.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  Object.assign(clone.style, {
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    maxHeight: "none",
    margin: "0",
    opacity: "1",
    transition: "none",
  });
  source.width = Math.max(1, Math.round(rect.width * dpr));
  source.height = Math.max(1, Math.round(rect.height * dpr));
  source.append(clone);
  host.append(source);
  clone.scrollTop = panel.scrollTop;

  const painted = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 400);
    source.onpaint = () => {
      clearTimeout(timer);
      resolve(true);
    };
    source.requestPaint!();
  });
  source.onpaint = null;
  try {
    if (painted) {
      context.reset();
      context.drawElementImage(clone, 0, 0);
      return source;
    }
  } catch {
    // Fall through: no snapshot, no peel
  }
  source.remove();
  return null;
};

const rgb = (color: string): [number, number, number] => {
  const probe = document.createElement("canvas").getContext("2d", {
    willReadFrequently: true,
  });
  if (!probe) return [1, 1, 1];
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
};

// Plays the peel on panel: "in" lays the sheet down, "out" peels it off.
// The real panel is hidden (inline opacity) from the first frame; "in"
// expects it hidden already and shows it at the end, "out" leaves it hidden
// for the caller to close. Resolves false when it couldn't run, so the
// caller can fall back.
export const peel = async (
  panel: HTMLElement,
  host: HTMLElement,
  direction: "in" | "out",
): Promise<boolean> => {
  const rect = panel.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const dpr = Math.min(devicePixelRatio || 1, 2);

  const source = await capture(panel, host, rect, dpr);
  if (!source) return false;

  // Sized by CSS to the viewport, which is where rect is measured from
  const output = document.createElement("canvas");
  output.className = "peel-canvas peel-canvas--output";
  host.append(output);
  const view = { width: output.clientWidth, height: output.clientHeight };
  output.width = Math.max(1, Math.round(view.width * dpr));
  output.height = Math.max(1, Math.round(view.height * dpr));

  const gl = output.getContext("webgl2", {
    alpha: true,
    depth: true,
    stencil: false,
    antialias: true,
    premultipliedAlpha: true,
  });
  const cleanup = () => {
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    source.remove();
    output.remove();
  };
  if (!gl) {
    cleanup();
    return false;
  }

  const compile = (type: number, text: string): WebGLShader => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, SHEET_VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, SHEET_FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Peel shader error:", gl.getProgramInfoLog(program));
    cleanup();
    return false;
  }
  const uniform = (name: string) => gl.getUniformLocation(program, name);

  const vertices = new Float32Array((SEG + 1) * (SEG + 1) * 2);
  for (let y = 0; y <= SEG; y++) {
    for (let x = 0; x <= SEG; x++) {
      const i = (y * (SEG + 1) + x) * 2;
      vertices[i] = x / SEG;
      vertices[i + 1] = y / SEG;
    }
  }
  const indices = new Uint32Array(SEG * SEG * 6);
  let offset = 0;
  for (let y = 0; y < SEG; y++) {
    for (let x = 0; x < SEG; x++) {
      const a = y * (SEG + 1) + x;
      const c = a + SEG + 1;
      indices.set([a, c, a + 1, a + 1, c, c + 1], offset);
      offset += 6;
    }
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    source,
  );
  source.remove();

  // Light shine on dark cards, dark on light ones, like the original's
  // "auto"; the back of the paper is the card's own colour
  const back = rgb(getComputedStyle(panel).backgroundColor);
  const light = 0.2126 * back[0] + 0.7152 * back[1] + 0.0722 * back[2] > 0.5;
  const shine = light ? [0, 0, 0] : [1, 1, 1];

  gl.useProgram(program);
  gl.uniform1i(uniform("uContent"), 0);
  gl.uniform2f(uniform("uView"), view.width, view.height);
  gl.uniform4f(uniform("uRect"), rect.left, rect.top, rect.width, rect.height);
  // Far enough that, fully peeled, the sheet has turned over past its width
  gl.uniform1f(uniform("uReveal"), rect.width * 1.15);
  gl.uniform1f(uniform("uCurl"), Math.min(rect.width, rect.height) * 0.35);
  gl.uniform1f(uniform("uBow"), SETTINGS.bow);
  gl.uniform1f(uniform("uBulge"), SETTINGS.bulge);
  gl.uniform1f(uniform("uFocal"), SETTINGS.perspective);
  gl.uniform1f(uniform("uShade"), SETTINGS.shade);
  gl.uniform1f(uniform("uShine"), SETTINGS.shine);
  gl.uniform3f(uniform("uShineColor"), shine[0], shine[1], shine[2]);
  gl.uniform3f(uniform("uBackColor"), back[0], back[1], back[2]);
  gl.uniform1f(uniform("uCross"), rect.height);

  gl.viewport(0, 0, output.width, output.height);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  const draw = (amount: number) => {
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(uniform("uPeel"), amount);
    // Fades out at the end of the peel, once it has mostly turned over
    gl.uniform1f(
      uniform("uAlpha"),
      1 - Math.min(1, Math.max(0, (amount - 0.7) / 0.3)),
    );
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
  };

  const duration = direction === "in" ? SETTINGS.enter : SETTINGS.exit;
  const start = performance.now();
  draw(direction === "in" ? 1 : 0);
  panel.style.opacity = "0";
  await new Promise<void>((resolve) => {
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      draw(direction === "in" ? 1 - easeOutCubic(t) : easeInCubic(t));
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });

  if (direction === "in") panel.style.opacity = "";
  cleanup();
  return true;
};
