<script setup lang="ts">
const year: number = new Date().getFullYear();
</script>

<template>
  <footer
    class="footer footer-center p-10 bg-base-100 text-base-content rounded absolute bottom-0"
  >
    <div>
      <p>
        MIT license {{ year }} -
        <a
          href=""
          target="_blank"
          rel="noopener noreferrer"
          class="link link-accent font-semibold"
          >an Open Source project</a
        >
        made with <span class="text-error font-semibold">&lt;3</span> by
        <a
          href="https://salvatorelaisa.blog"
          target="_blank"
          rel="noopener noreferrer"
          class="link link-accent font-semibold"
          >Salvatore Laisa</a
        >
      </p>
    </div>
  </footer>
</template>
