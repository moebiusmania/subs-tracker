<script setup lang="ts">
// The add and edit form, inside FormDialog. With an index it edits that item
// (editForm), without one it adds a new one (addForm). icon: the submit icon
import { onMounted, reactive, ref } from "vue";

import AppIcon from "./AppIcon.vue";
import type { IconName } from "../icons.ts";
import { useContext } from "../context.ts";

const props = defineProps<{ index?: number; icon: IconName }>();

const { components, closeForm: close } = useContext();
const form = reactive(
  props.index === undefined
    ? components.addForm()
    : components.editForm(props.index),
);
const strings = props.index === undefined ? "add" : "edit";

const price = ref<HTMLInputElement | null>(null);

onMounted(() => {
  // Set once, so typing isn't rewritten
  price.value!.value = form.formatPrice(form.item.price);
  form.init();
});

const setPrice = (event: Event) => {
  form.item.price =
    form.parsePrice((event.target as HTMLInputElement).value) ?? NaN;
};
const setExpiration = (event: Event) => {
  form.item.expiration = new Date((event.target as HTMLInputElement).value);
};
</script>

<template>
  <form class="form" @submit.prevent="form.submit()">
    <div class="field field--full">
      <label for="name">{{ $t.add.name }}</label>
      <input
        type="text"
        id="name"
        name="name"
        :placeholder="$t.add.namePlaceholder"
        v-model="form.item.name"
        required
        autofocus
      />
    </div>

    <div class="field">
      <label for="price">{{ $t.add.price }}</label>
      <!-- Text, not number: a number input rejects the decimal comma in most
           locales -->
      <input
        ref="price"
        type="text"
        id="price"
        name="price"
        inputmode="decimal"
        autocomplete="off"
        placeholder="10,00"
        pattern="\d+([.,]\d{1,2})?|[.,]\d{1,2}"
        :title="$t.tui.invalidPrice"
        @input="setPrice"
        required
      />
    </div>

    <div class="field">
      <label for="currency">{{ $t.add.currency }}</label>
      <select
        id="currency"
        name="currency"
        v-model="form.item.currency"
        required
        disabled
      >
        <option value="€">{{ "€ " + $t.add.euro }}</option>
        <option value="$">{{ "$ " + $t.add.dollar }}</option>
      </select>
    </div>

    <div class="field">
      <label for="expiration">{{ $t.add.expiration }}</label>
      <input
        type="date"
        id="expiration"
        name="expiration"
        :value="form.formatDate(form.item.expiration)"
        @input="setExpiration"
        required
      />
    </div>

    <div class="field">
      <label for="recurrence">{{ $t.add.recurrence }}</label>
      <select
        id="recurrence"
        name="recurrence"
        v-model="form.item.recurrence"
        required
      >
        <option value="monthly">{{ $t.recurrence.monthly }}</option>
        <option value="yearly">{{ $t.recurrence.yearly }}</option>
      </select>
    </div>

    <div class="field field--full field--switch">
      <input
        type="checkbox"
        class="switch"
        id="isactive"
        name="isactive"
        role="switch"
        v-model="form.item.isActive"
      />
      <label for="isactive">{{ $t.add.active }}</label>
    </div>

    <div class="form__actions">
      <button type="submit" class="btn btn--primary">
        <AppIcon :name="icon" /> <span>{{ $t[strings].submit }}</span>
      </button>
      <button type="button" class="btn btn--ghost" @click="close()">
        {{ $t.add.cancel }}
      </button>
    </div>
  </form>
</template>
