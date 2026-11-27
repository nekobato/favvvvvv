<script setup lang="ts">
import { DragDropProvider, DragOverlay, PointerSensor, type DragEndEvent, type DragStartEvent } from "@dnd-kit/vue";
import { useForm, useRouter } from "@void/vue";
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from "vue";
import { FetchError, fetch } from "void/client";
import { moveTo, type ReorderSource, type ReorderTarget } from "../client/dashboard-reorder";
import ActionIcon from "../components/ActionIcon.vue";
import BookmarkBulkDialog from "../components/BookmarkBulkDialog.vue";
import BookmarkGroupEditor from "../components/BookmarkGroupEditor.vue";
import BookmarkImportDialog from "../components/BookmarkImportDialog.vue";
import BookmarkSearchDialog from "../components/BookmarkSearchDialog.vue";
import DashboardBookmarkList from "../components/DashboardBookmarkList.vue";
import DashboardDrop from "../components/DashboardDrop.vue";
import DashboardGrip from "../components/DashboardGrip.vue";
import DashboardGroup from "../components/DashboardGroup.vue";
import DashboardReorderDialog from "../components/DashboardReorderDialog.vue";
import DashboardSectionEditor from "../components/DashboardSectionEditor.vue";
import DashboardToast from "../components/DashboardToast.vue";
import WorkspaceHeader from "../components/WorkspaceHeader.vue";
import {
  bookmarkLocationKey,
  maxBookmarkTitleLength,
  maxBookmarkUrlLength,
  type BookmarkBulkChange,
  type BookmarkDestination,
  type BookmarkItem,
  type BookmarkLocation,
  type DashboardMove,
} from "../shared/bookmarks";
import type { Props } from "./index.server";

const props = defineProps<Props>();
const router = useRouter();

const groupEditor = useTemplateRef<InstanceType<typeof BookmarkGroupEditor>>("groupEditor");
const sectionEditor = useTemplateRef<InstanceType<typeof DashboardSectionEditor>>("sectionEditor");
const searchDialog = useTemplateRef<InstanceType<typeof BookmarkSearchDialog>>("searchDialog");
const reorderDialog = useTemplateRef<InstanceType<typeof DashboardReorderDialog>>("reorderDialog");
const bulkDialog = useTemplateRef<InstanceType<typeof BookmarkBulkDialog>>("bulkDialog");
const toast = useTemplateRef<InstanceType<typeof DashboardToast>>("toast");
const editor = useTemplateRef<HTMLDialogElement>("editor");
const confirmation = useTemplateRef<HTMLDialogElement>("confirmation");
const newButton = useTemplateRef<HTMLButtonElement>("newButton");
const modeButton = useTemplateRef<HTMLButtonElement>("modeButton");
const titleInput = useTemplateRef<HTMLInputElement>("titleInput");
const urlInput = useTemplateRef<HTMLInputElement>("urlInput");
const titleLookup = shallowRef<AbortController>();
const titleFeedback = ref<{ message: string; failed: boolean }>();
const titleLookupFailed = "ページタイトルを取得できませんでした。";
const removalKind = ref<"bookmark" | "group" | "section">("bookmark");
const removalLabels = { bookmark: "ブックマーク", group: "グループ", section: "セクション" };
const selectedTitle = ref("");
const editing = ref(false);
const selectedIds = ref(new Set<string>());
const hasSelection = computed(() => editing.value && selectedIds.value.size > 0);
const bulkPending = ref(false);
const bulkError = ref("");
const reorderPending = ref(false);
const editingPending = computed(() => bulkPending.value || reorderPending.value);
const reorderDialogError = ref("");
const dragSource = shallowRef<ReorderSource>();
const reorderSensors = [PointerSensor];
const sides = ["before", "after"] as const;

const visibleRootGroups = computed(() => props.query
  ? props.rootGroups.filter(group => group.bookmarks.total > 0)
  : props.rootGroups);
const sections = computed(() => props.sections.map((section, index) => ({ ...section, label: `セクション ${index + 1}` })));
const visibleSections = computed(() => {
  if (props.query) {
    return sections.value.map(section => ({
      ...section, groups: section.groups.filter(group => group.bookmarks.total > 0),
    })).filter(section => section.groups.length || section.bookmarks.total);
  }
  return sections.value.filter(section => editing.value || section.groups.length || section.bookmarks.total);
});
const showUngrouped = computed(() => !props.query || props.ungrouped.total > 0);
const canReorderGroups = computed(() => sections.value.length > 0 || props.rootGroups.length > 1);
const showRootTarget = computed(() => editing.value && dragSource.value?.kind === "group"
  && visibleSections.value.some(section => section.groups.length > 0));
