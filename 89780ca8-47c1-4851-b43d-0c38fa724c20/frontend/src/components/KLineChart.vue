<template>
  <div class="glass p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold" style="color: var(--text-secondary);">K-Line Chart</h3>
      <div class="flex gap-1">
        <button
          v-for="p in periods"
          :key="p"
          class="px-2 py-1 text-xs rounded transition-colors"
          :style="klinePeriod === p ? 'background: var(--gold); color: var(--bg-deep); font-weight: 600;' : 'color: var(--text-muted);'"
          @click="tradeStore.setKlinePeriod(p as any)"
        >
          {{ p }}
        </button>
      </div>
    </div>
    <div class="relative" ref="chartContainer">
      <canvas ref="canvas" @mousemove="handleMouseMove" @mouseleave="crosshair = null" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useTradeStore } from '@/stores/trade'

const tradeStore = useTradeStore()
const klinePeriod = computed(() => tradeStore.klinePeriod)

const periods = ['1m', '5m', '1h', '1d'] as const

const canvas = ref<HTMLCanvasElement | null>(null)
const chartContainer = ref<HTMLDivElement | null>(null)
const crosshair = ref<{ x: number; y: number } | null>(null)

let animationId: number | null = null

function drawChart() {
  const cvs = canvas.value
  if (!cvs) return
  const ctx = cvs.getContext('2d')
  if (!ctx) return

  const container = chartContainer.value
  if (!container) return

  const dpr = window.devicePixelRatio || 1
  const rect = container.getBoundingClientRect()
  cvs.width = rect.width * dpr
  cvs.height = 400 * dpr
  cvs.style.width = rect.width + 'px'
  cvs.style.height = '400px'
  ctx.scale(dpr, dpr)

  const width = rect.width
  const height = 400
  const data = tradeStore.klineData
  if (data.length === 0) return

  const padding = { top: 20, right: 60, bottom: 80, left: 10 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom - 80
  const volH = 60

  const allPrices = data.flatMap(d => [d.high, d.low])
  const minPrice = Math.min(...allPrices)
  const maxPrice = Math.max(...allPrices)
  const priceRange = maxPrice - minPrice || 1
  const maxVol = Math.max(...data.map(d => d.volume))

  ctx.clearRect(0, 0, width, height)

  const barWidth = chartW / data.length
  const gap = Math.max(barWidth * 0.2, 1)

  data.forEach((d, i) => {
    const x = padding.left + i * barWidth + barWidth / 2
    const isUp = d.close >= d.open
    const color = isUp ? '#00d4aa' : '#ff4757'

    const highY = padding.top + ((maxPrice - d.high) / priceRange) * chartH
    const lowY = padding.top + ((maxPrice - d.low) / priceRange) * chartH
    const openY = padding.top + ((maxPrice - d.open) / priceRange) * chartH
    const closeY = padding.top + ((maxPrice - d.close) / priceRange) * chartH

    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, highY)
    ctx.lineTo(x, lowY)
    ctx.stroke()

    const bodyTop = Math.min(openY, closeY)
    const bodyH = Math.max(Math.abs(closeY - openY), 1)
    ctx.fillStyle = color
    ctx.fillRect(x - (barWidth - gap) / 2, bodyTop, barWidth - gap, bodyH)

    const volY = height - padding.bottom
    const volBarH = (d.volume / maxVol) * volH
    ctx.fillStyle = isUp ? 'rgba(0, 212, 170, 0.3)' : 'rgba(255, 71, 87, 0.3)'
    ctx.fillRect(x - (barWidth - gap) / 2, volY - volBarH, barWidth - gap, volBarH)
  })

  for (let i = 0; i <= 4; i++) {
    const price = minPrice + (priceRange * i) / 4
    const y = padding.top + (chartH * (4 - i)) / 4
    ctx.strokeStyle = 'rgba(30, 35, 72, 0.5)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()

    ctx.fillStyle = '#8b8fa3'
    ctx.font = '10px JetBrains Mono'
    ctx.textAlign = 'left'
    ctx.fillText(price.toFixed(2), width - padding.right + 5, y + 3)
  }

  const labelInterval = Math.max(Math.floor(data.length / 6), 1)
  data.forEach((d, i) => {
    if (i % labelInterval === 0) {
      const x = padding.left + i * barWidth + barWidth / 2
      ctx.fillStyle = '#8b8fa3'
      ctx.font = '10px JetBrains Mono'
      ctx.textAlign = 'center'
      ctx.fillText(d.time, x, height - padding.bottom + 70)
    }
  })

  if (crosshair.value) {
    const cx = crosshair.value.x
    const cy = crosshair.value.y
    ctx.strokeStyle = 'rgba(212, 168, 83, 0.4)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(cx, padding.top)
    ctx.lineTo(cx, height - padding.bottom)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(padding.left, cy)
    ctx.lineTo(width - padding.right, cy)
    ctx.stroke()
    ctx.setLineDash([])

    const hoverPrice = maxPrice - ((cy - padding.top) / chartH) * priceRange
    ctx.fillStyle = 'rgba(212, 168, 83, 0.9)'
    ctx.font = '11px JetBrains Mono'
    ctx.textAlign = 'left'
    ctx.fillText(hoverPrice.toFixed(2), width - padding.right + 5, cy + 4)
  }
}

function handleMouseMove(e: MouseEvent) {
  const rect = canvas.value?.getBoundingClientRect()
  if (!rect) return
  crosshair.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  drawChart()
}

function resizeHandler() {
  drawChart()
}

watch(() => tradeStore.klineData, () => {
  drawChart()
}, { deep: true })

watch(klinePeriod, () => {
  drawChart()
})

onMounted(() => {
  drawChart()
  window.addEventListener('resize', resizeHandler)
  animationId = window.setInterval(drawChart, 3000)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeHandler)
  if (animationId) clearInterval(animationId)
})
</script>
