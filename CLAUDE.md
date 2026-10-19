# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project

Static subscription-cost tracker built with Bun, Vite, Vue 3 and Vitest,
styled with one hand-written modern CSS file. There is no backend: all data
lives in the browser's `localStorage`. Live at
https://moebiusmania.github.io/subs-tracker/. A terminal version with the same
features lives in `tui/` (see below).

Bun is the package manager and script runner (`bun.lock` is committed) and the
TUI's runtime; Vite, Vitest and vue-tsc run on Node, which `bun run` picks up.
Dependencies are in `package.json`: `vue`, the QR encoder `uqr`, and the dev
tools (Vite with `@vitejs/plugin-vue`, Vitest with `happy-dom`, vue-tsc,
Prettier, `@types/bun`). TypeScript stays on 6: vue-tsc doesn't run on
TypeScript 7's native compiler yet.

## Commands

- `bun run dev` — Vite dev server with hot reload at http://localhost:3000
- `bun run dev:host` — same, but listening on all interfaces
  (`--host 0.0.0.0`) to test from other devices on the LAN
- `bun run build` — build the static site into `_site/`: the client build, a
  server build of `src/entry-server.ts` into `_ssr/`, then
  `scripts/prerender.ts` (see **Build**)
- `bun run build:gh` — build for GitHub Pages
  (`SITE_URL=https://moebiusmania.github.io/subs-tracker/`)
- `bun run preview` — serve `_site/`
- `bun run test` — all unit tests (`src/**/*.test.ts`, `tui/*.test.ts`); run
  one file with `bunx vitest run src/lib/store.test.ts`, or one test with
  `bunx vitest run -t toggleActive`
- `bun run check` — `prettier --check .` and `vue-tsc --build`, over two
  projects: `tsconfig.app.json` (browser code and `.vue` files, DOM types) and
  `tsconfig.node.json` (`vite.config.ts`, `scripts/`, `tui/` and the shared
  `src/lib/`, Bun types). `bun run format` fixes the formatting
- `bun run tui` — run the terminal version; `bun run tui:build` compiles it to
  `dist/subs-tracker` (git-ignored). Set `SUBS_TRACKER_DATA=/some/file.json`
  to keep test runs away from the real data file.

CI (`.github/workflows/build.yml`, Ubuntu 26.04 runners) installs Bun (the
version in `packageManager`), then runs `bun install --frozen-lockfile`,
`check`, `test` and `build:gh` on every push and pull request. On pushes to
`main` that job also uploads `_site` as the Pages artifact, and a second job
only runs `actions/deploy-pages` (no rebuild).

Development happens on a Raspberry Pi: never install or run a headless browser
(Chromium, Playwright, Puppeteer, …) to check changes. For visual changes, run
`bun run check`/`build`, explain what to look for, and let the user verify in
their own browser (`bun run dev:host` serves it to the LAN). `src/app.test.ts`
mounts the real app in happy-dom, for checks on behaviour and markup.

## Architecture

- **Build**: `index.html` (repo root) is Vite's entry: the `<head>` (meta and
  social tags, fonts, `/styles.css`, the inline pre-paint script) and an empty
  `<body><!--app--></body>`. A plugin in `vite.config.ts` fills its
  `{{ meta.title }}`-style placeholders from `src/i18n/en.json`, plus
  `{{ site }}` (the absolute site URL) and `{{ locales }}`. The site URL comes
  from `SITE_URL` (`scripts/site.ts`, `http://localhost/` by default) and its
  path is Vite's `base`. After the client build, `scripts/prerender.ts` renders
  the app with the server build (`src/entry-server.ts`, with a stand-in
  context: English, light theme, no subscriptions, which `HomePage.vue` leaves
  out on the server anyway) into the body, writes it as `index.html`,
  `add/index.html` and `edit/index.html` (each with its own canonical and
  `og:url`) and deletes `_ssr/`. There's no hydration: `main.ts` mounts the
  app on `body`, which replaces the prerendered shell in one go. Static files
  live in `public/` and are copied as they are. `src/og-image.svg` and
  `src/icons/*.svg` are sources, not published. The prerender also fills in
  the service worker (see **PWA**).
- **URLs**: internal links are built from the context's `base`
  (``:href="`${base}add/`"``), which is `import.meta.env.BASE_URL`, so the
  GitHub Pages `/subs-tracker/` prefix is applied. Vite adds it to the
  `public/` files referenced from `index.html`.
