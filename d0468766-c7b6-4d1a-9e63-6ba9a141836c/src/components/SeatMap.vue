<script setup lang="ts">
import { computed } from 'vue'
import type { Seat, Hall } from '@/types'

const props = defineProps<{
  seats: Seat[]
  hall?: Hall | null
}>()

const emit = defineEmits<{
  (e: 'toggle', seat: Seat): void
}>()

const seatSize = 18
const gap = 4
const padX = 30
const padTop = 70
const padBottom = 30

const cols = computed(() => props.hall?.cols ?? 10)
const rows = computed(() => props.hall?.rows ?? 10)

const maxCol = computed(() => Math.max(...(props.seats.length ? props.seats.map((s) => s.col) : [1]), cols.value))
const maxRow = computed(() => Math.max(...(props.seats.length ? props.seats.map((s) => s.row) : [1]), rows.value))

const svgWidth = computed(() => padX * 2 + maxCol.value * (seatSize + gap))
const svgHeight = computed(() => padTop + padBottom + maxRow.value * (seatSize + gap) + 30)

function seatX(col: number) {
  return padX + (col - 1) * (seatSize + gap)
}
function seatY(row: number) {
  return padTop + (row - 1) * (seatSize + gap)
}
function seatColor(s: Seat) {
  if (s.status === 'selected') return '#F0C75E'
  if (s.status === 'sold') return '#4a4a55'
  if (s.status === 'locked') return '#C8364F'
  if (s.type === 'vip') return '#9d7c2e'
  if (s.type === 'couple') return '#7a3b4a'
  return 'rgba(232,181,71,0.18)'
}
function seatStroke(s: Seat) {
  if (s.status === 'selected') return '#fff'
  if (s.status === 'available') return 'rgba(232,181,71,0.35)'
  return 'transparent'
}

function toggle(seat: Seat) {
  if (seat.status === 'sold' || seat.status === 'locked') return
  emit('toggle', seat)
}
</script>

<template>
  <div class="seat-map">
    <svg :width="svgWidth" :height="svgHeight" :viewBox="`0 0 ${svgWidth} ${svgHeight}`">
      <defs>
        <linearGradient id="screenGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="rgba(232,181,71,0)" />
          <stop offset="0.5" stop-color="rgba(232,181,71,0.7)" />
          <stop offset="1" stop-color="rgba(232,181,71,0)" />
        </linearGradient>
        <radialGradient id="spot" cx="0.5" cy="0" r="0.8">
          <stop offset="0" stop-color="rgba(232,181,71,0.12)" />
          <stop offset="1" stop-color="transparent" />
        </radialGradient>
      </defs>

      <rect :x="0" :y="0" :width="svgWidth" :height="svgHeight" fill="url(#spot)" />

      <path :d="`M${padX - 10},${28} Q${svgWidth / 2},${8} ${svgWidth - padX + 10},${28}`" fill="none" stroke="url(#screenGrad)" stroke-width="3" />
      <text :x="svgWidth / 2" :y="48" text-anchor="middle" fill="#E8B547" font-size="13" font-family="Cinzel, serif" letter-spacing="4">SCREEN 银幕</text>

      <g v-for="s in seats" :key="s.id">
        <rect
          v-if="s.type === 'couple'"
          :x="seatX(s.col)"
          :y="seatY(s.row)"
          :width="seatSize * 2 + gap"
          :height="seatSize"
          rx="4"
          :fill="seatColor(s)"
          :stroke="seatStroke(s)"
          stroke-width="1.5"
          class="seat"
          @click="toggle(s)"
        />
        <rect
          v-else
          :x="seatX(s.col)"
          :y="seatY(s.row)"
          :width="seatSize"
          :height="seatSize"
          rx="4"
          :fill="seatColor(s)"
          :stroke="seatStroke(s)"
          stroke-width="1.5"
          class="seat"
          @click="toggle(s)"
        />
      </g>

      <g v-for="r in maxRow" :key="`r${r}`">
        <text :x="padX - 14" :y="seatY(r) + seatSize - 5" fill="#6b6f7e" font-size="9">{{ r }}</text>
      </g>
    </svg>

    <div class="legend">
      <span><i class="dot available" />可选</span>
      <span><i class="dot selected" />已选</span>
      <span><i class="dot sold" />已售</span>
      <span><i class="dot locked" />锁定</span>
      <span><i class="dot vip" />VIP区</span>
      <span><i class="dot couple" />情侣座</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.seat-map {
  overflow: auto;
  max-height: 540px;
  @include scrollbar-dark;
  text-align: center;
}
svg {
  display: block;
  margin: 0 auto;
}
.seat {
  cursor: pointer;
  transition: fill 0.15s ease, transform 0.1s ease;
  transform-origin: center;
  transform-box: fill-box;
  &:hover {
    filter: brightness(1.5);
    transform: scale(1.15);
  }
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
  padding: 14px 0 4px;
  font-size: 12px;
  color: var(--c-text-secondary);
  span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid rgba(232, 181, 71, 0.35);
    &.available {
      background: rgba(232, 181, 71, 0.18);
    }
    &.selected {
      background: #f0c75e;
      border-color: #fff;
    }
    &.sold {
      background: #4a4a55;
      border: none;
    }
    &.locked {
      background: #c8364f;
      border: none;
    }
    &.vip {
      background: #9d7c2e;
      border: none;
    }
    &.couple {
      background: #7a3b4a;
      border: none;
    }
  }
}
</style>