const destinations = computed<BookmarkDestination[]>(() => [
  { ...props.ungrouped.location, label: "グループなし" },
  ...props.rootGroups.map(group => ({ ...group.bookmarks.location, label: group.label })),
  ...sections.value.flatMap(section => [
    { ...section.bookmarks.location, label: `${section.label}（直下）` },
    ...section.groups.map(group => ({ ...group.bookmarks.location, label: `${section.label} / ${group.label}` })),
  ]),
]);

const saveForm = useForm("/?save", { id: "", title: "", url: "", groupId: "", sectionId: "" }, { throwOnError: false });
const bookmarkTarget = computed(() => {
  try {
    const url = new URL(saveForm.data.url.trim());
    if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) {
      return url.href;
    }
  } catch {
    return undefined;
  }
});
const saveDestination = computed({
  get: () => bookmarkLocationKey({ groupId: saveForm.data.groupId, sectionId: saveForm.data.sectionId }),
  set: (key: string) => {
    const location = destinations.value.find(item => bookmarkLocationKey(item) === key);
    saveForm.data.groupId = location?.groupId ?? "";
    saveForm.data.sectionId = location?.sectionId ?? "";
  },
});
const removeForm = useForm("/?remove", { id: "" }, { throwOnError: false });
const removeGroupForm = useForm("/?removeGroup", { id: "" }, { throwOnError: false });
const removeSectionForm = useForm("/?removeSection", { id: "", expectedUserId: props.userId }, { throwOnError: false });
const removalForms = { bookmark: removeForm, group: removeGroupForm, section: removeSectionForm };
const removalForm = computed(() => removalForms[removalKind.value]);

watch(() => props.userId, () => {
  editing.value = false;
  dragSource.value = undefined;
  selectedIds.value.clear();
  bulkDialog.value?.close();
  reorderDialog.value?.close();
  sectionEditor.value?.close();
  resetTitleLookup();
  confirmation.value?.close();
  editor.value?.close();
  toast.value?.dismiss();
});
onBeforeUnmount(() => titleLookup.value?.abort());

function toggleEditing() {
  if (editingPending.value) return;
  editing.value = !editing.value;
  if (!editing.value) {
    dragSource.value = undefined;
    selectedIds.value.clear();
  }
}

function selectBookmark(id: string, checked: boolean) {
  if (!editing.value || editingPending.value) return;
  if (checked) selectedIds.value.add(id);
  else selectedIds.value.delete(id);
}

async function clearBookmarkSelection() {
  selectedIds.value.clear();
  await nextTick();
  modeButton.value?.focus({ preventScroll: true });
}

function openBulkDialog(action: BookmarkBulkChange["action"]) {
  if (!hasSelection.value || editingPending.value) return;
  bulkError.value = "";
  void bulkDialog.value?.open(action);
}

async function saveBulk(change: BookmarkBulkChange) {
  if (!hasSelection.value || editingPending.value) return;
  const expectedUserId = props.userId;
  const ids = [...selectedIds.value];
  bulkPending.value = true;
  bulkError.value = "";
  toast.value?.dismiss();
  let saved = false;
  try {
    const { affected } = await fetch("/api/bookmarks/bulk", {
      method: "POST",
      body: { ...change, ids, expectedUserId },
      retry: 0,
    });
    if (expectedUserId !== props.userId) return;
    saved = true;
    bulkDialog.value?.close();
    selectedIds.value.clear();
    if (await router.refresh() === undefined) throw new Error("Dashboard refresh did not complete");
    if (expectedUserId !== props.userId) return;
    toast.value?.show(change.action === "delete" ? `${affected} 件を削除しました。`
      : affected ? `${affected} 件を移動しました。` : "選択したブックマークはすでに移動先にあります。");
  } catch (cause) {
    if (expectedUserId !== props.userId) return;
    if (saved) {
      toast.value?.show("変更は保存済みです。一覧を再読み込みしてください。", "error");
    } else {
      const action = change.action === "move" ? "移動" : "削除";
      bulkError.value = cause instanceof FetchError && cause.status === 409
        ? "対象またはアカウントが変更されました。ページを再読み込みしてください。"
        : cause instanceof FetchError && cause.status === 403
          ? "ログインし直してください。"
          : `${action}できませんでした。もう一度お試しください。`;
    }
  } finally {
    bulkPending.value = false;
  }
  if (saved) {
    await nextTick();
    modeButton.value?.focus({ preventScroll: true });
  }
}

