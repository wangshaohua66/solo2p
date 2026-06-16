<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useApronStore } from '@/stores/apron';
import { useSimulation } from '@/composables/useSimulation';
import { usePerformance } from '@/composables/usePerformance';
import TopHeader from '@/components/TopHeader.vue';
import LeftFilter from '@/components/LeftFilter.vue';
import ApronMap from '@/components/ApronMap.vue';
import TurnaroundGantt from '@/components/TurnaroundGantt.vue';
import AlertPanel from '@/components/AlertPanel.vue';
import RoleSwitcher from '@/components/RoleSwitcher.vue';
import FlightStatsChart from '@/components/FlightStatsChart.vue';
import VehicleDispatchChart from '@/components/VehicleDispatchChart.vue';
import AlertTrendChart from '@/components/AlertTrendChart.vue';
import PerformancePanel from '@/components/PerformancePanel.vue';
import { formatPercent, formatBeijingTime } from '@/utils/helpers';
import { Plane, Clock, AlertTriangle, BarChart3, Car, TrendingUp, MapPin, Users, Gauge, Activity, LayoutDashboard, Layers } from 'lucide-vue-next';

const store = useApronStore();
const { isRunning } = useSimulation();
usePerformance();

const leftCollapsed = computed(() => store.layoutConfig.leftPanelCollapsed);
const rightCollapsed = computed(() => store.layoutConfig.rightPanelCollapsed);
const ganttCollapsed = computed(() => store.layoutConfig.ganttCollapsed);
const currentRole = computed(() => store.currentRole);

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
const activeVehicles = computed(() => store.vehicles.filter(v => v.status !== 'idle').length);
const totalVehicles = computed(() => store.vehicles.length);

const roleConfig = computed(() => store.roleConfig);

const statCardsForRole = computed(() => {
  const role = currentRole.value;

  const common = [
    {
      title: '在场航班',
      value: activeFlightsCount.value,
      unit: '架次',
      color: '#3b82f6',
      icon: Plane,
      key: 'flights',
    },
    {
      title: '延误航班',
      value: delayedCount.value,
      unit: '架次',
      color: '#ef4444',
      icon: AlertTriangle,
      key: 'delayed',
    },
  ];

  if (role === 'dispatcher') {
    return [
      ...common,
      {
        title: '平均过站',
        value: avgTurnaround.value,
        unit: '分钟',
        color: '#f59e0b',
        icon: Clock,
        key: 'turnaround',
      },
      {
        title: '靠桥率1h',
        value: contactRate1h.value,
        color: '#10b981',
        icon: TrendingUp,
        key: 'contactRate',
      },
      {
        title: '占用机位',
        value: occupiedStands.value,
        unit: '个',
        color: '#06b6d4',
        icon: MapPin,
        key: 'stands',
      },
      {
        title: '活动车辆',
        value: activeVehicles.value,
        unit: '辆',
        color: '#8b5cf6',
        icon: Car,
        key: 'vehicles',
      },
    ];
  }

  if (role === 'ground-crew') {
    return [
      {
        title: '活动车辆',
        value: activeVehicles.value,
        unit: '辆',
        color: '#06b6d4',
        icon: Car,
        key: 'vehicles',
      },
      {
        title: '车辆利用率',
        value: vehicleUtil.value,
        color: '#10b981',
        icon: Gauge,
        key: 'utilization',
      },
      ...common,
    ];
  }

  if (role === 'supervisor') {
    return [
      ...common,
      {
        title: '平均过站',
        value: avgTurnaround.value,
        unit: '分钟',
        color: '#f59e0b',
        icon: Clock,
        key: 'turnaround',
      },
      {
        title: '靠桥率1h',
        value: contactRate1h.value,
        color: '#10b981',
        icon: TrendingUp,
        key: 'contactRate',
      },
      {
        title: '靠桥率24h',
        value: contactRate24h.value,
        color: '#06b6d4',
        icon: TrendingUp,
        key: 'contactRate24h',
      },
      {
        title: '未处理告警',
        value: unackAlerts.value,
        unit: '条',
        color: '#ef4444',
        icon: AlertTriangle,
        key: 'alerts',
      },
      {
        title: '占用机位',
        value: occupiedStands.value,
        unit: '个',
        color: '#8b5cf6',
        icon: MapPin,
        key: 'stands',
      },
      {
        title: '车辆利用率',
        value: vehicleUtil.value,
        color: '#14b8a6',
        icon: Gauge,
        key: 'utilization',
      },
    ];
  }

  return common;
});

const dashClasses = computed(() => {
  return [
    'apron-dashboard',
    `role-${currentRole.value}`,
    {
      'left-collapsed': leftCollapsed.value,
      'right-collapsed': rightCollapsed.value,
      'gantt-collapsed': ganttCollapsed.value,
    },
  ];
});

const roleIcon = computed(() => {
  switch (currentRole.value) {
    case 'dispatcher': return Layers;
    case 'ground-crew': return Users;
    case 'supervisor': return LayoutDashboard;
    default: return Activity;
  }
});

