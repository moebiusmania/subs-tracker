<script setup lang="ts">
const app = useMainStore();
</script>

<template>
  <Empty v-if="app.data.length === 0" />
  <Dashboard v-if="app.data.length > 0" :data="app.data" />
  <List v-if="app.data.length > 0" :data="app.data" />
</template>
