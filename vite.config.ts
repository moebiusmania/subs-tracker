import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const id: string = "/subs-tracker/";

// https://vitejs.dev/config/
export default defineConfig({
  base: id,
  plugins: [vue()],
});
