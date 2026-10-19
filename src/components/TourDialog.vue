<script setup lang="ts">
// "How it works": a motion graphic in a dialog, opened from the empty state
// with a tour-open event. src/tour.ts draws it into the stage; it's its own
// chunk, fetched the first time it's needed (or when the pointer gets near
// the link), so it doesn't weigh on the page load
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";

import AppIcon from "./AppIcon.vue";
import type { Tour } from "../tour.ts";
import { getTranslation } from "../lib/index.ts";
import { useContext } from "../context.ts";

type TourModule = typeof import("../tour.ts");
let tourModule: Promise<TourModule> | null = null;
const loadTour = (): Promise<TourModule> => {
  tourModule ??= import("../tour.ts").catch((error) => {
    // Let a later attempt try again
    tourModule = null;
    throw error;
  });
  return tourModule;
};

const { store, base, reduceMotion } = useContext();

const dialog = ref<HTMLDialogElement | null>(null);
const stage = ref<HTMLElement | null>(null);
// The pointer went down on the backdrop, see FormDialog
const pressed = ref(false);
const loading = ref(false);
const failed = ref(false);
const playing = ref(false);
const ended = ref(false);
const scene = ref(0);
const scenes = ref<number[]>([]);
// Not deeply reactive: Vue's proxies would wrap the animations
const module = shallowRef<TourModule | null>(null);
let tour: Tour | null = null;

const caption = computed(() =>
  module.value ? module.value.caption(store.i18n, scene.value) : "",
);
const sceneLabel = (index: number): string =>
  getTranslation(store.i18n.tour.scene, index + 1);

const prefetch = (): void => {
  loadTour().catch(() => {});
};

const open = async (): Promise<void> => {
  const element = dialog.value!;
  if (element.open) return;
  failed.value = false;
  loading.value = true;
  element.showModal();
  let loaded: TourModule;
  try {
    loaded = await loadTour();
  } catch {
    failed.value = true;
    return;
  } finally {
    loading.value = false;
  }
  if (!element.open) return;
  module.value = loaded;
  scenes.value = Array.from({ length: loaded.sceneCount }, (_, i) => i);
  tour = loaded.createTour(stage.value!, {
    strings: () => store.i18n,
    still: reduceMotion(),
    onChange: (state) => {
      playing.value = state.playing;
      ended.value = state.ended;
      scene.value = state.scene;
    },
  });
};

const close = (): void => {
  dialog.value!.close();
};

// On the dialog's close event, however it was closed
const closed = (): void => {
  tour?.destroy();
  tour = null;
  playing.value = false;
  ended.value = false;
  scene.value = 0;
};

const toggle = (): void => {
  if (playing.value) tour?.pause();
  else tour?.play();
};

const goTo = (index: number): void => {
  tour?.goTo(index);
};

const onOpen = () => void open();
onMounted(() => {
  addEventListener("tour-open", onOpen);
  addEventListener("tour-prefetch", prefetch);
});
onBeforeUnmount(() => {
  removeEventListener("tour-open", onOpen);
  removeEventListener("tour-prefetch", prefetch);
});
</script>

<template>
  <div>
    <dialog
      ref="dialog"
      class="tour"
      aria-labelledby="tour-title"
      @close="closed()"
      @pointerdown="pressed = $event.target === dialog"
      @click.self="pressed && close()"
    >
      <div class="tour__panel">
        <header class="tour__header">
          <h2 id="tour-title">{{ $t.tour.title }}</h2>
          <button
            type="button"
            class="icon-btn"
            :aria-label="$t.tour.close"
            :title="$t.tour.close"
            @click="close()"
          >
            <AppIcon name="x" />
          </button>
        </header>

        <div ref="stage" class="tour__stage"></div>
        <p class="tour__status" v-show="loading">{{ $t.tour.loading }}</p>
        <p class="tour__status" v-show="failed">{{ $t.tour.failed }}</p>
        <p class="tour__caption" aria-live="polite">{{ caption }}</p>

        <div class="tour__controls" v-show="scenes.length">
          <button
            type="button"
            class="icon-btn tour__play"
            :aria-label="
              playing ? $t.tour.pause : ended ? $t.tour.replay : $t.tour.play
            "
            :title="
              playing ? $t.tour.pause : ended ? $t.tour.replay : $t.tour.play
            "
            @click="toggle()"
          >
            <span v-show="playing"><AppIcon name="pause" /></span>
            <span v-show="!playing && !ended"><AppIcon name="play" /></span>
            <span v-show="!playing && ended"
              ><AppIcon name="rotate-ccw"
            /></span>
          </button>
          <div class="tour__dots">
            <button
              v-for="index in scenes"
              :key="index"
              type="button"
              class="tour__dot"
              :aria-label="sceneLabel(index)"
              :title="sceneLabel(index)"
              :aria-current="scene === index"
              @click="goTo(index)"
            ></button>
          </div>
          <a
            class="btn btn--primary btn--sm tour__cta"
            :href="`${base}add/`"
            v-show="ended || scene === scenes.length - 1"
            @click="close()"
            >{{ $t.tour.cta }}</a
          >
        </div>
      </div>
    </dialog>
  </div>
</template>