const roleName = computed(() => {
  switch (currentRole.value) {
    case 'dispatcher': return '机坪调度员';
    case 'ground-crew': return '地勤队长';
    case 'supervisor': return '运行主管';
    default: return '';
  }
});

const toggleGantt = () => {
  store.setLayoutConfig({ ganttCollapsed: !ganttCollapsed.value });
};

onMounted(() => {
  store.updateFlightHistory();
  store.updateAlertHistory();
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
      <template v-if="currentRole === 'dispatcher'">
        <div class="main-content-dispatcher">
          <div class="map-area">
            <ApronMap />
          </div>
          <div v-if="!ganttCollapsed" class="gantt-area">
            <div class="gantt-header-bar">
              <span class="gantt-title">航班过站甘特图</span>
              <button class="gantt-toggle-btn" @click="toggleGantt">
                收起
              </button>
            </div>
            <TurnaroundGantt />
          </div>
          <div v-else class="gantt-collapsed-bar" @click="toggleGantt">
            <span>展开甘特图</span>
          </div>
        </div>
      </template>

      <template v-else-if="currentRole === 'ground-crew'">
        <div class="main-content-ground-crew">
          <div class="map-area-full">
            <ApronMap />
          </div>
        </div>
      </template>

      <template v-else-if="currentRole === 'supervisor'">
        <div class="main-content-supervisor">
          <div class="stats-cards-row">
            <div
              v-for="card in statCardsForRole"
              :key="card.key"
              class="big-stat-card"
              :style="{ '--card-color': card.color }"
            >
              <div class="big-stat-icon">
                <component :is="card.icon" :size="24" />
              </div>
              <div class="big-stat-info">
                <span class="big-stat-title">{{ card.title }}</span>
                <span class="big-stat-value">
                  {{ card.value }}<span v-if="card.unit" class="big-stat-unit">{{ card.unit }}</span>
                </span>
              </div>
            </div>
          </div>
          <div class="supervisor-charts-row">
            <FlightStatsChart height="280px" />
            <VehicleDispatchChart height="280px" />
            <AlertTrendChart height="280px" />
          </div>
          <div class="map-area-supervisor">
            <ApronMap />
          </div>
        </div>
      </template>
    </main>

    <aside class="dash-right" :class="{ collapsed: rightCollapsed }">
      <div class="right-panel-inner">
        <div class="right-panel-header">
          <div class="panel-header-left">
            <component :is="roleIcon" :size="18" class="text-cyan-400" />
            <span class="font-semibold text-sm">{{ roleName }}视图</span>
            <span class="current-time font-mono text-xs text-gray-400">
              {{ formatBeijingTime(Date.now(), 'MM-DD HH:mm:ss') }}
            </span>
          </div>
          <RoleSwitcher />
        </div>

        <div class="right-panel-content">
          <template v-if="currentRole === 'dispatcher'">
            <div class="right-section">
              <div class="section-label">
                <BarChart3 :size="14" class="text-gray-400" />
                <span>航班统计趋势</span>
              </div>
              <FlightStatsChart height="220px" />
            </div>

            <div class="right-section">
              <div class="section-label">
                <Car :size="14" class="text-gray-400" />
                <span>车辆调度分布</span>
              </div>
              <VehicleDispatchChart height="220px" />
            </div>

            <div class="right-section">
              <div class="section-label">
                <AlertTriangle :size="14" class="text-gray-400" />
                <span>告警趋势</span>
              </div>
              <AlertTrendChart height="220px" />
            </div>

            <PerformancePanel />

            <div class="right-section">
              <div class="section-label">
                <MapPin :size="14" class="text-gray-400" />
                <span>机位使用</span>
              </div>
              <div class="stand-stats-mini">
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
                <div class="stand-stat-bar">
                  <div class="bar-bg">
                    <div class="bar-fill" :style="{ width: (occupiedStands / totalStands * 100) + '%' }" />
                  </div>
                  <span class="bar-label font-mono">{{ Math.round(occupiedStands / totalStands * 100) }}%</span>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="currentRole === 'ground-crew'">
            <div class="right-section">
              <div class="section-label">
                <Car :size="14" class="text-gray-400" />
                <span>车辆调度分布</span>
              </div>
              <VehicleDispatchChart height="260px" />
            </div>

            <div class="right-section">
              <div class="section-label">
                <BarChart3 :size="14" class="text-gray-400" />
                <span>车辆任务概览</span>
              </div>
              <div class="vehicle-task-stats">
                <div class="task-stat-item">
                  <span class="task-label">总车辆</span>
                  <span class="task-value font-mono">{{ totalVehicles }}</span>
                </div>
                <div class="task-stat-item">
                  <span class="task-label">任务中</span>
                  <span class="task-value font-mono text-cyan-400">{{ activeVehicles }}</span>
                </div>
                <div class="task-stat-item">
                  <span class="task-label">利用率</span>
                  <span class="task-value font-mono text-green-400">{{ vehicleUtil }}</span>
                </div>
                <div class="task-stat-item">
                  <span class="task-label">待处理</span>
                  <span class="task-value font-mono text-amber-400">{{ totalVehicles - activeVehicles }}</span>
                </div>
              </div>
            </div>

            <div class="right-section">
              <div class="section-label">
                <AlertTriangle :size="14" class="text-gray-400" />
                <span>告警趋势</span>
              </div>
              <AlertTrendChart height="200px" />
            </div>

            <PerformancePanel />
          </template>

          <template v-else-if="currentRole === 'supervisor'">
            <PerformancePanel />

            <div class="right-section">
              <div class="section-label">
                <TrendingUp :size="14" class="text-gray-400" />
                <span>关键指标</span>
              </div>
              <div class="kpi-list">
                <div class="kpi-item">
                  <span class="kpi-label">24h靠桥率</span>
                  <span class="kpi-value font-mono text-green-400">{{ contactRate24h }}</span>
                </div>
                <div class="kpi-item">
                  <span class="kpi-label">平均过站时间</span>
                  <span class="kpi-value font-mono">{{ avgTurnaround }} <small>分钟</small></span>
                </div>
                <div class="kpi-item">
                  <span class="kpi-label">车辆利用率</span>
                  <span class="kpi-value font-mono text-cyan-400">{{ vehicleUtil }}</span>
                </div>
                <div class="kpi-item">
                  <span class="kpi-label">未处理告警</span>
                  <span class="kpi-value font-mono text-red-400">{{ unackAlerts }}</span>
                </div>
              </div>
            </div>

            <div class="right-section">
              <div class="section-label">
                <MapPin :size="14" class="text-gray-400" />
                <span>机位使用</span>
              </div>
              <div class="stand-stats-mini">
                <div class="stand-stat-row">
                  <span class="stat-label-text">使用中</span>
                  <span class="stat-value-text font-mono">{{ occupiedStands }} / {{ totalStands }}</span>
                </div>
                <div class="stand-stat-bar">
                  <div class="bar-bg">
                    <div class="bar-fill" :style="{ width: (occupiedStands / totalStands * 100) + '%' }" />
                  </div>
                  <span class="bar-label font-mono">{{ Math.round(occupiedStands / totalStands * 100) }}%</span>
                </div>
              </div>
            </div>
          </template>
        </div>
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

.apron-dashboard.gantt-collapsed .gantt-area {
  display: none;
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

.main-content-dispatcher {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.map-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.map-area-full {
  height: 100%;
  width: 100%;
}

.gantt-area {
  flex-shrink: 0;
  height: 42%;
  min-height: 220px;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary);
}

.gantt-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.gantt-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.gantt-toggle-btn {
  font-size: 11px;
  padding: 2px 10px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.gantt-toggle-btn:hover {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.gantt-collapsed-bar {
  flex-shrink: 0;
  padding: 8px 16px;
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.gantt-collapsed-bar:hover {
  background: rgba(34, 211, 238, 0.1);
  color: var(--color-accent);
}

.main-content-ground-crew {
  height: 100%;
  width: 100%;
}

.main-content-supervisor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 12px;
  min-height: 0;
  overflow-y: auto;
}

.stats-cards-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  flex-shrink: 0;
}

.big-stat-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}

.big-stat-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--card-color);
}

.big-stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  border-color: var(--card-color);
}

