# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project

Static subscription-cost tracker built with Deno 2, Lume 3 (static site
generator, Vento templates) and Alpine.js, styled with hand-written modern CSS.
There is no backend and no Node/npm (no `package.json`, no `node_modules`): all
data lives in the browser's `localStorage`. Live at
https://moebiusmania.github.io/subs-tracker/. A terminal version with the same
features lives in `tui/` (see below).

Dependencies are declared only in the `deno.json` import map: Lume is pinned to
an exact version via jsDelivr (`lume/`), Alpine comes from `npm:alpinejs`,
deno_tui is pinned the same way as Lume (`deno_tui/`), the TUI uses
`jsr:@std/path`, and tests use `jsr:@std/assert`. To upgrade Lume, bump the
version in the `lume/` URL. `deno.lock` is committed. Running one-off scripts
from the repo root with extra `npm:`/`jsr:` imports adds them to the lockfile,
so don't commit those entries.

## Commands

- `deno task serve` — dev server with live reload at http://localhost:3000
- `deno task dev:host` — same, but listening on all interfaces
  (`--hostname=0.0.0.0`) to test from other devices on the LAN
- `deno task build` — build the static site into `_site/`
- `deno task build:gh` — build for GitHub Pages
  (`--location=https://moebiusmania.github.io/subs-tracker/`)
