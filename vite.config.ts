import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/subs-tracker/",
  plugins: [
    vue(),
    VitePWA({
      includeAssets: ["favicon.svg"],
      manifest: {
        start_url: "https://moebiusmania.github.io/subs-tracker/",
        name: "Subscriptions Tracker",
        short_name: "Subscriptions Tracker",
        description:
          "Webapp to keep track on subscriptions fees and have some math done for you.",
        theme_color: "#ffffff",
        icons: [
          {
            src: "/subs-tracker/favicon.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "/subs-tracker/favicon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          },
          {
            src: "/subs-tracker/favicon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            // purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
