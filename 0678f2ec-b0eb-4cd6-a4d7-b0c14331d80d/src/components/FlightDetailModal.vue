<script setup lang="ts">
import { computed } from 'vue';
import type { Flight, Stand, ServiceTask } from '@/types/apron';
import {
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_COLORS,
  AIRLINES,
  STAND_STATUS_LABELS,
} from '@/utils/constants';
import { formatDateTime, formatDuration } from '@/utils/helpers';
import { X, Plane, Clock, Users, Fuel, Utensils, Droplets, Luggage, UserCheck } from 'lucide-vue-next';

interface Props {
  flight: Flight | null;
  stand: Stand | null;
  visible: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

const airlineInfo = computed(() => {
  if (!props.flight) return null;
  return AIRLINES.find((a) => a.code === props.flight!.airline);
});

const turnaroundTime = computed(() => {
  if (!props.flight) return 0;
  return (props.flight.departureTime - props.flight.arrivalTime) / 60000;
});

const overallProgress = computed(() => {
  if (!props.flight) return 0;
  const completed = props.flight.services.filter((s) => s.status === 'completed').length;
  return Math.round((completed / props.flight.services.length) * 100);
});

const getServiceIcon = (type: string) => {
  const icons: Record<string, any> = {
    towing: Plane,
    fueling: Fuel,
    cleaning: Droplets,
    catering: Utensils,
    boarding: UserCheck,
  };
  return icons[type] || Luggage;
};

const getStatusClass = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-500';
    case 'in-progress':
      return 'bg-blue-500';
    case 'delayed':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: '待开始',
    'in-progress': '进行中',
    completed: '已完成',
    delayed: '已延误',
  };
  return texts[status] || status;
};

const handleClose = () => {
  emit('close');
};
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="handleClose">
      <div class="modal-content">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-lg flex items-center justify-center"
              :style="{ backgroundColor: airlineInfo?.color + '30' }"
            >
              <Plane :size="20" :color="airlineInfo?.color || '#06b6d4'" />
            </div>
            <div>
              <h3 class="modal-title font-mono">{{ flight?.flightNo }}</h3>
              <p class="text-sm text-gray-400">
                {{ airlineInfo?.name || flight?.airline }} · {{ flight?.aircraftType }}
              </p>
            </div>
          </div>
          <button class="p-2 rounded-lg hover:bg-white/10 transition-colors" @click="handleClose">
            <X :size="20" class="text-gray-400" />
          </button>
        </div>

        <div class="modal-body space-y-6">
          <div v-if="stand" class="grid grid-cols-2 gap-4">
            <div class="bg-bg-tertiary rounded-lg p-4">
              <p class="text-xs text-gray-400 uppercase mb-1">机位</p>
              <p class="text-2xl font-mono font-bold">{{ stand.number }}</p>
              <span
                class="text-xs mt-1 inline-block"
                :class="`badge-${stand.status}`"
              >
                {{ STAND_STATUS_LABELS[stand.status] }}
              </span>
            </div>
            <div class="bg-bg-tertiary rounded-lg p-4">
              <p class="text-xs text-gray-400 uppercase mb-1">旅客人数</p>
              <p class="text-2xl font-mono font-bold">{{ flight?.passengerCount }}</p>
              <Users :size="16" class="text-gray-400 mt-1" />
            </div>
          </div>

          <div class="bg-bg-tertiary rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-medium">过站进度</span>
              <span class="text-2xl font-mono font-bold text-cyan-400">{{ overallProgress }}%</span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-bar-fill"
                :style="{ width: `${overallProgress}%`, backgroundColor: '#06b6d4' }"
              />
            </div>
            <div class="flex justify-between mt-2 text-xs text-gray-400 font-mono">
              <span>{{ formatDateTime(flight?.arrivalTime || 0, 'HH:mm') }}</span>
              <span>过站 {{ formatDuration(turnaroundTime) }}</span>
              <span>{{ formatDateTime(flight?.departureTime || 0, 'HH:mm') }}</span>
            </div>
          </div>

          <div>
            <h4 class="text-sm font-medium mb-3 flex items-center gap-2">
              <Clock :size="16" class="text-gray-400" />
              保障作业进度
            </h4>
            <div class="space-y-3">
              <div
                v-for="service in flight?.services"
                :key="service.id"
                class="bg-bg-tertiary rounded-lg p-3"
              >
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-8 h-8 rounded flex items-center justify-center"
                      :style="{ backgroundColor: SERVICE_TYPE_COLORS[service.type] + '30' }"
                    >
                      <component
                        :is="getServiceIcon(service.type)"
                        :size="16"
                        :color="SERVICE_TYPE_COLORS[service.type]"
                      />
                    </div>
                    <div>
                      <p class="text-sm font-medium">{{ SERVICE_TYPE_LABELS[service.type] }}</p>
                      <p class="text-xs text-gray-400 font-mono">
                        {{ formatDateTime(service.startTime, 'HH:mm') }} - {{ formatDateTime(service.endTime, 'HH:mm') }}
                      </p>
                    </div>
                  </div>
                  <div class="text-right">
                    <span
                      class="inline-block w-2 h-2 rounded-full mr-2"
                      :class="getStatusClass(service.status)"
                    />
                    <span class="text-xs">{{ getStatusText(service.status) }}</span>
                    <p class="text-lg font-mono font-bold mt-1">{{ service.progress }}%</p>
                  </div>
                </div>
                <div class="progress-bar h-1.5">
                  <div
                    class="progress-bar-fill"
                    :style="{
                      width: `${service.progress}%`,
                      backgroundColor: SERVICE_TYPE_COLORS[service.type],
                    }"
                  />
                </div>
                <div v-if="service.crew" class="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  <UserCheck :size="12" />
                  <span>{{ service.crew }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="flight?.isDelayed" class="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div class="flex items-center gap-2 text-red-400">
              <Clock :size="18" />
              <span class="font-medium">航班延误</span>
            </div>
            <p class="text-sm text-gray-300 mt-1">该航班预计延误，请关注后续保障进度</p>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn" @click="handleClose">关闭</button>
          <button class="btn btn-primary">调整保障计划</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: var(--z-index-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn var(--transition-base);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  max-width: 600px;
  width: 90%;
  max-height: 85vh;
  overflow: auto;
  animation: slideUp var(--transition-base) ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  padding: var(--spacing-xl);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  background: var(--color-bg-secondary);
  z-index: 1;
}

.modal-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  margin: 0;
}

