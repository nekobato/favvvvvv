<script setup lang="ts">
import { onUnmounted, ref, shallowRef } from "vue";
import ActionIcon from "./ActionIcon.vue";

type NoticeKind = "success" | "pending" | "error";

const notice = shallowRef<{ id: symbol; message: string; kind: NoticeKind }>();
const isOpen = ref(false);
let dismissTimer: ReturnType<typeof setTimeout> | undefined;

function dismiss() {
  clearTimeout(dismissTimer);
  isOpen.value = false;
}

function show(message: string, kind: NoticeKind = "success") {
  clearTimeout(dismissTimer);
  notice.value = { id: Symbol(), message, kind };
  isOpen.value = true;
  if (kind === "success") dismissTimer = setTimeout(dismiss, 5000);
}

onUnmounted(() => clearTimeout(dismissTimer));
defineExpose({ show, dismiss });
</script>

<template>
  <div class="toast-layer">
    <p class="sr-only" role="status" aria-atomic="true">
      <span v-if="isOpen && notice && notice.kind !== 'error'" :key="notice.id">{{ notice.message }}</span>
    </p>
    <p class="sr-only" role="alert" aria-atomic="true">
      <span v-if="isOpen && notice?.kind === 'error'" :key="notice.id">{{ notice.message }}</span>
    </p>
    <div class="toast t-toast" :class="{ 'is-open': isOpen, 'is-error': notice?.kind === 'error' }" :inert="!isOpen">
      <p aria-hidden="true">{{ notice?.message }}</p>
      <button
        v-if="notice?.kind === 'error'" class="button size-icon" type="button"
        aria-label="通知を閉じる" title="通知を閉じる" @click="dismiss"
      >
        <ActionIcon name="close" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast-layer {
  --toast-open: 350ms;
  --toast-close: 250ms;
  --toast-distance: -8px;
  --toast-blur: 2px;
  --toast-scale: 0.97;
  --toast-ease: cubic-bezier(0.22, 1, 0.36, 1);

  position: fixed;
  z-index: 10;
  inset-block-start: calc(env(safe-area-inset-top, 0px) + 16px);
  inset-inline: 16px;
  display: grid;
  justify-items: center;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  max-inline-size: min(480px, 100%);
  min-block-size: 40px;
  padding: 8px 16px;
  color: var(--on-accent);
  background: var(--accent);
  border-radius: 8px;
  box-shadow: 0 4px 12px oklch(0.25 0.02 168 / 0.18);
  font-size: 14px;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.toast.is-error {
  background: var(--danger);
}

.button.size-icon {
  margin-block: -4px;
  margin-inline-end: -8px;
  color: inherit;
  pointer-events: auto;
}

.button.size-icon:hover {
  color: inherit;
  background: oklch(1 0 0 / 0.16);
}

.button.size-icon:focus-visible {
  outline-color: currentColor;
  outline-offset: -3px;
}

.t-toast {
  opacity: 0;
  transform: translateY(var(--toast-distance)) scale(var(--toast-scale));
  filter: blur(var(--toast-blur));
  will-change: transform, opacity, filter;
  transition:
    opacity var(--toast-close) var(--toast-ease),
    transform var(--toast-close) var(--toast-ease),
    filter var(--toast-close) var(--toast-ease);
}

.t-toast.is-open {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
  transition:
    opacity var(--toast-open) var(--toast-ease),
    transform var(--toast-open) var(--toast-ease),
    filter var(--toast-open) var(--toast-ease);
}

@media (prefers-reduced-motion: reduce) {
  .t-toast { transition: none !important; }
}
</style>
