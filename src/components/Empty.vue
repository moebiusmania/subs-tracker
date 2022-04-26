<script setup lang="ts">
import Container from "./Container.vue";
</script>

<template>
  <Container>
    <h2 class="text-center font-sans text-3xl font-bold">
      There is nothing here!
    </h2>
    <p class="text-center text-xl mt-2">
      Let's start by adding your subscriptions data.
    </p>
    <div class="mt-10 md:flex md:justify-center">
      <router-link to="/add" class="btn btn-accent w-full md:w-1/2 lg:w-1/3">
        Add some data!
      </router-link>
    </div>
  </Container>
</template>