.modal-body {
  padding: var(--spacing-xl);
}

.modal-footer {
  padding: var(--spacing-xl);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  position: sticky;
  bottom: 0;
  background: var(--color-bg-secondary);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-lg);
  font-size: var(--font-size-sm);
  font-weight: 500;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border-light);
}

.btn-primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-text-inverse);
}

.btn-primary:hover {
  background: var(--color-accent-hover);
  border-color: var(--color-accent-hover);
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

.gap-3 {
  gap: 0.75rem;
}

.space-y-3 > * + * {
  margin-top: 0.75rem;
}

.space-y-6 > * + * {
  margin-top: 1.5rem;
}

.grid {
  display: grid;
}

.grid-cols-2 {
  grid-template-columns: repeat(2, 1fr);
}

.gap-4 {
  gap: 1rem;
}

.bg-bg-tertiary {
  background: var(--color-bg-tertiary);
}

.bg-green-500 {
  background-color: #10b981;
}

.bg-blue-500 {
  background-color: #3b82f6;
}

.bg-red-500 {
  background-color: #ef4444;
}

.bg-gray-500 {
  background-color: #6b7280;
}

.bg-red-500\/10 {
  background-color: rgba(239, 68, 68, 0.1);
}

.border {
  border-width: 1px;
}

.border-red-500\/30 {
  border-color: rgba(239, 68, 68, 0.3);
}

.rounded-lg {
  border-radius: var(--radius-lg);
}

.p-3 {
  padding: 0.75rem;
}

.p-4 {
  padding: 1rem;
}

.p-2 {
  padding: 0.5rem;
}

.w-10 {
  width: 2.5rem;
}

.h-10 {
  height: 2.5rem;
}

.w-8 {
  width: 2rem;
}

.h-8 {
  height: 2rem;
}

.w-2 {
  width: 0.5rem;
}

.h-2 {
  height: 0.5rem;
}

.h-1\.5 {
  height: 0.375rem;
}

.text-xs {
  font-size: 0.75rem;
}

.text-sm {
  font-size: 0.875rem;
}

.text-lg {
  font-size: 1.125rem;
}

.text-2xl {
  font-size: 1.5rem;
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

.text-gray-300 {
  color: #cbd5e1;
}

.text-gray-400 {
  color: #94a3b8;
}

.text-cyan-400 {
  color: #22d3ee;
}

.text-red-400 {
  color: #f87171;
}

.mt-1 {
  margin-top: 0.25rem;
}

.mt-2 {
  margin-top: 0.5rem;
}

.mb-1 {
  margin-bottom: 0.25rem;
}

.mb-2 {
  margin-bottom: 0.5rem;
}

.mb-3 {
  margin-bottom: 0.75rem;
}

.mr-2 {
  margin-right: 0.5rem;
}

.text-right {
  text-align: right;
}

.inline-block {
  display: inline-block;
}

.rounded-full {
  border-radius: 9999px;
}

.progress-bar {
  height: 6px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: var(--radius-sm);
  transition: width var(--transition-base);
}

.badge-available {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.badge-occupied {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.badge-in-service {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.badge-maintenance {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.uppercase {
  text-transform: uppercase;
}
</style>
