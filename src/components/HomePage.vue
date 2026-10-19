<script setup lang="ts">
// The home page. /add/ and /edit/ render it too: the form dialog opens over
// it from the URL, so those links still work on their own. The prerender
// leaves the subscriptions out (they're in the browser's storage), like the
// empty main the page had before the app took over
import EmptyState from "./EmptyState.vue";
import DashboardStats from "./DashboardStats.vue";
import SubsList from "./SubsList.vue";
import FormDialog from "./FormDialog.vue";
import TourDialog from "./TourDialog.vue";
import TransferDialog from "./TransferDialog.vue";
import { useContext } from "../context.ts";

const { store } = useContext();
const browser = !import.meta.env.SSR;
</script>

<template>
  <div>
    <EmptyState v-if="browser && store.data.length === 0" />
    <div v-if="browser && store.data.length > 0" class="stack">
      <DashboardStats />
      <SubsList />
    </div>
  </div>

  <FormDialog />
  <TourDialog />
  <TransferDialog />
</template>
