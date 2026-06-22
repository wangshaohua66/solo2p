<template>
  <div
    class="relative glass-card overflow-hidden cursor-pointer transition-shadow duration-300"
    style="perspective: 1000px;"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
    @click="$router.push(`/trade/${item.id}`)"
  >
    <div
      class="relative transition-transform duration-200 ease-out"
      :style="`transform: rotateX(${rotateX}deg) rotateY(${rotateY}deg);`"
    >
      <div class="relative overflow-hidden rounded-t-2xl" style="aspect-ratio: 1;">
        <img :src="item.image" :alt="item.name" class="w-full h-full object-cover" loading="lazy" />
        <div class="absolute top-3 left-3">
          <span
            class="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
            :class="`badge-${item.rarity}`"
          >
            {{ item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1) }}
          </span>
        </div>
      </div>

      <div class="p-4">
        <h3 class="text-base font-semibold mb-1" style="color: var(--text-primary);">{{ item.name }}</h3>
        <p class="text-xs mb-3" style="color: var(--text-secondary);">by {{ item.creator }}</p>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs" style="color: var(--text-muted);">Current Price</p>
            <p class="text-lg font-bold font-mono" style="color: var(--gold);">
              {{ item.price.toFixed(2) }} <span class="text-xs font-normal" style="color: var(--text-muted);">ETH</span>
            </p>
          </div>
          <div
            class="flex items-center text-sm font-medium"
            :style="`color: ${priceChange >= 0 ? 'var(--green-up)' : 'var(--red-down)'};`"
          >
            <TrendingUp v-if="priceChange >= 0" :size="14" class="mr-1" />
            <TrendingDown v-else :size="14" class="mr-1" />
            {{ Math.abs(priceChange).toFixed(1) }}%
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { TrendingUp, TrendingDown } from 'lucide-vue-next'
import type { Collection } from '@/stores/collection'

const props = defineProps<{ item: Collection }>()

const rotateX = ref(0)
const rotateY = ref(0)

const priceChange = computed(() => {
  if (props.item.previousPrice === 0) return 0
  return ((props.item.price - props.item.previousPrice) / props.item.previousPrice) * 100
})

function handleMouseMove(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  rotateY.value = ((x - centerX) / centerX) * 8
  rotateX.value = -((y - centerY) / centerY) * 8
  el.style.boxShadow = '0 0 30px rgba(212, 168, 83, 0.2)'
}

function handleMouseLeave(e: MouseEvent) {
  rotateX.value = 0
  rotateY.value = 0
  ;(e.currentTarget as HTMLElement).style.boxShadow = ''
}
</script>
