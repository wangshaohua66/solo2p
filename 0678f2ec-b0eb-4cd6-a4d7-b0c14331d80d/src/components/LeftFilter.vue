<script setup lang="ts">
import { computed } from 'vue';
import { useApronStore } from '@/stores/apron';
import {
  TERMINALS,
  TERMINAL_NAMES,
  STAND_STATUSES,
  STAND_STATUS_LABELS,
  STAND_STATUS_COLORS,
  AIRLINES,
  VEHICLE_TYPE_LABELS,
} from '@/utils/constants';
import type { Terminal, StandStatus } from '@/types/apron';
import { Building2, CircleDot, Plane, Car, Filter, X, ChevronDown, ChevronUp } from 'lucide-vue-next';
import { ref } from 'vue';

const store = useApronStore();

const expandedSections = ref({
  terminals: true,
  status: true,
  airlines: false,
  vehicles: false,
});

const toggleSection = (section: keyof typeof expandedSections.value) => {
  expandedSections.value[section] = !expandedSections.value[section];
};

const selectedTerminals = computed({
  get: () => store.layoutConfig.filters.terminals,
  set: (val) => store.updateFilters({ terminals: val }),
});

const selectedStatuses = computed({
  get: () => store.layoutConfig.filters.statuses,
  set: (val) => store.updateFilters({ statuses: val }),
});

const selectedAirlines = computed({
  get: () => store.layoutConfig.filters.airlines,
  set: (val) => store.updateFilters({ airlines: val }),
});

const toggleTerminal = (terminal: Terminal) => {
  const current = [...selectedTerminals.value];
  const index = current.indexOf(terminal);
  if (index > -1) {
    if (current.length > 1) {
      current.splice(index, 1);
    }
  } else {
    current.push(terminal);
  }
  selectedTerminals.value = current;
};

const toggleStatus = (status: StandStatus) => {
  const current = [...selectedStatuses.value];
  const index = current.indexOf(status);
  if (index > -1) {
    if (current.length > 1) {
      current.splice(index, 1);
    }
  } else {
    current.push(status);
  }
  selectedStatuses.value = current;
};

const toggleAirline = (airlineCode: string) => {
  const current = [...selectedAirlines.value];
  const index = current.indexOf(airlineCode);
  if (index > -1) {
    current.splice(index, 1);
  } else {
    current.push(airlineCode);
  }
  selectedAirlines.value = current;
};

const isAllTerminalsSelected = computed(() =>
  TERMINALS.every((t) => selectedTerminals.value.includes(t))
);

const isAllStatusesSelected = computed(() =>
  STAND_STATUSES.every((s) => selectedStatuses.value.includes(s))
);

const selectAllTerminals = () => {
  selectedTerminals.value = [...TERMINALS];
};

const selectAllStatuses = () => {
  selectedStatuses.value = [...STAND_STATUSES];
};

const clearAirlines = () => {
  selectedAirlines.value = [];
};

const standCounts = computed(() => {
  const counts: Record<string, number> = {};
  store.stands.forEach((s) => {
    counts[s.terminal] = (counts[s.terminal] || 0) + 1;
  });
  return counts;
});

const statusCounts = computed(() => {
  const counts: Record<string, number> = {};
  store.stands.forEach((s) => {
    counts[s.status] = (counts[s.status] || 0) + 1;
  });
  return counts;
});

const vehicleCounts = computed(() => {
  const counts: Record<string, number> = { total: store.vehicles.length };
  store.vehicles.forEach((v) => {
    counts[v.type] = (counts[v.type] || 0) + 1;
    counts[v.status] = (counts[v.status] || 0) + 1;
  });
  return counts;
});

const weatherOverlayVisible = computed({
  get: () => store.layoutConfig.weatherOverlayVisible,
  set: (val) => {
    store.layoutConfig.weatherOverlayVisible = val;
    store.saveLayout();
  },
});
</script>

