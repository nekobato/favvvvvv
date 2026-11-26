<script setup lang="ts">
import { useRouter } from "@void/vue";
import { computed, ref, useTemplateRef } from "vue";
import { FetchError } from "void/client";
import ActionIcon from "./ActionIcon.vue";
import { importBookmarkBatch, maxBookmarkFileMegabytes, readBookmarkFile } from "../client/bookmark-import";
import { bookmarkImportPreviewLookupLimit, type BookmarkImportResult } from "../shared/bookmarks";

const props = defineProps<{ userId: string }>();
const emit = defineEmits<{ imported: [message: string] }>();
const router = useRouter();
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const picker = useTemplateRef<HTMLInputElement>("picker");
const busy = ref(false);
const total = ref(0);
const error = ref("");
const result = ref<BookmarkImportResult>({ imported: 0, duplicates: 0, skipped: 0 });
const processed = computed(() => result.value.imported + result.value.duplicates + result.value.skipped);
const summary = computed(() => {
  const { imported, duplicates, skipped } = result.value;
  return `追加 ${imported} 件・重複 ${duplicates} 件・対象外 ${skipped} 件`;
});

function resetResult() {
  total.value = 0;
  error.value = "";
  result.value = { imported: 0, duplicates: 0, skipped: 0 };
}

function openDialog() {
  resetResult();
  if (picker.value) picker.value.value = "";
  dialog.value?.showModal();
}

async function importBookmarks() {
  const file = picker.value?.files?.item(0);
  if (!file || busy.value) return;
  const expectedUserId = props.userId;

  resetResult();
  busy.value = true;
  let sentBatch = false;
  try {
    const parsed = await readBookmarkFile(file);
    if (parsed.error !== undefined) {
      error.value = parsed.error;
      return;
    }

    const { items, skipped } = parsed;
    total.value = items.length + skipped;
    result.value.skipped = skipped;
    for (let offset = 0; offset < items.length; offset += bookmarkImportPreviewLookupLimit) {
      sentBatch = true;
      const batchItems = items.slice(offset, offset + bookmarkImportPreviewLookupLimit);
      const batch = await importBookmarkBatch(expectedUserId, batchItems);
      result.value.imported += batch.imported;
      result.value.duplicates += batch.duplicates;
      result.value.skipped += batch.skipped;
    }
  } catch (cause) {
    const status = cause instanceof FetchError ? cause.status : undefined;
    if (status === 409) {
      if (picker.value) picker.value.value = "";
      error.value = "アカウントが切り替わりました。利用中のアカウントを確認し、ファイルを選択し直してください。";
    } else {
      error.value = status === 403
        ? "ログインし直してから、同じファイルで再試行してください。"
        : "インポートが中断されました。同じファイルで再試行できます。";
    }
  } finally {
    try {
      if (sentBatch) await router.refresh();
    } catch {
      if (!error.value) error.value = "一覧の表示を更新できませんでした。ページを再読み込みしてください。";
    } finally {
      busy.value = false;
    }
  }

  if (error.value) return;
  dialog.value?.close();
  emit("imported", summary.value);
}
</script>

<template>
  <button type="button" class="button" @click="openDialog">インポート</button>
  <dialog ref="dialog" class="dialog" aria-labelledby="import-title" @cancel="busy && $event.preventDefault()">
    <h2 id="import-title">ブックマークをインポート</h2>
    <form class="import-form" aria-labelledby="import-title" @submit.prevent="importBookmarks">
      <label for="bookmark-file">ブックマーク HTML ファイル</label>
      <input
        id="bookmark-file" ref="picker" class="input file" type="file" accept=".html,.htm,text/html"
        :aria-describedby="error ? 'bookmark-file-help import-error' : 'bookmark-file-help'"
        :disabled="busy" required autofocus @change="resetResult"
      />
      <p id="bookmark-file-help" class="help">
        Chrome などからエクスポートした HTML を選択してください。最大 {{ maxBookmarkFileMegabytes }} MB です。
      </p>
      <progress
        v-if="busy" class="progress" aria-label="インポートの進行状況"
        :value.attr="total ? processed : null" :max="total || 1"
      />
      <p class="import-status" role="status">
        <template v-if="busy">
          {{ total ? `${processed} / ${total} 件を処理` : "ファイルを解析中…" }}
        </template>
        <template v-else-if="processed">
          {{ summary }}
        </template>
      </p>
      <p v-if="error" id="import-error" class="error" role="alert">{{ error }}</p>

      <div class="dialog-actions">
        <button
          class="button size-icon" type="button" aria-label="閉じる" title="閉じる"
          :disabled="busy" @click="dialog?.close()"
        >
          <ActionIcon name="close" />
        </button>
        <button class="button type-primary" type="submit" :disabled="busy">
          {{ busy ? "インポート中…" : "インポート" }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.import-form {
  display: grid;
  gap: 8px;
  margin-block-start: 16px;
}

label {
  font-size: 14px;
  font-weight: 650;
}

.file {
  font-size: 14px;
}

.file::file-selector-button {
  min-block-size: 40px;
  margin-inline-end: 8px;
  padding-inline: 12px;
  color: var(--ink);
  background: var(--accent-soft);
  border: 0;
  border-radius: 6px;
  font: inherit;
}

.help, .import-status {
  color: var(--muted);
  font-size: 14px;
}

.import-status:empty {
  display: none;
}

.progress {
  inline-size: 100%;
  accent-color: var(--accent);
}

.dialog-actions {
  margin-block-start: 8px;
}
</style>
