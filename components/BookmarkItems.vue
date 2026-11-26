<script setup lang="ts">
import { computed } from "vue";
import { bookmarkLocationKey, type BookmarkGroupLayout, type BookmarkItem, type BookmarkLocation, type DashboardColumnCount } from "../shared/bookmarks";
import DashboardDrop from "./DashboardDrop.vue";
import DashboardGrip from "./DashboardGrip.vue";

const props = defineProps<{
  items: BookmarkItem[];
  layout: BookmarkGroupLayout;
  columns: DashboardColumnCount;
  location: BookmarkLocation;
  editing: boolean;
  selectedIds: ReadonlySet<string>;
  pending: boolean;
}>();
const emit = defineEmits<{
  edit: [item: BookmarkItem];
  select: [id: string, checked: boolean];
}>();
const sides = ["before", "after"] as const;

const iconLayout = computed(() => props.layout === "icon-large" || props.layout === "icon-small");
const entries = computed(() => props.items.map((item) => {
  const host = new URL(item.url).hostname.replace(/^www\./i, "");
  const hue = Array.from(host).reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) % 360, 0);
  return { item, host, hue, initial: host.charAt(0).toUpperCase() };
}));

function changeSelection(id: string, event: Event) {
  emit("select", id, (event.currentTarget as HTMLInputElement).checked);
}

function syncImageFallback(element: unknown) {
  if (element instanceof HTMLImageElement && element.complete) {
    element.hidden = element.naturalWidth === 0;
  }
}
</script>

<template>
  <ul
    v-if="entries.length" class="bookmarks" role="list"
    :style="{ '--columns': props.columns }"
    :class="{
      'type-icons': iconLayout,
      'type-icon-large': props.layout === 'icon-large',
      'type-icon-small': props.layout === 'icon-small',
      'type-list-large': props.layout === 'list-large',
      'type-list-small': props.layout === 'list-small',
    }"
  >
    <li v-for="{ item, host, hue, initial } in entries" :key="item.id" class="entry">
      <label v-if="props.editing" class="select">
        <input
          type="checkbox" :aria-label="`選択 ${item.title}`" :checked="props.selectedIds.has(item.id)"
          :disabled="props.pending" @change="changeSelection(item.id, $event)"
        />
      </label>
      <component
        :is="props.editing ? DashboardGrip : 'a'" class="link"
        v-bind="props.editing
          ? { source: { kind: 'bookmark', id: item.id, title: item.title, ...props.location }, disabled: props.pending, editOnClick: true }
          : { href: item.url, target: '_blank', rel: 'noopener noreferrer' }"
        @choose="emit('edit', item)"
      >
        <span class="symbol" :style="{ '--symbol-hue': hue }" aria-hidden="true">
          <img
            v-if="item.icon" :key="item.icon.revision" class="bookmark-image"
            :class="item.icon.kind === 'favicon' ? 'is-favicon' : 'is-thumbnail'"
            :ref="syncImageFallback"
            :src="`/api/bookmarks/${item.id}/image?kind=${item.icon.kind}&v=${item.icon.revision}`"
            alt="" loading="lazy" decoding="async" draggable="false"
            @load="syncImageFallback($event.currentTarget)" @error="syncImageFallback($event.currentTarget)"
          />
          <span class="initial">{{ initial }}</span>
        </span>
        <span class="caption">
          <span class="title" :title="item.title">{{ item.title }}</span>
          <span v-if="!iconLayout" class="address" :title="item.url">
            {{ props.layout === "list-large" ? item.url : host }}
          </span>
        </span>
      </component>
      <template v-if="props.editing">
        <DashboardDrop
          v-for="side in sides" :key="side" :zone-id="`bookmark-${item.id}-${side}`"
          :inline="iconLayout ? 'always' : props.columns > 1 ? 'desktop' : undefined"
          :target="{ kind: 'bookmark', ...props.location, placement: { side, anchorId: item.id } }"
        />
      </template>
    </li>
  </ul>
  <p v-else class="empty">
    {{ props.location.groupId ? "このグループにブックマークはありません。" : "ブックマークはまだありません。" }}
    <DashboardDrop
      v-if="props.editing" :zone-id="`empty-${bookmarkLocationKey(props.location)}`"
      :target="{ kind: 'bookmark', ...props.location, placement: { side: 'start' } }"
    />
  </p>
