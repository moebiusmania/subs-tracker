<script setup lang="ts">
import { reactive } from "vue";

import AppIcon from "./AppIcon.vue";
import { useContext } from "../context.ts";

const { store, components, base } = useContext();
const list = reactive(components.list());

// Picked up by TransferDialog
const send = (name: string) => dispatchEvent(new CustomEvent(name));
</script>

<template>
  <section class="subs" aria-labelledby="subs-title">
    <header class="subs__header">
      <h2 id="subs-title" class="section-title subs__title">
        <span>{{ $t.main.list }}</span>
        <span class="subs__count">{{ store.data.length }}</span>
      </h2>
      <!-- Disabled once the list is full (MAX_SUBSCRIPTIONS) -->
      <a
        class="btn btn--primary btn--sm"
        :href="`${base}add/`"
        v-show="store.canAdd"
      >
        <AppIcon name="plus" /> <span>{{ $t.main.cta }}</span>
      </a>
      <button
        type="button"
        class="btn btn--primary btn--sm"
        disabled
        aria-describedby="subs-limit"
        v-show="!store.canAdd"
      >
        <AppIcon name="plus" /> <span>{{ $t.main.cta }}</span>
      </button>
    </header>
    <p id="subs-limit" class="subs__limit" role="status" v-show="!store.canAdd">
      <AppIcon name="circle-alert" /> <span>{{ list.limitText }}</span>
    </p>

    <ul class="subs__grid" role="list">
      <li
        v-for="(item, index) in store.data"
        :key="index"
        class="sub-card"
        :class="{
          'is-inactive': !item.isActive,
          'is-due': list.expiresThisMonth(item),
        }"
      >
        <div class="sub-card__top">
          <span class="sub-card__avatar" aria-hidden="true">{{
            item.name.trim().charAt(0).toUpperCase() || "?"
          }}</span>
          <div class="sub-card__name">
            <h3>{{ item.name }}</h3>
            <span class="sub-card__recurrence">{{
              list.recurrence(item)
            }}</span>
          </div>
          <div class="sub-card__tools">
            <a
              class="icon-btn"
              :href="`${base}edit/?item=${index}`"
              :aria-label="list.editLabel(item)"
              :title="list.editLabel(item)"
            >
              <AppIcon name="pencil" />
            </a>
            <button
              type="button"
              class="icon-btn icon-btn--danger"
              :aria-label="list.deleteLabel(item)"
              :title="list.deleteLabel(item)"
              @click="list.deleteItem(index)"
            >
              <AppIcon name="trash" />
            </button>
          </div>
        </div>
        <p class="sub-card__price">{{ list.price(item) }}</p>
        <div class="sub-card__bottom">
          <p class="sub-card__expires">
            <AppIcon name="calendar" />
            <span class="visually-hidden">{{ $t.main.expires }}</span>
            <time :datetime="new Date(item.expiration).toISOString()">{{
              list.expiration(item)
            }}</time>
            <span class="sub-card__due" v-show="list.expiresThisMonth(item)">{{
              $t.main.thisMonth
            }}</span>
          </p>
          <button
            type="button"
            class="status"
            :aria-label="list.statusLabel(item)"
            @click="list.toggleActive(index)"
          >
            <span class="status__dot" aria-hidden="true"></span>
            <span>{{ list.status(item) }}</span>
          </button>
        </div>
      </li>
    </ul>

    <footer class="subs__actions">
      <div class="subs__backup">
        <button
          type="button"
          class="btn btn--sm"
          @click="send('transfer-export')"
        >
          <AppIcon name="download" /> <span>{{ $t.backup.export }}</span>
        </button>
        <button
          type="button"
          class="btn btn--sm"
          @click="send('transfer-import')"
        >
          <AppIcon name="upload" /> <span>{{ $t.backup.import }}</span>
        </button>
      </div>
      <button
        type="button"
        class="btn btn--sm btn--danger"
        @click="list.deleteAll()"
      >
        <AppIcon name="trash" /> <span>{{ $t.main.delete }}</span>
      </button>
    </footer>
  </section>
</template>
