<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ text: string; type?: string }>()

const styleMap: Record<string, string> = {
  wine: 'bg-wine-50 text-wine-600',
  gold: 'bg-gold-50 text-gold-700',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-rose-50 text-rose-600',
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  gray: 'bg-gray-100 text-gray-500',
}

const cls = computed(() => styleMap[props.type || 'wine'] || styleMap.wine)
</script>

<template>
  <span class="chip" :class="cls">{{ text }}</span>
</template>
