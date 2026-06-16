<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useApronStore } from '@/stores/apron';
import { useSimulation } from '@/composables/useSimulation';
import TopHeader from '@/components/TopHeader.vue';
import LeftFilter from '@/components/LeftFilter.vue';
import ApronMap from '@/components/ApronMap.vue';
import TurnaroundGantt from '@/components/TurnaroundGantt.vue';
import AlertPanel from '@/components/AlertPanel.vue';
import StatCard from '@/components/StatCard.vue';
import RoleSwitcher from '@/components/RoleSwitcher.vue';
import { formatPercent } from '@/utils/helpers';
import { Plane, Clock, AlertTriangle, BarChart3, Car, TrendingUp } from 'lucide-vue-next';

const store = useApronStore();
const { isRunning } = useSimulation();

const leftCollapsed = computed(() => store.layoutConfig.leftPanelCollapsed);
const rightCollapsed = computed(() => store.layoutConfig.rightPanelCollapsed);

const contactRate1h = computed(() => formatPercent(store.contactRate1h));
const contactRate24h = computed(() => formatPercent(store.contactRate24h));
const avgTurnaround = computed(() => store.avgTurnaroundTime.toFixed(0));
const vehicleUtil = computed(() => formatPercent(store.vehicleUtilization));
const delayedCount = computed(() => store.delayedFlightsCount);
const activeFlightsCount = computed(() => store.activeFlights.length);
const occupiedStands = computed(() => store.stands.filter(s => s.status === 'occupied' || s.status === 'in-service').length);
const totalStands = computed(() => store.stands.length);
const unackAlerts = computed(() => store.unacknowledgedAlerts.length);
const contactStands = computed(() => store.stands.filter(s => s.type === 'contact').length);
const remoteStands = computed(() => store.stands.filter(s => s.type === 'remote').length);

const currentRole = computed(() => store.currentRole);

const dashClasses = computed(() => {
  return [
    'apron-dashboard',
    {
      'left-collapsed': leftCollapsed.value,
      'right-collapsed': rightCollapsed.value,
    },
  ];
});
</script>

<template>
  <div :class="dashClasses">
    <div class="dash-header">
      <TopHeader />
    </div>

    <div class="dash-sidebar">
      <LeftFilter />
    </div>

    <main class="dash-main">
      <ApronMap />
    </main>

    <aside class="dash-right" :class="{ collapsed: rightCollapsed }">
      <div class="right-panel-inner">
        <div class="right-panel-header">
          <div class="flex items-center gap-2">
            <BarChart3 :size="18" class="text-cyan-400" />
            <span class="font-semibold text-sm">运行态势</span>
          </div>
          <RoleSwitcher />
        </div>

        <div class="right-panel-content">
          <div class="stats-section">
            <div class="section-label">
              <Plane :size="14" class="text-gray-400" />
              <span>航班概况</span>
            </div>
            <div class="stats-grid">
              <StatCard
                title="在场航班"
                :value="activeFlightsCount"
                unit="架次"
                color="#3b82f6"
                :icon="Plane"
                :trend="5.2"
                trend-label="较昨日"
              />
              <StatCard
                title="延误航班"
                :value="delayedCount"
                unit="架次"
                color="#ef4444"
                :icon="AlertTriangle"
                :trend="-2.1"
                trend-label="较昨日"
              />
              <StatCard
                title="平均过站"
                :value="avgTurnaround"
                unit="分钟"
                color="#f59e0b"
                :icon="Clock"
                :trend="-3.5"
                trend-label="优化"
              />
              <StatCard
                title="靠桥率1h"
                :value="contactRate1h"
                color="#10b981"
                :icon="TrendingUp"
                :trend="1.8"
                trend-label="提升"
              />
            </div>
          </div>

          <div class="stats-section">
            <div class="section-label">
              <BarChart3 :size="14" class="text-gray-400" />
              <span>机位统计</span>
            </div>
            <div class="stand-stats">
              <div class="stand-stat-row">
                <span class="stat-label-text">总机位</span>
                <span class="stat-value-text font-mono">{{ totalStands }}</span>
              </div>
              <div class="stand-stat-row">
                <span class="stat-label-text">近机位</span>
                <span class="stat-value-text font-mono text-cyan-400">{{ contactStands }}</span>
              </div>
              <div class="stand-stat-row">
                <span class="stat-label-text">远机位</span>
                <span class="stat-value-text font-mono text-purple-400">{{ remoteStands }}</span>
              </div>
              <div class="stand-stat-row">
                <span class="stat-label-text">占用/保障</span>
                <span class="stat-value-text font-mono text-amber-400">{{ occupiedStands }}</span>
              </div>
              <div class="stand-stat-bar">
                <div class="bar-bg">
                  <div
                    class="bar-fill"
                    :style="{ width: (occupiedStands / totalStands * 100) + '%' }"
                  />
                </div>
                <span class="bar-label font-mono">{{ Math.round(occupiedStands / totalStands * 100) }}%</span>
              </div>
            </div>
          </div>

          <div class="stats-section">
            <div class="section-label">
              <Car :size="14" class="text-gray-400" />
              <span>车辆调度</span>
            </div>
            <div class="stats-grid">
              <StatCard
                title="车辆利用率"
                :value="vehicleUtil"
                color="#06b6d4"
                :icon="Car"
                :trend="3.2"
                trend-label="较昨日"
              />
              <StatCard
                title="未处理告警"
                :value="unackAlerts"
                unit="条"
                color="#ef4444"
                :icon="AlertTriangle"
              />
            </div>
          </div>

          <div class="stats-section">
            <div class="section-label">
              <Clock :size="14" class="text-gray-400" />
              <span>24h靠桥率</span>
            </div>
            <div class="contact-rate-display">
              <span class="rate-value font-mono">{{ contactRate24h }}</span>
              <div class="rate-bar">
                <div
                  class="rate-bar-fill"
                  :style="{ width: contactRate24h }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="gantt-section">
        <TurnaroundGantt />
      </div>
    </aside>

    <div class="dash-footer">
      <AlertPanel />
    </div>

    <div v-if="!isRunning" class="simulation-overlay">
      <div class="simulation-message">
        <div class="spinner" />
        <p>模拟引擎启动中...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.apron-dashboard {
  display: grid;
  grid-template-columns: 280px 1fr 340px;
  grid-template-rows: var(--header-height) 1fr var(--footer-height);
  grid-template-areas:
    "header header header"
    "sidebar main right"
    "footer footer footer";
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--color-bg-primary);
}

