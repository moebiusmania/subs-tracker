<script setup lang="ts">
import { ref, Ref } from "vue";
import { defineAsyncComponent } from "vue";

import { Subscription } from "./../libs/types";
import { subs as mock } from "./../libs/mocks";

const Empty = defineAsyncComponent(() => import("./../components/Empty.vue"));
const List = defineAsyncComponent(() => import("./../components/List.vue"));
const Dashboard = defineAsyncComponent(
  () => import("./../components/Dashboard.vue")
);

const data: Ref<Subscription[]> = ref(mock);
</script>

<template>
  <Empty v-if="data.length === 0" />
  <Dashboard v-if="data.length > 0" :data="data" />
  <List v-if="data.length > 0" :data="data" />
</template>
