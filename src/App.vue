<script setup lang="ts">
import { onMounted } from "vue";
import { useMainStore } from "./store";

import Header from "./components/Header.vue";
import Footer from "./components/Footer.vue";
import { hasData, load } from "./libs/storage";

const app = useMainStore();

onMounted(() => {
  if (hasData()) {
    app.setState(load());
    document.querySelector("html")?.setAttribute("data-theme", app.theme);
  }
});
</script>

<template>
  <Header />
  <router-view />
  <Footer />
</template>
