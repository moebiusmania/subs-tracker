<script setup lang="ts">
// Export and import: a dialog to pick a JSON file or a QR code, opened with
// transfer-export and transfer-import events. main.ts sends
// transfer-receive when a share link (#d=…) opens the app: then it asks
// before importing. The transfer component is in lib/components.ts
import { onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

import AppIcon from "./AppIcon.vue";
import { useContext } from "../context.ts";

const { components } = useContext();
const transfer = reactive(components.transfer());

const dialog = ref<HTMLDialogElement | null>(null);

const listeners: Record<string, (event: Event) => void> = {
  "transfer-export": () => transfer.openExport(),
  "transfer-import": () => transfer.openImport(),
  "transfer-receive": (event) =>
    void transfer.receive((event as CustomEvent<string>).detail),
};

onMounted(() => {
  for (const [name, listener] of Object.entries(listeners)) {
    addEventListener(name, listener);
  }
  watch(
    () => transfer.mode,
    (mode) => {
      const element = dialog.value!;
      if (!mode) element.close();
      else if (!element.open) element.showModal();
    },
    { flush: "post" },
  );
});
onBeforeUnmount(() => {
  for (const [name, listener] of Object.entries(listeners)) {
    removeEventListener(name, listener);
  }
});
</script>

<template>
  <div>
    <dialog
      ref="dialog"
      class="transfer"
      aria-labelledby="transfer-title"
      @close="transfer.close()"
      @pointerdown="transfer.pressed = $event.target === dialog"
      @click.self="transfer.pressed && transfer.close()"
    >
      <div class="transfer__panel">
        <header class="transfer__header">
          <h2 id="transfer-title">{{ transfer.title }}</h2>
          <button
            type="button"
            class="icon-btn"
            :aria-label="$t.transfer.close"
            :title="$t.transfer.close"
            @click="transfer.close()"
          >
            <AppIcon name="x" />
          </button>
        </header>

        <!-- Export or import: a file or a QR code -->
        <div
          v-if="
            (transfer.mode === 'export' || transfer.mode === 'import') &&
            transfer.view === 'choose'
          "
          class="transfer__body"
        >
          <p class="transfer__intro">
            {{
              transfer.mode === "export"
                ? $t.transfer.exportIntro
                : $t.transfer.importIntro
            }}
          </p>
          <div class="transfer__choices">
            <button
              type="button"
              class="choice"
              @click="
                transfer.mode === 'export'
                  ? transfer.saveFile()
                  : transfer.openFile()
              "
            >
              <span class="choice__icon"><AppIcon name="file" /></span>
              <span class="choice__title">{{ $t.transfer.file }}</span>
              <span class="choice__text">{{
                transfer.mode === "export"
                  ? $t.transfer.fileExport
                  : $t.transfer.fileImport
              }}</span>
            </button>

            <button
              v-if="transfer.mode === 'export'"
              type="button"
              class="choice"
              :disabled="transfer.busy"
              @click="transfer.showQr()"
            >
              <span class="choice__icon"><AppIcon name="qr-code" /></span>
              <span class="choice__title">{{ $t.transfer.qr }}</span>
              <span class="choice__text">{{
                transfer.busy ? $t.transfer.loading : $t.transfer.qrExport
              }}</span>
            </button>

            <!-- Scanning happens in the camera app: the link opens this page.
                 Pasting it covers links sent by message and installed apps,
                 which don't share storage with the browser on every system -->
            <div
              v-if="transfer.mode === 'import'"
              class="choice choice--static"
            >
              <span class="choice__icon"><AppIcon name="qr-code" /></span>
              <span class="choice__title">{{ $t.transfer.qr }}</span>
              <span class="choice__text">{{ $t.transfer.scanHow }}</span>
              <form
                class="transfer__paste"
                @submit.prevent="transfer.importPasted()"
              >
                <label for="transfer-link">{{ $t.transfer.link }}</label>
                <div class="transfer__paste-row">
                  <input
                    type="url"
                    id="transfer-link"
                    placeholder="https://…#d=…"
                    autocomplete="off"
                    spellcheck="false"
                    v-model="transfer.pasted"
                    required
                  />
                  <button type="submit" class="btn btn--sm">
                    {{ $t.transfer.importLink }}
                  </button>
                </div>
              </form>
            </div>
          </div>
          <p class="transfer__note" v-show="transfer.mode === 'import'">
            {{ $t.transfer.replaces }}
          </p>
          <p class="transfer__error" role="alert" v-show="transfer.error">
            {{ transfer.error }}
          </p>
        </div>

        <!-- The QR code: dark on white whatever the theme, for the scanners -->
        <div v-if="transfer.view === 'qr'" class="transfer__body">
          <div
            class="transfer__qr"
            role="img"
            :aria-label="$t.transfer.qrAlt"
            v-html="transfer.qr"
          ></div>
          <p class="transfer__intro">{{ $t.transfer.qrHint }}</p>
          <div class="transfer__actions">
            <button
              type="button"
              class="btn btn--ghost btn--sm"
              @click="transfer.back()"
            >
              <AppIcon name="arrow-left" /> <span>{{ $t.transfer.back }}</span>
            </button>
            <button
              type="button"
              class="btn btn--sm"
              @click="transfer.copyLink()"
            >
              <AppIcon name="copy" />
              <span aria-live="polite">{{
                transfer.copied ? $t.transfer.copied : $t.transfer.copy
              }}</span>
            </button>
          </div>
        </div>

        <!-- A share link opened the app -->
        <div v-if="transfer.mode === 'link'" class="transfer__body">
          <p class="transfer__intro" v-show="transfer.busy">
            {{ $t.transfer.loading }}
          </p>
          <p class="transfer__intro" v-show="transfer.pending.length">
            {{ transfer.confirmText }}
          </p>
          <p class="transfer__error" role="alert" v-show="transfer.error">
            {{ transfer.error }}
          </p>
          <div class="transfer__actions">
            <button
              type="button"
              class="btn btn--ghost btn--sm"
              @click="transfer.close()"
            >
              {{ $t.transfer.cancel }}
            </button>
            <button
              type="button"
              class="btn btn--primary btn--sm"
              v-show="transfer.pending.length"
              @click="transfer.acceptLink()"
            >
              <AppIcon name="upload" /> <span>{{ $t.transfer.accept }}</span>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  </div>
</template>
