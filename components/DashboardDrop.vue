<script setup lang="ts">
import { pointerIntersection } from "@dnd-kit/collision";
import { useDroppable } from "@dnd-kit/vue";
import { useTemplateRef } from "vue";
import type { ReorderTarget } from "../client/dashboard-reorder";

const props = defineProps<{ zoneId: string; target: ReorderTarget; inline?: "always" | "desktop" }>();
const zone = useTemplateRef<HTMLSpanElement>("zone");
const { isDropTarget } = useDroppable({
  id: () => props.zoneId,
  element: zone,
  collisionDetector: () => pointerIntersection,
  accept: () => draggable => {
    const { kind, placement } = props.target;
    return draggable.type === kind && (!("anchorId" in placement) || placement.anchorId !== draggable.data.source?.id);
  },
  data: () => ({ target: props.target }),
});
</script>

<template>
  <span
    ref="zone" class="zone" aria-hidden="true"
    :class="[`is-${props.target.placement.side}`, {
      'is-inline': props.inline === 'always',
      'is-desktop-inline': props.inline === 'desktop',
      'is-target': isDropTarget,
    }]"
  />
</template>

<style scoped>
.zone {
  --block-inset: 50%;
  --inline-inset: 0%;
  --block-indicator: 3px;
  --inline-indicator: 0px;
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.is-inline {
  --block-inset: 0%;
  --inline-inset: 50%;
  --block-indicator: 0px;
  --inline-indicator: 3px;
}

.is-before {
  inset-block-end: var(--block-inset);
  inset-inline-end: var(--inline-inset);
}

.is-after {
  inset-block-start: var(--block-inset);
  inset-inline-start: var(--inline-inset);
}

.is-target:is(.is-start, .is-end) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 8px;
}

.is-target.is-before {
  border-block-start: var(--block-indicator) solid var(--accent);
  border-inline-start: var(--inline-indicator) solid var(--accent);
}

.is-target.is-after {
  border-block-end: var(--block-indicator) solid var(--accent);
  border-inline-end: var(--inline-indicator) solid var(--accent);
}

@media (min-width: 720px) and (min-height: 500px), (min-width: 720px) and (pointer: fine) {
  .is-desktop-inline {
    --block-inset: 0%;
    --inline-inset: 50%;
    --block-indicator: 0px;
    --inline-indicator: 3px;
  }
}
</style>
