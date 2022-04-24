# Subscriptions Tracker

> Webapp to keep track on subscriptions fees and has some math done for you.

### Motivation

TBD

### How it stores the data?

Everything you type and "save" in the application **is stored locally on your device** using the [LocalStorage browser API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), so no data is moved anywhere on the Internet.

This **may** change in the future if I will consider the idea of adding a backend to make the app work across multiple device, but eventually this will be an opt-in feature with the local device data being always the default method.

### Feature request

Feel free to [open an issue on this repo](https://github.com/moebiusmania/subs-tracker/issues) if you feel that you want to suggest some improvements or new feature.

### What has been used

- Vue 3
- Typescript
- Vite.js
- TailwindCSS
- DaisyUI

### License

Released under the [MIT License](LICENSE).
