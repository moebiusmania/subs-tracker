import lume from "lume/mod.ts";
import esbuild from "lume/plugins/esbuild.ts";

const site = lume({ src: "./src" });

site.use(esbuild());

// Copied as they are: Lume only hands pages (HTML and the bundled JS) to
// processors, so the service worker below reads these from disk
const assets = [
  "styles.css",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "favicon.svg",
  "favicon.ico",
  "robots.txt",
];

site.add("js/main.ts");
site.add("sw.js");
assets.forEach((file) => site.add(file));

// Fill in the service worker's precache list and a version hashed from every
// built file, so any change to the site makes browsers install the new worker
site.process([".js"], async (_pages, allPages) => {
  const sw = allPages.find((page) => page.data.url === "/sw.js");
  if (!sw) return;

  const pages = allPages.filter((page) => page !== sw);
  const offline = assets.filter((file) => file !== "robots.txt");
  const precache = [
    ...pages.map((page) => `.${page.data.url}`),
    ...offline.map((file) => `./${file}`),
  ];

  const files = await new Blob([
    ...pages.map((page) => `${page.data.url}\n${page.content as string}`),
    ...await Promise.all(assets.map((file) => Deno.readFile(site.src(file)))),
  ]).arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", files);
  const version = Array.from(new Uint8Array(digest).slice(0, 6))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  sw.content = (sw.content as string)
    .replace(`"__SW_VERSION__"`, JSON.stringify(version))
    .replace(`"__SW_PRECACHE__"`, JSON.stringify(precache));
});

export default site;
