<script setup lang="ts">
import { computed } from 'vue';
import type { Alert } from '@/types/apron';
import { ALERT_LEVEL_COLORS, ALERT_LEVEL_LABELS } from '@/utils/constants';
import { formatDateTime } from '@/utils/helpers';
import { AlertTriangle, Info, AlertCircle, X } from 'lucide-vue-next';

interface Props {
  alert: Alert;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  click: [alertId: string];
  acknowledge: [alertId: string];
}>();

const bgColor = computed(() => {
  const colors: Record<string, string> = {
    red: 'rgba(239, 68, 68, 0.15)',
    orange: 'rgba(245, 158, 11, 0.15)',
    blue: 'rgba(59, 130, 246, 0.15)',
  };
  return colors[props.alert.level] || colors.blue;
});

const borderColor = computed(() => ALERT_LEVEL_COLORS[props.alert.level]);

const timeStr = computed(() => formatDateTime(props.alert.timestamp, 'HH:mm:ss'));

const IconComponent = computed(() => {
  switch (props.alert.level) {
    case 'red':
      return AlertTriangle;
    case 'orange':
      return AlertCircle;
    default:
      return Info;
  }
});

const handleClick = () => {
  emit('click', props.alert.id);
};

const handleAcknowledge = (e: Event) => {
  e.stopPropagation();
  emit('acknowledge', props.alert.id);
};
</script>

<template>
  <div
    class="alert-item"
    :class="`alert-item-${alert.level}`"
    :style="{
      backgroundColor: bgColor,
      borderLeftColor: borderColor,
    }"
    @click="handleClick"
  >
    <component
      :is="IconComponent"
      :size="16"
      :color="borderColor"
      class="mr-2 flex-shrink-0"
    />

    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span
          class="badge text-xs font-mono"
          :style="{ backgroundColor: `${borderColor}20`, color: borderColor }"
        >
          {{ ALERT_LEVEL_LABELS[alert.level] }}
        </span>
        <span class="text-xs text-gray-400 font-mono">{{ timeStr }}</span>
      </div>
      <p class="text-sm truncate mt-0.5">{{ alert.message }}</p>
    </div>

    <button
      v-if="!alert.acknowledged"
      class="ml-2 p-1 rounded hover:bg-white/10 transition-colors"
      @click="handleAcknowledge"
      title="确认告警"
    >
      <X :size="14" class="text-gray-400" />
    </button>

    <span
      v-else
      class="ml-2 text-xs text-gray-500 font-mono"
    >
      已确认
    </span>
  </div>
</template>

<style scoped>
.alert-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-left: 3px solid;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  white-space: nowrap;
  min-width: 300px;
  animation: slideIn var(--transition-base) ease-out;
}

.alert-item:hover {
  background-color: rgba(255, 255, 255, 0.05) !important;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.mr-2 {
  margin-right: 0.5rem;
}

.ml-2 {
  margin-left: 0.5rem;
}

.flex-1 {
  flex: 1;
}

.min-w-0 {
  min-width: 0;
}

.flex {
  display: flex;
}

.items-center {
  align-items: center;
}

.gap-2 {
  gap: 0.5rem;
}

.text-xs {
  font-size: 0.75rem;
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

.font-mono {
  font-family: var(--font-family-mono);
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mt-0\/5 {
  margin-top: 0.125rem;
}

.p-1 {
  padding: 0.25rem;
}

.rounded {
  border-radius: 0.25rem;
}

.hover\:bg-white\/10:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.transition-colors {
  transition: color var(--transition-fast), background-color var(--transition-fast);
}

.flex-shrink-0 {
  flex-shrink: 0;
}
</style>
