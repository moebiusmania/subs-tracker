<script setup lang="ts">
import SiteHeader from "./components/SiteHeader.vue";
import SiteFooter from "./components/SiteFooter.vue";
import HomePage from "./components/HomePage.vue";
import UpdateBanner from "./components/UpdateBanner.vue";
import InstallBanner from "./components/InstallBanner.vue";
</script>

<template>
  <a class="skip-link" href="#content">{{ $t.header.skip }}</a>
  <SiteHeader />
  <main id="content" class="container">
    <HomePage />
  </main>
  <SiteFooter />
  <div class="banners">
    <UpdateBanner />
    <InstallBanner />
  </div>
</template>
