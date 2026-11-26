<script setup lang="ts">
import { useForm } from "@void/vue";
import { onMounted, ref, useTemplateRef } from "vue";
import ActionIcon from "../../components/ActionIcon.vue";
import WorkspaceHeader from "../../components/WorkspaceHeader.vue";
import { maxCollectionNameLength } from "../../shared/collections";
import type { Props } from "./index.server";

const props = defineProps<Props>();
const create = useForm("/collections?create", { name: "" }, { throwOnError: false });
const nameInput = useTemplateRef<HTMLInputElement>("nameInput");
const ready = ref(false);
const status = ref("");

onMounted(() => { ready.value = true; });

async function createCollection() {
  const input = nameInput.value;
  if (!input) return;
  status.value = "";
  create.data.name = input.value;
  await create.post();
  if (create.wasSuccessful) {
    input.value = "";
    status.value = "コレクションを作成しました。";
    input.focus();
  }
}
</script>

<template>
  <WorkspaceHeader :email="props.email" section="collections" />
  <main class="workspace">
    <h1 class="sr-only">コレクション</h1>
    <form class="capture-form" aria-label="コレクションを作成" @submit.prevent="createCollection">
      <label for="collection-name" class="sr-only">コレクション名</label>
      <input
        id="collection-name" ref="nameInput" class="input" name="name"
        :maxlength="maxCollectionNameLength" placeholder="コレクション名" required
        :aria-invalid="!!create.errors.name || !!create.error"
        :aria-describedby="create.errors.name || create.error ? 'collection-error' : undefined"
      />
      <button
        class="button size-icon type-primary" type="submit" aria-label="コレクションを作成"
        title="コレクションを作成" :disabled="!ready || create.pending"
      >
        <ActionIcon name="folderAdd" />
      </button>
    </form>
    <p v-if="create.errors.name || create.error" id="collection-error" class="error" role="alert">
      {{ create.errors.name || create.error?.message }}
    </p>
    <p class="workspace-message" role="status">{{ status }}</p>
    <ul v-if="props.collections.length" class="collections" role="list">
      <li v-for="collection in props.collections" :key="collection.id">
        <a class="collection" :href="`/collections/${collection.id}`">
          <span>{{ collection.name }}</span>
          <span class="count">{{ collection.total }} 件</span>
          <ActionIcon name="next" />
        </a>
      </li>
    </ul>
    <p v-else class="workspace-message">コレクションはまだありません。</p>
  </main>
</template>

<style scoped>
.collections {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 264px), 1fr));
  gap: 8px 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.collection {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  min-block-size: 52px;
  padding: 8px 12px;
  color: var(--ink);
  border-radius: 8px;
  font-weight: 680;
  overflow-wrap: anywhere;
  text-decoration: none;
}

.collection:hover {
  background: var(--accent-soft);
}

.count {
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}
</style>
