<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
    <div>
      <h1 class="font-display text-3xl font-semibold text-wine-800 leading-tight">{{ title }}</h1>
      <p v-if="subtitle" class="text-sm text-wine-400 mt-1">{{ subtitle }}</p>
    </div>
    <div class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
