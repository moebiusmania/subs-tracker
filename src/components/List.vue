<script setup lang="ts">
import { Subscription } from "../libs/types";
import { useMainStore } from "./../store";
import { save } from "./../libs/storage";

import Container from "./Container.vue";
import Backup from "./Backup.vue";

const app = useMainStore();
const i18n = app.i18n.main;
const fbText = "Sure you want to delete all subscriptions data?";

defineProps<{
  data: Subscription[];
}>();

const ask = (message: string): boolean => {
  return confirm(message);
};

const deleteAll = (): void => {
  if (ask(fbText)) {
    app.deleteSubs();
    save(app.getState);
  }
};

const toggleActive = (index: number): void => {
  app.toggleActive(index);
  save(app.getState);
};
</script>

<template>
  <Container>
    <header
      class="flex flex-col gap-3 md:flex-row md:gap-7 md:justify-between mb-4"
    >
      <h2 class="font-sans text-2xl font-bold">{{ i18n.list }}</h2>
      <router-link to="/add" class="btn btn-accent w-full md:w-max">
        ⊕ {{ i18n.cta }}
      </router-link>
    </header>
    <section
      class="md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-7"
    >
      <article
        v-for="(item, index) in data"
        class="card rounded-none bg-base-100 shadow-xl my-7 md:my-0"
        :key="index"
      >
        <div class="card-body">
          <h2 class="card-title">
            <span
              @click="toggleActive(index)"
              :class="`badge cursor-pointer ${
                item.isActive ? 'badge-success' : 'badge-error'
              }`"
            ></span>
            {{ item.name }}
          </h2>
          <p>
            {{ item.price + item.currency }}, {{ item.recurrence }} -
            {{ i18n.expires }}
            {{ new Date(item.expiration).toLocaleDateString() }}
          </p>
        </div>
      </article>
    </section>
    <Backup />
    <button class="btn w-full mt-7 btn-error modal-button" @click="deleteAll">
      ⊗ {{ i18n.delete }}
    </button>
  </Container>
</template>
