<template>
  <span
    class="status-tag"
    :style="{
      color: statusInfo.color,
      backgroundColor: hexToRgba(statusInfo.color, 0.12),
      borderColor: hexToRgba(statusInfo.color, 0.3)
    }"
  >
    <span
      class="status-dot"
      :style="{ backgroundColor: statusInfo.color }"
    />
    <span class="status-text">{{ displayText }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  remainsStatusMap,
  bookingStatusMap,
  missionStatusMap,
  plotStatusMap,
  memorialSlotStatusMap,
  billStatusMap
} from '@/utils/status'
import type { DictItem } from '@/types/common'

type StatusTagType = 'remains' | 'booking' | 'mission' | 'plot' | 'slot' | 'bill'

const props = withDefaults(
  defineProps<{
    status: string
    type?: StatusTagType
    text?: string
  }>(),
  {
    type: 'remains',
    text: ''
  }
)

const statusMapLookup: Record<StatusTagType, Record<string, DictItem>> = {
  remains: remainsStatusMap,
  booking: bookingStatusMap,
  mission: missionStatusMap,
  plot: plotStatusMap,
  slot: memorialSlotStatusMap,
  bill: billStatusMap
}

const statusInfo = computed<DictItem>(() => {
  const map = statusMapLookup[props.type]
  return (
    map[props.status] || {
      value: props.status,
      label: props.status,
      color: '#8C8C8C'
    }
  )
})

const displayText = computed(() => props.text || statusInfo.value.label)

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
</script>

<style lang="scss" scoped>
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: $radius-sm;
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  white-space: nowrap;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 4px currentColor;
}

.status-text {
  letter-spacing: 0.3px;
}
</style>
