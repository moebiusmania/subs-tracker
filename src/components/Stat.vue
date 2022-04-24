<script setup lang="ts">
defineProps<{
  title: string;
  value: number | string;
  description: string;
}>();
</script>

<template>
  <div class="stats shadow w-full">
    <div class="stat">
      <div class="stat-title">{{ title }}</div>
      <div class="stat-value">{{ value }}</div>
      <div class="stat-desc">{{ description }}</div>
    </div>
  </div>
</template>
