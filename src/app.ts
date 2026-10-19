import { createApp as createVueApp } from "vue";

import App from "./App.vue";
import type { I18n } from "./lib/types.ts";
import { type Context, contextKey } from "./context.ts";

declare module "vue" {
  interface ComponentCustomProperties {
    // The current strings, as $t.section.key in templates
    $t: I18n;
  }
}

// The browser (main.ts) and the prerender (entry-server.ts) build the same
// app, each with its own context
export const createApp = (context: Context) => {
  const app = createVueApp(App);
  app.provide(contextKey, context);
  // A getter, so templates follow language changes
  Object.defineProperty(app.config.globalProperties, "$t", {
    get: () => context.store.i18n,
  });
  return app;
};
