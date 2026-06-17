<script setup lang="ts">
withDefaults(defineProps<{ value?: number; max?: number; showLabel?: boolean }>(), {
  value: 0,
  max: 100,
  showLabel: false,
})
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="flex-1 h-1.5 rounded-full bg-wine-50 overflow-hidden">
      <div class="h-full rounded-full bg-wine-grad transition-all duration-500" :style="{ width: Math.min(100, (value / max) * 100) + '%' }"></div>
    </div>
    <span v-if="showLabel" class="num text-xs text-wine-500 w-9 text-right">{{ Math.round((value / max) * 100) }}%</span>
  </div>
</template>
