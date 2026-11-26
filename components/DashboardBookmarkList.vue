<script setup lang="ts">
import { Link } from "@void/vue";
import { bookmarkLocationKey, type BookmarkGroupLayout, type BookmarkItem, type DashboardBookmarkList, type DashboardColumnCount } from "../shared/bookmarks";
import ActionIcon from "./ActionIcon.vue";
import BookmarkItems from "./BookmarkItems.vue";

const { list, layout = "list-small", columns = 1, label, query, editing, selectedIds, pending } = defineProps<{
  list: DashboardBookmarkList;
  layout?: BookmarkGroupLayout;
  columns?: DashboardColumnCount;
  label: string;
  query: string;
  editing: boolean;
  selectedIds: ReadonlySet<string>;
  pending: boolean;
}>();
const emit = defineEmits<{ select: [id: string, checked: boolean]; edit: [item: BookmarkItem] }>();

function pageUrl(page: number) {
  const search = new URLSearchParams();
  if (query) search.set("q", query);
  if (page > 1) {
    const { groupId, sectionId } = list.location;
    if (groupId) search.set("group", groupId);
    if (sectionId) search.set("section", sectionId);
    search.set("page", String(page));
  }
  return `${search.size ? `/?${search}` : "/"}#${bookmarkLocationKey(list.location)}`;
}
</script>

<template>
  <div>
    <BookmarkItems
      :items="list.items" :location="list.location" :layout :columns :editing :selected-ids="selectedIds" :pending
      @select="(id, checked) => emit('select', id, checked)" @edit="emit('edit', $event)"
    />
    <nav v-if="list.pageCount > 1" class="pagination" :aria-label="`${label}のページ`">
      <Link
        v-if="list.page > 1" class="button size-icon" :href="pageUrl(list.page - 1)"
        :preserve-state="editing" aria-label="前へ" title="前のページ"
      ><ActionIcon name="previous" /></Link>
      <span>{{ list.page }} / {{ list.pageCount }}</span>
      <Link
        v-if="list.page < list.pageCount" class="button size-icon" :href="pageUrl(list.page + 1)"
        :preserve-state="editing" aria-label="次へ" title="次のページ"
      ><ActionIcon name="next" /></Link>
    </nav>
  </div>
</template>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-block-start: 16px;
  color: var(--muted);
  font-size: 14px;
}
</style>
