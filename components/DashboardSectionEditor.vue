<script setup lang="ts">
import { useForm } from "@void/vue";
import { useTemplateRef } from "vue";
import type { DashboardColumnCount, DashboardSection } from "../shared/bookmarks";
import DashboardColumnSelect from "./DashboardColumnSelect.vue";

const { userId } = defineProps<{ userId: string }>();
const emit = defineEmits<{ saved: [message: string] }>();
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const form = useForm("/?saveSection", {
  id: "", columns: 1 as DashboardColumnCount, expectedUserId: userId,
}, { throwOnError: false });

function open(section?: Pick<DashboardSection, "id" | "columns">) {
  form.data.id = section?.id ?? "";
  form.data.columns = section?.columns ?? 1;
  form.data.expectedUserId = userId;
  form.clearError();
  form.clearErrors();
  dialog.value?.showModal();
}

function close() {
  dialog.value?.close();
}

async function save() {
  if (form.pending) return;
  await form.post({ preserveScroll: true });
  if (form.wasSuccessful && form.data.expectedUserId === userId) {
    emit("saved", form.data.id ? "セクションを更新しました。" : "セクションを追加しました。");
    close();
  }
}

defineExpose({ open, close });
</script>

<template>
  <dialog
    id="section-editor-dialog" ref="dialog" class="dialog" aria-labelledby="section-editor-title"
    @cancel="form.pending && $event.preventDefault()"
  >
    <h2 id="section-editor-title">{{ form.data.id ? "セクションの列数を変更" : "セクションを追加" }}</h2>
    <form class="section-form" @submit.prevent="save">
      <DashboardColumnSelect id="section-columns" v-model="form.data.columns" :error="form.errors.columns" />
      <p v-if="form.error" class="error" role="alert">{{ form.error.message }}</p>
      <div class="dialog-actions">
        <button class="button" type="button" :disabled="form.pending" @click="close">キャンセル</button>
        <button class="button type-primary" type="submit" :disabled="form.pending">
          {{ form.pending ? "保存中…" : "保存" }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.section-form {
  margin-block-start: 16px;
}
</style>