function chooseOrder(source: ReorderSource) {
  if (source.kind === "bookmark" || !editing.value || editingPending.value) return;
  reorderDialogError.value = "";
  reorderDialog.value?.open(source);
}

function startDrag({ operation }: DragStartEvent) {
  dragSource.value = operation.source?.data.source as ReorderSource | undefined;
}

function finishDrag({ canceled, operation }: DragEndEvent) {
  dragSource.value = undefined;
  if (canceled) return;
  const source = operation.source?.data.source as ReorderSource | undefined;
  const target = operation.target?.data.target as ReorderTarget | undefined;
  const move = source && target ? moveTo(source, target) : undefined;
  if (move) void saveOrder(move);
}

async function saveOrder(move: DashboardMove, viaDialog = false) {
  if (!editing.value || editingPending.value) return;
  const expectedUserId = props.userId;
  reorderPending.value = true;
  reorderDialogError.value = "";
  if (viaDialog) toast.value?.dismiss();
  else toast.value?.show("並べ替えを保存中…", "pending");
  let saved = false;
  try {
    await fetch("/api/bookmarks/reorder", { method: "POST", body: { ...move, expectedUserId }, retry: 0 });
    if (expectedUserId !== props.userId) return;
    saved = true;
    if (viaDialog) reorderDialog.value?.close();
    if (await router.refresh() === undefined) throw new Error("Dashboard refresh did not complete");
    if (expectedUserId !== props.userId) return;
    toast.value?.show("並べ替えを保存しました。");
  } catch (cause) {
    if (expectedUserId !== props.userId) return;
    if (saved) {
      toast.value?.show("並べ替えは保存済みです。一覧を再読み込みしてください。", "error");
    } else {
      const message = cause instanceof FetchError && cause.status === 409
        ? "一覧またはアカウントが変更されました。再読み込みしてから操作してください。"
        : "並べ替えを保存できませんでした。もう一度お試しください。";
      if (viaDialog) reorderDialogError.value = message;
      else toast.value?.show(message, "error");
    }
  } finally {
    reorderPending.value = false;
  }

  if (saved && viaDialog) {
    await nextTick();
    const focus = document.getElementById(`reorder-${move.kind}-${move.id}`)
      ?? document.getElementById(`${move.kind}-${move.id}`)
      ?? modeButton.value;
    focus?.focus({ preventScroll: true });
  }
}

function openEditor(bookmark?: BookmarkItem, target?: BookmarkLocation) {
  resetTitleLookup();
  saveForm.data.id = bookmark?.id ?? "";
  saveForm.data.title = bookmark?.title ?? "";
  saveForm.data.url = bookmark?.url ?? "";
  const location = bookmark ?? target;
  saveForm.data.groupId = location?.groupId ?? "";
  saveForm.data.sectionId = location?.sectionId ?? "";
  saveForm.clearErrors();
  saveForm.clearError();
  editor.value?.showModal();
}

function openBookmarkTarget() {
  if (bookmarkTarget.value) window.open(bookmarkTarget.value, "_blank", "noopener,noreferrer");
}

function resetTitleLookup() {
  titleLookup.value?.abort();
  titleLookup.value = undefined;
  titleFeedback.value = undefined;
}

