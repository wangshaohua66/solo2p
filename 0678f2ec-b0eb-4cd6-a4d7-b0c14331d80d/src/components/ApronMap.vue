<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue';
import { useApronStore } from '@/stores/apron';
import { useApronMap } from '@/composables/useApronMap';
import StandSlot from './StandSlot.vue';
import VehicleMarker from './VehicleMarker.vue';
import WeatherOverlay from './WeatherOverlay.vue';
import FlightDetailModal from './FlightDetailModal.vue';
import { SVG_VIEWBOX, TERMINAL_NAMES } from '@/utils/constants';
import { TERMINAL_BUILDINGS, getVehiclePoolArea, getFuelDepotArea, getServiceArea } from '@/utils/standLayout';
import { ZoomIn, ZoomOut, Maximize, Crosshair, LocateFixed } from 'lucide-vue-next';

const store = useApronStore();
const {
  transform,
  handleStandClick,
  centerOnStand,
  resetView,
  zoomIn,
  zoomOut,
  setupSvgHandlers,
  cleanupSvgHandlers,
} = useApronMap();

const svgRef = ref<SVGSVGElement | null>(null);
const vehiclePool = getVehiclePoolArea();
const fuelDepot = getFuelDepotArea();
const serviceArea = getServiceArea();

const visibleStands = computed(() => store.filteredStands);

const showFlightModal = computed(() => !!store.selectedFlightId);

const handleVehicleClick = (vehicleId: string) => {
  const vehicle = store.vehicles.find(v => v.id === vehicleId);
  if (vehicle?.currentTask) {
    const flight = store.flightById(vehicle.currentTask);
    if (flight) {
      store.setSelectedStand(flight.standId);
      centerOnStand(flight.standId);
    }
  }
};

const handleCenterSelected = () => {
  if (store.selectedStandId) {
    centerOnStand(store.selectedStandId);
  }
};

onMounted(() => {
  if (svgRef.value) {
    setupSvgHandlers(svgRef.value);
  }
});

onUnmounted(() => {
  cleanupSvgHandlers();
});
</script>

