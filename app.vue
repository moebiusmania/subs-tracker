<script setup lang="ts">
import { hasData, load } from "./libs/storage";

const app = useMainStore();

onMounted(() => {
  if (hasData()) {
    app.setState(load());
    document.querySelector("html")?.setAttribute("data-theme", app.theme);
  }
});

useHead({
  title: "Subscriptions Tracker ⚠️",
  meta: [
    { name: "description", content: "Webapp to keep track on subscriptions fees and have some math done for you." },
    { name: "theme-color", content: "#ffffff" },
    { name: "viewport", content: "width=device-width, initial-scale=1.0" },
    { name: "title", content: "Subscriptions Tracker ⚠️" },
  ],
  link: [
    {
      rel: "icon",
      type: "image/svg+xml",
      href: "/favicon.svg",
    },
    {
      rel: "icon",
      type: "image/png",
      sizes: "32x32",
      href: "/static/favicons/favicon-32x32.png",
    },
  ],
  htmlAttrs: {
    lang: "it-IT",
    "data-theme": "light",
    // class: document && document.documentElement.classList.contains("dark") ? "dark" : "light",
  }
})
</script>

<template>
  <div class="flex flex-col h-screen">
    <Header />
    <NuxtPage />
    <Footer />
  </div>
</template>
