<script setup lang="ts">
import { computed } from 'vue';
import type { Stand, Flight } from '@/types/apron';
import { STAND_STATUS_COLORS } from '@/utils/constants';
import { useApronStore } from '@/stores/apron';

interface Props {
  stand: Stand;
  selected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
});

const emit = defineEmits<{
  click: [standId: string];
}>();

const store = useApronStore();

const fillColor = computed(() => {
  if (props.stand.weatherAlert) {
    return '#ef4444';
  }
  return STAND_STATUS_COLORS[props.stand.status];
});

const currentFlight = computed(() => {
  if (!props.stand.currentFlight) return null;
  return store.flightById(props.stand.currentFlight);
});

const handleClick = () => {
  emit('click', props.stand.id);
};

const rectX = computed(() => props.stand.position.x);
const rectY = computed(() => props.stand.position.y);
const rectWidth = computed(() => props.stand.position.width);
const rectHeight = computed(() => props.stand.position.height);

const centerX = computed(() => rectX.value + rectWidth.value / 2);
const centerY = computed(() => rectY.value + rectHeight.value / 2);
</script>

<template>
  <g
    class="stand-slot"
    :class="{
      'stand-selected': selected,
      'weather-alert': stand.weatherAlert,
    }"
    @click="handleClick"
  >
    <rect
      :x="rectX"
      :y="rectY"
      :width="rectWidth"
      :height="rectHeight"
      rx="2"
      ry="2"
      class="stand-rect"
      :fill="fillColor"
      :stroke="stand.type === 'remote' ? '#8b5cf6' : '#475569'"
      stroke-width="1"
      :opacity="stand.type === 'remote' ? 0.85 : 1"
    />

    <text
      :x="centerX"
      :y="centerY - 5"
      text-anchor="middle"
      dominant-baseline="middle"
      fill="#ffffff"
      font-size="10"
      font-family="var(--font-family-mono)"
      font-weight="600"
      class="pointer-events-none select-none"
    >
      {{ stand.number }}
    </text>

    <text
      v-if="currentFlight"
      :x="centerX"
      :y="centerY + 10"
      text-anchor="middle"
      dominant-baseline="middle"
      fill="rgba(255,255,255,0.7)"
      font-size="8"
      font-family="var(--font-family-mono)"
      class="pointer-events-none select-none"
    >
      {{ currentFlight.flightNo }}
    </text>

    <text
      v-if="stand.type === 'remote'"
      :x="centerX"
      :y="rectY + 12"
      text-anchor="middle"
      dominant-baseline="middle"
      fill="#8b5cf6"
      font-size="7"
      font-family="var(--font-family-mono)"
      class="pointer-events-none select-none"
    >
      远
    </text>
  </g>
</template>

<style scoped>
.stand-slot {
  transition: all var(--transition-fast);
}

.stand-slot:hover .stand-rect {
  stroke-width: 2;
  filter: brightness(1.2);
}

.stand-selected .stand-rect {
  stroke: var(--color-accent) !important;
  stroke-width: 3 !important;
  filter: drop-shadow(0 0 10px var(--color-accent));
}

.weather-alert .stand-rect {
  animation: blink 0.5s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
