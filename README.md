# 💰 Subscriptions Tracker ⚠️

<p align="center">
  <img src=".github/poster.svg" alt="Illustration of fanned subscription cards with bouncing euro and dollar coins" width="360">
</p>

Webapp to keep track on subscriptions fees and has some math done for you.

👉 **Try it at [moebiusmania.github.io/subs-tracker](https://moebiusmania.github.io/subs-tracker/)**

🖥️ Prefer the terminal? There's also a [terminal version](#terminal-version) with the same features.

### Motivation

> "...but exactly how much I'm spending right now with all the subscriptions services that I'm using right now?"

I guess that **everyone** of us has asked him/herself this question at least once in the last few years.

We use subscription services for every kind of needs nowadays, and most of them are more than legitimate to ask the money they are charging, but for us it's easy to lost track of the overall expenses with these solutions.

So that's what this app is doing: just insert the data of the subscriptions that you are using and it will do some easy math to tell you how much you are spending on a yearly and monthly basis.

### How it stores the data?

Everything you type and "save" in the application **is stored locally on your device** using the [LocalStorage browser API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), so no data is moved anywhere on the Internet.

This **may** change in the future if I will consider the idea of adding a backend to make the app work across multiple device, but eventually this will be an opt-in feature with the local device data being always the default method.

At the moment there is an _import/export_ functionality available in the app that will create a `.json` file with your subscriptions data that you can use to eventually move the data on another instance of the app (_on another device_). It isn't the most convenient way to _"sync"_ the data, but it easy to implement and keeps the complete ownership of personal data to the users.

### Languages

The app is available in English and Italian: pick one with the flags at the top of the page. The choice is saved on your device, and on the first visit the app follows your browser's language.

### Install it & use it offline

The app is a PWA: you can install it on your home screen (or desktop) from the banner at the bottom of the page, or from the browser menu. On iPhone and iPad tap _Share_ and then _Add to Home Screen_.

After the first visit it works offline too, since both the app and your data are kept on the device. When you open it online you always get the latest version: the offline copy is updated in the background.

### Terminal version

There's also a version that runs in the terminal, with the same features: the stats, the subscription cards (toggle them active/inactive), adding a subscription, export/import, delete all, light and dark themes, English and Italian. It works with both the keyboard and the mouse (click, hover and scroll wheel).

#### Why a terminal version?

The web app needs a browser, and a browser isn't always there or isn't always handy:

- **No graphical environment**: headless servers, a Raspberry Pi without a display, minimal Linux installs or containers where there's only a shell.
- **Over SSH**: you can check and update your subscriptions on a remote machine from any terminal, without port forwarding or exposing a web server.
- **Terminal-first workflows**: if you live in the terminal (tmux, tiling window managers, keyboard-driven setups), it's quicker to run a command than to open a browser tab.
- **Your data as a plain file**: the data is a JSON file you can back up, sync with your own tools (git, rsync, Syncthing…) or move between machines, instead of being tied to one browser's storage.
- **A single binary**: `deno task tui:build` produces a standalone executable with no runtime to install, easy to copy onto another machine.

It's not a separate app: it reuses the same logic as the web version, so the numbers always match, and the export/import files work in both. You can move your data from one to the other at any time.

```bash
$ deno task tui          # run it
$ deno task tui:build    # compile a standalone binary to dist/subs-tracker
```

| Key                         | What it does                                                   |
| --------------------------- | -------------------------------------------------------------- |
| `Tab` / `Shift+Tab`, arrows | move between buttons, cards and fields                         |
| `Enter` / `Space`           | press a button, toggle a card, submit the form                 |
| `↑` `↓` / mouse wheel       | change the price or the date in the form (`PgUp`/`PgDn` month) |
| `a` `e` `i`                 | add a subscription, export, import                             |
| `t` / `l`                   | switch theme / language                                        |
| `Esc`                       | back, or close a dialog                                        |
| `PgUp` `PgDn` `Home` `End`  | scroll                                                         |
| `q` / `Ctrl+C`              | quit                                                           |

The data is saved in `~/.config/subs-tracker/data.json` (`%APPDATA%\subs-tracker\data.json` on Windows, or wherever `SUBS_TRACKER_DATA` points). It's the same format as the web app, and the export/import files work in both. The language follows your system locale until you pick one.

### Roadmap

- Edit entries
- Manage currencies (_both per-entry and globally_)
- Highlight/prioritize items that are close to expire (_within 30 days from the given expiration date_)
- Push Notifications?
- "Help/How it works" screen
- (_still undecided_) Signup/signin + Backend to sync data on multiple devices. As I said above if this will happen it will not be mandatory.

### Thoughts on the backend

I'm not sure that this kind of simple app requires all of the effort of having a signup/signin system + a database just for the convenience of having the same data on multiple device. But if I'm going to do that in the future for whatever reason I'm going to use some pre-packaged solution that offers both a DB and social login authentication.

That's why the options that I'm considering for this part are pretty much similar:

- [Firebase (Google)](https://firebase.google.com/), it works well but maybe I should stop relying too much on Google's stuff
- [Supabase](https://supabase.com/), claims to be "Firebase OSS alternative" seems nice but it's another SaaS
- [Appwrite](https://appwrite.io/), is another "Firebase OSS alternative" but it offers an on-premise solution that can be hosted wherever you want, and in that case I would a basic Droplet plan on [Digital Ocean](https://www.digitalocean.com/).

### New feature request

Feel free to [open an issue on this repo](https://github.com/moebiusmania/subs-tracker/issues) if you feel that you want to suggest some improvements or new feature.

### How to develop

You only need [Deno](https://deno.com/) 2.x installed: there is no Node.js, no `package.json` and no install step, dependencies are fetched and cached by Deno on first run.

Clone the repo

```bash
$ git clone https://github.com/moebiusmania/subs-tracker
$ cd subs-tracker
```

start the development server

```bash
$ deno task serve
```

open a browser at `http://localhost:3000` and you will see the application.

All the available tasks:

| Task                  | What it does                                                             |
| --------------------- | ------------------------------------------------------------------------ |
| `deno task serve`     | dev server with live reload on `http://localhost:3000`                   |
| `deno task dev:host`  | same, but reachable from other devices on your network (phones, tablets) |
| `deno task build`     | builds the static site into `_site/`                                     |
| `deno task build:gh`  | builds for GitHub Pages, under the `/subs-tracker/` path                 |
| `deno task test`      | runs the unit tests                                                      |
| `deno task check`     | formatting check, lint and type-check                                    |
| `deno task tui`       | runs the terminal version                                                |
| `deno task tui:build` | compiles the terminal version to a standalone binary in `dist/`          |

### How it's built

The app is a static website: every page is plain HTML generated at build time, with a small script adding the interactivity in the browser.

- **Pages** are [Vento](https://vento.js.org/) templates in `src/` (`index.vto` for the home, `add.vto` for the form), shared markup lives in `src/_includes/`.
- **Interactivity** is handled by [Alpine.js](https://alpinejs.dev/): `src/js/main.ts` is the only script, bundled by Lume with esbuild.
- **Business logic** (costs math, the store, local storage and the UI components logic) lives in `src/js/lib/` as plain TypeScript with no framework, so it's fully unit tested.
- **Offline & install**: `src/sw.js` is the service worker. It loads everything from the network first and falls back to the cached copy when offline. At build time `_config.ts` fills in the list of files to precache and a version hashed from the whole site, so every deploy installs a fresh worker. `src/manifest.webmanifest` and the icons in `src/icons/` make the app installable.
- **Terminal version** lives in `tui/` and uses [deno_tui](https://github.com/Im-Beast/deno_tui) to draw and read the keyboard and mouse. A small declarative layer on top of it (`tui/scene.ts`) redraws only what changed, and the screens reuse the web app's store and component logic from `src/js/lib/`, so both versions behave the same.
- **Styles** are a single hand-written stylesheet, `src/styles.css`, using modern CSS (cascade layers, `@scope`, nesting, `light-dark()`, `@starting-style`, view transitions) with no framework or preprocessor. Light and dark themes both meet the WCAG 2.1 AA contrast requirements, and animations are disabled when the system asks for reduced motion.

### Tests & deploy

Unit tests use the built-in [Deno test runner](https://docs.deno.com/runtime/fundamentals/testing/) and live next to the code they test (`*_test.ts` in `src/js/lib/` and `tui/`).

Every push and pull request runs the format, lint, type-check and test steps on GitHub Actions and builds the site. Pushes to `main` that pass them are then deployed to GitHub Pages.

### What has been used

- [Deno](https://deno.com/) - runtime and toolchain (tasks, tests, lint, format, type-check)
- [Lume](https://lume.land/) - static site generator, builds the pages as plain HTML
- [Vento](https://vento.js.org/) - templating language used by Lume
- [Alpine.js](https://alpinejs.dev/) - client side interactivity and state
- [deno_tui](https://github.com/Im-Beast/deno_tui) - terminal rendering and keyboard/mouse input for the terminal version
- [Nunito](https://fonts.bunny.net/family/nunito) - font, served by the privacy friendly [Bunny Fonts](https://fonts.bunny.net/)
- [Lucide](https://lucide.dev/) - icons
- [GitHub Actions](https://github.com/features/actions) & [GitHub Pages](https://pages.github.com/) - CI and hosting

### Support

This is an "hobby project" so if you like it and do you want to support me a little bit [you could buy me a coffee ☕](https://www.buymeacoffee.com/moebiusmania), and you would make me very happy (_coffee is life essence for a developer!_) 🥳.

### License

Released under the [MIT License](LICENSE).
