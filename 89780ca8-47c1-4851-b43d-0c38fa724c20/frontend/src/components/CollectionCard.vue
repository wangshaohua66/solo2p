<template>
  <div
    class="card-3d-wrapper"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
    @click="$router.push(`/trade/${item.id}`)"
  >
    <div
      class="card-3d"
      :style="cardTransform"
    >
      <div class="card-3d-face card-3d-front">
        <div class="relative overflow-hidden rounded-t-2xl" style="aspect-ratio: 1;">
          <img :src="item.image" :alt="item.name" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
          <div class="absolute top-3 left-3">
            <span
              class="px-2 py-0.5 rounded-full text-xs font-semibold text-white shadow-lg"
              :class="`badge-${item.rarity}`"
            >
              {{ item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1) }}
            </span>
          </div>
          <div class="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1">
            <span class="text-[10px] font-mono text-gold-accent">{{ item.id }}</span>
          </div>
        </div>

        <div class="p-4 relative">
          <div class="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gold-accent/30 to-transparent"></div>
          <h3 class="text-base font-semibold mb-1 truncate" style="color: var(--text-primary);">{{ item.name }}</h3>
          <p class="text-xs mb-3 truncate" style="color: var(--text-secondary);">by {{ item.creator }}</p>
          <div class="flex items-end justify-between">
            <div>
              <p class="text-[10px] uppercase tracking-wider" style="color: var(--text-muted);">Price</p>
              <p class="text-xl font-bold font-mono leading-tight" style="color: var(--gold); text-shadow: 0 0 10px rgba(212, 168, 83, 0.3);">
                {{ item.price.toFixed(2) }}
                <span class="text-[10px] font-normal tracking-wide" style="color: var(--text-muted);">ETH</span>
              </p>
            </div>
            <div
              class="flex items-center text-xs font-medium px-2 py-1 rounded-full"
              :class="priceChange >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'"
              :style="`color: ${priceChange >= 0 ? 'var(--green-up)' : 'var(--red-down)'};`"
            >
              <TrendingUp v-if="priceChange >= 0" :size="12" class="mr-0.5" />
              <TrendingDown v-else :size="12" class="mr-0.5" />
              {{ Math.abs(priceChange).toFixed(1) }}%
            </div>
          </div>
        </div>
      </div>

      <div class="card-3d-face card-3d-back">
        <div class="h-full flex flex-col justify-between p-4">
          <div>
            <h4 class="text-sm font-bold mb-2" style="color: var(--gold);">Quick Info</h4>
            <div class="space-y-1.5 text-xs">
              <div class="flex justify-between">
                <span style="color: var(--text-muted);">Rarity</span>
                <span class="font-semibold capitalize" :style="rarityColor">{{ item.rarity }}</span>
              </div>
              <div class="flex justify-between">
                <span style="color: var(--text-muted);">Supply</span>
                <span class="font-mono" style="color: var(--text-primary);">{{ item.totalSupply }}</span>
              </div>
              <div class="flex justify-between">
                <span style="color: var(--text-muted);">Minted</span>
                <span class="font-mono" style="color: var(--text-primary);">{{ item.mintedCount }}</span>
              </div>
              <div class="flex justify-between">
                <span style="color: var(--text-muted);">Royalty</span>
                <span class="font-mono" style="color: var(--gold);">{{ (item.royaltyRate * 100).toFixed(0) }}%</span>
              </div>
            </div>
          </div>
          <div class="space-y-2">
            <div class="h-1.5 rounded-full" style="background: rgba(255,255,255,0.05);">
              <div
                class="h-full rounded-full transition-all duration-500"
                :style="`width: ${progressWidth}; background: linear-gradient(90deg, #d4a853, #ffd700);`"
              ></div>
            </div>
            <p class="text-[10px] text-center" style="color: var(--text-muted);">
              Click to view details →
            </p>
          </div>
        </div>
      </div>
    </div>
    <div
      class="card-3d-glow"
      :style="glowStyle"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { TrendingUp, TrendingDown } from 'lucide-vue-next'
