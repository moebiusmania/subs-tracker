<script setup lang="ts">
import { useRouter, Router } from "vue-router";

import { useMainStore } from "./../store";
import { Subscription } from "../libs/types";
import Container from "./../components/Container.vue";
import Form from "./../components/Form.vue";

const app = useMainStore();
const router: Router = useRouter();

const creationComplete = (data: Subscription): void => {
  app.addSubscription(data);
  router.push("/");
};
</script>

<template>
  <Container>
    <div class="bg-base-100 p-7 lg:p-8 mt-3">
      <h2 class="font-sans text-2xl font-bold">Add a new subscription</h2>
      <p class="mt-2 font-light text-sm">
        The subscription data will be
        <strong class="font-bold text-accent">stored locally</strong>. It will
        not be available on other device and there are no security or privacy
        concerns.
      </p>
      <div class="divider"></div>
      <Form @add-item="creationComplete" />
    </div>
  </Container>
</template>