- **Client side**: `src/main.ts` is the only entry point. It builds the store,
  wraps it in `reactive()`, hydrates it from `localStorage`, applies
  `data-theme` on `<html>`, wires the browser side effects into
  `createComponents()` and mounts `App.vue` with `createApp()` from
  `src/app.ts` (shared with the prerender). `app.ts` provides a `Context`
  (`src/context.ts`: store, router, components, `base`, `closeForm`, `canPeel`,
  `reduceMotion`), which every component reads with `useContext()`, and
  defines `$t` as a global property. The component logic (`header`, `empty`,
  `dashboard`, `list`, `backup` (TUI only), `transfer`, `addForm`, `editForm`,
  `install`, `update`) lives in `src/lib/components.ts` as plain factories:
  the `.vue` files call them and wrap the result in `reactive()` (their
  methods and getters use `this`, which is then the proxy). Browser side
  effects (confirm, closing the form, theme attribute, view transition, file
  download/pick, install prompt, new-version notice, QR code, clipboard, a
  deleted card's exit animation) are passed in as `Deps`, so `main.ts` only
  wires real DOM implementations and the tests pass fakes. Components talk to
  each other with window `CustomEvent`s (`transfer-export`,
  `transfer-import`, `transfer-receive`, `tour-open`, `tour-prefetch`). Vue
  patches the DOM on the next tick, so DOM work right after a change awaits
  `nextTick()` (the view transition's callback, the card removal's FLIP).
- **Vue templates**: `vite.config.ts` compiles them with
  `whitespace: "preserve"`, so whitespace between inline elements renders as
  in plain HTML (the default condensing would glue `</a>⏎<span>` together).
  Put a comment about a whole component in its `<script>`: one before the root
  element makes the component a fragment in dev. Components never use
  `<style>`: all CSS is in `public/styles.css`. A `:value` binding is applied
  again on every re-render, so the price field is set once in `onMounted`
  instead, and typing isn't rewritten. Icons are `<AppIcon name="…">`, with
  the Lucide paths in `src/icons.ts`. Prefer `v-show` where the Alpine
  version had `x-show` (the CSS and the prerender expect those elements to
  exist).
- **Add and edit dialog**: the forms open in a modal `<dialog class="sheet">`
  over the home page, with a blurred backdrop, full screen below 40rem. They
  keep their URLs: `/add/` and `/edit/?item=<index>` (a static site can't have
  `/edit/<index>` pages; the service worker matches the cached page with
  `ignoreSearch`). `route.ts` (`parseRoute`/`routeUrl`, tested) maps a URL to a
  route. `main.ts` keeps it in a `reactive({ route })`, intercepts plain clicks
  on links to those URLs with `history.pushState` (so back closes the dialog)
  and follows `popstate`. Loading `/add/` or `/edit/` directly renders home too
  and opens the dialog. `components/FormDialog.vue` watches the route, calls
  `showModal()`/`close()` and renders the form (`SubscriptionForm.vue`) keyed
  by it, so each opening starts fresh. Everything that closes it (the close
  button, cancel, Escape, a backdrop click, a submit through
  `deps.closeForm`) goes through `closeForm`: `history.back()` when the dialog
  was opened from a link, else `replaceState` to home. `editForm` edits a copy
  of the item and saves with `store.updateSubscription`; an index with no item
  closes right away. The panel (`.sheet__panel`, the visible card; the dialog
  only places it) enters and leaves with a WebGL2 peel, like a sticker laid
  down and peeled off (`src/peel.ts`, adapted from Canvas UI's Peel, MIT +
  Commons Clause: keep its copyright notice, don't publish it as a standalone
  component). It snapshots a stripped clone of the panel with the experimental
  html-in-canvas API (`drawElementImage` in a `layoutsubtree` canvas, Chrome
  behind a flag or origin trial), so `supportsPeel()` is false almost
  everywhere. There the panel slides in fast with a small bounce (an
  overshooting easing, from the bottom edge on phones) and slides out quicker
  (`.sheet--peel` switches the CSS slide off; `SLIDE_OUT` in `FormDialog.vue`
  matches `--duration-slide-out`). Reduced motion skips both. The backdrop
  always just fades (`.is-closing` on exit). `FormDialog` keeps its own `view`
  and runs openings and closings one at a time, so the form stays rendered
  until the exit animation is over.
- **Export and import**: the Export and Import buttons (Import also sits at the
  bottom of the empty state) send `transfer-export`/`transfer-import` events to
  `components/TransferDialog.vue`, a dialog (the `transfer` component in
  `components.ts`) offering a JSON file or a QR code. The QR code holds a share
  link, the app's home URL with the data in the hash (`#d=…`): `lib/transfer.ts`
  packs each subscription into a few bytes (flags, price in cents, the shown
  day as days since 1970, length-prefixed UTF-8 strings), deflates them with
  `CompressionStream` and writes base64url. Version byte first, so the format
  can change. The camera app opens the link; `main.ts` reads the hash on load
  (and on `hashchange`), removes it with `replaceState`, and the dialog asks
  before replacing the data. Import also takes a pasted link (links sent by
  message, installed apps that don't share storage with the browser). The
  encoder (`uqr`, via `lib/qr.ts`) is its own chunk, a dynamic import in
  `main.ts` the first time a code is shown. The QR SVG is always black on
  white, whatever the theme, for the scanners. File and link imports go
  through `parseBackup`/`decodeShare`, which reject anything that isn't a
  subscription list. The TUI picks file or QR/link with a segmented control in
  its dialogs, draws the code full screen with `▀` half blocks (links point to
  `SITE_URL`) and only takes pasted links.
- **Subscription cap**: `MAX_SUBSCRIPTIONS` (40, in `store.ts`) keeps every list
  within one easily scanned QR code (a full list of long names is a version 18
  code). `store.canAdd` disables the add button and shows a notice (web
  `.subs__limit`, TUI accent line), `addSubscription` refuses past it, `/add/`
  opened directly closes, and imports with more are refused.
- **Header and empty state**: the header's content (brand, language switch,
  theme toggle) is `components/AppBar.vue`, using the `header` component. With
  no subscriptions the header is hidden (`:root[data-empty]`, set before first
  paint by the inline script in `index.html`, then kept in sync by a
  `watchEffect` in `main.ts`), and the empty state card shows the same app bar
  as its top row. The TUI does the same: no header row while empty,
  `#drawHeader` draws the controls inside the empty panel.
- **"How it works" animation**: a link in the empty state opens
  `components/TourDialog.vue`, a dialog with a ~43 s motion graphic
  (googly-eyed subscription cards nibbling a wallet, the add form, totals, the
  due glow, pausing one, local storage and export). `src/tour.ts` draws it as
  one SVG coloured with the CSS tokens and drives it with Web Animations
  created up front with absolute delays (`fill: "forwards"`; seeking sets
  `currentTime` on all of them, and `resume()` only plays those not finished,
  since `play()` rewinds a finished one). It's its own chunk, a dynamic import
  that `TourDialog.vue` runs on first open, prefetching when the pointer or
  focus reaches the link, so it costs nothing on page load (the service worker
  still precaches it for offline use). The tour object is a plain variable and
  the module a `shallowRef`: Vue's deep proxies would wrap the animations.
  Captions and the scene list come from `tour.scenes` in the locale files.
  With reduced motion it opens on still frames (each scene's `still` time)
  that the scene dots step through. Browser-only: the TUI has no counterpart.
- **Business logic** (`src/lib/`, framework-free and unit tested):
  - `store.ts`: `createStore()` returns a plain object (state + actions, ported
    from the old Pinia store) that `reactive()` makes reactive. `toggleActive`
    refuses to deactivate the last active subscription. Deleting
    (`deleteSubscription`, one card; `deleteSubs`, everything) always goes
    through a confirmation: the `list` component's `deleteItem`/`deleteAll`
    call `deps.confirm` on the web, the TUI shows its own dialog.
  - `storage.ts`: reads and writes the whole `AppState` as JSON under the key
    `subs-tracker`. Persistence is manual: every component handler that mutates
    the store calls `persist()` right after, and new mutations need the same
    call. `storage.test.ts` runs in happy-dom for `localStorage`, cleared
    around each test.
  - `index.ts`: cost calculations. Yearly cost counts monthly items ×12, and
    only active subscriptions are counted. `isExpiringThisMonth` drives the "due
    this month" highlight (web `.is-due` card with an accent border, a slow
    pulsing glow and a badge, TUI accent border and badge).
  - `mocks.ts`: `mockSubs(now)` builds the example data with expirations
    relative to `now` (one this month, one next month, the rest later), so tests
    assert dates computed from it rather than fixed strings.
  - `types.ts` has the `I18n` and `Locale` types. `I18n` must stay in sync with
    the files in `src/i18n/` (`i18n.test.ts` checks that every locale has the
    same keys). `getTranslation` replaces a `{{value}}` placeholder at runtime.
  - `i18n.ts`: the `translations` map and `detectLocale`. `store.locale` is a
    getter: the picked `language`, or else `systemLocale` from
    `navigator.languages`. `store.i18n` derives from it. Only `language` is
    persisted, and it stays `null` until the user picks one in the header.
- **i18n**: the language switches at runtime. Templates read the current
  strings as `$t.section.key` (`{{ $t.empty.title }}`,
  `:aria-label="$t.add.back"`), a global property in `app.ts` that returns
  `store.i18n`. The prerendered HTML is English. New strings need a key in
  every locale file and in the `I18n` type. The picked language is saved in
  `localStorage` with the rest of the state (older saves have a `locale` field
  instead, which is ignored). Without one the app follows the system language,
  English as fallback. The inline script in `index.html` repeats that lookup
  before first paint. For a non-English locale it sets `data-i18n-pending`,
  which hides the page until `main.ts` has mounted the app (with a one-second
  CSS fallback). Language names in the switcher (which shows the codes, EN/IT)
  stay in their own language.
- **Styling**: one hand-written stylesheet, `public/styles.css`, with no
  framework or build step (in `public/`, so Vite copies it untouched). It uses
  five cascade layers (reset, tokens, base, layout, components). The look
  follows the Monarch design system on Refero
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
  `.theme-toggle__sun`). The body is a flex column of the app's root elements
  (skip link, header, main, footer, banners), which is why the app mounts on
  `body` rather than a wrapper. The look is warm and editorial: pill buttons,
  badges and avatars (`--radius-full`), 12px cards, 8px inputs, light shadows
  only, no decorative motion (the due-card glow and the dialog peel are the
  exceptions). Headings, stat values and prices use the Fraunces serif at
  weight 400 with tight negative tracking (standing in for Monarch's
  Copernicus); everything else is Inter. Uppercase tracked text is only for
  eyebrow labels (stat labels, the "this month" badge). The stats are one strip
  of cells, and the subscriptions are a grid of cards (`.sub-card`). The
  header, empty state and install banner show `favicon.svg` as the logo.
  Fraunces (400) and Inter (400/500/600) come from Bunny Fonts. Sections fade
  in with `@starting-style`; navigations and the theme switch use view
  transitions; everything respects `prefers-reduced-motion`.
