<script setup lang="ts">
import { dashboardColumnCounts, type DashboardColumnCount } from "../shared/bookmarks";

const { id, error } = defineProps<{ id: string; error?: string }>();
const columns = defineModel<DashboardColumnCount>({ required: true });
</script>

<template>
  <div class="column-field">
    <label :for="id">列数</label>
    <select
      :id="id" v-model="columns" class="input" name="columns" :aria-invalid="!!error"
      :aria-describedby="error ? `${id}-error` : undefined"
    >
      <option v-for="count in dashboardColumnCounts" :key="count" :value="count">{{ count }}列</option>
    </select>
    <p v-if="error" :id="`${id}-error`" class="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.column-field {
  display: grid;
  gap: 8px;
}

label {
  font-size: 14px;
  font-weight: 650;
}

select {
  font: inherit;
}
</style>
