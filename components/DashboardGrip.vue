<script setup lang="ts">
import { useDraggable } from "@dnd-kit/vue";
import { useTemplateRef } from "vue";
import type { ReorderSource } from "../client/dashboard-reorder";

const props = defineProps<{ source: ReorderSource; disabled: boolean; editOnClick?: boolean }>();
const emit = defineEmits<{ choose: [source: ReorderSource] }>();
const grip = useTemplateRef<HTMLButtonElement>("grip");
const id = `reorder-${props.source.kind}-${props.source.id}`;

useDraggable({
  id,
  element: grip,
  type: props.source.kind,
  disabled: () => props.disabled,
  data: () => ({ source: props.source }),
});
</script>

<template>
  <button
    :id="id" ref="grip" class="grip"
    type="button" :disabled="props.disabled"
    :aria-label="props.editOnClick ? `${props.source.title} を編集` : `並べ替え ${props.source.title}`"
    :title="props.editOnClick ? 'クリックで編集、ドラッグで並べ替え' : 'ドラッグまたはクリックで並べ替え'"
    aria-haspopup="dialog"
    @click="emit('choose', props.source)"
  >
    <slot />
  </button>
</template>

<style scoped>
.grip:enabled {
  cursor: grab;
  -webkit-user-select: none;
  user-select: none;
}

.grip:enabled:active {
  cursor: grabbing;
}
</style>