async function retrieveBookmarkTitle() {
  if (!saveForm.data.id || saveForm.pending || titleLookup.value || !urlInput.value?.reportValidity()) return;

  const request = new AbortController();
  titleLookup.value = request;
  titleFeedback.value = undefined;
  try {
    const { title, imagesUpdated } = await fetch("/api/bookmarks/title", {
      method: "POST",
      body: { id: saveForm.data.id, url: saveForm.data.url, expectedUserId: props.userId },
      signal: request.signal,
      retry: 0,
      timeout: 10_000,
    });
    if (request.signal.aborted || !editor.value?.open) return;
    if (imagesUpdated) await router.refresh().catch(() => undefined);
    if (request.signal.aborted || !editor.value?.open) return;
    if (!title) {
      titleFeedback.value = imagesUpdated
        ? { message: `画像を更新しました。${titleLookupFailed}`, failed: false }
        : { message: titleLookupFailed, failed: true };
      return;
    }

    saveForm.data.title = title;
    saveForm.clearErrors("title");
    titleFeedback.value = {
      message: imagesUpdated ? "タイトルを再取得し、画像を更新しました。" : "タイトルを再取得しました。",
      failed: false,
    };
  } catch (cause) {
    if (request.signal.aborted || !editor.value?.open) return;
    const status = cause instanceof FetchError ? cause.status : undefined;
    const message = status === 403 ? "ログインし直してください。"
      : status === 409 || status === 404 ? "ブックマークまたはアカウントが変更されました。ページを再読み込みしてください。"
      : titleLookupFailed;
    titleFeedback.value = { message, failed: true };
  } finally {
    if (titleLookup.value === request) titleLookup.value = undefined;
  }
}

function confirmRemoval(id: string, kind: typeof removalKind.value, title = "") {
  removalKind.value = kind;
  selectedTitle.value = title;
  if (kind === "section") removeSectionForm.data.expectedUserId = props.userId;
  removalForm.value.data.id = id;
  removalForm.value.clearError();
  confirmation.value?.showModal();
}

function confirmEditedBookmarkRemoval() {
  const { id, title } = saveForm.data;
  if (!id || saveForm.pending || titleLookup.value) return;

  const lists = [
    props.ungrouped,
    ...props.rootGroups.map(group => group.bookmarks),
    ...props.sections.flatMap(section => [section.bookmarks, ...section.groups.map(group => group.bookmarks)]),
  ];
  const bookmark = lists.flatMap(list => list.items).find(item => item.id === id);
  confirmRemoval(id, "bookmark", bookmark?.title ?? title);
}

async function saveBookmark() {
  if (titleLookup.value || saveForm.pending) return;
  toast.value?.dismiss();
  await saveForm.post({ preserveScroll: true });
  if (saveForm.wasSuccessful) {
    editor.value?.close();
    toast.value?.show(saveForm.data.id ? "ブックマークを更新しました。" : "ブックマークを登録しました。");
  } else if (saveForm.errors.url) {
    urlInput.value?.focus();
  } else if (saveForm.errors.title) {
    titleInput.value?.focus();
  }
}

async function removeSelection() {
  const form = removalForm.value;
  if (form.pending) return;
  toast.value?.dismiss();
  const expectedUserId = props.userId;
  const kind = removalKind.value;
  const id = form.data.id;
  const sectionIndex = visibleSections.value.findIndex(section => section.id === id);
  const neighbor = visibleSections.value[sectionIndex + 1] ?? visibleSections.value[sectionIndex - 1];
  await form.post({ preserveScroll: true });
  if (!form.wasSuccessful || expectedUserId !== props.userId) return;

  confirmation.value?.close();
  if (kind === "bookmark") {
    selectedIds.value.delete(id);
    editor.value?.close();
  } else if (kind === "section") {
    selectedIds.value.clear();
  }
  toast.value?.show(`${removalLabels[kind]}を削除しました。`);
  await nextTick();
  const focus = kind === "group" ? document.getElementById("ungrouped-title")
    : kind === "section" && neighbor ? document.getElementById(`section-${neighbor.id}`) : null;
  (focus ?? (kind === "section" ? modeButton.value : newButton.value))?.focus({ preventScroll: true });
}
</script>

