<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'

const props = defineProps<{
  label: string
  value: number | string
  unit?: string
  trend?: number
  trendLabel?: string
  icon?: Component
  accent?: 'wine' | 'gold' | 'green' | 'amber'
}>()

const display = computed(() => (typeof props.value === 'number' ? props.value.toLocaleString('zh-CN') : props.value))
const accentClass = computed(() => {
  const map = { wine: 'from-wine-600 to-wine-800', gold: 'from-gold-400 to-gold-600', green: 'from-emerald-500 to-emerald-700', amber: 'from-amber-500 to-amber-600' }
  return map[props.accent || 'wine']
})
const trendUp = computed(() => (props.trend ?? 0) >= 0)
</script>

<template>
  <div class="card p-5 relative overflow-hidden group">
    <div class="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10" :class="accentClass" style="background-image: linear-gradient(135deg,var(--tw-gradient-stops))"></div>
    <div class="flex items-start justify-between relative">
      <div>
        <p class="text-xs text-wine-400 font-medium tracking-wide">{{ label }}</p>
        <p class="mt-2 num text-3xl font-semibold text-wine-800 leading-none">{{ display }}<span v-if="unit" class="text-sm text-wine-400 ml-1 font-sans">{{ unit }}</span></p>
      </div>
      <div v-if="icon" class="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-wine-grad shadow-soft">
        <component :is="icon" :size="18" />
      </div>
    </div>
    <div v-if="trend !== undefined" class="mt-3 flex items-center gap-1.5 text-xs">
      <span :class="trendUp ? 'text-emerald-600' : 'text-rose-500'" class="font-medium num">
        {{ trendUp ? '▲' : '▼' }} {{ Math.abs(trend || 0) }}%
      </span>
      <span v-if="trendLabel" class="text-wine-300">{{ trendLabel }}</span>
    </div>
  </div>
</template>
