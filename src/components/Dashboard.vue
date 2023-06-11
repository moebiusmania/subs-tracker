<script setup lang="ts">
import Container from "./Container.vue";
import Stat from "./Stat.vue";

import { Subscription } from "../libs/types";
import { getInactives, getMonthlyCost, getYearlyCost, getTranslation } from "./../libs";
import { useMainStore } from "../store";

defineProps<{
  data: Subscription[];
}>();

const app = useMainStore();
const i18n = app.i18n.main;
</script>

<template>
  <Container>
    <h2 class="font-sans mb-4 text-2xl font-bold">{{ i18n.title }}</h2>

    <section
      class="flex flex-col gap-5 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-7"
    >
      <Stat
        title="Total subscriptions:"
        :value="data.length"
        :description="getTranslation(i18n.inactives, getInactives(data).length)"
      />

      <Stat
        title="Total monthly cost:"
        :value="`${getMonthlyCost(data)}€`"
        :description="i18n.detail"
      />

      <Stat
        title="Total yearly cost:"
        :value="`${getYearlyCost(data)}€`"
        :description="i18n.detail"
      />
    </section>
  </Container>
</template>
