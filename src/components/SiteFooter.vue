<script setup lang="ts">
const year = new Date().getFullYear();
</script>

<template>
  <footer class="site-footer">
    <p class="container">
      <span>{{ $t.footer.license }}</span> <span>{{ year }}</span> ·
      <a
        href="https://github.com/moebiusmania/subs-tracker"
        target="_blank"
        rel="noopener noreferrer"
        >{{ $t.footer.project }}</a
      >
      <span>{{ $t.footer.madeBy }}</span>
      <a
        href="https://github.com/moebiusmania"
        target="_blank"
        rel="noopener noreferrer"
        >Salvatore Laisa</a
      >
    </p>
  </footer>
</template>