<template>
  <WorkspaceHeader :email="props.email" section="dashboard" />

  <main class="workspace">
    <h1 class="sr-only">Dashboard</h1>
    <div class="actions" role="group" aria-label="Dashboardの操作">
      <BookmarkImportDialog v-if="editing" :user-id="props.userId" @imported="toast?.show($event)" />
      <div class="action-icons">
        <button
          class="button size-icon" type="button" aria-label="検索" title="検索"
          aria-haspopup="dialog" aria-controls="search-dialog" @click="searchDialog?.open()"
        >
          <ActionIcon name="search" />
        </button>
        <button
          v-if="editing && !hasSelection" class="button size-icon" type="button"
          aria-label="グループを追加" title="Dashboard直下にグループを追加" aria-haspopup="dialog"
          :disabled="editingPending" @click="groupEditor?.open(null)"
        >
          <ActionIcon name="folderAdd" />
        </button>
        <button
          v-if="editing && !hasSelection" class="button size-icon" type="button"
          aria-label="セクションを追加" title="セクションを追加" aria-haspopup="dialog" aria-controls="section-editor-dialog"
          :disabled="editingPending" @click="sectionEditor?.open()"
        >
          <ActionIcon name="dashboardAdd" />
        </button>
      </div>
      <button
        ref="newButton" class="button size-icon" :class="{ 'type-primary': !editing }" type="button"
        aria-label="新規登録" title="新規登録" aria-haspopup="dialog" aria-controls="bookmark-editor-dialog"
        @click="openEditor()"
      >
        <ActionIcon name="add" />
      </button>
      <button
        ref="modeButton" class="button" :class="editing ? 'type-primary' : 'type-plain'" type="button"
        :disabled="editingPending" @click="toggleEditing"
      >{{ editing ? "完了" : "編集" }}</button>
    </div>

    <div v-if="props.query || hasSelection" class="list-controls">
      <div v-if="props.query" class="search-query">
        <p>「{{ props.query }}」の検索結果</p>
        <a class="button size-icon" href="/" aria-label="検索を解除" title="検索を解除">
          <ActionIcon name="close" />
        </a>
      </div>
      <div v-if="hasSelection" class="selection-actions" role="group" aria-label="選択したブックマークの操作">
        <button class="button type-plain" type="button" :disabled="editingPending" @click="clearBookmarkSelection">
          選択解除
        </button>
        <button
          class="button type-plain" type="button" aria-haspopup="dialog" aria-controls="bulk-bookmark-dialog"
          :disabled="editingPending" @click="openBulkDialog('move')"
        >
          <ActionIcon name="move" />移動
        </button>
        <button
          class="button type-plain is-destructive" type="button" aria-haspopup="dialog" aria-controls="bulk-bookmark-dialog"
          :disabled="editingPending" @click="openBulkDialog('delete')"
        >
          <ActionIcon name="trash" />削除
        </button>
      </div>
    </div>
    <p v-if="!visibleRootGroups.length && !visibleSections.length && !showUngrouped" class="search-empty">
      検索に一致するブックマークはありません。
    </p>

    <DragDropProvider :sensors="reorderSensors" @drag-start="startDrag" @drag-end="finishDrag">
      <div v-if="visibleRootGroups.length || showRootTarget" class="section">
        <div v-if="showRootTarget" class="root-target">
          Dashboard直下へ移動
          <DashboardDrop
            zone-id="root-groups" :target="{ kind: 'group', sectionId: null, placement: { side: 'end' } }"
          />
        </div>
        <div v-if="visibleRootGroups.length" class="group-grid">
          <DashboardGroup
            v-for="group in visibleRootGroups" :key="group.id" :group :section-id="null" :section-columns="1"
            :query="props.query" :editing :selected-ids="selectedIds" :pending="editingPending"
            :can-reorder="canReorderGroups" :has-selection="hasSelection"
            @add="openEditor(undefined, group.bookmarks.location)" @edit-group="groupEditor?.open(null, group)"
            @remove="confirmRemoval(group.id, 'group', group.label)" @reorder="chooseOrder"
            @select="selectBookmark" @edit-bookmark="openEditor"
          />
        </div>
      </div>
      <section
        v-for="section in visibleSections" :id="`section-${section.id}`" :key="section.id" class="section"
        :class="{ 'is-editing': editing }" :aria-label="section.label" tabindex="-1"
      >
        <header
          v-if="editing" class="section-tools"
          :class="{ 'is-empty': !section.groups.length && !section.bookmarks.total }"
        >
          <DashboardGrip
            v-if="sections.length > 1" class="button size-icon"
            :source="{ kind: 'section', id: section.id, title: section.label }"
            :disabled="editingPending" @choose="chooseOrder"
          ><ActionIcon name="grip" /></DashboardGrip>
          <div class="section-actions">
            <button
              v-if="!hasSelection" class="button size-icon" type="button" :aria-label="`${section.label} にブックマークを追加`"
              :disabled="editingPending" title="このセクションにブックマークを追加"
              @click="openEditor(undefined, section.bookmarks.location)"
            ><ActionIcon name="add" /></button>
            <button
              v-if="!hasSelection" class="button size-icon" type="button" :aria-label="`${section.label} にグループを追加`"
              :disabled="editingPending" title="このセクションにグループを追加" @click="groupEditor?.open(section.id)"
            ><ActionIcon name="folderAdd" /></button>
            <button
              v-if="!hasSelection" class="button size-icon" type="button" :aria-label="`${section.label} の列数を変更`"
              :disabled="editingPending" title="セクションの列数を変更" aria-haspopup="dialog" aria-controls="section-editor-dialog"
              @click="sectionEditor?.open(section)"
            ><ActionIcon name="edit" /></button>
            <button
              class="button size-icon is-destructive" type="button" :aria-label="`${section.label} を削除`"
              :disabled="editingPending" title="セクションを削除" aria-haspopup="dialog" aria-controls="removal-dialog"
              @click="confirmRemoval(section.id, 'section')"
            ><ActionIcon name="close" /></button>
          </div>
          <DashboardDrop
            :zone-id="`section-bookmarks-${section.id}`"
            :target="{ kind: 'bookmark', ...section.bookmarks.location, placement: { side: 'start' } }"
          />
          <DashboardDrop
            v-if="canReorderGroups" :zone-id="`section-groups-${section.id}`"
            :target="{ kind: 'group', sectionId: section.id, placement: { side: 'end' } }"
          />
        </header>
        <div v-if="section.groups.length" class="group-grid" :style="{ '--columns': section.columns }">
          <DashboardGroup
            v-for="group in section.groups" :key="group.id" :group :section-id="section.id" :section-columns="section.columns"
            :query="props.query" :editing :selected-ids="selectedIds" :pending="editingPending"
            :can-reorder="canReorderGroups" :has-selection="hasSelection"
            @add="openEditor(undefined, group.bookmarks.location)" @edit-group="groupEditor?.open(section.id, group)"
            @remove="confirmRemoval(group.id, 'group', group.label)" @reorder="chooseOrder"
            @select="selectBookmark" @edit-bookmark="openEditor"
          />
        </div>
        <DashboardBookmarkList
          v-if="section.bookmarks.total" class="section-bookmarks"
          :list="section.bookmarks" :label="section.label" :columns="section.columns"
          :query="props.query" :editing :selected-ids="selectedIds" :pending="editingPending"
          @select="selectBookmark" @edit="openEditor"
        />
        <template v-if="editing && sections.length > 1">
          <DashboardDrop
            v-for="side in sides" :key="side" :zone-id="`section-${section.id}-${side}`"
            :target="{ kind: 'section', placement: { side, anchorId: section.id } }"
          />
        </template>
      </section>
      <section v-if="showUngrouped" id="ungrouped" class="section" aria-labelledby="ungrouped-title">
        <header class="ungrouped-header">
          <h2 id="ungrouped-title" tabindex="-1">グループなし</h2>
          <DashboardDrop
            v-if="editing" zone-id="header-ungrouped"
            :target="{ kind: 'bookmark', ...props.ungrouped.location, placement: { side: 'start' } }"
          />
        </header>
        <DashboardBookmarkList
          :list="props.ungrouped" label="グループなし" :query="props.query" :editing :selected-ids="selectedIds"
          :pending="editingPending" @select="selectBookmark" @edit="openEditor"
        />
      </section>
      <DragOverlay :drop-animation="null">
        <div class="drag-preview" aria-hidden="true">{{ dragSource?.title }}</div>
      </DragOverlay>
    </DragDropProvider>
  </main>

  <DashboardToast ref="toast" />

  <BookmarkSearchDialog ref="searchDialog" :query="props.query" :user-id="props.userId" />

  <BookmarkGroupEditor ref="groupEditor" @saved="toast?.show($event)" />
  <DashboardSectionEditor ref="sectionEditor" :user-id="props.userId" @saved="toast?.show($event)" />

  <BookmarkBulkDialog
    ref="bulkDialog" :count="selectedIds.size" :destinations :pending="bulkPending" :error="bulkError"
    @submit="saveBulk"
  />

  <DashboardReorderDialog
    ref="reorderDialog" :sections :root-groups="props.rootGroups" :pending="reorderPending" :error="reorderDialogError"
    @move="saveOrder($event, true)"
  />

  <dialog
    id="bookmark-editor-dialog" ref="editor" class="dialog" aria-labelledby="editor-title"
    @cancel="saveForm.pending && $event.preventDefault()" @close="!editor?.open && resetTitleLookup()"
  >
    <h2 id="editor-title">{{ saveForm.data.id ? "ブックマークを編集" : "ブックマークを登録" }}</h2>
    <form class="fields" aria-labelledby="editor-title" @submit.prevent="saveBookmark">
      <label for="url">URL</label>
      <div class="url-entry">
        <input
          id="url" ref="urlInput" v-model="saveForm.data.url" class="input" name="url" type="url"
          placeholder="https://example.com/" :maxlength="maxBookmarkUrlLength" required autofocus
          :aria-invalid="!!saveForm.errors.url" :aria-describedby="saveForm.errors.url ? 'url-error' : undefined"
          @input="resetTitleLookup"
        />
        <button
          v-if="saveForm.data.id" class="button size-icon" type="button" :disabled="!bookmarkTarget"
          aria-label="URLを新規タブで開く" title="URLを新規タブで開く" @click="openBookmarkTarget"
        >
          <ActionIcon name="external" />
        </button>
      </div>
      <p v-if="saveForm.errors.url" id="url-error" class="error" role="alert">{{ saveForm.errors.url }}</p>
      <label for="title">タイトル <span class="optional">（任意）</span></label>
      <div>
        <div class="title-entry">
          <input
            id="title" ref="titleInput" v-model="saveForm.data.title" class="input" name="title"
            :maxlength="maxBookmarkTitleLength" :aria-invalid="!!saveForm.errors.title"
            :aria-describedby="saveForm.errors.title ? 'title-error' : undefined" @input="resetTitleLookup"
          />
          <button
            v-if="saveForm.data.id" class="button" type="button" :disabled="saveForm.pending || !!titleLookup"
            @click="retrieveBookmarkTitle"
          >再取得</button>
        </div>
        <p v-if="saveForm.data.id" class="title-feedback" :class="{ error: titleFeedback?.failed }" role="status">
          {{ titleLookup ? "取得中…" : titleFeedback?.message }}
        </p>
      </div>
      <p v-if="saveForm.errors.title" id="title-error" class="error" role="alert">{{ saveForm.errors.title }}</p>
      <label for="bookmark-destination">登録先</label>
      <select
        id="bookmark-destination" v-model="saveDestination" class="input"
        :aria-invalid="!!(saveForm.errors.groupId || saveForm.errors.sectionId)"
        :aria-describedby="saveForm.errors.groupId || saveForm.errors.sectionId ? 'bookmark-destination-error' : undefined"
      >
        <option v-for="location in destinations" :key="bookmarkLocationKey(location)" :value="bookmarkLocationKey(location)">
          {{ location.label }}
        </option>
      </select>
      <p v-if="saveForm.errors.groupId || saveForm.errors.sectionId" id="bookmark-destination-error" class="error" role="alert">
        {{ saveForm.errors.groupId || saveForm.errors.sectionId }}
      </p>
      <p v-if="saveForm.error" class="error" role="alert">{{ saveForm.error.message }}</p>
      <div class="dialog-actions">
        <button
          v-if="saveForm.data.id" class="button type-plain is-destructive" type="button"
          :disabled="saveForm.pending || !!titleLookup" aria-haspopup="dialog" aria-controls="removal-dialog"
          @click="confirmEditedBookmarkRemoval"
        >
          <ActionIcon name="trash" />削除
        </button>
        <button
          class="button size-icon" type="button" aria-label="キャンセル" title="キャンセル"
          :disabled="saveForm.pending" @click="editor?.close()"
        >
          <ActionIcon name="close" />
        </button>
        <button class="button type-primary" type="submit" :disabled="saveForm.pending || !!titleLookup">
          {{ saveForm.pending ? "保存中…" : "保存" }}
        </button>
      </div>
    </form>
  </dialog>

  <dialog
    id="removal-dialog" ref="confirmation" class="dialog confirmation"
    aria-labelledby="confirmation-title" aria-describedby="confirmation-description"
    @cancel="removalForm.pending && $event.preventDefault()"
  >
    <h2 id="confirmation-title">{{ removalLabels[removalKind] }}を削除</h2>
    <p id="confirmation-description" class="confirmation-description">
      <template v-if="removalKind === 'section'">
        このセクションを削除しますか？セクション内のグループとブックマークも削除されます。
      </template>
      <template v-else>
        「{{ selectedTitle }}」を削除しますか？
        <template v-if="removalKind === 'group'">所属するブックマークは「グループなし」に移動します。</template>
      </template>
    </p>
    <p v-if="removalForm.error" class="error" role="alert">{{ removalForm.error.message }}</p>
    <div class="dialog-actions">
      <button class="button" type="button" :disabled="removalForm.pending" autofocus @click="confirmation?.close()">
        キャンセル
      </button>
      <button class="button type-danger" type="button" :disabled="removalForm.pending" @click="removeSelection">
        {{ removalForm.pending ? "削除中…" : "削除する" }}
      </button>
    </div>
  </dialog>
