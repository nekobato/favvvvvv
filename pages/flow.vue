<script setup lang="ts">
import { useForm } from "@void/vue";
import { computed, nextTick, onMounted, ref, useTemplateRef } from "vue";
import ActionIcon from "../components/ActionIcon.vue";
import LinkPagination from "../components/LinkPagination.vue";
import SavedLinkItems from "../components/SavedLinkItems.vue";
import WorkspaceHeader from "../components/WorkspaceHeader.vue";
import { maxBookmarkUrlLength } from "../shared/bookmarks";
import type { SavedLink } from "../shared/collections";
import { readShareFragment } from "../shared/share";
import type { Props } from "./flow.server";

const props = defineProps<Props>();
const capture = useForm("/flow?capture", { url: "" }, { throwOnError: false });
const add = useForm("/flow?addToCollection", { linkId: "", collectionId: "" }, { throwOnError: false });
const picker = useTemplateRef<HTMLDialogElement>("picker");
const captureInput = useTemplateRef<HTMLInputElement>("captureInput");
const ready = ref(false);
const selected = ref<SavedLink>();
const status = ref("");
const collectionNames = computed(() => new Map(props.collections.map(({ id, name }) => [id, name])));
const available = computed(() => props.collections.filter(({ id }) => !selected.value?.collectionIds.includes(id)));

onMounted(() => {
  const url = readShareFragment(window.location.hash);
  const input = captureInput.value;
  if (url && input && !input.value) {
    input.value = url;
    status.value = "共有された URL を確認して追加できます。";
  } else if (url === "") {
    status.value = "共有内容に HTTP または HTTPS の URL が見つかりませんでした。";
  }
  ready.value = true;
});

async function captureUrl() {
  const input = captureInput.value;
  if (!input) return;
  status.value = "";
  capture.data.url = input.value;
  await capture.post();
  if (capture.wasSuccessful) {
    input.value = "";
    input.focus();
  }
}

async function chooseCollection(item: SavedLink) {
  selected.value = item;
  add.data.linkId = item.id;
  add.data.collectionId = available.value[0]?.id ?? "";
  add.clearErrors();
  add.clearError();
  await nextTick();
  picker.value?.showModal();
}

async function addLink() {
  status.value = "";
  await add.post();
  if (add.wasSuccessful) {
    status.value = "コレクションに追加しました。";
    picker.value?.close();
  }
}
</script>

<template>
  <WorkspaceHeader :email="props.email" section="flow" />
  <main class="workspace">
    <h1 class="sr-only">フローリスト</h1>
    <form class="capture-form" aria-label="リンクを追加" @submit.prevent="captureUrl">
      <label for="capture-url" class="sr-only">リンクの URL</label>
      <input
        id="capture-url" ref="captureInput" class="input" type="url" name="url"
        :maxlength="maxBookmarkUrlLength" placeholder="https://…" required :disabled="capture.pending"
        :aria-invalid="!!capture.errors.url"
        :aria-describedby="capture.errors.url ? 'capture-error' : undefined"
      />
      <button
        class="button size-icon type-primary" type="submit" aria-label="リンクを追加" title="リンクを追加"
        :disabled="!ready || capture.pending"
      >
        <ActionIcon name="add" />
      </button>
    </form>
    <p v-if="capture.errors.url || capture.error" id="capture-error" class="error" role="alert">
      {{ capture.errors.url || capture.error?.message }}
    </p>
    <p class="workspace-message" role="status">{{ capture.pending ? "リンクを追加しています…" : status }}</p>
    <SavedLinkItems v-if="props.links.length" :items="props.links">
      <template #default="{ item }">
        <button
          class="button size-icon" type="button" :aria-label="`コレクションに追加 ${item.title}`"
          title="コレクションに追加" @click="chooseCollection(item)"
        >
          <ActionIcon name="folderAdd" />
        </button>
      </template>
    </SavedLinkItems>
    <p v-else class="workspace-message">リンクはまだありません。</p>
    <LinkPagination path="/flow" :page="props.page" :page-count="props.pageCount" />
  </main>

  <dialog ref="picker" class="dialog" aria-labelledby="picker-title" @cancel="add.pending && $event.preventDefault()">
    <div class="picker-heading">
      <h2 id="picker-title">コレクションに追加</h2>
      <button
        class="button size-icon" type="button" aria-label="閉じる" title="閉じる"
        :disabled="add.pending" @click="picker?.close()"
      >
        <ActionIcon name="close" />
      </button>
    </div>
    <p v-if="selected" class="selected">{{ selected.title }}</p>
    <form v-if="available.length" class="picker-form" @submit.prevent="addLink">
      <label for="target-collection">追加先</label>
      <select id="target-collection" v-model="add.data.collectionId" class="input" required autofocus>
        <option v-for="collection in available" :key="collection.id" :value="collection.id">
          {{ collection.name }}
        </option>
      </select>
      <p v-if="add.error" class="error" role="alert">{{ add.error.message }}</p>
      <div class="dialog-actions">
        <button class="button type-primary" type="submit" :disabled="add.pending">追加</button>
      </div>
    </form>
    <p v-else-if="props.collections.length" class="workspace-message">すべてのコレクションに追加済みです。</p>
    <p v-else class="workspace-message"><a href="/collections">コレクションを作成</a></p>
    <ul v-if="selected?.collectionIds.length" class="memberships" aria-label="追加済みのコレクション">
      <li v-for="id in selected.collectionIds" :key="id">
        <a :href="`/collections/${id}`">{{ collectionNames.get(id) }}</a>
      </li>
    </ul>
  </dialog>
</template>

<style scoped>
.picker-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.selected {
  margin-block-start: 8px;
  overflow-wrap: anywhere;
}

.picker-form {
  display: grid;
  gap: 8px;
  margin-block-start: 16px;
}

.picker-form label {
  font-size: 14px;
  font-weight: 650;
}

.picker-form select {
  font: inherit;
}

.memberships {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}
</style>
