<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useApronStore } from '@/stores/apron';
import AlertItem from './AlertItem.vue';
import { AlertTriangle, ChevronUp, ChevronDown } from 'lucide-vue-next';
import { ALERT_LEVEL_COLORS } from '@/utils/constants';

const store = useApronStore();
const isExpanded = ref(true);
const containerRef = ref<HTMLDivElement | null>(null);

const sortedAlerts = computed(() => {
  return [...store.alerts].sort((a, b) => {
    const levelOrder = { red: 0, orange: 1, blue: 2 };
    const levelDiff = levelOrder[a.level] - levelOrder[b.level];
    if (levelDiff !== 0) return levelDiff;
    return b.timestamp - a.timestamp;
  });
});

const unacknowledgedCount = computed(() => store.unacknowledgedAlerts.length);

const redCount = computed(() => store.alerts.filter(a => a.level === 'red' && !a.acknowledged).length);
const orangeCount = computed(() => store.alerts.filter(a => a.level === 'orange' && !a.acknowledged).length);
const blueCount = computed(() => store.alerts.filter(a => a.level === 'blue' && !a.acknowledged).length);

const handleAlertClick = (alertId: string) => {
  const alert = store.alerts.find(a => a.id === alertId);
  if (alert?.standId) {
    store.setSelectedStand(alert.standId);
  }
};

const handleAcknowledge = (alertId: string) => {
  store.acknowledgeAlert(alertId);
};

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
};

watch(
  () => store.alerts.length,
  () => {
    if (containerRef.value) {
      containerRef.value.scrollLeft = 0;
    }
  }
);
</script>

<template>
  <footer class="alert-panel" :class="{ collapsed: !isExpanded }">
    <div class="alert-panel-header" @click="toggleExpand">
      <div class="flex items-center gap-3">
        <div class="relative">
          <AlertTriangle :size="20" class="text-orange-400" />
          <span
            v-if="unacknowledgedCount > 0"
            class="absolute -top-1 -right-1 min-w-4 h-4 px-1 text-xs font-bold bg-red-500 rounded-full flex items-center justify-center"
          >
            {{ unacknowledgedCount > 99 ? '99+' : unacknowledgedCount }}
          </span>
        </div>
        <span class="font-medium text-sm">实时告警中心</span>

        <div class="flex items-center gap-2 ml-2">
          <span
            v-if="redCount > 0"
            class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono"
            :style="{ backgroundColor: ALERT_LEVEL_COLORS.red + '25', color: ALERT_LEVEL_COLORS.red }"
          >
            <span class="w-1.5 h-1.5 rounded-full animate-pulse" :style="{ backgroundColor: ALERT_LEVEL_COLORS.red }"></span>
            紧急 {{ redCount }}
          </span>
          <span
            v-if="orangeCount > 0"
            class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono"
            :style="{ backgroundColor: ALERT_LEVEL_COLORS.orange + '25', color: ALERT_LEVEL_COLORS.orange }"
          >
            <span class="w-1.5 h-1.5 rounded-full animate-pulse" :style="{ backgroundColor: ALERT_LEVEL_COLORS.orange }"></span>
            警告 {{ orangeCount }}
          </span>
          <span
            v-if="blueCount > 0"
            class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono"
            :style="{ backgroundColor: ALERT_LEVEL_COLORS.blue + '25', color: ALERT_LEVEL_COLORS.blue }"
          >
            <span class="w-1.5 h-1.5 rounded-full animate-pulse" :style="{ backgroundColor: ALERT_LEVEL_COLORS.blue }"></span>
            提示 {{ blueCount }}
          </span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-400 font-mono">
          共 {{ store.alerts.length }} 条告警
        </span>
        <ChevronUp v-if="isExpanded" :size="18" class="text-gray-400" />
        <ChevronDown v-else :size="18" class="text-gray-400" />
      </div>
    </div>

    <div v-if="isExpanded" class="alert-panel-content">
      <div ref="containerRef" class="alert-scroll-container">
        <template v-if="sortedAlerts.length > 0">
          <AlertItem
            v-for="alert in sortedAlerts"
            :key="alert.id"
            :alert="alert"
            @click="handleAlertClick"
            @acknowledge="handleAcknowledge"
          />
        </template>
        <div v-else class="empty-state">
          <p class="text-sm text-gray-500">当前无告警消息</p>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.alert-panel {
  grid-area: footer;
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: height var(--transition-base);
  height: var(--footer-height);
}

.alert-panel.collapsed {
  height: 48px;
}

.alert-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-xl);
  height: 48px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background var(--transition-fast);
  flex-shrink: 0;
}

.alert-panel-header:hover {
  background: var(--color-bg-hover);
}

.alert-panel-content {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.alert-scroll-container {
  display: flex;
  align-items: stretch;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 8px var(--spacing-md);
  gap: 8px;
  scroll-behavior: smooth;
}

.alert-scroll-container > :deep(.alert-item) {
  flex-shrink: 0;
  min-width: 320px;
  max-width: 380px;
  height: 100%;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  border-left-width: 4px;
  margin: 0;
}

.empty-state {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
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

.gap-3 {
  gap: 0.75rem;
}

.ml-2 {
  margin-left: 0.5rem;
}

.relative {
  position: relative;
}

.absolute {
  position: absolute;
}

.-top-1 {
  top: -0.25rem;
}

.-right-1 {
  right: -0.25rem;
}

.min-w-4 {
  min-width: 1rem;
}

.h-4 {
  height: 1rem;
}

.px-1 {
  padding-left: 0.25rem;
  padding-right: 0.25rem;
}

.text-xs {
  font-size: 0.75rem;
}

.text-sm {
  font-size: 0.875rem;
}

.font-bold {
  font-weight: 700;
}

.font-medium {
  font-weight: 500;
}

.font-mono {
  font-family: var(--font-family-mono);
}

.bg-red-500 {
  background-color: #ef4444;
}

.rounded-full {
  border-radius: 9999px;
}

.justify-center {
  justify-content: center;
}

.text-orange-400 {
  color: #fb923c;
}

.text-gray-400 {
  color: #94a3b8;
}

.text-gray-500 {
  color: #64748b;
}

.w-1\.5 {
  width: 0.375rem;
}

.h-1\.5 {
  height: 0.375rem;
}

.px-2 {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

.py-0\.5 {
  padding-top: 0.125rem;
  padding-bottom: 0.125rem;
}

.animate-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
