<template>
  <div class="glass-card p-4 fade-in-up">
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-2">
        <span
          class="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
          :style="severityStyle"
        >
          {{ alert.severity.toUpperCase() }}
        </span>
        <span class="text-xs" style="color: var(--text-muted);">{{ alert.type }}</span>
      </div>
      <span class="text-xs" style="color: var(--text-muted);">{{ alert.timestamp }}</span>
    </div>

    <p class="text-sm mb-3" style="color: var(--text-primary);">{{ alert.detail }}</p>

    <div class="flex gap-2">
      <button
        v-if="alert.status === 'active'"
        class="px-3 py-1 text-xs rounded transition-colors"
        style="border: 1px solid var(--green-up); color: var(--green-up);"
        @click="$emit('resolve', alert.id)"
      >
        Resolve
      </button>
      <button
        v-if="alert.severity === 'high' && alert.status === 'active'"
        class="px-3 py-1 text-xs rounded transition-colors"
        style="border: 1px solid var(--red-down); color: var(--red-down);"
        @click="$emit('freeze', alert.id)"
      >
        Freeze Account
      </button>
      <span
        v-if="alert.status === 'resolved'"
        class="px-3 py-1 text-xs rounded"
        style="color: var(--green-up);"
      >
        Resolved
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface RiskAlert {
  id: string
  severity: 'high' | 'medium' | 'low'
  type: string
  detail: string
  timestamp: string
  status: 'active' | 'resolved'
}

const props = defineProps<{ alert: RiskAlert }>()
defineEmits<{ resolve: [id: string]; freeze: [id: string] }>()

const severityStyle = computed(() => {
  switch (props.alert.severity) {
    case 'high': return 'background: linear-gradient(135deg, #ff4757, #ff6b81);'
    case 'medium': return 'background: linear-gradient(135deg, #f39c12, #f1c40f);'
    case 'low': return 'background: linear-gradient(135deg, #00d4aa, #00b894);'
    default: return ''
  }
})
</script>
