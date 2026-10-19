<script setup lang="ts">
import { onMounted, reactive } from "vue";

import AppIcon from "./AppIcon.vue";
import { useContext } from "../context.ts";

const { components, base } = useContext();
const install = reactive(components.install());

onMounted(() => install.init());
</script>

<template>
  <aside
    class="banner install"
    v-show="install.mode"
    aria-labelledby="install-title"
  >
    <img
      class="banner__logo"
      :src="`${base}favicon.svg`"
      alt=""
      width="40"
      height="40"
    />
    <div class="banner__body">
      <h2 id="install-title" class="banner__title">{{ $t.install.title }}</h2>
      <p class="banner__text" v-show="install.mode === 'prompt'">
        {{ $t.install.message }}
      </p>
      <p class="banner__text" v-show="install.mode === 'manual'">
        <span>{{ $t.install.manualTap }}</span>
        <span class="banner__share"
          ><AppIcon name="share" /><span class="visually-hidden">{{
            $t.install.share
          }}</span></span
        >
        <span>{{ $t.install.manualAdd }}</span>
      </p>
    </div>
    <div class="banner__actions">
      <button
        type="button"
        class="btn btn--primary"
        v-show="install.mode === 'prompt'"
        @click="install.install()"
      >
        <AppIcon name="download" /> <span>{{ $t.install.cta }}</span>
      </button>
      <button type="button" class="btn btn--ghost" @click="install.dismiss()">
        {{ $t.install.dismiss }}
      </button>
    </div>
  </aside>
</template>
