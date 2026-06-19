<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { darkGoldTheme, goldPalette } from '@/utils/echarts'
import type { EChartsOption } from 'echarts'

const props = defineProps<{
  option: Record<string, any>
  height?: string
  palette?: string[]
}>()

const merged = computed<EChartsOption>(() => {
  const base = JSON.parse(JSON.stringify(darkGoldTheme)) as Record<string, unknown>
  const opt = JSON.parse(JSON.stringify(props.option)) as Record<string, unknown>
  if (props.palette) {
    ;(opt as any).color = props.palette
  } else {
    ;(opt as any).color = goldPalette
  }
  return { ...base, ...opt } as EChartsOption
})
</script>

<template>
  <VChart class="base-chart" :option="merged" :style="{ height: height || '320px' }" autoresize />
</template>

<style scoped>
.base-chart {
  width: 100%;
}
</style>
