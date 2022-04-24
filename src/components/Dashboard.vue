<script setup lang="ts">
import { Subscription } from "../libs/types";
import Container from "./Container.vue";
import Stat from "./Stat.vue";

defineProps<{
  data: Subscription[];
}>();

const getInactives = (data: Subscription[]): Subscription[] =>
  data.filter((item: Subscription): boolean => !item.isActive);

const getMonthlyCost = (data: Subscription[]): number => {
  const value: string = data
    .filter(
      (item: Subscription): boolean =>
        item.isActive && item.recurrence === "monthly"
    )
    .map((item: Subscription): number => item.price)
    .reduce((a: number, b: number): number => a + b)
    .toFixed(2);
  return parseFloat(value);
};

const getYearlyCost = (data: Subscription[]): number => {
  const value: string = data
    .filter((item: Subscription): boolean => item.isActive)
    .map((item: Subscription): number =>
      item.recurrence === "monthly" ? item.price * 12 : item.price
    )
    .reduce((a: number, b: number): number => a + b)
    .toFixed(2);
  return parseFloat(value);
};
</script>

<template>
  <Container>
    <h2 class="font-sans mb-4 text-2xl font-bold">Your stats:</h2>

    <section
      class="md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-7"
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