- **PWA**: `public/sw.js` is a plain JS service worker, copied as it is.
  Same-origin GETs are network-first with `cache: "no-cache"` and a 4s timeout
  that falls back to the cache, so online users always get the latest deploy;
  Bunny Fonts are stale-while-revalidate. `scripts/prerender.ts` replaces its
  `"__SW_VERSION__"` and `"__SW_PRECACHE__"` placeholders with a hash of every
  built file and the precache list: every file in `_site/` but `sw.js`,
  `robots.txt` and `og-image.png` (pages as their directory URL), so new static
  files are precached and hashed with no list to update. `src/pwa.ts` registers
  the worker (from `import.meta.env.BASE_URL`, which keeps the path prefix) and
  implements the `Installer` dep behind the install banner
  (`components/InstallBanner.vue`): Chromium's `beforeinstallprompt`, manual
  Share-menu steps on iOS, and a "not now" flag under the separate
  `localStorage` key `subs-tracker:install-dismissed`. Updates: the prerender
  writes the version into the built JS too (`"__BUILD_VERSION__"` in
  `pwa.ts`). The page calls `registration.update()` whenever it becomes visible
  and every hour, since browsers only check `sw.js` on page loads and the app
  rarely loads pages. A new worker posts `{ type: "activated", version }` to
  open pages once it takes over; `createUpdater` (the `Updater` dep, a no-op in
  the TUI) compares it with the page's own version and, when they differ, the
  update banner (`components/UpdateBanner.vue`) offers a reload. It never
  reloads by itself, so a form being filled in isn't lost. Both banners are
  `.banner` cards stacked in one fixed `.banners` container in `App.vue`. The
  PNG icons in `public/icons/` are rendered from `src/icons/icon.svg` and
  `icon-maskable.svg`, `favicon.ico` (16/32/48 PNG entries) from
  `public/favicon.svg`, so re-render them if the logo or the palette changes
  (`apple-touch-icon.png` comes from the maskable one). The artwork is a
  statement card listing three subscriptions with a renewal badge on a flat
  ember background (no gradient), in the light tokens; the favicon redraws it
  on a 32px grid so it stays readable at 16px. The README shows
  `src/icons/icon.svg`.
