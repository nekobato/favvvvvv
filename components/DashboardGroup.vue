<script setup lang="ts">
import { computed } from "vue";
import type { ReorderSource } from "../client/dashboard-reorder";
import { bookmarkLocationKey, type BookmarkItem, type DashboardColumnCount, type DashboardGroup } from "../shared/bookmarks";
import ActionIcon from "./ActionIcon.vue";
import DashboardBookmarkList from "./DashboardBookmarkList.vue";
import DashboardDrop from "./DashboardDrop.vue";
import DashboardGrip from "./DashboardGrip.vue";

const { group, sectionId, sectionColumns, query, editing, canReorder, hasSelection, pending, selectedIds } = defineProps<{
  group: DashboardGroup;
  sectionId: string | null;
  sectionColumns: DashboardColumnCount;
  query: string;
  editing: boolean;
  canReorder: boolean;
  hasSelection: boolean;
  pending: boolean;
  selectedIds: ReadonlySet<string>;
}>();
const emit = defineEmits<{
  add: [];
  editGroup: [];
  remove: [];
  reorder: [source: ReorderSource];
  select: [id: string, checked: boolean];
  editBookmark: [item: BookmarkItem];
}>();
const id = computed(() => bookmarkLocationKey(group.bookmarks.location));
const sides = ["before", "after"] as const;
</script>

<template>
  <section
    :id class="group" :aria-labelledby="group.name ? `${id}-title` : undefined"
    :aria-label="group.name ? undefined : group.label" tabindex="-1"
  >
    <header v-if="group.name || editing" class="group-header">
      <h2 v-if="group.name" :id="`${id}-title`" tabindex="-1">{{ group.name }}</h2>
      <DashboardGrip
        v-if="editing && canReorder" class="button size-icon"
        :source="{ kind: 'group', id: group.id, title: group.label, sectionId }"
        :disabled="pending" @choose="emit('reorder', $event)"
      ><ActionIcon name="grip" /></DashboardGrip>
      <div v-if="editing && !hasSelection" class="group-actions">
        <button
          class="button size-icon" type="button" :aria-label="`${group.label} にブックマークを追加`"
          :disabled="pending" title="このグループにブックマークを追加" @click="emit('add')"
        ><ActionIcon name="add" /></button>
        <button
          class="button size-icon" type="button" :aria-label="`編集 ${group.label}（グループ）`"
          :disabled="pending" title="グループを編集" @click="emit('editGroup')"
        ><ActionIcon name="edit" /></button>
        <button
          class="button size-icon is-destructive" type="button" :aria-label="`グループ「${group.label}」を削除`"
          :disabled="pending" title="グループを削除" aria-haspopup="dialog" aria-controls="removal-dialog"
          @click="emit('remove')"
        ><ActionIcon name="trash" /></button>
      </div>
      <DashboardDrop
        v-if="editing" :zone-id="`header-${id}`"
        :target="{ kind: 'bookmark', ...group.bookmarks.location, placement: { side: 'start' } }"
      />
    </header>
    <DashboardBookmarkList
      :list="group.bookmarks" :label="group.label" :layout="group.layout" :columns="sectionColumns > 1 ? 1 : group.columns"
      :query :editing :selected-ids="selectedIds" :pending
      @select="(itemId, checked) => emit('select', itemId, checked)" @edit="emit('editBookmark', $event)"
    />
    <template v-if="editing && canReorder">
      <DashboardDrop
        v-for="side in sides" :key="side" :zone-id="`group-${group.id}-${side}`"
        :inline="sectionColumns > 1 ? 'desktop' : undefined"
        :target="{ kind: 'group', sectionId, placement: { side, anchorId: group.id } }"
      />
    </template>
  </section>
</template>

<style scoped>
.group, .group-header {
  position: relative;
  min-inline-size: 0;
}

.group {
  scroll-margin-block-start: 16px;
}

.group-header, .group-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.group-header {
  flex-wrap: wrap;
  margin-block-end: 8px;
}

.group-header h2 {
  flex: 1 1 120px;
  font-size: 20px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.group-actions {
  margin-inline-start: auto;
}
</style>
