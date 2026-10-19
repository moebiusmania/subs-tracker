<script setup lang="ts">
// The add and edit forms, in a dialog over the home page (full screen on
// phones). It follows the route: /add/ or /edit/?item=<index>. Escape, the
// backdrop, the close button and cancel all go through closeForm, which also
// puts the URL back. The form is keyed by the route, so every opening starts
// from a fresh copy of the item; it stays rendered until the exit animation
// is over.
import { nextTick, onMounted, ref, watch } from "vue";

import AppIcon from "./AppIcon.vue";
import SubscriptionForm from "./SubscriptionForm.vue";
import type { Route } from "../lib/route.ts";
import { peel } from "../peel.ts";
import { useContext } from "../context.ts";

// The CSS slide out's length (--duration-slide-out in styles.css)
const SLIDE_OUT = 160;

const { router, closeForm: close, canPeel, reduceMotion } = useContext();

const dialog = ref<HTMLDialogElement | null>(null);
// The pointer went down on the backdrop: a drag that started inside the
// dialog and ended outside doesn't close it
const pressed = ref(false);
const view = ref<(Route & { key: string }) | null>(null);

const panel = (dialog: HTMLDialogElement): HTMLElement | null =>
  dialog.querySelector<HTMLElement>(":scope > .sheet__panel");

const sync = async (dialog: HTMLDialogElement): Promise<void> => {
  const route = router.route;
  const peeling = canPeel && !reduceMotion();

  if (route.name === "home") {
    if (dialog.open) {
      // The backdrop fades while the panel peels (or slides) away
      dialog.classList.add("is-closing");
      const sheet = panel(dialog);
      const peeled = peeling && sheet && (await peel(sheet, dialog, "out"));
      if (!peeled && !reduceMotion()) {
        await new Promise((resolve) => setTimeout(resolve, SLIDE_OUT));
      }
      dialog.close();
      dialog.classList.remove("is-closing");
    }
    view.value = null;
    return;
  }

  const key = JSON.stringify(route);
  if (view.value?.key === key && dialog.open) return;
  view.value = { ...route, key };
  // After the form has rendered, so showModal() focuses its autofocus field
  await nextTick();
  // The edit form may have closed it right away (no such item)
  if (router.route.name === "home" || dialog.open) return;
  const sheet = panel(dialog);
  if (peeling && sheet) sheet.style.opacity = "0";
  dialog.showModal();
  if (peeling && sheet && !(await peel(sheet, dialog, "in"))) {
    sheet.style.opacity = "";
  }
};

onMounted(() => {
  const element = dialog.value!;
  // Openings and closings run one at a time, each for the route current
  // when it starts
  let queue = Promise.resolve();
  watch(
    () => router.route,
    () => {
      queue = queue.then(() => sync(element)).catch(console.error);
    },
    { immediate: true },
  );
});
</script>

<template>
  <!-- With the WebGL peel the panel doesn't slide in with CSS -->
  <dialog
    ref="dialog"
    class="sheet"
    :class="{ 'sheet--peel': canPeel }"
    aria-labelledby="sheet-title"
    @cancel.prevent="close()"
    @close="close()"
    @pointerdown="pressed = $event.target === dialog"
    @click.self="pressed && close()"
  >
    <section v-if="view" :key="view.key" class="add sheet__panel">
      <header class="add__header">
        <h1 id="sheet-title">
          {{ view.name === "edit" ? $t.edit.title : $t.add.title }}
        </h1>
        <!-- A cross in the corner, a back arrow on phones where the dialog
             looks like a page -->
        <button
          type="button"
          class="icon-btn add__close"
          :aria-label="$t.add.back"
          :title="$t.add.back"
          @click="close()"
        >
          <span class="add__close-x"><AppIcon name="x" /></span>
          <span class="add__close-back"><AppIcon name="arrow-left" /></span>
        </button>
        <!-- The intro carries its own markup: it only comes from src/i18n -->
        <p
          class="add__intro"
          v-show="view.name === 'add'"
          v-html="$t.add.intro"
        ></p>
      </header>

      <SubscriptionForm v-if="view.name === 'add'" icon="plus" />
      <SubscriptionForm
        v-if="view.name === 'edit'"
        :index="view.index"
        icon="check"
      />
    </section>
  </dialog>
</template>
