<script setup lang="ts">
import { useForm } from "@void/vue";
import { ref } from "vue";
import ActionIcon from "../../components/ActionIcon.vue";
import LinkPagination from "../../components/LinkPagination.vue";
import SavedLinkItems from "../../components/SavedLinkItems.vue";
import WorkspaceHeader from "../../components/WorkspaceHeader.vue";
import type { Props } from "./[id].server";

const props = defineProps<Props>();
const path = `/collections/${props.collection.id}` as const;
const add = useForm(`${path}?addToDashboard`, { linkId: "" }, { throwOnError: false });
const remove = useForm(`${path}?remove`, { linkId: "" }, { throwOnError: false });
const status = ref("");

async function addToDashboard(linkId: string) {
  status.value = "";
  remove.clearError();
  add.data.linkId = linkId;
  await add.post();
  if (add.wasSuccessful) status.value = "Dashboard に追加しました。";
}

async function removeLink(linkId: string) {
  status.value = "";
  add.clearError();
  remove.data.linkId = linkId;
  await remove.post();
  if (remove.wasSuccessful) status.value = "コレクションから外しました。";
}
</script>

<template>
  <WorkspaceHeader :email="props.email" section="collections" />
  <main class="workspace">
    <a class="back" href="/collections"><ActionIcon name="previous" />コレクション</a>
    <h1>{{ props.collection.name }}</h1>
    <p class="workspace-message" role="status">{{ status }}</p>
    <p v-if="add.error || remove.error" class="error" role="alert">{{ add.error?.message || remove.error?.message }}</p>
    <SavedLinkItems v-if="props.links.length" :items="props.links" grid>
      <template #default="{ item }">
        <span
          v-if="item.inDashboard" class="button size-icon" role="img"
          aria-label="Dashboard に追加済み" title="Dashboard に追加済み"
        >
          <ActionIcon name="check" />
        </span>
        <button
          v-else class="button size-icon" type="button" :aria-label="`Dashboard に追加 ${item.title}`"
          title="Dashboard に追加" :disabled="add.pending || remove.pending" @click="addToDashboard(item.id)"
        >
          <ActionIcon name="dashboardAdd" />
        </button>
        <button
          class="button size-icon" type="button" :aria-label="`コレクションから外す ${item.title}`"
          title="コレクションから外す" :disabled="add.pending || remove.pending" @click="removeLink(item.id)"
        >
          <ActionIcon name="minus" />
        </button>
      </template>
    </SavedLinkItems>
    <p v-else class="workspace-message"><a href="/flow">フローリスト</a>からリンクを追加できます。</p>
    <LinkPagination :path="path" :page="props.page" :page-count="props.pageCount" />
  </main>
</template>

<style scoped>
.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-block-size: 40px;
  margin-block-end: 4px;
  font-size: 14px;
  text-decoration: none;
}

.back:hover {
  text-decoration: underline;
}
</style>
