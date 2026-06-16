<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useApronStore } from '@/stores/apron';
import { useGanttDrag } from '@/composables/useGanttDrag';
import GanttBar from './GanttBar.vue';
import { formatTime } from '@/utils/helpers';
import { MIN_TURNAROUND_INTERVAL } from '@/utils/constants';
import { ChevronDown, ChevronUp, Clock, Plane } from 'lucide-vue-next';

const store = useApronStore();

const containerRef = ref<HTMLDivElement | null>(null);
const containerWidth = ref(1200);
const rowHeight = 44;
const sidebarWidth = 80;

const {
  isDragging,
  startDrag,
  handleDrag,
  endDrag,
  hasConflict,
  timeToX,
  xToTime,
} = useGanttDrag();

let resizeObserver: ResizeObserver | null = null;

const dayStart = computed(() => {
  const now = new Date(store.currentTime);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
});

const dayEnd = computed(() => dayStart.value + 24 * 60 * 60 * 1000);

const timeRange = computed(() => dayEnd.value - dayStart.value);

const timeAxisHours = computed(() => {
  const hours = [];
  for (let h = 0; h <= 24; h += 2) {
    hours.push({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      x: ((h * 3600 * 1000) / timeRange.value) * containerWidth.value,
    });
  }
  return hours;
});

const currentTimeX = computed(() => {
  if (store.currentTime < dayStart.value || store.currentTime > dayEnd.value) return -1;
  return ((store.currentTime - dayStart.value) / timeRange.value) * containerWidth.value;
});

const flightsWithStand = computed(() => {
  return store.flights
    .filter(f => f.status !== 'departed')
    .map(f => {
      const stand = store.standById(f.standId);
      const conflict = hasFlightConflict(f.id);
      return {
        flight: f,
        stand,
        hasConflict: conflict,
      };
    })
    .sort((a, b) => {
      const aNum = a.stand?.number || '';
      const bNum = b.stand?.number || '';
      return aNum.localeCompare(bNum, undefined, { numeric: true });
    });
});

const visibleFlights = computed(() => {
  const { terminals, statuses, airlines } = store.layoutConfig.filters;
  return flightsWithStand.value.filter(item => {
    if (item.stand && !terminals.includes(item.stand.terminal)) return false;
    if (item.stand && !statuses.includes(item.stand.status)) return false;
    if (airlines.length > 0 && !airlines.includes(item.flight.airline)) return false;
    return true;
  }).slice(0, 30);
});

const ganttHeight = computed(() => {
  return Math.max(200, visibleFlights.value.length * rowHeight + 60);
});

function hasFlightConflict(flightId: string): boolean {
  const flight = store.flightById(flightId);
  if (!flight) return false;
  const sameStandFlights = store.flights.filter(
    f => f.standId === flight.standId && f.id !== flightId && f.status !== 'departed'
  );
  for (const other of sameStandFlights) {
    const interval = Math.abs(other.arrivalTime - flight.departureTime);
    if (interval < MIN_TURNAROUND_INTERVAL) return true;
    const interval2 = Math.abs(flight.arrivalTime - other.departureTime);
    if (interval2 < MIN_TURNAROUND_INTERVAL) return true;
    if (
      (flight.arrivalTime < other.departureTime && flight.departureTime > other.arrivalTime) ||
      (other.arrivalTime < flight.departureTime && other.departureTime > flight.arrivalTime)
    ) {
      return true;
    }
  }
  return false;
}

const handleBarDragStart = (e: MouseEvent, flightId: string, serviceId?: string) => {
  e.preventDefault();
  startDrag(e, flightId, serviceId, containerWidth.value, dayStart.value, dayEnd.value);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
};