</template>

<style scoped>
.bookmarks {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry, .empty {
  position: relative;
}

.entry {
  min-inline-size: 0;
}

.empty {
  padding: 16px 0;
  color: var(--muted);
  font-size: 14px;
}

.link {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 12px;
  min-inline-size: 0;
  min-block-size: 40px;
  color: var(--ink);
  text-decoration: none;
}

button.link {
  padding: 0;
  background: transparent;
  border: 0;
  text-align: start;
}

a.link:hover .title {
  text-decoration: underline;
}

.symbol {
  display: grid;
  flex: none;
  place-items: center;
  inline-size: var(--symbol-size);
  block-size: var(--symbol-size);
  overflow: hidden;
  color: oklch(0.37 0.09 var(--symbol-hue));
  background: oklch(0.91 0.065 var(--symbol-hue));
  border-radius: var(--symbol-radius);
  font-size: var(--symbol-text);
  font-weight: 750;
  line-height: 1;
}

.symbol:has(.is-favicon:not([hidden])) {
  background-color: transparent;
}

.bookmark-image {
  inline-size: 72%;
  block-size: 72%;
  object-fit: contain;
}

.bookmark-image.is-thumbnail {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

.bookmark-image:not([hidden]) + .initial {
  display: none;
}

.caption {
  display: grid;
  min-inline-size: 0;
}

.title, .address {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title {
  font-weight: 680;
}

.address {
  color: var(--muted);
  font-size: 13px;
}

.type-list-large {
  --symbol-size: 48px;
  --symbol-radius: 12px;
  --symbol-text: 22px;
  --row-gap: 12px;
}

.type-list-small {
  --symbol-size: 28px;
  --symbol-radius: 6px;
  --symbol-text: 13px;
  --row-gap: 4px;
}

.type-list-large, .type-list-small {
  gap: var(--row-gap) 16px;
}

.type-list-large .entry, .type-list-small .entry {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-list-large .entry {
  padding-block: 8px;
}

.type-list-small .entry {
  padding-block: 2px;
}

.type-list-small .link {
  gap: 8px;
  font-size: 14px;
}

.select {
  display: grid;
  flex: none;
  place-items: center;
  inline-size: 40px;
  block-size: 40px;
}

.select input {
  inline-size: 16px;
  block-size: 16px;
  margin: 0;
  accent-color: var(--accent);
}

.type-icons {
  --tile-width: calc(var(--symbol-size) + 8px);
  grid-template-columns: repeat(auto-fill, min(100%, var(--tile-width)));
  gap: var(--tile-gap);
}

.type-icon-large {
  --tile-gap: 16px;
  --caption-gap: 4px;
  --symbol-size: 68px;
  --symbol-radius: 16px;
  --symbol-text: 30px;
}

.type-icon-small {
  --tile-gap: 8px;
  --tile-width: calc(var(--symbol-size) + 12px);
  --symbol-size: 44px;
  --symbol-radius: 12px;
  --symbol-text: 20px;
}

.type-icons .entry {
  display: grid;
}

.type-icons .select {
  justify-self: start;
}

.type-icons .link {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  inline-size: 100%;
  align-content: start;
  justify-items: center;
  gap: var(--caption-gap, 6px);
  padding: 8px 0 0;
  border-radius: 8px;
  font-size: 13px;
  text-align: center;
}

.type-icons .caption {
  max-inline-size: 100%;
}

@media (min-width: 720px) and (min-height: 500px), (min-width: 720px) and (pointer: fine) {
  .bookmarks:not(.type-icons) {
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  }
}
</style>
