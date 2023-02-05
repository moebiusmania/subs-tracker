import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const id: string = "/subs-tracker/";

const isPROD: boolean = process.env.NODE_ENV === 'production';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3000,
  },
  base: isPROD ? id : "/",
  plugins: [vue()],
});
