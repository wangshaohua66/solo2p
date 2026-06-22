<template>
  <div class="glass-card p-5 flex items-center gap-4">
    <div
      class="w-12 h-12 rounded-xl flex items-center justify-center"
      style="background: rgba(212, 168, 83, 0.1);"
    >
      <component :is="icon" :size="22" style="color: var(--gold);" />
    </div>
    <div class="flex-1">
      <p class="text-xs" style="color: var(--text-muted);">{{ label }}</p>
      <p class="text-2xl font-bold font-mono" style="color: var(--gold);">{{ displayValue }}</p>
    </div>
    <div
      class="flex items-center gap-1 text-sm font-medium"
      :style="`color: ${trend >= 0 ? 'var(--green-up)' : 'var(--red-down)'};`"
    >
      <TrendingUp v-if="trend >= 0" :size="14" />
      <TrendingDown v-else :size="14" />
      {{ Math.abs(trend).toFixed(1) }}%
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-vue-next'

const props = defineProps<{
  icon: LucideIcon
  label: string
  value: number
  trend: number
  prefix?: string
  suffix?: string
}>()

const displayValue = computed(() => {
  if (props.value >= 1000000) return (props.value / 1000000).toFixed(1) + 'M'
  if (props.value >= 1000) return (props.value / 1000).toFixed(1) + 'K'
  return props.value.toLocaleString()
})
</script>
