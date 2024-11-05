<script setup lang="ts">
import { save } from "./../libs/storage";

const app = useMainStore();
const i18n = app.i18n.backup;

const btns = "btn btn-neutral w-full md:w-1/2 lg:w-1/3";

const exportData = (): void => {
  const data = app.getState.data;
  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.id = "download";
  a.href = url;
  a.download = "subscriptions.json";
  a.click();

  URL.revokeObjectURL(url);

  document.getElementById("download")?.remove();
};

const importData = (): void => {
  const input = document.createElement("input");

  input.id = "upload";
  input.type = "file";
  input.accept = ".json";
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === "string") {
          const data = JSON.parse(content);
          app.importSubs(data);
          save(app.getState);
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();

  document.getElementById("upload")?.remove();
};
</script>

<template>
  <section class="mt-8 flex flex-col md:flex-row justify-between gap-4">
    <button :class="btns" @click="exportData">↓ {{ i18n.export }}</button>

    <button :class="btns" @click="importData">↑ {{ i18n.import }}</button>
  </section>
</template>
