<script setup lang="ts">
import { reactive } from "vue";

import StatCell from "./StatCell.vue";
import { useContext } from "../context.ts";

const { components } = useContext();
const dashboard = reactive(components.dashboard());
</script>

<template>
  <section class="stats" aria-labelledby="stats-title">
    <h1 id="stats-title" class="section-title">{{ $t.main.title }}</h1>
    <div class="stats__grid panel">
      <StatCell
        label="total"
        :value="dashboard.total"
        :description="dashboard.inactives"
        tint="lav"
        icon="list"
      />
      <StatCell
        label="monthly"
        :value="dashboard.monthly"
        :description="$t.main.detail"
        tint="mint"
        icon="calendar"
      />
      <StatCell
        label="yearly"
        :value="dashboard.yearly"
        :description="$t.main.detail"
        tint="peach"
        icon="calendar-range"
      />
    </div>
  </section>
</template>
