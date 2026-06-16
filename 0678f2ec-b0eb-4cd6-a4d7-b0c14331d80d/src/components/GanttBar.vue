<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Flight, ServiceTask } from '@/types/apron';
import { SERVICE_TYPE_COLORS, SERVICE_TYPE_LABELS } from '@/utils/constants';
import { formatTime } from '@/utils/helpers';

interface Props {
  flight: Flight;
  containerWidth: number;
  dayStart: number;
  dayEnd: number;
  rowHeight: number;
  hasConflict?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  dragStart: [e: MouseEvent, flightId: string, serviceId?: string];
  click: [flightId: string];
}>();

const isDragging = ref(false);

const totalDuration = computed(() => props.dayEnd - props.dayStart);

const flightX = computed(() => {
  return ((props.flight.arrivalTime - props.dayStart) / totalDuration) * props.containerWidth;
});

const flightWidth = computed(() => {
  const duration = props.flight.departureTime - props.flight.arrivalTime;
  return Math.max(20, (duration / totalDuration) * props.containerWidth);
});

const airlineColor = computed(() => {
  const colors = ['#C8102E', '#003087', '#00468B', '#E60012', '#EA0029', '#1D428A'];
  const hash = props.flight.airline.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
});

const getServiceStyle = (service: ServiceTask) => {
  const x = ((service.startTime - props.dayStart) / totalDuration) * props.containerWidth;
  const width = Math.max(10, ((service.endTime - service.startTime) / totalDuration) * props.containerWidth);
  return {
    left: `${x}px`,
    width: `${width}px`,
    backgroundColor: SERVICE_TYPE_COLORS[service.type],
  };
};

const getServiceOpacity = (service: ServiceTask) => {
  if (service.status === 'completed') return 0.7;
  if (service.status === 'delayed') return 1;
  return 0.9;
};

const handleMouseDown = (e: MouseEvent, serviceId?: string) => {
  e.stopPropagation();
  emit('dragStart', e, props.flight.id, serviceId);
};

const handleClick = () => {
  emit('click', props.flight.id);
};
</script>

<template>
  <div
    class="gantt-row"
    :style="{ height: `${rowHeight}px` }"
    @click="handleClick"
  >
    <div
      class="gantt-bar flight-bar"
      :class="{
        'has-conflict': hasConflict,
        'is-delayed': flight.isDelayed,
      }"
      :style="{
        left: `${flightX}px`,
        width: `${flightWidth}px`,
        background: `linear-gradient(180deg, ${airlineColor}dd, ${airlineColor}99)`,
      }"
      @mousedown="(e) => handleMouseDown(e)"
    >
      <div class="flight-info">
        <span class="flight-no font-mono">{{ flight.flightNo }}</span>
        <span class="flight-time font-mono text-xs opacity-70">
          {{ formatTime(flight.arrivalTime) }} - {{ formatTime(flight.departureTime) }}
        </span>
      </div>

      <div class="service-bars">
        <div
          v-for="service in flight.services"
          :key="service.id"
          class="gantt-bar service-bar"
          :class="{
            'status-pending': service.status === 'pending',
            'status-progress': service.status === 'in-progress',
            'status-completed': service.status === 'completed',
            'status-delayed': service.status === 'delayed',
          }"
          :style="{
            ...getServiceStyle(service),
            opacity: getServiceOpacity(service),
          }"
          :title="`${SERVICE_TYPE_LABELS[service.type]}: ${service.progress}%`"
          @mousedown.stop="(e) => handleMouseDown(e, service.id)"
        >
          <div
            v-if="service.status === 'in-progress' || service.status === 'completed'"
            class="service-progress"
            :style="{ width: `${service.progress}%` }"
          />
          <span
            v-if="flightWidth > 80"
            class="service-label"
          >
            {{ SERVICE_TYPE_LABELS[service.type].charAt(0) }}
          </span>
        </div>
      </div>

      <div
        v-if="hasConflict"
        class="conflict-indicator"
      />
    </div>
  </div>
</template>

<style scoped>
.gantt-row {
  position: relative;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
}

.gantt-row:hover {
  background: rgba(6, 182, 212, 0.05);
}

.gantt-bar {
  position: absolute;
  top: 4px;
  border-radius: 4px;
  overflow: hidden;
  cursor: grab;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  will-change: left, width;
}

.gantt-bar:hover {
  transform: scaleY(1.05);
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.gantt-bar:active {
  cursor: grabbing;
}

.flight-bar {
  height: 32px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.flight-bar.has-conflict {
  border: 2px dashed var(--color-alert-red);
  animation: pulse-border 1s ease-in-out infinite;
}

.flight-bar.is-delayed {
  border: 2px solid var(--color-alert-orange);
}

@keyframes pulse-border {
  0%, 100% { border-color: var(--color-alert-red); }
  50% { border-color: rgba(239, 68, 68, 0.3); }
}

.flight-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  z-index: 2;
  position: relative;
}

.flight-no {
  font-size: 11px;
  font-weight: 600;
  color: white;
  white-space: nowrap;
}

.flight-time {
  color: white;
}

.service-bars {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
}

.service-bar {
  height: 14px;
  top: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: white;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.service-bar.status-pending {
  opacity: 0.4;
}

.service-bar.status-delayed {
  border-color: var(--color-alert-red);
}

.service-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.3);
  transition: width var(--transition-base);
}

.service-label {
  position: relative;
  z-index: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.conflict-indicator {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  background: var(--color-alert-red);
  border-radius: 50%;
  border: 2px solid white;
  animation: blink 1s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.font-mono {
  font-family: var(--font-family-mono);
}

.text-xs {
  font-size: 0.75rem;
}

.opacity-70 {
  opacity: 0.7;
}
</style>
