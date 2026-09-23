# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Client-only Nuxt 4 app (Vue 3 + Pinia + Tailwind v4 + DaisyUI 5) for tracking subscription costs. There is no backend: all data lives in the browser's `localStorage`. `server/` holds only a tsconfig.

## Commands

- `npm ci` — install (runs `nuxt prepare` via postinstall)
- `npm run dev` — dev server at http://localhost:3000
- `npm run build` — production build
- `npm run build:gh` — static GitHub Pages build with base URL `/subs-tracker/`. This is what CI runs (`.github/workflows/build.yml`, Node 24) on every push to `main`, then deploys `.output/public` to GitHub Pages.
- `npm run generate` / `npm run preview`

There is no lint or test script. Vitest test files exist (`libs/__test__/`, `stores/__test__/`), but Vitest is not in `package.json`, and the README has it commented out. To run them you would have to install `vitest` first (e.g. `npx vitest run libs/__test__/index.test.js`). The store tests may be stale: `getState` now also returns `i18n`.

## Architecture

- **State**: a single Pinia store, `useMainStore` (`stores/index.ts`), auto-imported by `@pinia/nuxt`. It holds `AppState` (`libs/types.ts`): `locale`, `i18n`, `theme`, `currency`, `data: Subscription[]`.
- **Persistence is manual**: `libs/storage.ts` reads and writes the whole `AppState` as JSON under the `localStorage` key `subs-tracker`. Store actions do **not** persist on their own. Every component that mutates state calls `save(app.getState)` right after the mutation (see `pages/add.vue`, `components/List.vue`, `Header.vue`, `Backup.vue`, `Empty.vue`). New mutations need the same call.
- **Hydration**: `app.vue` calls `app.setState(load())` in `onMounted` (client only) and applies the theme by setting `data-theme` on `<html>`. The theme toggle in `Header.vue` does the same thing directly on the DOM.
- **Calculations**: pure functions in `libs/index.ts` (`getMonthlyCost`, `getYearlyCost`, `getInactives`, `formatDate`). Yearly cost counts monthly items ×12. Both cost functions use `reduce` without an initial value, so they throw on an empty filtered list. Callers only render `Dashboard` when `data.length > 0`, and `toggleActive` keeps at least one item active.
- **i18n**: not a Nuxt i18n module. `i18n/en.json` is imported into store state and typed by the `I18n` type. Components read `app.i18n.<section>` directly. `getTranslation` replaces a `{{value}}` placeholder. Adding a string means updating both `en.json` and the `I18n` type.
- **Mock data**: `libs/mocks.ts` feeds `store.loadMock()` (the "load demo data" option on the empty screen) and the unit tests.
- **Styling**: `public/tailwind.css` imports Tailwind and the DaisyUI plugin, and is wired in through `nuxt.config.ts` with the `@tailwindcss/vite` plugin. Use DaisyUI component classes (`btn`, `stat`, `divider`, `bg-base-*`) and its themes (`light`/`dark`).
- Pages: `/` (`pages/index.vue`: Empty, or Dashboard + List) and `/add` (`pages/add.vue` → `Form`). Components are auto-imported.