const onDragMove = (e: MouseEvent) => {
  if (!containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  const clientX = e.clientX - rect.left - sidebarWidth;
  handleDrag(clientX);
};

const onDragEnd = () => {
  endDrag();
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  store.detectConflicts();
};

const handleBarClick = (flightId: string) => {
  const flight = store.flightById(flightId);
  if (flight) {
    store.setSelectedStand(flight.standId);
    store.setSelectedFlight(flightId);
  }
};

const isCollapsed = computed({
  get: () => store.layoutConfig.ganttCollapsed,
  set: (val) => {
    store.layoutConfig.ganttCollapsed = val;
    store.saveLayout();
  },
});

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

onMounted(() => {
  if (containerRef.value) {
    const updateWidth = () => {
      if (containerRef.value) {
        const rect = containerRef.value.getBoundingClientRect();
        containerWidth.value = Math.max(800, rect.width - sidebarWidth);
      }
    };
    updateWidth();
    resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
});
</script>

<template>
  <div class="turnaround-gantt" :class="{ collapsed: isCollapsed }">
    <div class="gantt-header" @click="toggleCollapse">
      <div class="flex items-center gap-2">
        <Clock :size="18" class="text-cyan-400" />
        <span class="font-semibold text-sm">航班过站甘特图</span>
        <span class="text-xs text-gray-400 font-mono">
          {{ visibleFlights.length }} / {{ flightsWithStand.length }} 架次
        </span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-400 hidden md:inline">
          今日 {{ formatTime(dayStart) }} - {{ formatTime(dayEnd) }}
        </span>
        <ChevronUp v-if="!isCollapsed" :size="16" class="text-gray-400" />
        <ChevronDown v-else :size="16" class="text-gray-400" />
      </div>
    </div>

    <div v-show="!isCollapsed" class="gantt-body">
      <div
        ref="containerRef"
        class="gantt-container"
        :class="{ dragging: isDragging }"
      >
        <div class="gantt-scroll" :style="{ height: ganttHeight + 'px' }">
          <div class="gantt-sidebar" :style="{ width: sidebarWidth + 'px' }">
            <div class="gantt-sidebar-header">
              <Plane :size="14" class="text-gray-400" />
              <span>机位</span>
            </div>
            <div
              v-for="item in visibleFlights"
              :key="item.flight.id"
              class="gantt-sidebar-row"
              :style="{ height: rowHeight + 'px' }"
              @click="handleBarClick(item.flight.id)"
            >
              <span
                class="stand-no font-mono"
                :class="{
                  'text-cyan-400': item.stand?.id === store.selectedStandId,
                  'text-purple-400': item.stand?.type === 'remote',
                }"
              >
                {{ item.stand?.number || '---' }}
              </span>
              <span
                v-if="item.stand?.type === 'remote'"
                class="remote-badge"
              >
                远
              </span>
            </div>
          </div>

          <div class="gantt-main" :style="{ marginLeft: sidebarWidth + 'px' }">
            <div class="gantt-time-axis">
              <div
                v-for="tick in timeAxisHours"
                :key="tick.hour"
                class="gantt-time-tick"
                :style="{ left: tick.x + 'px' }"
              >
                <span class="time-label font-mono text-xs">{{ tick.label }}</span>
              </div>

              <div
                v-if="currentTimeX >= 0"
                class="gantt-now-line"
                :style="{ left: currentTimeX + 'px' }"
              >
                <div class="now-line-top"></div>
                <div class="now-line-label font-mono text-xs text-cyan-400">
                  {{ formatTime(store.currentTime) }}
                </div>
              </div>
            </div>

            <div class="gantt-rows-container">
              <div
                v-for="item in visibleFlights"
                :key="item.flight.id"
                class="gantt-row-wrapper"
                :style="{ height: rowHeight + 'px' }"
              >
                <div class="gantt-row-bg">
                  <div
                    v-for="tick in timeAxisHours.filter(t => t.hour % 4 === 0 && t.hour > 0)"
                    :key="'grid-' + tick.hour"
                    class="gantt-grid-line"
                    :style="{ left: tick.x + 'px' }"
                  />
                </div>

                <GanttBar
                  :flight="item.flight"
                  :container-width="containerWidth"
                  :day-start="dayStart"
                  :day-end="dayEnd"
                  :row-height="rowHeight"
                  :has-conflict="item.hasConflict"
                  @drag-start="handleBarDragStart"
                  @click="handleBarClick"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.turnaround-gantt {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: height var(--transition-base);
  height: 100%;
}

.turnaround-gantt.collapsed {
  height: 48px;
}

.gantt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background var(--transition-fast);
  flex-shrink: 0;
}

.gantt-header:hover {
  background: var(--color-bg-hover);
}

.gantt-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.gantt-container {
  flex: 1;
  overflow: auto;
  position: relative;
  background: var(--color-bg-primary);
}

.gantt-container.dragging {
  cursor: grabbing;
  user-select: none;
}

.gantt-scroll {
  position: relative;
  min-width: 100%;
}

.gantt-sidebar {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  z-index: 2;
}

.gantt-sidebar-header {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  background: var(--color-bg-secondary);
  z-index: 3;
}

.gantt-sidebar-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background var(--transition-fast);
  padding: 0 8px;
}

.gantt-sidebar-row:hover {
  background: var(--color-bg-hover);
}

.stand-no {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.remote-badge {
  font-size: 9px;
  padding: 1px 4px;
  background: rgba(139, 92, 246, 0.2);
  color: #8b5cf6;
  border-radius: 2px;
}

.gantt-main {
  position: relative;
}

.gantt-time-axis {
  height: 32px;
  position: sticky;
  top: 0;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  z-index: 2;
}

.gantt-time-tick {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  transform: translateX(-50%);
}

.time-label {
  color: var(--color-text-muted);
  font-weight: 500;
}

.gantt-now-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  z-index: 5;
  pointer-events: none;
}

.now-line-top {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  background: linear-gradient(180deg, #22d3ee, transparent);
}

.now-line-label {
  position: absolute;
  top: 2px;
  left: 4px;
  padding: 2px 6px;
  background: rgba(6, 182, 212, 0.2);
  border-radius: 3px;
  font-weight: 600;
  white-space: nowrap;
}

.gantt-rows-container {
  position: relative;
}

.gantt-row-wrapper {
  position: relative;
  border-bottom: 1px solid var(--color-border);
}

.gantt-row-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.gantt-grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(71, 85, 105, 0.15);
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

.font-semibold {
  font-weight: 600;
}

.font-mono {
  font-family: var(--font-family-mono);
}

.text-sm {
  font-size: 0.875rem;
}

.text-xs {
  font-size: 0.75rem;
}

.text-gray-400 {
  color: #94a3b8;
}

.text-cyan-400 {
  color: #22d3ee;
}

.text-purple-400 {
  color: #c084fc;
}

.hidden {
  display: none;
}

@media (min-width: 768px) {
  .md\:inline {
    display: inline;
  }
}
</style>
