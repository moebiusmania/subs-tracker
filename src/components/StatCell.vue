<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import type { IconName } from "../icons.ts";

// label: a key of i18n.main
defineProps<{
  label: "total" | "monthly" | "yearly";
  value: string | number;
  description: string;
  tint: string;
  icon: IconName;
}>();
</script>

<template>
  <div :class="['stat', `stat--${tint}`]">
    <p class="stat__label">
      <span class="stat__icon"><AppIcon :name="icon" /></span>
      <span>{{ $t.main[label] }}</span>
    </p>
    <p class="stat__value">{{ value }}</p>
    <p class="stat__desc">{{ description }}</p>
  </div>
</template>
