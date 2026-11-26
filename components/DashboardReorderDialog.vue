<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { moveTo, type ReorderSource } from "../client/dashboard-reorder";
import type { DashboardMove, ReorderPlacement } from "../shared/bookmarks";

type ContainerSource = Extract<ReorderSource, { kind: "group" | "section" }>;
type Anchor = { id: string; label: string };

const props = defineProps<{
  sections: (Anchor & { groups: Anchor[] })[];
  rootGroups: Anchor[];
  pending: boolean;
  error: string;
}>();
const emit = defineEmits<{ move: [move: DashboardMove] }>();
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const source = ref<ContainerSource>();
const placement = ref<ReorderPlacement>();
const destination = ref<string | null>(null);

const anchors = computed(() => {
  const groupAnchors = destination.value === null ? props.rootGroups
    : props.sections.find(({ id }) => id === destination.value)?.groups ?? [];
  const candidates = source.value?.kind === "section" ? props.sections : groupAnchors;
  return candidates.filter(({ id }) => id !== source.value?.id);
});

function open(item: ContainerSource) {
  source.value = item;
  destination.value = item.kind === "group" ? item.sectionId : null;
  placement.value = undefined;
  dialog.value?.showModal();
}

function close() {
  dialog.value?.close();
}

function submit() {
  if (!source.value || !placement.value || props.pending) return;
  const move = moveTo(source.value, source.value.kind === "section"
    ? { kind: "section", placement: placement.value }
    : { kind: "group", sectionId: destination.value, placement: placement.value });
  if (move) emit("move", move);
}

defineExpose({ open, close });
</script>

<template>
  <dialog ref="dialog" class="dialog" aria-labelledby="reorder-title" @cancel="props.pending && $event.preventDefault()">
    <h2 id="reorder-title">{{ source?.kind === "section" ? "セクションを並べ替え" : "グループを並べ替え" }}</h2>
    <p class="subject">{{ source?.title }}</p>
    <form class="fields" @submit.prevent="submit">
      <template v-if="source?.kind === 'group' && props.sections.length">
        <label for="reorder-section">移動先</label>
        <select
          id="reorder-section" v-model="destination" class="input" :disabled="props.pending"
          @change="placement = undefined"
        >
          <option :value="null">Dashboard直下</option>
          <option v-for="section in props.sections" :key="section.id" :value="section.id">{{ section.label }}</option>
        </select>
      </template>
      <label for="reorder-position">位置</label>
      <select id="reorder-position" v-model="placement" class="input" :disabled="props.pending" required autofocus>
        <option :value="undefined" disabled>位置を選択</option>
        <option :value="{ side: 'start' }">先頭</option>
        <option :value="{ side: 'end' }">末尾</option>
        <template v-for="anchor in anchors" :key="anchor.id">
          <option :value="{ side: 'before', anchorId: anchor.id }">「{{ anchor.label }}」の直前</option>
          <option :value="{ side: 'after', anchorId: anchor.id }">「{{ anchor.label }}」の直後</option>
        </template>
      </select>
      <p v-if="props.error" class="error" role="alert">{{ props.error }}</p>
      <div class="dialog-actions">
        <button class="button" type="button" :disabled="props.pending" @click="close">キャンセル</button>
        <button class="button type-primary" type="submit" :disabled="props.pending || !placement">
          {{ props.pending ? "保存中…" : "移動" }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.subject {
  margin-block: 8px 16px;
  color: var(--muted);
  overflow-wrap: anywhere;
}

.fields {
  display: grid;
  gap: 8px;
}

label {
  font-size: 14px;
  font-weight: 650;
}

select {
  min-inline-size: 0;
  font: inherit;
}
</style>
