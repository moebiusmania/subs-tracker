// Runs after both Vite builds (see build in package.json):
//
// - renders the app's shell (header, empty main, closed dialogs, footer) with
//   the server build into index.html, and copies it to add/ and edit/, which
//   open the form dialog over home. The browser shows it in English until
//   the app replaces it
// - fills in the service worker's precache list and a version hashed from
//   every built file, so any change to the site makes browsers install the
//   new worker. The app's code gets the same version, to tell whether it's
//   older than the worker (src/pwa.ts)
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { site } from "./site.ts";

const out = "_site";
const ssr = "_ssr";
const base = new URL(site).pathname;

// Pages with their own URL, all showing home
const pages = ["", "add/", "edit/"];

// Not precached: the worker itself, and files only crawlers fetch
const offline = (path: string) =>
  !["sw.js", "robots.txt", "og-image.png"].includes(path);

// The server build of src/entry-server.ts
const { render } = (await import(
  join(process.cwd(), ssr, "entry-server.js")
)) as { render: (base: string) => Promise<string> };

const template = await readFile(join(out, "index.html"), "utf8");
if (!template.includes("<!--app-->")) {
  throw new Error("index.html has no <!--app--> placeholder");
}
const shell = template.replace("<!--app-->", await render(base));

for (const page of pages) {
  const url = `${site}${page}`;
  const html = shell
    .replace(
      `<link rel="canonical" href="${site}"`,
      `<link rel="canonical" href="${url}"`,
    )
    .replace(
      `<meta property="og:url" content="${site}"`,
      `<meta property="og:url" content="${url}"`,
    );
  await mkdir(join(out, page), { recursive: true });
  await writeFile(join(out, page, "index.html"), html);
}
await rm(ssr, { recursive: true, force: true });

const files = (await readdir(out, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => relative(out, join(entry.parentPath, entry.name)))
  .map((path) => path.split("\\").join("/"))
  .sort();

const built = files.filter((path) => path !== "sw.js");
const contents = await Promise.all(
  built.map((path) => readFile(join(out, path))),
);
const digest = await crypto.subtle.digest(
  "SHA-256",
  await new Blob(
    built.flatMap((path, index) => [`${path}\n`, contents[index]!]),
  ).arrayBuffer(),
);
const version = Array.from(new Uint8Array(digest).slice(0, 6))
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");

const precache = built
  .filter(offline)
  .map((path) => `./${path.replace(/(^|\/)index\.html$/, "$1")}`);

for (const path of built.filter((path) => path.endsWith(".js"))) {
  const code = await readFile(join(out, path), "utf8");
  if (code.includes("__BUILD_VERSION__")) {
    await writeFile(
      join(out, path),
      code.replaceAll(/(["'`])__BUILD_VERSION__\1/g, JSON.stringify(version)),
    );
  }
}

const sw = await readFile(join(out, "sw.js"), "utf8");
await writeFile(
  join(out, "sw.js"),
  sw
    .replace(`"__SW_VERSION__"`, JSON.stringify(version))
    .replace(`"__SW_PRECACHE__"`, JSON.stringify(precache)),
);

console.log(`Prerendered ${pages.length} pages, version ${version}`);