- `deno task test` — all unit tests (`src/**/*_test.ts`, `tui/*_test.ts`, with
  read/write permissions for the TUI's file tests); run one file with
  `deno test src/js/lib/store_test.ts`, or one test with
  `deno test --filter toggleActive src/`
- `deno task check` — `deno fmt --check`, `deno lint` and type-checking of
  `src/js/main.ts`, `_config.ts` and `tui/`
- `deno task tui` — run the terminal version; `deno task tui:build` compiles it
  to `dist/subs-tracker` (git-ignored). Set `SUBS_TRACKER_DATA=/some/file.json`
  to keep test runs away from the real data file.

CI (`.github/workflows/build.yml`, Ubuntu 26.04 runners) runs `check`, `test`
and `build:gh` on every push and pull request. On pushes to `main` that job also
uploads `_site` as the Pages artifact, and a second job only runs
`actions/deploy-pages` (no rebuild).

Development happens on a Raspberry Pi: never install or run a headless browser
(Chromium, Playwright, Puppeteer, …) to check changes. For visual changes, run
`deno task check`/`build`, explain what to look for, and let the user verify in
their own browser (`deno task dev:host` serves it to the LAN).

## Architecture

- **Build side (Lume)**: `_config.ts` sets `src: "./src"`. Pages are Vento
  templates: `src/index.vto` → `/`, `src/add.vto` → `/add/`. `src/_data.yml`
  gives every page the `layouts/base.vto` layout. `src/_data/i18n/*.json` (one
  file per locale, `en` and `it`) is exposed to templates as `i18n.en`,
  `i18n.it`. Lume 3 only copies non-page files that are registered with
  `site.add()` in `_config.ts`, so new assets must be added there.
- **URLs**: always write internal links with the Vento `url` filter
  (`{{ '/add/' |> url }}`) so the GitHub Pages `/subs-tracker/` prefix is
  applied. JS gets the home URL from the template
  (`addForm('{{ '/' |> url }}')`) for the same reason.
- **Client side**: `src/js/main.ts` is the only entry point. Lume's esbuild
  plugin bundles it, including Alpine from `npm:`, into `/js/main.js`. On every
  page load it builds the store, hydrates it from `localStorage`, applies
  `data-theme` on `<html>`, registers `Alpine.store("app", …)` and the
  `Alpine.data` components, then calls `Alpine.start()`. The component logic
  (`header`, `empty`, `dashboard`, `list`, `backup`, `addForm`, `install`) lives
  in `src/js/lib/components.ts` as plain factories. Browser side effects
  (confirm, navigation, theme attribute, view transition, file download/pick)
  are passed in as `Deps`, so `main.ts` only wires real DOM implementations and
  the tests pass fakes.
- **Alpine gotcha**: directives only run inside an `x-data` root. That's why
  `index.vto` is wrapped in `<div x-data>`: its top-level `<template x-if>`
  switches between the empty state and dashboard+list at runtime, since the HTML
  is static.
- **Business logic** (`src/js/lib/`, framework-free and unit tested):
  - `store.ts`: `createStore()` returns a plain object (state + actions, ported
    from the old Pinia store) that `Alpine.store()` makes reactive.
    `toggleActive` refuses to deactivate the last active subscription.
  - `storage.ts`: reads and writes the whole `AppState` as JSON under the key
    `subs-tracker`. Persistence is manual: every component handler that mutates
    the store calls `persist()` right after, and new mutations need the same
    call. `storage_test.ts` uses Deno's built-in `localStorage`, cleared around
    each test.
  - `index.ts`: cost calculations. Yearly cost counts monthly items ×12, and
    only active subscriptions are counted.
  - `types.ts` has the `I18n` and `Locale` types. `I18n` must stay in sync with
    the files in `_data/i18n/` (`i18n_test.ts` checks that every locale has the
    same keys). `getTranslation` replaces a `{{value}}` placeholder at runtime.
  - `i18n.ts`: the `translations` map and `detectLocale`. `store.locale` is a
    getter: the picked `language`, or else `systemLocale` from
    `navigator.languages`. `store.i18n` derives from it. Only `language` is
    persisted, and it stays `null` until the user taps a flag.
- **i18n**: the language switches at runtime. Every visible string is written as
  `<h1 x-text="$t.empty.title">{{ i18n.en.empty.title }}</h1>`, so the static
  HTML is English and Alpine swaps in the current locale (`$t` is an
  `Alpine.magic` returning `store.i18n`). Attributes use a static English value
  plus a `:attr="$t…"` binding. New strings need a key in every locale file and
  in the `I18n` type. The picked language is saved in `localStorage` with the
  rest of the state (older saves have a `locale` field instead, which is
  ignored). Without one the app follows the system language, English as
  fallback. The inline script in `base.vto` repeats that lookup before first
  paint. For a non-English locale it sets `data-i18n-pending`, which hides the
  page until `main.ts` has run (with a one-second CSS fallback). Language names
  in the flag switcher stay in their own language.
- **Styling**: one hand-written stylesheet, `src/styles.css`, with no framework
  or build step. It uses five cascade layers (reset, tokens, base, layout,
  components). The palette is warm cream/plum-ink with pastel tints (`--tint-*`)
  and a lavender accent. Every colour is a `light-dark()` token on `:root`,
  switched by `color-scheme` via `html[data-theme]`. All text colours were
  checked against WCAG 2.1 AA on bg, surfaces and every tint, so recheck the
  ratios when changing a colour. Components use `@scope`. Scoped rules win on
  proximity over unscoped ones with the same specificity, so theme overrides for
  scoped elements must live outside the `@scope` block (see
  `.theme-toggle__sun`). Icons are Lucide paths in `src/_data/icons.yml`,
  rendered with `partials/icon.vto`. The empty-state scene is an inline SVG
  (`partials/empty-illustration.vto`), coloured by `--illo-*` tokens and
  animated by the `.illo` rules. `.github/poster.svg` is a standalone copy for
  the README with the colours and animations embedded (GitHub renders SVGs as
  images), so keep the two in sync. Don't use `--` in its XML comments. The
  Nunito font comes from Bunny Fonts. Entry animations use `@starting-style` and
  keyframes; navigations and the theme switch use view transitions; everything
  respects `prefers-reduced-motion`.
- **PWA**: `src/sw.js` is a plain JS service worker (esbuild bundles it too).
  Same-origin GETs are network-first with `cache: "no-cache"` and a 4s timeout
  that falls back to the cache, so online users always get the latest deploy;
  Bunny Fonts are stale-while-revalidate. A `site.process()` in `_config.ts`
  replaces its `"__SW_VERSION__"` and `"__SW_PRECACHE__"` placeholders with a
  hash of every built file and the precache list (all pages plus the `assets`
  array). New static files go in that array so they are precached and hashed.
  `src/js/pwa.ts` registers the worker (resolved from `import.meta.url` to keep
  the path prefix) and implements the `Installer` dep behind the `install`
  banner component (`partials/install.vto`): Chromium's `beforeinstallprompt`,
  manual Share-menu steps on iOS, and a "not now" flag under the separate
  `localStorage` key `subs-tracker:install-dismissed`. The PNG icons are
  rendered from `src/icons/icon.svg` and `icon-maskable.svg` (not published), so
  re-render them if the logo changes.
- Dates saved to `localStorage` come back as strings, so render them with
  `new Date(item.expiration)`.
- **Terminal version** (`tui/`, entry `tui/main.ts`): feature parity with the
  web app, driven by keyboard and mouse. It reuses `createStore()` and
  `createComponents()` from `src/js/lib/`: `App` (`tui/app.ts`) passes its own
  `Deps` (writes/reads files for export/import, a no-op installer, and
  `confirm: () => true` because it shows its own dialog before calling
  `deleteAll()`), so business rules stay in one place. The state is the same
  `AppState` JSON, saved by `tui/system.ts` to
  `$XDG_CONFIG_HOME/subs-tracker/data.json` (`~/.config/…`, `%APPDATA%` on
  Windows, `SUBS_TRACKER_DATA` overrides); an unreadable file is moved to
  `.bak`. The system language comes from `LANGUAGE`/`LC_ALL`/`LC_MESSAGES`/
  `LANG`. TUI-only strings are in the `tui` section of the locale files.
  - Keeping parity: when adding or changing a feature in the web version,
    evaluate whether it can be ported to the TUI too, and port it in the same
    change when it makes sense (put shared logic in `src/js/lib/` so both use
    it). If it's browser-only (like the PWA install banner) or doesn't fit a
    terminal, say so instead of silently skipping it.
  - Rendering: `App.render()` returns a flat list of box/text nodes plus hit
    regions (built with `Painter`, which offsets and clips layers: page, header,
    status bar, toast, modal) and has no terminal dependency, so `app_test.ts`
    drives it with fake keys and clicks. `Scene` (`tui/scene.ts`) reconciles the
    nodes by key onto deno_tui `BoxObject`/ `TextObject`s. deno_tui only
    recomputes which cells of an object are covered when that object moves, so
    `Scene` marks everything under a changed, moved or erased node for repaint:
    keep that when touching it. Nodes sharing a z-index are drawn in creation
    order, so a background box must have a lower z than the text on it.
  - Interaction is the app's own (not deno_tui's components): focus by id, Tab
    order = registration order with the header first, arrows move spatially,
    clicks go to the topmost layer then the first registered hit (small controls
    are registered before the field they sit on). Mouse uses any-motion SGR
    tracking (1003/1006) for hover. `tui/keys.ts` splits one stdin read into
    several keys (pastes, fast typing).
  - Colours are the CSS tokens copied into `tui/palette.ts` (keep them in sync
    with `styles.css`), 24-bit when the terminal supports it, else the nearest
    xterm-256 colour.
