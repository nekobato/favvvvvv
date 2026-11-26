<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from "vue";
import { bookmarkLocationKey, type BookmarkBulkChange, type BookmarkDestination, type BookmarkLocation } from "../shared/bookmarks";

const props = defineProps<{ count: number; destinations: BookmarkDestination[]; pending: boolean; error: string }>();
const emit = defineEmits<{ submit: [change: BookmarkBulkChange] }>();
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const action = ref<BookmarkBulkChange["action"]>("move");
const destination = ref<BookmarkLocation>();

async function open(nextAction: BookmarkBulkChange["action"]) {
  action.value = nextAction;
  destination.value = undefined;
  await nextTick();
  dialog.value?.showModal();
}

function close() {
  dialog.value?.close();
}

function submit() {
  if (props.pending || !props.count) return;
  if (action.value === "delete") emit("submit", { action: "delete" });
  else if (destination.value) emit("submit", { action: "move", ...destination.value });
}

defineExpose({ open, close });
</script>

<template>
  <dialog
    id="bulk-bookmark-dialog" ref="dialog" class="dialog bulk-dialog"
    aria-labelledby="bulk-title" aria-describedby="bulk-description"
    @cancel="props.pending && $event.preventDefault()"
  >
    <h2 id="bulk-title">{{ action === "move" ? "ブックマークを一括移動" : "ブックマークを一括削除" }}</h2>
    <p id="bulk-description" class="description">
      {{ action === "move"
        ? `選択した ${props.count} 件を移動先の末尾に追加します。`
        : `選択したブックマーク ${props.count} 件を削除しますか？` }}
    </p>
    <form class="fields" @submit.prevent="submit">
      <template v-if="action === 'move'">
        <label for="bulk-destination">移動先</label>
        <select id="bulk-destination" v-model="destination" class="input" :disabled="props.pending" required autofocus>
          <option :value="undefined" disabled>移動先を選択</option>
          <option
            v-for="location in props.destinations" :key="bookmarkLocationKey(location)"
            :value="{ groupId: location.groupId, sectionId: location.sectionId }"
          >{{ location.label }}</option>
        </select>
      </template>
      <p v-if="props.error" class="error" role="alert">{{ props.error }}</p>
      <div class="dialog-actions">
        <button
          class="button" type="button" :disabled="props.pending" :autofocus="action === 'delete'" @click="close"
        >キャンセル</button>
        <button
          v-if="action === 'move'" class="button type-primary" type="submit"
          :disabled="props.pending || destination === undefined"
        >{{ props.pending ? "移動中…" : "移動する" }}</button>
        <button v-else class="button type-danger" type="submit" :disabled="props.pending">
          {{ props.pending ? "削除中…" : "削除する" }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.bulk-dialog::backdrop {
  overflow: hidden;
  overscroll-behavior: contain;
}

.description {
  margin-block: 12px 16px;
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
  font: inherit;
}
</style>