<template>
  <aside
    class="panel left-panel"
    :class="{ collapsed: store.layoutConfig.leftPanelCollapsed }"
  >
    <div v-if="!store.layoutConfig.leftPanelCollapsed">
      <div class="panel-header flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Filter :size="18" class="text-cyan-400" />
          <span>筛选条件</span>
        </div>
      </div>

      <div class="panel-content space-y-6">
        <div class="filter-section">
          <button
            class="filter-section-header w-full flex items-center justify-between"
            @click="toggleSection('terminals')"
          >
            <div class="flex items-center gap-2">
              <Building2 :size="16" class="text-gray-400" />
              <span class="font-medium">航站楼</span>
            </div>
            <ChevronDown
              v-if="!expandedSections.terminals"
              :size="16"
              class="text-gray-400"
            />
            <ChevronUp v-else :size="16" class="text-gray-400" />
          </button>

          <div v-if="expandedSections.terminals" class="filter-options mt-3 space-y-2">
            <button
              class="text-xs text-cyan-400 hover:text-cyan-300 mb-2"
              @click="selectAllTerminals"
              v-if="!isAllTerminalsSelected"
            >
              全选
            </button>

            <div
              v-for="terminal in TERMINALS"
              :key="terminal"
              class="filter-option"
              :class="{ active: selectedTerminals.includes(terminal) }"
              @click="toggleTerminal(terminal)"
            >
              <div class="flex items-center gap-2">
                <div
                  class="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
                  :class="
                    selectedTerminals.includes(terminal)
                      ? 'bg-cyan-500 border-cyan-500'
                      : 'border-gray-500'
                  "
                >
                  <svg
                    v-if="selectedTerminals.includes(terminal)"
                    class="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="3"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <span>{{ TERMINAL_NAMES[terminal] }}</span>
              </div>
              <span class="text-xs text-gray-400 font-mono">{{ standCounts[terminal] || 0 }}</span>
            </div>
          </div>
        </div>

        <div class="filter-section">
          <button
            class="filter-section-header w-full flex items-center justify-between"
            @click="toggleSection('status')"
          >
            <div class="flex items-center gap-2">
              <CircleDot :size="16" class="text-gray-400" />
              <span class="font-medium">机位状态</span>
            </div>
            <ChevronDown
              v-if="!expandedSections.status"
              :size="16"
              class="text-gray-400"
            />
            <ChevronUp v-else :size="16" class="text-gray-400" />
          </button>

          <div v-if="expandedSections.status" class="filter-options mt-3 space-y-2">
            <button
              class="text-xs text-cyan-400 hover:text-cyan-300 mb-2"
              @click="selectAllStatuses"
              v-if="!isAllStatusesSelected"
            >
              全选
            </button>

            <div
              v-for="status in STAND_STATUSES"
              :key="status"
              class="filter-option"
              :class="{ active: selectedStatuses.includes(status) }"
              @click="toggleStatus(status)"
            >
              <div class="flex items-center gap-2">
                <div
                  class="w-3 h-3 rounded-full"
                  :style="{ backgroundColor: STAND_STATUS_COLORS[status] }"
                />
                <span>{{ STAND_STATUS_LABELS[status] }}</span>
              </div>
              <span class="text-xs text-gray-400 font-mono">{{ statusCounts[status] || 0 }}</span>
            </div>
          </div>
        </div>

        <div class="filter-section">
          <button
            class="filter-section-header w-full flex items-center justify-between"
            @click="toggleSection('airlines')"
          >
            <div class="flex items-center gap-2">
              <Plane :size="16" class="text-gray-400" />
              <span class="font-medium">航空公司</span>
              <span
                v-if="selectedAirlines.length > 0"
                class="ml-2 px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded-full"
              >
                {{ selectedAirlines.length }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="selectedAirlines.length > 0"
                class="text-xs text-gray-400 hover:text-white p-1"
                @click.stop="clearAirlines"
              >
                <X :size="14" />
              </button>
              <ChevronDown
                v-if="!expandedSections.airlines"
                :size="16"
                class="text-gray-400"
              />
              <ChevronUp v-else :size="16" class="text-gray-400" />
            </div>
          </button>

          <div v-if="expandedSections.airlines" class="filter-options mt-3 space-y-1">
            <div
              v-for="airline in AIRLINES"
              :key="airline.code"
              class="filter-option py-2"
              :class="{ active: selectedAirlines.includes(airline.code) }"
              @click="toggleAirline(airline.code)"
            >
              <div class="flex items-center gap-2">
                <div
                  class="w-3 h-3 rounded"
                  :style="{ backgroundColor: airline.color }"
                />
                <span class="text-sm">{{ airline.name }}</span>
              </div>
              <span class="text-xs text-gray-500 font-mono">{{ airline.code }}</span>
            </div>
          </div>
        </div>

        <div class="filter-section">
          <button
            class="filter-section-header w-full flex items-center justify-between"
            @click="toggleSection('vehicles')"
          >
            <div class="flex items-center gap-2">
              <Car :size="16" class="text-gray-400" />
              <span class="font-medium">地面车辆</span>
            </div>
            <ChevronDown
              v-if="!expandedSections.vehicles"
              :size="16"
              class="text-gray-400"
            />
            <ChevronUp v-else :size="16" class="text-gray-400" />
          </button>

          <div v-if="expandedSections.vehicles" class="filter-options mt-3 space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <div
                v-for="(label, type) in VEHICLE_TYPE_LABELS"
                :key="type"
                class="bg-bg-tertiary rounded p-2 text-center"
              >
                <p class="text-lg font-mono font-bold">{{ vehicleCounts[type] || 0 }}</p>
                <p class="text-xs text-gray-400">{{ label }}</p>
              </div>
            </div>
            <div class="flex gap-2 mt-2">
              <div class="flex-1 bg-green-500/10 rounded p-2 text-center">
                <p class="text-lg font-mono font-bold text-green-400">
                  {{ vehicleCounts.working || 0 }}
                </p>
                <p class="text-xs text-gray-400">作业中</p>
              </div>
              <div class="flex-1 bg-blue-500/10 rounded p-2 text-center">
                <p class="text-lg font-mono font-bold text-blue-400">
                  {{ vehicleCounts.moving || 0 }}
                </p>
                <p class="text-xs text-gray-400">行驶中</p>
              </div>
              <div class="flex-1 bg-gray-500/10 rounded p-2 text-center">
                <p class="text-lg font-mono font-bold text-gray-400">
                  {{ vehicleCounts.idle || 0 }}
                </p>
                <p class="text-xs text-gray-400">待命</p>
              </div>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-border">
          <label class="flex items-center justify-between cursor-pointer">
            <span class="text-sm">气象叠加层</span>
            <div
              class="relative w-10 h-6 rounded-full transition-colors"
              :class="weatherOverlayVisible ? 'bg-cyan-500' : 'bg-gray-600'"
              @click="weatherOverlayVisible = !weatherOverlayVisible"
            >
              <div
                class="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
                :class="weatherOverlayVisible ? 'translate-x-5' : 'translate-x-1'"
              />
            </div>
          </label>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.panel {
  grid-area: sidebar;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width var(--transition-base);
  width: var(--sidebar-width);
}

.panel.collapsed {
  width: var(--sidebar-width-collapsed);
}

.panel-header {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  font-weight: 600;
  font-size: var(--font-size-lg);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.filter-section {
  margin-bottom: var(--spacing-lg);
}

.filter-section-header {
  text-align: left;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--color-border);
}

.filter-section-header:hover {
  color: var(--color-text-primary);
}

.filter-options {
  padding-left: var(--spacing-xs);
}

.filter-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-option:hover {
  background: var(--color-bg-hover);
}

.filter-option.active {
  background: rgba(6, 182, 212, 0.1);
}

.space-y-1 > * + * {
  margin-top: 0.25rem;
}

.space-y-2 > * + * {
  margin-top: 0.5rem;
}

.space-y-6 > * + * {
  margin-top: 1.5rem;
}

.flex {
  display: flex;
}

.items-center {
  align-items: center;
}

.justify-between {
  justify-content: space-between;
}

.gap-2 {
  gap: 0.5rem;
}

.gap-4 {
  gap: 1rem;
}

.w-4 {
  width: 1rem;
}

.h-4 {
  height: 1rem;
}

.w-3 {
  width: 0.75rem;
}

.h-3 {
  height: 0.75rem;
}

.w-10 {
  width: 2.5rem;
}

.h-6 {
  height: 1.5rem;
}

.w-full {
  width: 100%;
}

.rounded {
  border-radius: var(--radius-sm);
}

.rounded-full {
  border-radius: 9999px;
}

.border-2 {
  border-width: 2px;
}

.border {
  border-width: 1px;
}

.border-gray-500 {
  border-color: #6b7280;
}

.border-border {
  border-color: var(--color-border);
}

.bg-cyan-500 {
  background-color: #06b6d4;
}

.bg-cyan-500\/20 {
  background-color: rgba(6, 182, 212, 0.2);
}

.bg-bg-tertiary {
  background: var(--color-bg-tertiary);
}

.bg-green-500\/10 {
  background-color: rgba(16, 185, 129, 0.1);
}

.bg-blue-500\/10 {
  background-color: rgba(59, 130, 246, 0.1);
}

.bg-gray-500\/10 {
  background-color: rgba(107, 114, 128, 0.1);
}

.bg-gray-600 {
  background-color: #475569;
}

.bg-white {
  background-color: #ffffff;
}

.text-white {
  color: #ffffff;
}

.text-gray-400 {
  color: #94a3b8;
}

.text-gray-500 {
  color: #64748b;
}

.text-gray-600 {
  color: #475569;
}

.text-cyan-400 {
  color: #22d3ee;
}

.text-green-400 {
  color: #4ade80;
}

.text-blue-400 {
  color: #60a5fa;
}

.text-sm {
  font-size: 0.875rem;
}

.text-xs {
  font-size: 0.75rem;
}

.text-lg {
  font-size: 1.125rem;
}

.font-medium {
  font-weight: 500;
}

.font-bold {
  font-weight: 700;
}

.font-mono {
  font-family: var(--font-family-mono);
}

.mt-3 {
  margin-top: 0.75rem;
}

.mt-2 {
  margin-top: 0.5rem;
}

.mb-2 {
  margin-bottom: 0.5rem;
}

.ml-2 {
  margin-left: 0.5rem;
}

.py-2 {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

.py-0\.5 {
  padding-top: 0.125rem;
  padding-bottom: 0.125rem;
}

.px-2 {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

.p-1 {
  padding: 0.25rem;
}

.p-2 {
  padding: 0.5rem;
}

.text-center {
  text-align: center;
}

.relative {
  position: relative;
}

.absolute {
  position: absolute;
}

.top-1 {
  top: 0.25rem;
}

.transition-colors {
  transition: background-color var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}

.transition-transform {
  transition: transform var(--transition-fast);
}

.translate-x-1 {
  transform: translateX(0.25rem);
}

.translate-x-5 {
  transform: translateX(1.25rem);
}

.grid {
  display: grid;
}

.grid-cols-2 {
  grid-template-columns: repeat(2, 1fr);
}

.flex-1 {
  flex: 1;
}

.pt-4 {
  padding-top: 1rem;
}

.border-t {
  border-top-width: 1px;
}

.cursor-pointer {
  cursor: pointer;
}

.w-full {
  width: 100%;
}

.text-left {
  text-align: left;
}
</style>
