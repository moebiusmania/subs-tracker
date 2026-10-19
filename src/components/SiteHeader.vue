<script setup lang="ts">
// Hidden while there are no subscriptions: the empty state shows the same
// controls (see :root[data-empty] in styles.css)
import AppBar from "./AppBar.vue";
</script>

<template>
  <header class="site-header">
    <AppBar extra="container" />
  </header>
</template>
