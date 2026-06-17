<script setup lang="ts">
import { ref, shallowRef, watch, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

const props = defineProps<{ option: EChartsOption; height?: string }>()
const el = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
const inst = shallowRef<echarts.ECharts | null>(null)

function render() {
  if (!el.value) return
  if (!chart) {
    chart = echarts.init(el.value)
    inst.value = chart
  }
  chart.setOption(props.option, true)
}

function resize() {
  chart?.resize()
}

onMounted(() => {
  render()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart?.dispose()
  chart = null
})

watch(
  () => props.option,
  () => render(),
  { deep: true },
)

defineExpose({ instance: inst })
</script>

<template>
  <div ref="el" class="w-full" :style="{ height: height || '260px' }"></div>
</template>
