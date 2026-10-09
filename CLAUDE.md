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
an exact version via jsDelivr (`lume/`), Alpine comes from `npm:alpinejs`, the
QR encoder from `npm:uqr`, deno_tui is pinned the same way as Lume
(`deno_tui/`), the TUI uses `jsr:@std/path`, and tests use `jsr:@std/assert`. To
upgrade Lume, bump the version in the `lume/` URL. `deno.lock` is committed.
Running one-off scripts from the repo root with extra `npm:`/`jsr:` imports adds
them to the lockfile, so don't commit those entries.

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
  templates: `src/index.vto` → `/`, `src/add.vto` → `/add/`, `src/edit.vto` →
  `/edit/`. All three only include `partials/home.vto` (the home page plus
  `partials/form-dialog.vto`, where both forms share
  `partials/subscription-form.vto`): see **Add and edit dialog**.
  `src/_data.yml` gives every page the `layouts/base.vto` layout.
  `src/_data/i18n/*.json` (one file per locale, `en` and `it`) is exposed to
  templates as `i18n.en`, `i18n.it`. Lume 3 only copies non-page files that are
  registered with `site.add()` in `_config.ts`, so new assets must be added
  there.
- **URLs**: always write internal links with the Vento `url` filter
  (`{{ '/add/' |> url }}`) so the GitHub Pages `/subs-tracker/` prefix is
  applied. JS works out the home path from `import.meta.url` (`main.js` lives in
  `/js/`) for the same reason.
- **Client side**: `src/js/main.ts` is the only entry point. Lume's esbuild
  plugin bundles it, including Alpine from `npm:`, into `/js/main.js`. On every
  page load it builds the store, hydrates it from `localStorage`, applies
  `data-theme` on `<html>`, registers `Alpine.store("app", …)` and the
  `Alpine.data` components, then calls `Alpine.start()`. The component logic
  (`header`, `empty`, `dashboard`, `list`, `backup` (TUI only), `transfer`,
  `addForm`, `editForm`, `install`, `update`) lives in
  `src/js/lib/components.ts` as plain factories. Browser side effects (confirm,
  closing the form, theme attribute, view transition, file download/pick,
  install prompt, new-version notice, QR code, clipboard, a deleted card's exit
  animation) are passed in as `Deps`, so `main.ts` only wires real DOM
  implementations and the tests pass fakes.