.apron-dashboard.left-collapsed {
  grid-template-columns: 56px 1fr 340px;
}

.apron-dashboard.right-collapsed {
  grid-template-columns: 280px 1fr 0px;
}

.apron-dashboard.left-collapsed.right-collapsed {
  grid-template-columns: 56px 1fr 0px;
}

.dash-header {
  grid-area: header;
  overflow: hidden;
  min-height: 0;
}

.dash-sidebar {
  grid-area: sidebar;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
}

.dash-main {
  grid-area: main;
  overflow: hidden;
  position: relative;
  min-width: 0;
  min-height: 0;
  background: var(--color-bg-primary);
}

.dash-right {
  grid-area: right;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary);
  border-left: 1px solid var(--color-border);
  overflow: hidden;
  min-height: 0;
  min-width: 0;
}

.apron-dashboard.right-collapsed .dash-right {
  display: none;
}

.dash-footer {
  grid-area: footer;
  overflow: hidden;
  min-height: 0;
}

.dash-header :deep(.top-header),
.dash-sidebar :deep(.panel),
.dash-footer :deep(.alert-panel) {
  width: 100%;
  height: 100%;
}

.dash-sidebar :deep(.left-panel) {
  width: 100%;
  height: 100%;
}

.right-panel-inner {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

.right-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.right-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}

.stats-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.stand-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px;
}

.stand-stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.stat-label-text {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.stat-value-text {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.stand-stat-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.bar-bg {
  flex: 1;
  height: 8px;
  background: var(--color-bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-accent), #3b82f6);
  border-radius: 4px;
  transition: width var(--transition-base);
}

.bar-label {
  font-size: 11px;
  color: var(--color-accent);
  font-weight: 600;
  min-width: 36px;
  text-align: right;
}

.contact-rate-display {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px;
  text-align: center;
}

.rate-value {
  font-size: 48px;
  font-weight: 800;
  background: linear-gradient(135deg, #10b981, #06b6d4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.1;
}

.rate-bar {
  height: 10px;
  background: var(--color-bg-tertiary);
  border-radius: 5px;
  overflow: hidden;
  margin-top: 12px;
}

.rate-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #06b6d4);
  border-radius: 5px;
  transition: width var(--transition-base);
}

.gantt-section {
  flex-shrink: 0;
  border-top: 1px solid var(--color-border);
  max-height: 40%;
  min-height: 200px;
}

.simulation-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 22, 40, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.simulation-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: var(--color-text-secondary);
  font-size: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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

.text-gray-400 {
  color: #94a3b8;
}

.text-cyan-400 {
  color: #22d3ee;
}

.text-purple-400 {
  color: #c084fc;
}

.text-amber-400 {
  color: #fbbf24;
}

@media (max-width: 1919px) {
  .apron-dashboard,
  .apron-dashboard.left-collapsed,
  .apron-dashboard.right-collapsed,
  .apron-dashboard.left-collapsed.right-collapsed {
    grid-template-columns: 240px 1fr;
    grid-template-areas:
      "header header"
      "sidebar main"
      "footer footer";
  }

  .dash-right {
    display: none !important;
  }
}

@media (max-width: 1279px) {
  .apron-dashboard,
  .apron-dashboard.left-collapsed,
  .apron-dashboard.right-collapsed,
  .apron-dashboard.left-collapsed.right-collapsed {
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "main"
      "footer";
  }

  .dash-sidebar,
  .dash-right {
    display: none !important;
  }
}
</style>
