<script setup lang="ts">
import Container from "./Container.vue";
import Stat from "./Stat.vue";

import { Subscription } from "../libs/types";
import { getInactives, getMonthlyCost, getYearlyCost } from "./../libs";

defineProps<{
  data: Subscription[];
}>();
</script>

<template>
  <Container>
    <h2 class="font-sans mb-4 text-2xl font-bold">Your stats:</h2>

    <section
      class="flex flex-col gap-5 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-7"
    >
      <Stat
        title="Total subscriptions:"
        :value="data.length"
        :description="`with ${
          getInactives(data).length
        } inactive subscriptions`"
      />

      <Stat
        title="Total monthly cost:"
        :value="`${getMonthlyCost(data)}€`"
        description="(only active subscriptions)"
      />

      <Stat
        title="Total yearly cost:"
        :value="`${getYearlyCost(data)}€`"
        description="(only active subscriptions)"
      />
    </section>
  </Container>
</template>
