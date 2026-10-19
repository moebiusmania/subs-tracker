<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import { translations } from "../lib/i18n.ts";
import type { Locale } from "../lib/types.ts";
import { useContext } from "../context.ts";

// Brand, language switch and theme toggle: the site header, and the top of
// the empty state, which shows them instead of the header. extra: more
// classes for the root
defineProps<{ extra: string }>();

const { store, components, base } = useContext();
const header = components.header();
const locales = Object.entries(translations) as [
  Locale,
  (typeof translations)[Locale],
][];
</script>

<template>
  <div :class="['app-bar', extra]">
    <a class="brand" :href="base">
      <img :src="`${base}favicon.svg`" alt="" width="28" height="28" />
      <span>{{ $t.header.brand }}</span>
    </a>
    <div class="app-bar__actions">
      <!-- Shows the language codes; each language is named in its own
           language for assistive tech, so that's never translated -->
      <div class="lang-switch" role="group" :aria-label="$t.header.language">
        <button
          v-for="[code, strings] in locales"
          :key="code"
          type="button"
          class="lang-switch__option"
          :lang="code"
          :aria-label="strings.meta.language"
          :title="strings.meta.language"
          :aria-pressed="store.locale === code"
          @click="header.setLocale(code)"
        >
          {{ code }}
        </button>
      </div>
      <button
        type="button"
        class="icon-btn theme-toggle"
        :aria-label="$t.header.darkMode"
        :aria-pressed="store.theme === 'dark'"
        @click="header.toggleTheme()"
      >
        <span class="theme-toggle__sun"><AppIcon name="sun" /></span>
        <span class="theme-toggle__moon"><AppIcon name="moon" /></span>
      </button>
    </div>
  </div>
</template>