- **Add and edit dialog**: the forms open in a modal `<dialog class="sheet">`
  over the home page, with a blurred backdrop, full screen below 40rem. They
  keep their URLs: `/add/` and `/edit/?item=<index>` (a static site can't have
  `/edit/<index>` pages; the service worker matches the cached page with
  `ignoreSearch`). `route.ts` (`parseRoute`/`routeUrl`, tested) maps a URL to a
  route. `main.ts` keeps it in `Alpine.store("router")`, intercepts plain clicks
  on links to those URLs with `history.pushState` (so back closes the dialog)
  and follows `popstate`. Loading `/add/` or `/edit/` directly renders home too
  and opens the dialog. The `formDialog` component in `main.ts` calls
  `showModal()`/`close()` from the route and renders the form keyed by it, so
  each opening starts fresh. Everything that closes it (the close button,
  cancel, Escape, a backdrop click, a submit through `deps.closeForm`) goes
  through `closeForm`: `history.back()` when the dialog was opened from a link,
  else `replaceState` to home. `editForm` edits a copy of the item and saves
  with `store.updateSubscription`; an index with no item closes right away. The
  panel (`.sheet__panel`, the visible card; the dialog only places it) enters
  and leaves with a WebGL2 peel, like a sticker laid down and peeled off
  (`src/js/peel.ts`, adapted from Canvas UI's Peel, MIT + Commons Clause: keep
  its copyright notice, don't publish it as a standalone component). It
  snapshots a stripped clone of the panel with the experimental html-in-canvas
  API (`drawElementImage` in a `layoutsubtree` canvas, Chrome behind a flag or
  origin trial), so `supportsPeel()` is false almost everywhere. There the panel
  slides in fast with a small bounce (an overshooting easing, from the bottom
  edge on phones) and slides out quicker (`.sheet--peel` switches the CSS slide
  off; `SLIDE_OUT` in `main.ts` matches `--duration-slide-out`). Reduced motion
  skips both. The backdrop always just fades (`.is-closing` on exit).
  `formDialog` keeps its own `view` and runs openings and closings one at a
  time, so the form stays rendered until the exit animation is over.
- **Export and import**: the Export and Import buttons (Import also sits at the
  bottom of the empty state) send `transfer-export`/`transfer-import` events to
  `partials/transfer.vto`, a dialog (the `transfer` component in
  `components.ts`) offering a JSON file or a QR code. The QR code holds a share
  link, the app's home URL with the data in the hash (`#d=…`): `lib/transfer.ts`
  packs each subscription into a few bytes (flags, price in cents, the shown day
  as days since 1970, length-prefixed UTF-8 strings), deflates them with
  `CompressionStream` and writes base64url. Version byte first, so the format
  can change. The camera app opens the link; `main.ts` reads the hash on load
  (and on `hashchange`), removes it with `replaceState`, and the dialog asks
  before replacing the data. Import also takes a pasted link (links sent by
  message, installed apps that don't share storage with the browser). The
  encoder (`uqr`, via `lib/qr.ts`) is its own bundle, `js/qr.ts`, imported the
  first time a code is shown. The QR SVG is always black on white, whatever the
  theme, for the scanners. File and link imports go through
  `parseBackup`/`decodeShare`, which reject anything that isn't a subscription
  list. The TUI picks file or QR/link with a segmented control in its dialogs,
  draws the code full screen with `▀` half blocks (links point to `SITE_URL`)
  and only takes pasted links.
- **Subscription cap**: `MAX_SUBSCRIPTIONS` (40, in `store.ts`) keeps every list
  within one easily scanned QR code (a full list of long names is a version 18
  code). `store.canAdd` disables the add button and shows a notice (web
  `.subs__limit`, TUI accent line), `addSubscription` refuses past it, `/add/`
  opened directly closes, and imports with more are refused.
- **Header and empty state**: the header's content (brand, language switch,
  theme toggle) is `partials/app-bar.vto`, a `header` component. With no
  subscriptions the header is hidden (`:root[data-empty]`, set before first
  paint by the inline script in `base.vto`, then kept in sync by an effect in
  `main.ts`), and the empty state card shows the same app bar as its top row.
  The TUI does the same: no header row while empty, `#drawHeader` draws the
  controls inside the empty panel.
- **"How it works" animation**: a link in the empty state opens
  `partials/tour.vto`, a dialog with a ~43 s motion graphic (googly-eyed
  subscription cards nibbling a wallet, the add form, totals, the due glow,
  pausing one, local storage and export). `src/js/tour.ts` draws it as one SVG
  coloured with the CSS tokens and drives it with Web Animations created up
  front with absolute delays (`fill: "forwards"`; seeking sets `currentTime` on
  all of them, and `resume()` only plays those not finished, since `play()`
  rewinds a finished one). It's a separate esbuild entry (`site.add` in
  `_config.ts`) that the `tour` component in `main.ts` imports on first open,
  prefetching when the pointer or focus reaches the link, so it costs nothing on
  page load (the service worker still precaches it for offline use). Captions
  and the scene list come from `tour.scenes` in the locale files. With reduced
  motion it opens on still frames (each scene's `still` time) that the scene
  dots step through. Browser-only: the TUI has no counterpart.
- **Alpine gotcha**: directives only run inside an `x-data` root. That's why
  `partials/home.vto` is wrapped in `<div x-data>`: its top-level
  `<template x-if>` switches between the empty state and dashboard+list at
  runtime, since the HTML is static.
- **Business logic** (`src/js/lib/`, framework-free and unit tested):
  - `store.ts`: `createStore()` returns a plain object (state + actions, ported
    from the old Pinia store) that `Alpine.store()` makes reactive.
    `toggleActive` refuses to deactivate the last active subscription. Deleting
    (`deleteSubscription`, one card; `deleteSubs`, everything) always goes
    through a confirmation: the `list` component's `deleteItem`/ `deleteAll`
    call `deps.confirm` on the web, the TUI shows its own dialog.
  - `storage.ts`: reads and writes the whole `AppState` as JSON under the key
    `subs-tracker`. Persistence is manual: every component handler that mutates
    the store calls `persist()` right after, and new mutations need the same
    call. `storage_test.ts` uses Deno's built-in `localStorage`, cleared around
    each test.
  - `index.ts`: cost calculations. Yearly cost counts monthly items ×12, and
    only active subscriptions are counted. `isExpiringThisMonth` drives the "due
    this month" highlight (web `.is-due` card with an accent border, a slow
    pulsing glow and a badge, TUI accent border and badge).
  - `mocks.ts`: `mockSubs(now)` builds the example data with expirations
    relative to `now` (one this month, one next month, the rest later), so tests
    assert dates computed from it rather than fixed strings.
  - `types.ts` has the `I18n` and `Locale` types. `I18n` must stay in sync with
    the files in `_data/i18n/` (`i18n_test.ts` checks that every locale has the
    same keys). `getTranslation` replaces a `{{value}}` placeholder at runtime.
  - `i18n.ts`: the `translations` map and `detectLocale`. `store.locale` is a
    getter: the picked `language`, or else `systemLocale` from
    `navigator.languages`. `store.i18n` derives from it. Only `language` is
    persisted, and it stays `null` until the user picks one in the header.
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
  in the switcher (which shows the codes, EN/IT) stay in their own language.
