# 💰 Subscriptions Tracker ⚠️

Webapp to keep track on subscriptions fees and has some math done for you.

### Motivation

> "...but exactly how much I'm spending right now with all the subscriptions services that I'm using right now?"

I guess that **everyone** of us has asked him/herself this question at least once in the last few years.

We use subscription services for every kind of needs nowadays, and most of them are more than legitimate to ask the money they are charging, but for us it's easy to lost track of the overall expenses with these solutions.

So that's what this app is doing: just insert the data of the subscriptions that you are using and it will do some easy math to tell you how much you are spending on a yearly and monthly basis.

### How it stores the data?

Everything you type and "save" in the application **is stored locally on your device** using the [LocalStorage browser API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), so no data is moved anywhere on the Internet.

This **may** change in the future if I will consider the idea of adding a backend to make the app work across multiple device, but eventually this will be an opt-in feature with the local device data being always the default method.

### Roadmap

- Edit & delete entries
- Manage currencies (_both per-entry and globally_)
- Highlight/prioritize items that are close to expire (_within 30 days from the given expiration date_)
- Push Notifications?
- "Help/How it works" screen
- Localization, maybe...
- ~~PWA (_install in your homescreen and works offline_)~~
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

Clone the repo

```bash
$ git clone https://github.com/moebiusmania/subs-tracker
```

cd into it and install the dependencies

```bash
$ cd subs-tracker
$ npm ci
```

start the development server

```bash
$ npm run dev
```

open a browser at `http://localhost:3000` and you will see the application.

### What has been used

- [Vue 3](https://vuejs.org/) - component framework
- [Typescript](https://www.typescriptlang.org/) - static typed Javascript
- [Pinia](https://pinia.vuejs.org/) - state management
- [Vite.js](https://vitejs.dev/) - project bootstrap and tooling
- [Vitest](https://vitest.dev/) - unit testing
- [TailwindCSS](https://tailwindcss.com/) - CSS as utilility classes
- [DaisyUI](https://daisyui.com/) - UI components built on top of TailwindCSS

### Support

This is an "hobby project" so if you like it and do you want to support me a little bit [you could buy me a coffee ☕](https://www.buymeacoffee.com/moebiusmania), and you would make me very happy (_coffee is life essence for a developer!_) 🥳.

### License

Released under the [MIT License](LICENSE).