<template>
  <div class="apron-map-container">
    <div class="map-toolbar">
      <div class="toolbar-group">
        <button class="toolbar-btn" @click="zoomIn" title="放大">
          <ZoomIn :size="18" />
        </button>
        <button class="toolbar-btn" @click="zoomOut" title="缩小">
          <ZoomOut :size="18" />
        </button>
        <button class="toolbar-btn" @click="resetView" title="重置视图">
          <Maximize :size="18" />
        </button>
        <div class="toolbar-divider" />
        <button
          class="toolbar-btn"
          :class="{ disabled: !store.selectedStandId }"
          @click="handleCenterSelected"
          title="定位选中机位"
        >
          <Crosshair :size="18" />
        </button>
      </div>

      <div class="zoom-indicator font-mono text-xs">
        {{ Math.round(store.layoutConfig.zoom * 100) }}%
      </div>
    </div>

    <svg
      ref="svgRef"
      class="apron-svg"
      :viewBox="`0 0 ${SVG_VIEWBOX.width} ${SVG_VIEWBOX.height}`"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="50%" stop-color="#0c1222" />
          <stop offset="100%" stop-color="#0a0f1c" />
        </linearGradient>

        <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(71, 85, 105, 0.2)" stroke-width="0.5" />
        </pattern>

        <filter id="terminalShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000" flood-opacity="0.5" />
        </filter>

        <linearGradient id="terminalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#334155" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>

        <linearGradient id="vehiclePoolGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="rgba(6, 182, 212, 0.1)" />
          <stop offset="100%" stop-color="rgba(6, 182, 212, 0.02)" />
        </linearGradient>
      </defs>

      <rect
        x="0"
        y="0"
        :width="SVG_VIEWBOX.width"
        :height="SVG_VIEWBOX.height"
        fill="url(#bgGradient)"
      />

      <rect
        x="0"
        y="0"
        :width="SVG_VIEWBOX.width"
        :height="SVG_VIEWBOX.height"
        fill="url(#gridPattern)"
      />

      <g :transform="transform">
        <g class="service-areas">
          <rect
            :x="vehiclePool.x"
            :y="vehiclePool.y"
            :width="vehiclePool.width"
            :height="vehiclePool.height"
            rx="8"
            fill="url(#vehiclePoolGradient)"
            stroke="rgba(6, 182, 212, 0.3)"
            stroke-width="1.5"
            stroke-dasharray="6 4"
          />
          <text
            :x="vehiclePool.x + vehiclePool.width / 2"
            :y="vehiclePool.y + 24"
            text-anchor="middle"
            fill="#06b6d4"
            font-size="12"
            font-weight="600"
            opacity="0.7"
          >
            车辆调度池
          </text>
          <text
            :x="vehiclePool.x + vehiclePool.width / 2"
            :y="vehiclePool.y + 42"
            text-anchor="middle"
            fill="rgba(6, 182, 212, 0.5)"
            font-size="10"
            font-family="JetBrains Mono, monospace"
          >
            {{ store.vehicles.length }} 辆车
          </text>

          <rect
            :x="fuelDepot.x"
            :y="fuelDepot.y"
            :width="fuelDepot.width"
            :height="fuelDepot.height"
            rx="6"
            fill="rgba(234, 179, 8, 0.1)"
            stroke="rgba(234, 179, 8, 0.3)"
            stroke-width="1.5"
            stroke-dasharray="6 4"
          />
          <text
            :x="fuelDepot.x + fuelDepot.width / 2"
            :y="fuelDepot.y + fuelDepot.height / 2 + 4"
            text-anchor="middle"
            fill="#eab308"
            font-size="11"
            font-weight="600"
            opacity="0.7"
          >
            油库
          </text>

          <rect
            :x="serviceArea.x"
            :y="serviceArea.y"
            :width="serviceArea.width"
            :height="serviceArea.height"
            rx="6"
            fill="rgba(139, 92, 246, 0.1)"
            stroke="rgba(139, 92, 246, 0.3)"
            stroke-width="1.5"
            stroke-dasharray="6 4"
          />
          <text
            :x="serviceArea.x + serviceArea.width / 2"
            :y="serviceArea.y + 24"
            text-anchor="middle"
            fill="#8b5cf6"
            font-size="12"
            font-weight="600"
            opacity="0.7"
          >
            综合服务区
          </text>
          <text
            :x="serviceArea.x + serviceArea.width / 2"
            :y="serviceArea.y + 44"
            text-anchor="middle"
            fill="rgba(139, 92, 246, 0.5)"
            font-size="9"
          >
            餐饮·清洁·设备
          </text>
        </g>

        <g class="terminal-buildings">
          <g
            v-for="terminal in TERMINAL_BUILDINGS"
            :key="terminal.terminal"
            filter="url(#terminalShadow)"
          >
            <rect
              :x="terminal.position.x"
              :y="terminal.position.y"
              :width="terminal.position.width"
              :height="terminal.position.height"
              rx="10"
              fill="url(#terminalGradient)"
              stroke="rgba(148, 163, 184, 0.3)"
              stroke-width="1"
            />
            <g
              v-for="i in Math.floor(terminal.position.width / 30)"
              :key="i"
            >
              <rect
                :x="terminal.position.x + 10 + (i - 1) * 30"
                :y="terminal.position.y + 15"
                width="20"
                height="30"
                rx="2"
                fill="rgba(6, 182, 212, 0.15)"
                stroke="rgba(6, 182, 212, 0.3)"
                stroke-width="0.5"
              />
              <rect
                :x="terminal.position.x + 10 + (i - 1) * 30"
                :y="terminal.position.y + terminal.position.height - 45"
                width="20"
                height="30"
                rx="2"
                fill="rgba(6, 182, 212, 0.15)"
                stroke="rgba(6, 182, 212, 0.3)"
                stroke-width="0.5"
              />
            </g>
            <rect
              :x="terminal.position.x + 20"
              :y="terminal.position.y + terminal.position.height / 2 - 15"
              :width="terminal.position.width - 40"
              height="30"
              rx="4"
              fill="rgba(6, 182, 212, 0.08)"
            />
            <text
              :x="terminal.position.x + terminal.position.width / 2"
              :y="terminal.position.y + terminal.position.height / 2 + 6"
              text-anchor="middle"
              fill="#94a3b8"
              font-size="20"
              font-weight="700"
              letter-spacing="4"
            >
              {{ TERMINAL_NAMES[terminal.terminal] }}
            </text>
          </g>
        </g>

        <g class="stands-layer">
          <StandSlot
            v-for="stand in visibleStands"
            :key="stand.id"
            :stand="stand"
            :selected="stand.id === store.selectedStandId"
            @click="handleStandClick"
          />
        </g>

        <g class="vehicles-layer">
          <VehicleMarker
            v-for="vehicle in store.vehicles"
            :key="vehicle.id"
            :vehicle="vehicle"
            :show-trail="vehicle.status === 'moving'"
            @click="handleVehicleClick"
          />
        </g>

        <WeatherOverlay
          :weather="store.weather"
          :stands="store.stands"
          :visible="store.layoutConfig.weatherOverlayVisible"
        />
      </g>
    </svg>

    <div class="map-legend">
      <div class="legend-title">图例</div>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-color" style="background: #10b981"></span>
          <span>空闲机位</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #3b82f6"></span>
          <span>占用机位</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #f59e0b"></span>
          <span>保障中</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #ef4444"></span>
          <span>故障/告警</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #8b5cf6; border: 1px solid #8b5cf6"></span>
          <span>远机位</span>
        </div>
      </div>
    </div>

    <FlightDetailModal
      :flight="store.selectedFlight"
      :stand="store.selectedStand"
      :visible="showFlightModal"
      @close="store.setSelectedStand(null); store.setSelectedFlight(null)"
    />
  </div>
</template>

<style scoped>
.apron-map-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--color-bg-primary);
  overflow: hidden;
  grid-area: main;
}

.apron-svg {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
  user-select: none;
}

.apron-svg:active {
  cursor: grabbing;
}

.apron-svg :deep(g) {
  transform-box: fill-box;
}

.map-toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(8px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 8px;
  box-shadow: var(--shadow-md);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.toolbar-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.toolbar-btn:active {
  transform: scale(0.95);
}

.toolbar-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--color-border);
  margin: 0 4px;
}

.zoom-indicator {
  padding: 6px 10px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  color: var(--color-accent);
  font-weight: 600;
  min-width: 52px;
  text-align: center;
}

.map-legend {
  position: absolute;
  bottom: 16px;
  left: 16px;
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(8px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 12px 16px;
  z-index: 10;
  box-shadow: var(--shadow-md);
}

.legend-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 10px;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.legend-color {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}

.font-mono {
  font-family: var(--font-family-mono);
}

.text-xs {
  font-size: 0.75rem;
}
</style>
