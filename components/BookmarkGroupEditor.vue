<script setup lang="ts">
import { useForm } from "@void/vue";
import { useTemplateRef } from "vue";
import ActionIcon from "./ActionIcon.vue";
import DashboardColumnSelect from "./DashboardColumnSelect.vue";
import {
  bookmarkGroupLayouts,
  defaultBookmarkGroupLayout,
  maxBookmarkGroupNameLength,
  type BookmarkGroupLayout,
  type DashboardColumnCount,
  type DashboardGroup,
} from "../shared/bookmarks";

const emit = defineEmits<{ saved: [message: string] }>();
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const nameInput = useTemplateRef<HTMLInputElement>("nameInput");
const layoutLabels: Record<BookmarkGroupLayout, string> = {
  "icon-large": "アイコン大",
  "icon-small": "アイコン小",
  "list-large": "リスト大",
  "list-small": "リスト小",
};

const groupForm = useForm("/?saveGroup", {
  id: "",
  name: "",
  layout: defaultBookmarkGroupLayout as BookmarkGroupLayout,
  columns: 1 as DashboardColumnCount,
  sectionId: null as string | null,
}, { throwOnError: false });

function open(sectionId: string | null, group?: DashboardGroup) {
  groupForm.data.id = group?.id ?? "";
  groupForm.data.name = group?.name ?? "";
  groupForm.data.layout = group?.layout ?? defaultBookmarkGroupLayout;
  groupForm.data.columns = group?.columns ?? 1;
  groupForm.data.sectionId = sectionId;
  groupForm.clearError();
  groupForm.clearErrors();
  dialog.value?.showModal();
}

async function saveGroup() {
  await groupForm.post({ preserveScroll: true });
  if (groupForm.wasSuccessful) {
    emit("saved", groupForm.data.id ? "グループを更新しました。" : "グループを追加しました。");
    dialog.value?.close();
  } else if (groupForm.errors.name) {
    nameInput.value?.focus();
  }
}

defineExpose({ open });
</script>

<template>
  <dialog ref="dialog" class="dialog" aria-labelledby="group-editor-title" @cancel="groupForm.pending && $event.preventDefault()">
    <h2 id="group-editor-title">{{ groupForm.data.id ? "グループを編集" : "グループを追加" }}</h2>
    <form class="group-form" aria-labelledby="group-editor-title" @submit.prevent="saveGroup">
      <label for="group-name">グループ名 <span class="optional">（任意）</span></label>
      <input
        id="group-name" ref="nameInput" v-model="groupForm.data.name" class="input" name="name"
        :maxlength="maxBookmarkGroupNameLength" :aria-invalid="!!groupForm.errors.name"
        :aria-describedby="groupForm.errors.name ? 'group-name-error' : undefined" autofocus
      />
      <p v-if="groupForm.errors.name" id="group-name-error" class="error" role="alert">{{ groupForm.errors.name }}</p>

      <fieldset class="layouts">
        <legend>表示形式</legend>
        <div class="layout-options">
          <label v-for="layout in bookmarkGroupLayouts" :key="layout" class="option">
            <input v-model="groupForm.data.layout" type="radio" name="layout" :value="layout" />
            <span
              class="sample" aria-hidden="true"
              :class="{
                'type-icon-large': layout === 'icon-large',
                'type-icon-small': layout === 'icon-small',
                'type-list-large': layout === 'list-large',
                'type-list-small': layout === 'list-small',
              }"
            ><span></span><span></span><span></span></span>
            <span>{{ layoutLabels[layout] }}</span>
          </label>
        </div>
        <p v-if="groupForm.errors.layout" class="error" role="alert">{{ groupForm.errors.layout }}</p>
      </fieldset>
      <DashboardColumnSelect id="group-columns" v-model="groupForm.data.columns" :error="groupForm.errors.columns" />
      <p v-if="groupForm.error" class="error" role="alert">{{ groupForm.error.message }}</p>
      <div class="dialog-actions">
        <button
          class="button size-icon" type="button" aria-label="キャンセル" title="キャンセル"
          :disabled="groupForm.pending" @click="dialog?.close()"
        >
          <ActionIcon name="close" />
        </button>
        <button class="button type-primary" type="submit" :disabled="groupForm.pending">
          {{ groupForm.pending ? "保存中…" : "保存" }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.group-form {
  display: grid;
  gap: 8px;
  margin-block-start: 16px;
}

.group-form > label, legend {
  font-size: 14px;
  font-weight: 650;
}

.optional {
  color: var(--muted);
  font-weight: 400;
}

.layouts {
  min-inline-size: 0;
  margin: 8px 0 0;
  padding: 0;
  border: 0;
}

legend {
  padding: 0;
  margin-block-end: 8px;
}

.layout-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.option {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 4px;
  min-block-size: 80px;
  min-inline-size: 0;
  padding: 8px;
  background: var(--control-surface);
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.option:has(input:checked) {
  background: var(--accent-soft);
  font-weight: 680;
}

.option input {
  position: absolute;
  inset-block-start: 6px;
  inset-inline-start: 6px;
  margin: 0;
  accent-color: var(--accent);
}

.sample {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  block-size: 32px;
}

.sample span {
  inline-size: var(--sample-width);
  block-size: var(--sample-height);
  background: var(--accent);
  border-radius: 4px;
}

.sample.type-icon-large {
  --sample-width: 16px;
  --sample-height: 16px;
}

.sample.type-icon-small {
  --sample-width: 10px;
  --sample-height: 10px;
}

.sample.type-list-large, .sample.type-list-small {
  --sample-width: 52px;
  flex-direction: column;
}

.sample.type-list-large {
  --sample-height: 8px;
}

.sample.type-list-small {
  --sample-height: 4px;
}
</style>
