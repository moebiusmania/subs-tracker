<script setup lang="ts">
// Shown when a newer deploy has taken over while the app was open
// (createUpdater in src/pwa.ts)
import { onMounted, reactive } from "vue";

import { useContext } from "../context.ts";

const { components, base } = useContext();
const update = reactive(components.update());

onMounted(() => update.init());
</script>

<template>
  <aside
    class="banner update"
    v-show="update.available"
    aria-labelledby="update-title"
  >
    <img
      class="banner__logo"
      :src="`${base}favicon.svg`"
      alt=""
      width="40"
      height="40"
    />
    <div class="banner__body">
      <h2 id="update-title" class="banner__title">{{ $t.update.title }}</h2>
      <p class="banner__text">{{ $t.update.message }}</p>
    </div>
    <div class="banner__actions">
      <button type="button" class="btn btn--primary" @click="update.reload()">
        {{ $t.update.reload }}
      </button>
      <button type="button" class="btn btn--ghost" @click="update.dismiss()">
        {{ $t.update.dismiss }}
      </button>
    </div>
  </aside>
</template>