import type { Collection } from '@/stores/collection'

const props = defineProps<{ item: Collection }>()

const rotateX = ref(0)
const rotateY = ref(0)
const glowX = ref(50)
const glowY = ref(50)
const isHovering = ref(false)

const MAX_ROTATE = 15
const MAX_TILT = 8

const priceChange = computed(() => {
  if (props.item.previousPrice === 0) return 0
  return ((props.item.price - props.item.previousPrice) / props.item.previousPrice) * 100
})

const progressWidth = computed(() => {
  if (!props.item.totalSupply) return '0%'
  const pct = Math.min(100, (props.item.mintedCount / props.item.totalSupply) * 100)
  return `${pct}%`
})

const rarityColor = computed(() => {
  const map: Record<string, string> = {
    common: '#94a3b8',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#f59e0b',
  }
  return map[props.item.rarity] || map.common
})

const cardTransform = computed(() => {
  if (!isHovering.value) {
    return {
      transform: 'perspective(1200px) rotateX(0) rotateY(0) translateZ(0)',
      transition: 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
    }
  }
  return {
    transform: `perspective(1200px) rotateX(${rotateX.value}deg) rotateY(${rotateY.value}deg) translateZ(20px)`,
    transition: 'transform 0.1s ease-out',
  }
})

const glowStyle = computed(() => ({
  opacity: isHovering.value ? 1 : 0,
  background: `radial-gradient(circle at ${glowX.value}% ${glowY.value}%, rgba(212, 168, 83, 0.35) 0%, rgba(212, 168, 83, 0.1) 40%, transparent 70%)`,
}))

function handleMouseMove(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const centerX = rect.width / 2
  const centerY = rect.height / 2

  const normalizedX = (x - centerX) / centerX
  const normalizedY = (y - centerY) / centerY

  const tiltX = -normalizedY * MAX_TILT
  const tiltY = normalizedX * MAX_TILT

  const flipX = normalizedX * MAX_ROTATE

  rotateX.value = tiltX
  rotateY.value = tiltY + flipX * 0.3

  glowX.value = (x / rect.width) * 100
  glowY.value = (y / rect.height) * 100

  isHovering.value = true
}

function handleMouseLeave() {
  isHovering.value = false
  rotateX.value = 0
  rotateY.value = 0
  glowX.value = 50
  glowY.value = 50
}
</script>

<style scoped>
.card-3d-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4.2;
  perspective: 1500px;
  transform-style: preserve-3d;
  cursor: pointer;
}

.card-3d {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  will-change: transform;
}

.card-3d-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 1rem;
  overflow: hidden;
  background: linear-gradient(145deg, rgba(30, 41, 82, 0.9), rgba(20, 26, 55, 0.95));
  border: 1px solid rgba(212, 168, 83, 0.15);
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.card-3d-face::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 1rem;
  padding: 1px;
  background: linear-gradient(135deg, transparent 40%, rgba(212, 168, 83, 0.5) 50%, transparent 60%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  opacity: 0.4;
  transition: opacity 0.3s;
  pointer-events: none;
}

.card-3d-wrapper:hover .card-3d-face::before {
  opacity: 1;
}

.card-3d-back {
  transform: rotateY(180deg) translateZ(0.1px);
  background: linear-gradient(145deg, rgba(35, 45, 90, 0.95), rgba(25, 32, 68, 0.98));
}

.card-3d-glow {
  position: absolute;
  inset: -20px;
  border-radius: 1.5rem;
  pointer-events: none;
  transition: opacity 0.3s ease;
  opacity: 0;
  z-index: -1;
  filter: blur(30px);
}

.badge-legendary {
  background: linear-gradient(135deg, #f59e0b, #b45309);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.5);
}

.badge-epic {
  background: linear-gradient(135deg, #a855f7, #6d28d9);
  box-shadow: 0 0 12px rgba(168, 85, 247, 0.5);
}

.badge-rare {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.5);
}

.badge-common {
  background: linear-gradient(135deg, #64748b, #334155);
}
</style>
