<script setup lang="ts">
import { ref, Ref } from "vue";

import { Subscription } from "./libs/types";
import { subs as mock } from "./libs/mocks";

import Header from "./components/Header.vue";
import Footer from "./components/Footer.vue";
import List from "./components/List.vue";
import Dashboard from "./components/Dashboard.vue";

const data: Ref<Subscription[]> = ref(mock);
</script>

<template>
  <Header />
  <Dashboard :data="data" />
  <List :data="data" />
  <Footer />
</template>