.big-stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--card-color) 15%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--card-color);
  flex-shrink: 0;
}

.big-stat-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.big-stat-title {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.big-stat-value {
  font-size: 28px;
  font-weight: 800;
  color: var(--card-color);
  font-family: var(--font-family-mono);
  line-height: 1.1;
}

.big-stat-unit {
  font-size: 14px;
  font-weight: 600;
  margin-left: 2px;
  opacity: 0.7;
}

.supervisor-charts-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 12px;
  flex-shrink: 0;
}

.map-area-supervisor {
  flex: 1;
  min-height: 300px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-bg-card);
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

.panel-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.current-time {
  margin-left: 8px;
  padding-left: 8px;
  border-left: 1px solid var(--color-border);
}

.right-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.right-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
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

.stand-stats-mini {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stand-stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 0;
}

.stat-label-text {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.stat-value-text {
  font-size: 15px;
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
  height: 6px;
  background: var(--color-bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-accent), #3b82f6);
  border-radius: 3px;
  transition: width var(--transition-base);
}

.bar-label {
  font-size: 10px;
  color: var(--color-accent);
  font-weight: 600;
  min-width: 32px;
  text-align: right;
}

.vehicle-task-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 14px;
}

.task-stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: rgba(15, 23, 42, 0.6);
  border-radius: var(--radius-md);
  text-align: center;
}

.task-label {
  font-size: 11px;
  color: var(--color-text-muted);
}

.task-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.kpi-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px;
}

.kpi-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
}

.kpi-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.kpi-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.kpi-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.kpi-value small {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted);
  margin-left: 2px;
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

.gap-8 {
  gap: 2rem;
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

.text-amber-400 {
  color: #fbbf24;
}

.text-green-400 {
  color: #4ade80;
}

.text-red-400 {
  color: #f87171;
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
