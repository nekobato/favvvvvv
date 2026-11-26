<script setup lang="ts">
import { computed } from "vue";
import type { SavedLink } from "../shared/collections";

const props = defineProps<{ items: SavedLink[]; grid?: boolean }>();
const entries = computed(() => props.items.map((item) => ({ item, host: new URL(item.url).hostname })));
</script>

<template>
  <ul class="links" :class="{ 'type-grid': props.grid }" role="list">
    <li v-for="{ item, host } in entries" :key="item.id" class="entry">
      <a class="link" :href="item.url" target="_blank" rel="noopener noreferrer">
        <img
          v-if="item.hasThumbnail" class="thumbnail" :src="`/api/links/${item.id}/thumbnail`"
          alt="" width="160" height="90" loading="lazy" decoding="async"
        />
        <span v-else class="thumbnail fallback" aria-hidden="true">{{ host.charAt(0).toUpperCase() }}</span>
        <span class="details">
          <strong class="title">{{ item.title }}</strong>
          <span class="address" :title="item.url">{{ host }}</span>
        </span>
      </a>
      <div class="actions"><slot :item="item" /></div>
    </li>
  </ul>
</template>

<style scoped>
.links {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 12px;
}

.link {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  color: var(--ink);
  text-decoration: none;
}

.link:hover .title {
  text-decoration: underline;
}

.thumbnail {
  display: block;
  inline-size: clamp(64px, 15vw, 104px);
  block-size: auto;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  background: var(--control-surface);
  object-fit: cover;
}

.fallback {
  display: grid;
  place-items: center;
  color: var(--accent);
  font-size: 20px;
  font-weight: 700;
}

.details {
  display: grid;
  min-inline-size: 0;
  gap: 2px;
}

.title {
  overflow: hidden;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.address {
  overflow: hidden;
  color: var(--muted);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.type-grid {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 232px), 1fr));
  gap: 24px 20px;
}

.type-grid .entry {
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
}

.type-grid .link {
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}

.type-grid .thumbnail {
  inline-size: 100%;
  border-radius: 12px;
}

.type-grid .actions {
  justify-content: flex-end;
}
</style>