- **Social previews**: `index.html` has Open Graph/Twitter tags and a
  canonical link, with absolute URLs from `{{ site }}`. They're read by
  crawlers that don't run JS, so they stay in English. `og:title`/
  `twitter:title` use `meta.shareTitle`, longer than `meta.title` (30-60
  characters is what the preview checkers want). `public/og-image.png`
  (1200×630, not precached) is rendered from `src/og-image.svg`: the app icon
  (a copy of `icons/icon.svg`) and name beside a static mock of the dashboard,
  with the light tokens hard-coded. Keep it in sync with the palette, the icon
  and the cards. Its text needs static Inter weights (400/500/600) and static
  Fraunces 400 at render time, since resvg ignores the weight of a variable
  font (the Fontsource CDN serves static TTFs, e.g.
  `cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.ttf`).
  Nothing renders SVGs on the Pi out of the box: run `@resvg/resvg-js` from a
  script outside the repo so `package.json` and the lockfile stay clean.
- Dates saved to `localStorage` come back as strings, so render them with
  `new Date(item.expiration)`.
- **Terminal version** (`tui/`, entry `tui/main.ts`, runs on Bun with `node:`
  APIs): feature parity with the web app, driven by keyboard and mouse. It
  reuses `createStore()` and `createComponents()` from `src/lib/`: `App`
  (`tui/app.ts`) passes its own `Deps` (writes/reads files for export/import,
  `closeForm` going back to the home screen, where the form is a full-screen
  view, a no-op installer, and `confirm: () => true` because it shows its own
  dialog before calling `deleteAll()`), so business rules stay in one place.
  The state is the same `AppState` JSON, saved by `tui/system.ts` to
  `$XDG_CONFIG_HOME/subs-tracker/data.json` (`~/.config/…`, `%APPDATA%` on
  Windows, `SUBS_TRACKER_DATA` overrides); an unreadable file is moved to
  `.bak`. The system language comes from `LANGUAGE`/`LC_ALL`/`LC_MESSAGES`/
  `LANG`. TUI-only strings are in the `tui` section of the locale files.
  - Keeping parity: when adding or changing a feature in the web version,
    evaluate whether it can be ported to the TUI too, and port it in the same
    change when it makes sense (put shared logic in `src/lib/` so both use it).
    If it's browser-only (like the PWA install banner) or doesn't fit a
    terminal, say so instead of silently skipping it.
  - Rendering: `App.render()` returns a flat list of box/text nodes plus hit
    regions (built with `Painter`, which offsets and clips layers: page,
    header, status bar, toast, modal) and has no terminal dependency, so
    `app.test.ts` drives it with fake keys and clicks (its `settle()` waits for
    the app's `changed()` after async work). `Scene` (`tui/scene.ts`) paints
    the nodes in z order (list order for equal z) into a grid of cells and
    writes only the cells that changed since the last frame (everything after
    a resize). A background box must have a lower z than the text on it. Wide
    characters take two cells, and covering half of one blanks the other.
    `tui/main.ts` sets up the terminal itself: raw mode, the alternate screen,
    a hidden cursor, mouse tracking and `resize` events, all restored on quit,
    SIGTERM and SIGINT.
  - Interaction is the app's own: focus by id, Tab order = registration order
    with the header first, arrows move spatially, clicks go to the topmost
    layer then the first registered hit (small controls are registered before
    the field they sit on). Arrows skip a focusable control that sits inside
    another one (a card's ✕): Tab and the mouse reach it, and a focused card
    opens the same dialog with Del. Mouse uses any-motion SGR tracking
    (1003/1006) for hover; a move only redraws when the hover changes.
    `tui/input.ts` decodes stdin into key and mouse events, one per escape
    sequence (ported from deno_tui, MIT: keep its notice), and `tui/keys.ts`
    splits what's left into several keys (pastes, fast typing). `textWidth` in
    `tui/text.ts` is deno_tui's too, so widths and layouts stay as they were.
  - Colours are the CSS tokens copied into `tui/palette.ts` (keep them in sync
    with `styles.css`; only the `illo` set, for the TUI's empty-state
    illustration, has no CSS counterpart), 24-bit when the terminal supports it,
    else the nearest xterm-256 colour.
