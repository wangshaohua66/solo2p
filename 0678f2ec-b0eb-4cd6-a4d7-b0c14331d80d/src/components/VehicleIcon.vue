<script setup lang="ts">
import { computed } from 'vue';
import type { Vehicle } from '@/types/apron';
import { VEHICLE_TYPE_COLORS, VEHICLE_TYPE_SHAPES } from '@/utils/constants';

interface Props {
  vehicle: Vehicle;
  showTrail?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showTrail: true,
});

const emit = defineEmits<{
  click: [vehicleId: string];
}>();

const color = computed(() => VEHICLE_TYPE_COLORS[props.vehicle.type]);
const shape = computed(() => VEHICLE_TYPE_SHAPES[props.vehicle.type]);

const transform = computed(() => {
  const { x, y } = props.vehicle.position;
  return `translate(${x}px, ${y}px) rotate(${props.vehicle.heading}deg)`;
});

const statusOpacity = computed(() => {
  if (props.vehicle.status === 'idle') return 0.6;
  return 1;
});

const handleClick = () => {
  emit('click', props.vehicle.id);
};

const renderShape = computed(() => {
  const size = 14;
  const half = size / 2;

  switch (shape.value) {
    case 'square':
      return `M ${-half} ${-half} L ${half} ${-half} L ${half} ${half} L ${-half} ${half} Z`;
    case 'circle':
      return null;
    case 'triangle':
      return `M 0 ${-half} L ${half} ${half} L ${-half} ${half} Z`;
    case 'diamond':
      return `M 0 ${-half} L ${half} 0 L 0 ${half} L ${-half} 0 Z`;
    default:
      return `M ${-half} ${-half} L ${half} ${-half} L ${half} ${half} L ${-half} ${half} Z`;
  }
});

const arrowPoints = computed(() => {
  const size = 14;
  const arrowLength = 6;
  return `${size / 2 + 2},0 ${size / 2 + arrowLength},-3 ${size / 2 + arrowLength},3`;
});
</script>

<template>
  <g class="vehicle-group">
    <g
      v-if="showTrail && vehicle.trail.length > 0"
      class="vehicle-trail-container"
    >
      <polyline
        v-for="(point, index) in vehicle.trail"
        :key="index"
        :points="`${vehicle.trail[index - 1]?.x || point.x},${vehicle.trail[index - 1]?.y || point.y} ${point.x},${point.y}`"
        fill="none"
        :stroke="color"
        stroke-width="2"
        stroke-opacity="0.3"
        class="vehicle-trail"
      />
    </g>

    <g
      class="vehicle-icon"
      :style="{
        transform,
        opacity: statusOpacity,
      }"
      @click="handleClick"
    >
      <circle
        v-if="shape === 'circle'"
        cx="0"
        cy="0"
        r="7"
        :fill="color"
        stroke="#ffffff"
        stroke-width="1.5"
      />

      <path
        v-else
        :d="renderShape"
        :fill="color"
        stroke="#ffffff"
        stroke-width="1.5"
      />

      <polygon
        :points="arrowPoints"
        :fill="color"
        stroke="#ffffff"
        stroke-width="0.5"
      />

      <circle
        v-if="vehicle.status === 'working'"
        cx="0"
        cy="0"
        r="3"
        fill="#10b981"
        class="animate-pulse"
      />

      <circle
        v-else-if="vehicle.status === 'moving'"
        cx="0"
        cy="0"
        r="3"
        fill="#3b82f6"
        class="animate-pulse"
      />
    </g>
  </g>
</template>

<style scoped>
.vehicle-group {
  pointer-events: none;
}

.vehicle-icon {
  pointer-events: auto;
  cursor: pointer;
  transition: transform var(--transition-fast), opacity var(--transition-fast);
  will-change: transform;
}

.vehicle-icon:hover {
  transform: scale(1.3) rotate(v-bind('vehicle.heading + "deg"')) !important;
}

.vehicle-trail {
  animation: fadeOut 3s ease-out forwards;
  pointer-events: none;
}

@keyframes fadeOut {
  from { opacity: 0.5; }
  to { opacity: 0; }
}

.animate-pulse {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.3); }
}
</style>
