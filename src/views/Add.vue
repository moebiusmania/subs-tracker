<script setup lang="ts">
import Container from "./../components/Container.vue";
import Form from "./../components/Form.vue";
</script>

<template>
  <Container>
    <div class="bg-base-100 p-7 lg:p-8">
      <h2 class="font-sans text-2xl font-bold">Add a new subscription</h2>
      <p class="mt-2 font-light text-sm">
        The subscription data will be
        <strong class="font-bold text-accent">stored locally</strong>. It will
        not be available on other device and there are no security or privacy
        concerns.
      </p>
      <div class="divider"></div>
      <Form />
    </div>
  </Container>
</template>
