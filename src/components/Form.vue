<script setup lang="ts">
import { ref, Ref } from "vue";
import { format } from "date-fns";

import { Subscription } from "../libs/types";

const data: Ref<Subscription> = ref({
  name: "",
  price: 1,
  currency: "€",
  isActive: true,
  expiration: new Date(),
  recurrence: "monthly",
} as Subscription);

const formatDate = (value: Date): string => format(value, "yyyy-MM-dd");

const updatePrice = (event: Event): void => {
  const value: string = (event.target as HTMLInputElement).value;
  const update: Subscription = { ...data.value, price: parseFloat(value) };
  data.value = update;
};

const updateExpiration = (event: Event): void => {
  const value: string = (event.target as HTMLInputElement).value;
  const update: Subscription = { ...data.value, expiration: new Date(value) };
  data.value = update;
};
</script>

<template>
  <form>
    <label for="name" class="label">Service name:</label>
    <input
      type="text"
      placeholder="ex: Netflix, Prime, etc.."
      class="input w-full input-bordered"
      name="name"
      v-model="data.name"
      required
    />

    <label for="price" class="label">How much does it costs?</label>
    <input
      type="number"
      placeholder="10.00"
      class="input w-full input-bordered"
      min="0.1"
      step="0.1"
      :value="data.price.toString()"
      @input="updatePrice"
      name="price"
      required
    />

    <label for="currency" class="label">Currency:</label>
    <select
      class="select select-bordered w-full"
      required
      name="currency"
      v-model="data.currency"
    >
      <option value="€">€ Euro</option>
      <option value="$">$ Dollar</option>
    </select>

    <label class="label cursor-pointer" for="isactive">
      <span>Is active?</span>
      <input
        type="checkbox"
        class="toggle"
        name="isactive"
        checked
        v-model="data.isActive"
      />
    </label>

    <label for="expiration" class="label">Date of expiration:</label>
    <input
      type="date"
      class="input w-full input-bordered"
      required
      name="expiration"
      :value="formatDate(data.expiration)"
      @input="updateExpiration"
    />

    <label for="recurrence" class="label">Recurs:</label>
    <select
      class="select select-bordered w-full"
      required
      name="recurrence"
      v-model="data.recurrence"
    >
      <option value="monthly">Monthly</option>
      <option value="yearly">Yearly</option>
    </select>

    <div class="mt-7">
      <button class="btn btn-accent w-full md:w-1/2 lg:w-1/3">
        Add this subscription
      </button>

      <router-link to="/" class="btn w-full md:w-1/2 lg:w-1/3">
        Go back to the main screen
      </router-link>
    </div>
  </form>
</template>