</template>

<style scoped>
.actions, .list-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.actions {
  gap: 8px;
  margin-block-end: 24px;
}

.action-icons, .search-query {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-icons {
  flex: none;
}

.list-controls {
  gap: 12px;
  margin-block-end: 16px;
}

.search-query {
  min-inline-size: 0;
  color: var(--muted);
  font-size: 14px;
}

.search-query p {
  overflow-wrap: anywhere;
}

.selection-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
  margin-inline-start: auto;
}

.button.type-plain {
  padding-inline: 12px;
  color: var(--accent);
  background: transparent;
}

.button.type-plain.is-destructive {
  color: var(--danger);
}

.button.type-plain.is-destructive:hover:not(:disabled) {
  background: var(--danger-soft);
}

.drag-preview {
  inline-size: max-content;
  max-inline-size: min(240px, 65vw);
  overflow: hidden;
  padding: 8px 12px;
  color: var(--on-accent);
  background: var(--accent);
  border-radius: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section {
  position: relative;
  scroll-margin-block-start: 16px;
}

.section.is-editing::before {
  content: "";
  position: absolute;
  inset: -8px;
  border: 1px dashed var(--control-line);
  border-radius: 8px;
  pointer-events: none;
}

.section + .section {
  margin-block-start: clamp(32px, 5vw, 56px);
}

.section-tools, .section-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.section-tools, .ungrouped-header {
  position: relative;
  margin-block-end: 12px;
}

.section-tools.is-empty {
  align-items: start;
  min-block-size: 96px;
}

.ungrouped-header h2 {
  font-size: 20px;
  line-height: 1.3;
}

.section-actions {
  margin-inline-start: auto;
}

.root-target {
  position: relative;
  display: flex;
  align-items: center;
  min-block-size: 40px;
  padding-inline: 12px;
  color: var(--muted);
  background: var(--control-surface);
  border-radius: 8px;
  font-size: 14px;
}

.root-target + .group-grid {
  margin-block-start: 12px;
}

.group-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: clamp(24px, 4vw, 40px) 16px;
}

