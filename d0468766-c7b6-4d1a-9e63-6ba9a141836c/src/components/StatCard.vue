<script setup lang="ts">
import { computed } from 'vue'
import * as ElIcons from '@element-plus/icons-vue'
import { useCountUp } from '@/composables/useCountUp'

const props = withDefaults(
  defineProps<{
    label: string
    value: number
    unit?: string
    icon?: string
    prefix?: string
    suffix?: string
    decimals?: number
    trend?: number
    accent?: 'gold' | 'crimson' | 'success' | 'info'
  }>(),
  { accent: 'gold', decimals: 0 }
)

const counted = useCountUp(() => props.value)
const formatted = computed(() => {
  const v = counted.value
  return props.decimals > 0 ? v.toFixed(props.decimals) : Math.round(v).toLocaleString('zh-CN')
})
const trendUp = computed(() => (props.trend ?? 0) >= 0)
</script>

<template>
  <div class="stat-card" :class="accent">
    <div class="stat-glow" aria-hidden="true" />
    <div class="stat-top">
      <span class="stat-label">{{ label }}</span>
      <div class="stat-icon">
        <component :is="(ElIcons as any)[icon || 'TrendCharts']" />
      </div>
    </div>
    <div class="stat-value num">
      <span class="prefix" v-if="prefix">{{ prefix }}</span>
      <span class="value gold-text">{{ formatted }}</span>
      <span class="unit" v-if="unit">{{ unit }}</span>
    </div>
    <div class="stat-foot" v-if="trend !== undefined">
      <span class="trend" :class="trendUp ? 'up' : 'down'">
        <component :is="(ElIcons as any)[trendUp ? 'CaretTop' : 'CaretBottom']" />
        {{ Math.abs(trend!).toFixed(1) }}%
      </span>
      <span class="trend-label">较昨日</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stat-card {
  position: relative;
  @include card-base;
  @include gold-top-line;
  padding: 20px 22px;
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.55), $shadow-inset;
    .stat-glow {
      opacity: 1;
    }
  }
  &.crimson {
    .stat-icon {
      background: $crimson-soft;
      color: $crimson-bright;
      border-color: rgba(200, 54, 79, 0.3);
    }
  }
  &.success {
    .stat-icon {
      background: rgba(74, 222, 128, 0.12);
      color: $success;
      border-color: rgba(74, 222, 128, 0.3);
    }
  }
  &.info {
    .stat-icon {
      background: rgba(96, 165, 250, 0.12);
      color: $info;
      border-color: rgba(96, 165, 250, 0.3);
    }
  }
}
.stat-glow {
  position: absolute;
  top: -40%;
  right: -20%;
  width: 60%;
  height: 120%;
  background: radial-gradient(circle, rgba(232, 181, 71, 0.1), transparent 70%);
  opacity: 0.6;
  transition: opacity 0.3s ease;
  pointer-events: none;
}
.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.stat-label {
  font-size: 13px;
  color: var(--c-text-secondary);
  letter-spacing: 0.04em;
}
.stat-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: $gold-soft;
  color: $gold;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  border: 1px solid $gold-line;
}
.stat-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  .prefix,
  .unit {
    font-size: 14px;
    color: var(--c-text-tertiary);
    font-weight: 500;
  }
  .value {
    font-size: 32px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.01em;
  }
}
.stat-foot {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 600;
  &.up {
    color: $success;
  }
  &.down {
    color: $crimson-bright;
  }
}
.trend-label {
  font-size: 12px;
  color: var(--c-text-tertiary);
}
</style>
