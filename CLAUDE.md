# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project

Static subscription-cost tracker built with Deno, Lume 3 (static site generator)
and Alpine.js. There is no backend and no Node/npm: all data lives in the
browser's `localStorage`.

## Commands

- `deno task serve` — dev server with live reload at http://localhost:3000
- `deno task dev:host` — same, but listening on all interfaces
  (`--hostname=0.0.0.0`) to test from other devices on the LAN
- `deno task build` — build the static site into `_site/`
- `deno task build:gh` — build for GitHub Pages
  (`--location=https://moebiusmania.github.io/subs-tracker/`)
- `deno task test` — all unit tests (`src/**/*_test.ts`); run one file with
  `deno test src/js/lib/store_test.ts`, or one test with
  `deno test --filter toggleActive src/`
- `deno task check` — `deno fmt --check`, `deno lint` and type-checking of
  `src/js/main.ts` and `_config.ts`

CI (`.github/workflows/build.yml`) runs `check`, `test` and `build:gh` on every
push and pull request. On pushes to `main` a second job then builds again and
deploys `_site` to GitHub Pages.

## Architecture

- **Build side (Lume)**: `_config.ts` sets `src: "./src"`. Pages are Vento
  templates: `src/index.vto` → `/`, `src/add.vto` → `/add/`. `src/_data.yml`
  gives every page the `layouts/base.vto` layout plus `title`/`description`.
  `src/_data/i18n.json` is exposed to templates as `i18n` for static strings.
  Lume 3 only copies non-page files that are registered with `site.add()` in
  `_config.ts`, so new assets must be added there.
- **URLs**: always write internal links with the Vento `url` filter
  (`{{ '/add/' |> url }}`) so the GitHub Pages `/subs-tracker/` prefix is
  applied. JS gets the home URL from the template
  (`addForm('{{ '/' |> url }}')`) for the same reason.
- **Client side**: `src/js/main.ts` is the only entry point. Lume's esbuild
  plugin bundles it, including Alpine from `npm:`, into `/js/main.js`. On every
  page load it builds the store, hydrates it from `localStorage`, applies
  `data-theme` on `<html>`, registers `Alpine.store("app", …)` and the
  `Alpine.data` components, then calls `Alpine.start()`. The component logic
  (`header`, `empty`, `dashboard`, `list`, `backup`, `addForm`) lives in
  `src/js/lib/components.ts` as plain factories. Browser side effects (confirm,
  navigation, theme attribute, view transition, file download/pick) are passed
  in as `Deps`, so `main.ts` only wires real DOM implementations and the tests
  pass fakes.
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
  - `types.ts` has the `I18n` type, which must stay in sync with `i18n.json`.
    `getTranslation` replaces a `{{value}}` placeholder at runtime.
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
  animated by the `.illo` rules. The Nunito font comes from Bunny Fonts. Entry
  animations use `@starting-style` and keyframes; navigations and the theme
  switch use view transitions; everything respects `prefers-reduced-motion`.
- Dates saved to `localStorage` come back as strings, so render them with
  `new Date(item.expiration)`.
