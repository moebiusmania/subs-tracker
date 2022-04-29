<script setup lang="ts">
import { defineAsyncComponent } from "vue";

import { useMainStore } from "./../store";

const Empty = defineAsyncComponent(() => import("./../components/Empty.vue"));
const List = defineAsyncComponent(() => import("./../components/List.vue"));
const Dashboard = defineAsyncComponent(
  () => import("./../components/Dashboard.vue")
);

const app = useMainStore();
</script>

<template>
  <Empty v-if="app.data.length === 0" />
  <Dashboard v-if="app.data.length > 0" :data="app.data" />
  <List v-if="app.data.length > 0" :data="app.data" />
</template>