.group-grid + .section-bookmarks {
  margin-block-start: 24px;
}

@media (min-width: 720px) and (min-height: 500px), (min-width: 720px) and (pointer: fine) {
  .group-grid {
    grid-template-columns: repeat(var(--columns, 1), minmax(0, 1fr));
  }
}

.search-empty {
  padding: 32px 16px;
  color: var(--muted);
  font-size: 14px;
  text-align: center;
}

.fields {
  display: grid;
  gap: 8px;
}

.fields label {
  margin-block-start: 12px;
  font-size: 14px;
  font-weight: 650;
}

.fields select {
  font: inherit;
}

.fields .dialog-actions > .is-destructive {
  margin-inline-end: auto;
}

.url-entry, .title-entry {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-feedback {
  color: var(--muted);
  font-size: 14px;
}

.title-feedback:not(:empty) {
  margin-block-start: 8px;
}

.title-feedback.error {
  color: var(--danger);
}

.optional {
  color: var(--muted);
  font-weight: 400;
}

.confirmation::backdrop {
  overflow: hidden;
  overscroll-behavior: contain;
}

.confirmation-description {
  margin-block-start: 12px;
  overflow-wrap: anywhere;
}

@media (max-width: 480px) {
  .masthead {
    flex-wrap: wrap;
  }
}
</style>
