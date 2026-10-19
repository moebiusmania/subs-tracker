import { defineConfig, type Plugin } from "vitest/config";
import vue from "@vitejs/plugin-vue";

import en from "./src/i18n/en.json" with { type: "json" };
import it from "./src/i18n/it.json" with { type: "json" };
import { site } from "./scripts/site.ts";

// Fills the {{ … }} placeholders in index.html: {{ site }}, {{ locales }}
// and the English strings ({{ meta.title }}). Crawlers don't run JS, so the
// head stays in English
const htmlStrings = (): Plugin => ({
  name: "subs-tracker:html-strings",
  transformIndexHtml: {
    order: "pre",
    handler: (html) =>
      html.replace(/\{\{ ([\w.]+) \}\}/g, (_, path: string) => {
        if (path === "site") return site;
        if (path === "locales") return JSON.stringify(Object.keys({ en, it }));
        const value = path
          .split(".")
          .reduce<unknown>(
            (node, key) => (node as Record<string, unknown>)?.[key],
            en,
          );
        if (typeof value !== "string") {
          throw new Error(`index.html: no string for {{ ${path} }}`);
        }
        return value;
      }),
  },
});

export default defineConfig(({ isSsrBuild }) => ({
  // "/subs-tracker/" on GitHub Pages
  base: new URL(site).pathname,
  plugins: [
    vue({
      // Keep the whitespace between inline elements, like plain HTML
      template: { compilerOptions: { whitespace: "preserve" } },
    }),
    htmlStrings(),
  ],
  // Every component uses <script setup>: leave the Options API out of the
  // bundle
  define: { __VUE_OPTIONS_API__: "false" },
  server: { port: 3000 },
  build: {
    outDir: "_site",
    // The prerender (scripts/prerender.ts) only needs the app's code
    copyPublicDir: !isSsrBuild,
    modulePreload: { polyfill: false },
  },
  test: {
    include: ["src/**/*.test.ts", "tui/*.test.ts"],
  },
}));
