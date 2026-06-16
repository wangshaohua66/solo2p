<script setup lang="ts">
import { computed } from 'vue';
import { TrendingUp, TrendingDown, Minus } from 'lucide-vue-next';

interface Props {
  title: string;
  value: string | number;
  unit?: string;
  trend?: number;
  trendLabel?: string;
  color?: string;
  icon?: any;
}

const props = withDefaults(defineProps<Props>(), {
  unit: '',
  trend: 0,
  trendLabel: '',
  color: '#06b6d4',
});

const trendDirection = computed(() => {
  if (props.trend > 0) return 'up';
  if (props.trend < 0) return 'down';
  return 'flat';
});

const trendColor = computed(() => {
  if (trendDirection.value === 'up') return '#10b981';
  if (trendDirection.value === 'down') return '#ef4444';
  return '#64748b';
});

const TrendIcon = computed(() => {
  if (trendDirection.value === 'up') return TrendingUp;
  if (trendDirection.value === 'down') return TrendingDown;
  return Minus;
});
</script>

<template>
  <div class="stat-card">
    <div class="flex items-start justify-between mb-2">
      <span class="stat-label">{{ title }}</span>
      <component
        v-if="icon"
        :is="icon"
        :size="20"
        :color="color"
        class="opacity-60"
      />
    </div>

    <div class="flex items-baseline gap-1">
      <span class="stat-value" :style="{ color }">{{ value }}</span>
      <span v-if="unit" class="text-sm text-gray-400">{{ unit }}</span>
    </div>

    <div v-if="trendLabel" class="stat-trend" :class="trendDirection">
      <component :is="TrendIcon" :size="14" :color="trendColor" />
      <span :style="{ color: trendColor }">{{ Math.abs(trend).toFixed(1) }}%</span>
      <span class="text-gray-500">{{ trendLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  position: relative;
  overflow: hidden;
  transition: all var(--transition-base);
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, v-bind('color'), transparent);
}

.stat-card:hover {
  border-color: var(--color-border-light);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-3xl);
  font-weight: 700;
  line-height: 1.2;
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  margin-top: var(--spacing-sm);
}

.flex {
  display: flex;
}

.items-start {
  align-items: flex-start;
}

.items-baseline {
  align-items: baseline;
}

.justify-between {
  justify-content: space-between;
}

.gap-1 {
  gap: 0.25rem;
}

.mb-2 {
  margin-bottom: 0.5rem;
}

.text-sm {
  font-size: 0.875rem;
}

.text-gray-400 {
  color: #94a3b8;
}

.text-gray-500 {
  color: #64748b;
}

.opacity-60 {
  opacity: 0.6;
}
</style>
