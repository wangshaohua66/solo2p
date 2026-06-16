<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Weather, Stand } from '@/types/apron';
import { SVG_VIEWBOX } from '@/utils/constants';
import { getWindDirectionLabel } from '@/utils/helpers';

interface Props {
  weather: Weather | null;
  stands: Stand[];
  visible: boolean;
}

const props = defineProps<Props>();

const windParticles = ref<Array<{ x: number; y: number; vx: number; vy: number; alpha: number }>>([]);

const visibilityColor = computed(() => {
  if (!props.weather) return 'transparent';
  const { visibility } = props.weather;
  if (visibility < 1000) return 'rgba(200, 200, 200, 0.4)';
  if (visibility < 2000) return 'rgba(200, 200, 200, 0.2)';
  if (visibility < 3000) return 'rgba(200, 200, 200, 0.1)';
  return 'transparent';
});

const windArrowRotation = computed(() => {
  return props.weather ? props.weather.windDirection : 0;
});

const windStrength = computed(() => {
  if (!props.weather) return 0;
  return Math.min(1, props.weather.windSpeed / 30);
});

const windSpeedLabel = computed(() => {
  if (!props.weather) return '';
  return `${props.weather.windSpeed.toFixed(0)}节 ${getWindDirectionLabel(props.weather.windDirection)}`;
});

const visibilityLabel = computed(() => {
  if (!props.weather) return '';
  return `${props.weather.visibility}米`;
});

const tempLabel = computed(() => {
  if (!props.weather) return '';
  return `${props.weather.temperature.toFixed(0)}°C`;
});

const alertStands = computed(() => {
  return props.stands.filter(s => s.weatherAlert);
});
</script>

<template>
  <g v-if="visible" class="weather-overlay">
    <defs>
      <pattern id="fogPattern" patternUnits="userSpaceOnUse" width="40" height="40">
        <rect width="40" height="40" :fill="visibilityColor" />
        <circle cx="10" cy="10" r="8" fill="rgba(255,255,255,0.1)" />
        <circle cx="30" cy="30" r="6" fill="rgba(255,255,255,0.08)" />
      </pattern>

      <linearGradient id="visibilityGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#ef4444" />
        <stop offset="33%" stop-color="#f59e0b" />
        <stop offset="66%" stop-color="#06b6d4" />
        <stop offset="100%" stop-color="#10b981" />
      </linearGradient>

      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <rect
      x="0"
      y="0"
      :width="SVG_VIEWBOX.width"
      :height="SVG_VIEWBOX.height"
      fill="url(#fogPattern)"
      class="pointer-events-none"
    />

    <g v-for="stand in alertStands" :key="stand.id" class="weather-alert-stand">
      <rect
        :x="stand.position.x - 4"
        :y="stand.position.y - 4"
        :width="stand.position.width + 8"
        :height="stand.position.height + 8"
        rx="4"
        fill="none"
        stroke="#ef4444"
        stroke-width="2"
        stroke-dasharray="4 4"
        class="animate-blink"
      />
    </g>

    <g class="wind-arrows pointer-events-none" :opacity="windStrength">
      <g
        v-for="i in 20"
        :key="i"
        :transform="`translate(${(i % 5) * 400 + 100}, ${Math.floor(i / 5) * 250 + 100})`"
      >
        <g :transform="`rotate(${windArrowRotation})`">
          <line
            x1="0"
            y1="0"
            :x2="30 + windStrength * 30"
            y2="0"
            stroke="#06b6d4"
            stroke-width="2"
            opacity="0.5"
          />
          <polygon
            :points="`${30 + windStrength * 30},0 ${20 + windStrength * 30},-5 ${20 + windStrength * 30},5`"
            fill="#06b6d4"
            opacity="0.7"
          />
        </g>
      </g>
    </g>

    <g
      class="weather-info-panel"
      :transform="`translate(${SVG_VIEWBOX.width - 220}, 20)`"
    >
      <rect
        x="0"
        y="0"
        width="200"
        height="130"
        rx="8"
        fill="rgba(19, 31, 56, 0.95)"
        stroke="var(--color-border)"
        stroke-width="1"
      />

      <text x="16" y="30" fill="var(--color-text-secondary)" font-size="11" text-transform="uppercase">
        气象信息
      </text>

      <g transform="translate(16, 50)">
        <circle cx="15" cy="15" r="15" fill="rgba(6, 182, 212, 0.2)" />
        <g :transform="`rotate(${windArrowRotation}, 15, 15)`">
          <polygon points="15,2 10,28 15,22 20,28" fill="#06b6d4" />
        </g>
        <text x="40" y="20" fill="var(--color-text-primary)" font-size="14" font-weight="600" class="font-mono">
          {{ windSpeedLabel }}
        </text>
      </g>

      <g transform="translate(16, 85)">
        <rect x="0" y="0" width="15" height="15" rx="3" fill="rgba(148, 163, 184, 0.3)" />
        <text x="4" y="12" fill="#94a3b8" font-size="10" font-weight="600">V</text>
        <text x="25" y="12" fill="var(--color-text-primary)" font-size="13" class="font-mono">
          {{ visibilityLabel }}
        </text>
      </g>

      <g transform="translate(100, 85)">
        <rect x="0" y="0" width="15" height="15" rx="3" fill="rgba(239, 68, 68, 0.2)" />
        <text x="4" y="12" fill="#ef4444" font-size="10" font-weight="600">T</text>
        <text x="25" y="12" fill="var(--color-text-primary)" font-size="13" class="font-mono">
          {{ tempLabel }}
        </text>
      </g>

      <g transform="translate(16, 110)">
        <rect x="0" y="0" width="168" height="6" rx="3" fill="url(#visibilityGradient)" />
        <text x="0" y="22" fill="var(--color-text-muted)" font-size="9">低</text>
        <text x="160" y="22" fill="var(--color-text-muted)" font-size="9" text-anchor="end">高</text>
      </g>
    </g>
  </g>
</template>

<style scoped>
.weather-overlay {
  pointer-events: none;
}

.animate-blink {
  animation: blink 0.5s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.font-mono {
  font-family: var(--font-family-mono);
}

.pointer-events-none {
  pointer-events: none;
}
</style>
