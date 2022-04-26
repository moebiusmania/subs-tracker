<script setup lang="ts">
import Header from "./components/Header.vue";
import Footer from "./components/Footer.vue";
</script>

<template>
  <Header />
  <router-view />
  <div class="h-20"></div>
  <Footer />
</template>
