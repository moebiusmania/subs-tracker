// The prerender's entry (scripts/prerender.ts): the page's shell in English,
// as the browser shows it before the app takes over. Nothing here runs in
// the browser, so the side effects are stand-ins
import { reactive } from "vue";
import { renderToString } from "vue/server-renderer";

import { createApp } from "./app.ts";
import { createStore } from "./lib/store.ts";
import { createComponents } from "./lib/components.ts";

const unavailable = (): never => {
  throw new Error("Not available while prerendering");
};

export const render = (base: string): Promise<string> => {
  const store = reactive(createStore());
  const components = createComponents({
    app: () => store,
    persist: unavailable,
    confirm: unavailable,
    closeForm: unavailable,
    setThemeAttribute: unavailable,
    transition: unavailable,
    removeItem: unavailable,
    download: unavailable,
    pickFile: unavailable,
    installer: {
      installed: () => false,
      manual: () => false,
      dismissed: () => true,
      dismiss: () => {},
      onPrompt: () => {},
      onInstalled: () => {},
      prompt: () => Promise.resolve(false),
    },
    updater: { onUpdate: () => {}, reload: () => {} },
    shareBase: () => base,
    qrSvg: unavailable,
    copy: unavailable,
  });
  return renderToString(
    createApp({
      store,
      router: { route: { name: "home" } },
      components,
      base,
      closeForm: unavailable,
      canPeel: false,
      reduceMotion: () => true,
    }),
  );
};
