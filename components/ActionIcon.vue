<script setup lang="ts">
const paths = {
  add: "M12 5v14M5 12h14",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M18 6 6 18",
  dashboardAdd: "M3 4h18v16H3zM3 8h18m-9 3v6m-3-3h6",
  edit: "m14.5 5.5 4 4M4 20l4.5-1 12-12a2.8 2.8 0 0 0-4-4l-12 12L4 20Z",
  external: "M14 4h6v6m0-6-9 9M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5",
  folderAdd: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm9 3v6m-3-3h6",
  grip: "M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01",
  logout: "M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5m6-12 4 4-4 4m4-4H8",
  minus: "M5 12h14",
  more: "M4 12h2m5 0h2m5 0h2",
  move: "M11 20H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2m-9 5h9m-3-3 3 3-3 3",
  next: "m9 6 6 6-6 6",
  previous: "m15 6-6 6 6 6",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1.8 4.3L20 20",
  trash: "M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 3v7m4-7v7",
} as const;

const { name } = defineProps<{ name: keyof typeof paths }>();
</script>

<template>
  <svg
    width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"
  >
    <path :d="paths[name]" />
  </svg>
</template>
