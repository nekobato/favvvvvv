<script setup lang="ts">
import ActionIcon from "./ActionIcon.vue";

const props = defineProps<{ path: string; page: number; pageCount: number }>();
</script>

<template>
  <nav v-if="props.pageCount > 1" class="pagination" aria-label="ページ">
    <a
      v-if="props.page > 1" class="button size-icon"
      :href="props.page === 2 ? props.path : `${props.path}?page=${props.page - 1}`"
      aria-label="前へ" title="前のページ"
    >
      <ActionIcon name="previous" />
    </a>
    <span>{{ props.page }} / {{ props.pageCount }}</span>
    <a
      v-if="props.page < props.pageCount" class="button size-icon" :href="`${props.path}?page=${props.page + 1}`"
      aria-label="次へ" title="次のページ"
    >
      <ActionIcon name="next" />
    </a>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-block-start: 24px;
  color: var(--muted);
  font-size: 14px;
}
</style>
