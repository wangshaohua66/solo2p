<script setup lang="ts">
import { computed } from 'vue';
import type { Vehicle } from '@/types/apron';
import { VEHICLE_TYPE_COLORS, VEHICLE_TYPE_SHAPES, VEHICLE_TYPE_LABELS } from '@/utils/constants';

interface Props {
  vehicle: Vehicle;
  showTrail?: boolean;
  showLabel?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showTrail: true,
  showLabel: false,
});

const emit = defineEmits<{
  click: [vehicleId: string];
}>();

const color = computed(() => VEHICLE_TYPE_COLORS[props.vehicle.type]);
const shape = computed(() => VEHICLE_TYPE_SHAPES[props.vehicle.type]);

const transform = computed(() => {
  const { x, y } = props.vehicle.position;
  return `translate(${x}, ${y}) rotate(${props.vehicle.heading})`;
});

const statusOpacity = computed(() => {
  if (props.vehicle.status === 'idle') return 0.55;
  return 1;
});

const handleClick = (e: Event) => {
  e.stopPropagation();
  emit('click', props.vehicle.id);
};

const renderShape = computed(() => {
  const size = 16;
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
  const size = 16;
  const arrowLength = 7;
  return `${size / 2 + 2},0 ${size / 2 + arrowLength},-4 ${size / 2 + arrowLength},4`;
});

const trailPath = computed(() => {
  if (!props.showTrail || props.vehicle.trail.length < 2) return '';
  const points = [...props.vehicle.trail, props.vehicle.position];
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
});
</script>

<template>
  <g class="vehicle-marker">
    <path
      v-if="trailPath"
      :d="trailPath"
      fill="none"
      :stroke="color"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="vehicle-trail"
      :stroke-opacity="statusOpacity * 0.4"
    />

    <g
      class="vehicle-marker-icon"
      :transform="transform"
      :style="{ opacity: statusOpacity }"
      :title="`${VEHICLE_TYPE_LABELS[vehicle.type]} ${vehicle.plateNo}`"
      @click="handleClick"
    >
      <circle
        v-if="shape === 'circle'"
        cx="0"
        cy="0"
        r="8"
        :fill="color"
        stroke="#ffffff"
        stroke-width="2"
      />

      <path
        v-else
        :d="renderShape"
        :fill="color"
        stroke="#ffffff"
        stroke-width="2"
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
        r="3.5"
        fill="#10b981"
        class="working-pulse"
      />

      <circle
        v-else-if="vehicle.status === 'moving'"
        cx="0"
        cy="0"
        r="3.5"
        fill="#3b82f6"
        class="working-pulse"
      />

      <text
        v-if="showLabel"
        x="0"
        y="20"
        text-anchor="middle"
        fill="rgba(255,255,255,0.7)"
        font-size="8"
        font-family="JetBrains Mono, monospace"
        class="pointer-events-none"
      >
        {{ vehicle.plateNo }}
      </text>
    </g>
  </g>
</template>

<style scoped>
.vehicle-marker {
  pointer-events: none;
}

.vehicle-marker-icon {
  pointer-events: auto;
  cursor: pointer;
  transition: transform 0.2s ease-out, opacity 0.2s ease-out;
  transform-origin: center;
  will-change: transform;
}

.vehicle-marker-icon:hover {
  filter: drop-shadow(0 0 6px currentColor);
}

.vehicle-trail {
  pointer-events: none;
  stroke-dasharray: 200;
  stroke-dashoffset: 0;
  animation: trailFade 3s ease-out forwards;
}

@keyframes trailFade {
  from {
    stroke-opacity: 0.5;
  }
  to {
    stroke-opacity: 0.05;
  }
}

.working-pulse {
  animation: pulseGlow 1.5s ease-in-out infinite;
}

@keyframes pulseGlow {
  0%, 100% {
    r: 3;
    opacity: 1;
  }
  50% {
    r: 5;
    opacity: 0.7;
  }
}

.pointer-events-none {
  pointer-events: none;
}
</style>