- **Styling**: one hand-written stylesheet, `src/styles.css`, with no framework
  or build step. It uses five cascade layers (reset, tokens, base, layout,
  components). The look follows the Monarch design system on Refero
  (https://styles.refero.design/style/a9dd8050-c03a-4901-b7fa-a9cc0ca54812): a
  warm linen canvas, white paper cards with 1px stone hairlines, ink text and
  ember orange (`#ff692d`) as the only chromatic colour. The `--tint-*` tokens
  (their names are historical) are ember and linen shades, no other hues. Every
  colour is a `light-dark()` token on `:root`, switched by `color-scheme` via
  `html[data-theme]`; Monarch only has a light theme, the dark one is a warm ink
  derivation. All text colours were checked against WCAG 2.1 AA on bg, surfaces
  and every tint, so recheck the ratios when changing a colour. White on ember
  fails AA (2.9:1), so filled ember buttons carry ink text, and ember text uses
  the darker `--color-accent-strong`. Components use `@scope`. Scoped rules win
  on proximity over unscoped ones with the same specificity, so theme overrides
  for scoped elements must live outside the `@scope` block (see
  `.theme-toggle__sun`). Icons are Lucide paths in `src/_data/icons.yml`,
  rendered with `partials/icon.vto`. The look is warm and editorial: pill
  buttons, badges and avatars (`--radius-full`), 12px cards, 8px inputs, light
  shadows only, no decorative motion (the due-card glow and the dialog peel are
  the exceptions). Headings, stat values and prices use the Fraunces serif at
  weight 400 with tight negative tracking (standing in for Monarch's
  Copernicus); everything else is Inter. Uppercase tracked text is only for
  eyebrow labels (stat labels, the "this month" badge). The stats are one strip
  of cells, and the subscriptions are a grid of cards (`.sub-card`). The header,
  empty state and install banner show `favicon.svg` as the logo. Fraunces (400)
  and Inter (400/500/600) come from Bunny Fonts. Sections fade in with
  `@starting-style`; navigations and the theme switch use view transitions;
  everything respects `prefers-reduced-motion`.
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
  `localStorage` key `subs-tracker:install-dismissed`. Updates: the same
  `site.process()` writes the version into `main.js` too (`"__BUILD_VERSION__"`
  in `pwa.ts`). The page calls `registration.update()` whenever it becomes
  visible and every hour, since browsers only check `sw.js` on page loads and
  the app rarely loads pages. A new worker posts
  `{ type: "activated",
  version }` to open pages once it takes over;
  `createUpdater` (the `Updater` dep, a no-op in the TUI) compares it with the
  page's own version and, when they differ, the `update` banner
  (`partials/update.vto`) offers a reload. It never reloads by itself, so a form
  being filled in isn't lost. Both banners are `.banner` cards stacked in one
  fixed `.banners` container in `base.vto`. The PNG icons are rendered from
  `src/icons/icon.svg` and `icon-maskable.svg` (not published), `favicon.ico`
  (16/32/48 PNG entries) from `src/favicon.svg`, so re-render them if the logo
  or the palette changes (`apple-touch-icon.png` comes from the maskable one).
  The artwork is a statement card listing three subscriptions with a renewal
  badge on a flat ember background (no gradient), in the light tokens; the
  favicon redraws it on a 32px grid so it stays readable at 16px. The README
  shows `src/icons/icon.svg`.
- **Social previews**: `base.vto` has Open Graph/Twitter tags and a canonical
  link, with absolute URLs from the `url(true)` filter. They're read by crawlers
  that don't run JS, so they stay in English. `og:title`/`twitter:title` use
  `meta.shareTitle`, longer than `meta.title` (30-60 characters is what the
  preview checkers want). `src/og-image.png` (1200×630, added in `_config.ts`
  but not precached) is rendered from `src/og-image.svg`: the app icon (a copy
  of `icons/icon.svg`) and name beside a static mock of the dashboard, with the
  light tokens hard-coded. Keep it in sync with the palette, the icon and the
  cards. Its text needs static Inter weights (400/500/600) and static Fraunces
  400 at render time, since resvg ignores the weight of a variable font (the
  Fontsource CDN serves static TTFs, e.g.
  `cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.ttf`).
  Nothing renders SVGs on the Pi out of the box: run `npm:@resvg/resvg-js` from
  a script outside the repo so the lockfile stays clean.
- Dates saved to `localStorage` come back as strings, so render them with
  `new Date(item.expiration)`.
- **Terminal version** (`tui/`, entry `tui/main.ts`): feature parity with the
  web app, driven by keyboard and mouse. It reuses `createStore()` and
  `createComponents()` from `src/js/lib/`: `App` (`tui/app.ts`) passes its own
  `Deps` (writes/reads files for export/import, `closeForm` going back to the
  home screen, where the form is a full-screen view, a no-op installer, and
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
    are registered before the field they sit on). Arrows skip a focusable
    control that sits inside another one (a card's ✕): Tab and the mouse reach
    it, and a focused card opens the same dialog with Del. Mouse uses any-motion
    SGR tracking (1003/1006) for hover. `tui/keys.ts` splits one stdin read into
    several keys (pastes, fast typing).
  - Colours are the CSS tokens copied into `tui/palette.ts` (keep them in sync
    with `styles.css`; only the `illo` set, for the TUI's empty-state
    illustration, has no CSS counterpart), 24-bit when the terminal supports it,
    else the nearest xterm-256 colour.
