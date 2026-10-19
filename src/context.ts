import { inject, type InjectionKey } from "vue";

import type { Store } from "./lib/store.ts";
import type { Route } from "./lib/route.ts";
import type { createComponents } from "./lib/components.ts";

export type Components = ReturnType<typeof createComponents>;

// What the Vue components share: the reactive store and route, the component
// logic from lib/components.ts (with the browser side effects main.ts passes
// in as Deps) and a few browser checks. entry-server.ts provides a stand-in
// for the prerender
export type Context = {
  store: Store;
  router: { route: Route };
  components: Components;
  // The home path, with the GitHub Pages prefix ("/" or "/subs-tracker/")
  base: string;
  closeForm: () => void;
  // The form dialog can peel in and out with WebGL (peel.ts)
  canPeel: boolean;
  reduceMotion: () => boolean;
};

export const contextKey: InjectionKey<Context> = Symbol("context");

export const useContext = (): Context => {
  const context = inject(contextKey);
  if (!context) throw new Error("The app context is missing");
  return context;
};
