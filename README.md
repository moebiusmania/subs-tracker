# 💰 Subscriptions Tracker ⚠️

> Webapp to keep track on subscriptions fees and has some math done for you.

### Motivation

TBD

### How it stores the data?

Everything you type and "save" in the application **is stored locally on your device** using the [LocalStorage browser API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), so no data is moved anywhere on the Internet.

This **may** change in the future if I will consider the idea of adding a backend to make the app work across multiple device, but eventually this will be an opt-in feature with the local device data being always the default method.

### Roadmap

- Edit & delete entries
- Manage currencies (_both per-entry and globally_)
- Localization, maybe...
- PWA (_install in your homescreen and works offline_)
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
- [TailwindCSS](https://tailwindcss.com/) - CSS as utilility classes
- [DaisyUI](https://daisyui.com/) - UI components built on top of TailwindCSS

### Support

If you like this project and do you want to support me a little bit [you could buy me a coffee ☕](https://www.buymeacoffee.com/moebiusmania), and you would make me very happy (_coffee is life essence for a developer!_) 🥳.

### License

Released under the [MIT License](LICENSE).
