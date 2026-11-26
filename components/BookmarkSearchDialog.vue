<script setup lang="ts">
import { computed, shallowRef, ref, useTemplateRef, watch } from "vue";
import { FetchError, fetch } from "void/client";
import { maxBookmarkSearchLength, normalizeBookmarkQuery, type BookmarkSearchResult } from "../shared/bookmarks";
import ActionIcon from "./ActionIcon.vue";

const props = defineProps<{ query: string; userId: string }>();
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const input = useTemplateRef<HTMLInputElement>("input");
const list = useTemplateRef<HTMLUListElement>("list");
const isOpen = ref(false);
const text = ref(props.query);
const query = computed(() => normalizeBookmarkQuery(text.value));

type SearchState =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; result: BookmarkSearchResult };

const state = shallowRef<SearchState>({ status: "idle" });
const result = computed(() => state.value.status === "ready" ? state.value.result : null);
const feedback = computed(() => {
  if (state.value.status === "error") return state.value.message;
  if (state.value.status === "loading") return "検索中…";
  if (!result.value) return "";
  if (!result.value.items.length) return "一致するブックマークはありません。";
  return result.value.hasMore
    ? `先頭 ${result.value.items.length} 件を表示`
    : `${result.value.items.length} 件`;
});

function searchError(error: unknown) {
  if (error instanceof FetchError) {
    if (error.status === 403) return "ログインし直してください。";
    if (error.status === 409) return "アカウントが切り替わりました。ページを再読み込みしてください。";
  }
  return "検索結果を取得できませんでした。";
}

watch([isOpen, query, () => props.userId], ([opened, term, userId], _previous, onCleanup) => {
  if (!opened || !term) {
    state.value = { status: "idle" };
    return;
  }

  state.value = { status: "loading" };
  const controller = new AbortController();
  const timer = window.setTimeout(async () => {
    try {
      const result = await fetch("/api/bookmarks/search", {
        query: { q: term },
        headers: { "X-Favvvvvv-User": userId },
        signal: controller.signal,
        retry: 0,
        timeout: 10_000,
      });
      if (!controller.signal.aborted) state.value = { status: "ready", result };
    } catch (error) {
      if (!controller.signal.aborted) state.value = { status: "error", message: searchError(error) };
    }
  }, 200);
  onCleanup(() => {
    window.clearTimeout(timer);
    controller.abort();
  });
});

function open() {
  if (!dialog.value || dialog.value.open) return;
  text.value = props.query;
  dialog.value.showModal();
  isOpen.value = true;
}

function close() {
  isOpen.value = false;
  dialog.value?.close();
}

function closeOnEscape(event: KeyboardEvent) {
  if (event.isComposing) return;
  event.preventDefault();
  close();
}

function moveFocus(event: KeyboardEvent, direction: -1 | 1) {
  if (event.isComposing || !list.value) return;
  const links = Array.from(list.value.querySelectorAll("a"));
  const current = links.findIndex((link) => link === event.target);
  if (current === -1 && event.target !== input.value) return;

  const next = current + direction;
  const target = next === -1 ? input.value : links[next];
  if (!target) return;
  event.preventDefault();
  target.focus();
}

defineExpose({ open });
</script>

<template>
  <dialog
    id="search-dialog" ref="dialog" class="dialog search-dialog" aria-labelledby="search-title"
    @close="isOpen = dialog?.open ?? false"
    @keydown.down.exact="moveFocus($event, 1)" @keydown.up.exact="moveFocus($event, -1)"
  >
    <div class="heading">
      <h2 id="search-title">ブックマークを検索</h2>
      <button class="button size-icon" type="button" aria-label="閉じる" title="閉じる" @click="close">
        <ActionIcon name="close" />
      </button>
    </div>
    <form
      id="bookmark-search-form" class="form" action="/" method="get" role="search" aria-labelledby="search-title"
      @submit="close"
    >
      <label class="sr-only" for="search">タイトルまたは URL を検索</label>
      <input
        id="search" ref="input" v-model="text" class="input" name="q" type="search"
        :maxlength="maxBookmarkSearchLength" placeholder="タイトル・URL" autocomplete="off" autofocus
        @keydown.esc="closeOnEscape"
      />
      <button class="button size-icon" type="submit" aria-label="検索を実行" title="一覧で検索結果を表示">
        <ActionIcon name="search" />
      </button>
    </form>
    <p class="status" :class="{ 'is-error': state.status === 'error' }" role="status" aria-atomic="true">{{ feedback }}</p>
    <ul v-if="result?.items.length" ref="list" class="matches" role="list" aria-label="検索結果">
      <li v-for="item in result.items" :key="item.id">
        <a class="match" :href="item.url" target="_blank" rel="noopener noreferrer">
          <span class="title" :title="item.title">{{ item.title }}</span>
          <span class="address" :title="item.url">{{ item.url }}</span>
        </a>
      </li>
    </ul>
    <button v-if="result?.hasMore" class="button more" type="submit" form="bookmark-search-form">
      すべての結果を表示
    </button>
  </dialog>
</template>

<style scoped>
.search-dialog {
  --top-offset: clamp(16px, 10vh, 80px);

  max-block-size: calc(100% - var(--top-offset) - 16px);
  margin-block: var(--top-offset) auto;
}

.search-dialog[open] {
  display: flex;
  flex-direction: column;
}

.heading, .form {
  display: flex;
  align-items: center;
  gap: 4px;
}

.heading, .form, .status, .more {
  flex: none;
}

.heading {
  justify-content: space-between;
}

.form {
  padding: 4px;
  margin-block-start: 12px;
  background: var(--control-surface);
  border-radius: 12px;
}

.form .input {
  background: transparent;
  border: 0;
}

.form .input:focus-visible {
  outline-offset: -2px;
}

.status {
  color: var(--muted);
  font-size: 14px;
}

.status:not(:empty) {
  margin-block-start: 12px;
}

.status.is-error {
  color: var(--danger);
}

.matches {
  display: grid;
  gap: 4px;
  min-block-size: 48px;
  margin: 8px 0 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.matches li {
  min-inline-size: 0;
}

.match {
  display: grid;
  padding: 6px 8px;
  min-block-size: 44px;
  color: var(--ink);
  border-radius: 8px;
  font-size: 14px;
  text-decoration: none;
}

.match:hover, .match:focus-visible {
  background: var(--accent-soft);
}

.match:focus-visible {
  outline-offset: -2px;
}

.title, .address {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title {
  font-weight: 680;
}

.address {
  color: var(--muted);
  font-size: 13px;
}

.more {
  align-self: flex-start;
  margin-block-start: 12px;
}
</style>
