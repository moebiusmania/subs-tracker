<script setup lang="ts">
import { Subscription } from "../libs/types";
import { useMainStore } from "./../store";

import Container from "./Container.vue";

const app = useMainStore();

defineProps<{
  data: Subscription[];
}>();
</script>

<template>
  <Container>
    <header
      class="flex flex-col gap-3 md:flex-row md:gap-7 md:justify-between mb-4"
    >
      <h2 class="font-sans text-2xl font-bold">Your subscriptions:</h2>
      <router-link to="/add" class="btn btn-accent w-full md:w-max">
        Add a new subscription
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
              @click="app.toggleActive(index)"
              :class="`badge cursor-pointer ${
                item.isActive ? 'badge-success' : 'badge-error'
              }`"
            ></span>
            {{ item.name }}
          </h2>
          <p>
            {{ item.price + item.currency }}, {{ item.recurrence }} - Expires on
            {{ item.expiration.toLocaleDateString() }}
          </p>
        </div>
      </article>
    </section>
    <button
      class="btn w-full mt-7 btn-error modal-button"
      @click="app.deleteSubs()"
    >
      Delete all
    </button>
  </Container>
</template>
