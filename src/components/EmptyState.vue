<script setup lang="ts">
import AppBar from "./AppBar.vue";
import AppIcon from "./AppIcon.vue";
import { useContext } from "../context.ts";

const { components, base } = useContext();
const empty = components.empty();

// Picked up by TourDialog and TransferDialog
const send = (name: string) => dispatchEvent(new CustomEvent(name));
</script>

<template>
  <section class="empty panel">
    <AppBar extra="empty__bar" />
    <div class="empty__body">
      <h1>{{ $t.empty.title }}</h1>
      <p>{{ $t.empty.message }}</p>
      <div class="empty__actions">
        <a class="btn btn--primary" :href="`${base}add/`">
          <AppIcon name="plus" /> <span>{{ $t.empty.cta }}</span>
        </a>
        <span class="empty__or">{{ $t.empty.or }}</span>
        <button type="button" class="btn" @click="empty.useMock()">
          <AppIcon name="list" /> <span>{{ $t.empty.default }}</span>
        </button>
      </div>
      <!-- Opens the tour dialog; getting near it starts fetching the
           animation -->
      <button
        type="button"
        class="tour-link"
        @click="send('tour-open')"
        @pointerenter.once="send('tour-prefetch')"
        @focus.once="send('tour-prefetch')"
      >
        <AppIcon name="play" /> <span>{{ $t.tour.link }}</span>
      </button>
    </div>
    <!-- Bring the subscriptions from another device or a backup -->
    <div class="empty__import">
      <button
        type="button"
        class="btn btn--sm"
        @click="send('transfer-import')"
      >
        <AppIcon name="upload" /> <span>{{ $t.backup.import }}</span>
      </button>
    </div>
  </section>
</template>
