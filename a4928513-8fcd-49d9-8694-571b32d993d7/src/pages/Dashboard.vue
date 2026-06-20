<template>
  <div class="dashboard-page">
    <div class="stats-row">
      <StatCard
        title="今日登记"
        :value="mockData.today.remainsCount"
        icon="Document"
        :trend="8.5"
      />
      <StatCard
        title="待接运"
        :value="mockData.today.pickupMissions"
        icon="Van"
        :trend="-2"
      />
      <StatCard
        title="预约告别"
        :value="mockData.today.bookings"
        icon="Calendar"
        trend-text="今日 9 场"
      />
      <StatCard
        title="今日营收"
        :value="formatMoney(mockData.today.revenue)"
        icon="Money"
        :trend="12.3"
      />
    </div>

    <div class="content-grid">
      <div class="left-column">
        <div class="panel">
          <div class="panel-header">
            <h3 class="panel-title">
              <el-icon><List /></el-icon>
              待办任务
            </h3>
            <span class="panel-badge">{{ mockData.pendingTasks.length }}</span>
          </div>
          <div class="panel-body">
            <div class="task-list">
              <div
                v-for="task in sortedTasks"
                :key="task.id"
                class="task-item"
                :class="task.priority"
              >
                <div class="task-priority-dot"></div>
                <div class="task-content">
                  <div class="task-top">
                    <span class="task-type">{{ task.type }}</span>
                    <span class="task-time">{{ task.createTime }}</span>
                  </div>
                  <div class="task-desc">{{ task.content }}</div>
                </div>
                <el-button size="small" type="primary" text>处理</el-button>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <h3 class="panel-title">
              <el-icon><TrendCharts /></el-icon>
              最近操作动态
            </h3>
          </div>
          <div class="panel-body">
            <div class="activity-timeline">
              <div
                v-for="(activity, idx) in mockData.recentActivities"
                :key="activity.id"
                class="activity-item"
              >
                <div class="activity-node">
                  <span class="activity-dot"></span>
                  <span v-if="idx < mockData.recentActivities.length - 1" class="activity-line"></span>
                </div>
                <div class="activity-content">
                  <div class="activity-top">
                    <span class="activity-operator">{{ activity.operator }}</span>
                    <span class="activity-action">{{ activity.action }}</span>
                  </div>
                  <div class="activity-target">{{ activity.target }}</div>
                  <div class="activity-time">{{ activity.time }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="right-column">
        <div class="panel">
          <div class="panel-header">
            <h3 class="panel-title">
              <el-icon><MapLocation /></el-icon>
              接运车辆监控
            </h3>
            <el-button size="small" text type="primary">调度中心</el-button>
          </div>
          <div class="panel-body">
            <div class="vehicle-map">
              <svg viewBox="0 0 400 260" class="map-svg" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#3A3A44" stroke-width="0.5" opacity="0.5"/>
                  </pattern>
                  <linearGradient id="mainRoad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#4a4a55;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#3a3a44;stop-opacity:1" />
                  </linearGradient>
                  <radialGradient id="funeralHome" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" style="stop-color:#C9A86C;stop-opacity:0.4" />
                    <stop offset="100%" style="stop-color:#C9A86C;stop-opacity:0.05" />
                  </radialGradient>
                </defs>
                <rect width="400" height="260" fill="url(#grid)"/>
                <path d="M 0 130 L 400 130" stroke="url(#mainRoad)" stroke-width="8" stroke-linecap="round"/>
                <path d="M 200 0 L 200 260" stroke="url(#mainRoad)" stroke-width="8" stroke-linecap="round"/>
                <path d="M 60 50 L 340 210" stroke="#3a3a44" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
                <path d="M 340 50 L 60 210" stroke="#3a3a44" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
                <circle cx="200" cy="130" r="45" fill="url(#funeralHome)"/>
                <g transform="translate(200, 130)">
                  <rect x="-18" y="-12" width="36" height="24" rx="3" fill="#2E2E36" stroke="#C9A86C" stroke-width="1.5"/>
                  <path d="M -10 -12 L -10 -22 L 10 -22 L 10 -12" fill="#2E2E36" stroke="#C9A86C" stroke-width="1.5"/>
                  <text x="0" y="4" text-anchor="middle" fill="#C9A86C" font-size="9" font-weight="600">殡仪馆</text>
                </g>
                <g
                  v-for="(v, i) in displayVehicles"
                  :key="v.id"
                  :transform="`translate(${v.x}, ${v.y})`"
                  class="vehicle-marker"
                  :class="{ 'on-mission': v.onMission, 'idle': !v.onMission }"
                >
                  <circle r="14" :fill="v.onMission ? 'rgba(24, 144, 255, 0.2)' : 'rgba(82, 196, 26, 0.2)'" class="vehicle-pulse"/>
                  <circle r="9" :fill="v.onMission ? '#1890FF' : '#52C41A'" stroke="#fff" stroke-width="1.5"/>
                  <text y="-18" text-anchor="middle" fill="#fff" font-size="10" font-weight="500">{{ v.plate }}</text>
                  <text y="3" text-anchor="middle" fill="#fff" font-size="8">{{ v.onMission ? '🚚' : '🅿' }}</text>
                </g>
              </svg>
              <div class="map-legend">
                <span class="legend-item">
                  <span class="legend-dot idle"></span>
                  空闲 ({{ idleCount }})
                </span>
                <span class="legend-item">
                  <span class="legend-dot mission"></span>
                  执行中 ({{ missionCount }})
                </span>
                <span class="legend-item">
                  <span class="legend-icon">🏛</span>
                  殡仪馆
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <h3 class="panel-title">
              <el-icon><Bell /></el-icon>
              预警提示
            </h3>
          </div>
          <div class="panel-body">
            <div class="alert-list">
              <div
                v-for="alert in mockData.alerts"
                :key="alert.id"
                class="alert-item"
                :class="alert.level"
              >
                <el-icon class="alert-icon">
                  <WarningFilled v-if="alert.level === 'error'" />
                  <Warning v-else-if="alert.level === 'warning'" />
                  <InfoFilled v-else />
                </el-icon>
                <div class="alert-content">
                  <div class="alert-message">{{ alert.message }}</div>
                  <div class="alert-time">{{ alert.time }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title">
          <el-icon><Timer /></el-icon>
          今日业务时间线
        </h3>
      </div>
      <div class="panel-body">
        <div class="business-timeline">
          <div
            v-for="(item, index) in businessTimeline"
            :key="index"
            class="business-item"
          >
            <div class="business-time">{{ item.time }}</div>
            <div class="business-node">
              <div class="business-dot" :class="item.type"></div>
              <div v-if="index < businessTimeline.length - 1" class="business-line"></div>
            </div>
            <div class="business-info">
              <span class="business-type-tag" :class="item.type">{{ item.typeLabel }}</span>
              <span class="business-content">{{ item.content }}</span>
            </div>
            <div class="business-operator">{{ item.operator }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Document,
  Van,
  Calendar,
  Money,
  List,
  TrendCharts,
  MapLocation,
  Bell,
  Warning,
  WarningFilled,
  InfoFilled,
  Timer
} from '@element-plus/icons-vue'
import { mockDashboardStats } from '@/mock/statistics'
import { mockVehicles } from '@/mock/vehicles'
import StatCard from '@/components/common/StatCard.vue'

const mockData = mockDashboardStats

const sortedTasks = computed(() => {
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  return [...mockData.pendingTasks].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  )
})

const displayVehicles = computed(() => {
  return mockVehicles.slice(0, 6).map((v, i) => {
    const basePositions = [
      { x: 80, y: 60 },
      { x: 320, y: 80 },
      { x: 130, y: 200 },
      { x: 290, y: 190 },
      { x: 180, y: 100 },
      { x: 230, y: 170 }
    ]
    return {
      ...basePositions[i],
      id: v.id,
      plate: v.plateNumber.slice(0, 6),
      onMission: v.status === 'on_mission'
    }
  })
})

const idleCount = computed(() => mockVehicles.filter((v) => v.status === 'idle').length)
const missionCount = computed(() => mockVehicles.filter((v) => v.status === 'on_mission').length)

const businessTimeline = computed(() => [
  {
    time: '08:15',
    type: 'register',
    typeLabel: '登记',
    content: '赵某某 遗体档案登记完成',
    operator: '殡仪员张三'
  },
  {
    time: '08:45',
    type: 'dispatch',
    typeLabel: '派车',
    content: '沪A-8888领 陈建国 前往浦东新区',
    operator: '调度员A'
  },
  {
    time: '09:20',
    type: 'arrive',
    typeLabel: '到馆',
    content: '钱某某 遗体安全到达第二殡仪馆',
    operator: '驾驶员李卫东'
  },
  {
    time: '09:50',
    type: 'booking',
    typeLabel: '预约',
    content: '追思厅1号 10:00-11:30 告别仪式确认',
    operator: '礼仪师王建国'
  },
  {
    time: '10:30',
    type: 'farewell',
    typeLabel: '告别',
    content: '李某某 告别仪式开始',
    operator: '礼仪师赵六'
  },
  {
    time: '11:45',
    type: 'cremation',
    typeLabel: '火化',
    content: '孙某某 完成火化(3号炉)',
    operator: '火化工钱七'
  },
  {
    time: '13:20',
    type: 'settlement',
    typeLabel: '结算',
    content: '周某某 费用结算完成 ¥28,500',
    operator: '财务李四'
  },
  {
    time: '14:00',
    type: 'cemetery',
    typeLabel: '安葬',
    content: '吴某某 永宁区05-08号 安葬仪式',
    operator: '墓园管理员周九'
  }
])

function formatMoney(amount: number): string {
  if (amount >= 10000) {
    return `¥${(amount / 10000).toFixed(1)}万`
  }
  return `¥${amount.toLocaleString('zh-CN')}`
}
</script>

<style lang="scss" scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;

  @media (max-width: 1400px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
}

.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel {
  background: $color-funeral-card;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid $color-funeral-border;
  background: rgba(255, 255, 255, 0.02);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: $color-funeral-text-primary;
  margin: 0;

  :deep(.el-icon) {
    width: 18px;
    height: 18px;
    color: $color-funeral-gold;
  }
}

.panel-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 11px;
  background: linear-gradient(135deg, $color-funeral-gold 0%, $color-funeral-gold-dark 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.panel-body {
  padding: 16px 20px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: $radius-sm;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid $color-funeral-border;
  transition: all 0.2s;

  &:hover {
    border-color: $color-funeral-gold;
    background: rgba($color-funeral-gold, 0.04);
  }

  &.high .task-priority-dot {
    background: $color-status-error;
    box-shadow: 0 0 6px rgba($color-status-error, 0.5);
  }

  &.high .task-type {
    color: $color-status-error;
  }

  &.medium .task-priority-dot {
    background: $color-status-warning;
    box-shadow: 0 0 6px rgba($color-status-warning, 0.5);
  }

  &.medium .task-type {
    color: $color-status-warning;
  }

  &.low .task-priority-dot {
    background: $color-status-info;
    box-shadow: 0 0 6px rgba($color-status-info, 0.4);
  }

  &.low .task-type {
    color: $color-status-info;
  }
}

.task-priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.task-type {
  font-size: 12px;
  font-weight: 600;
}

.task-time {
  font-size: 11px;
  color: $color-funeral-text-muted;
}

.task-desc {
  font-size: 13px;
  color: $color-funeral-text-secondary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-timeline {
  display: flex;
  flex-direction: column;
}

.activity-item {
  display: flex;
  gap: 12px;
}

.activity-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;
}

.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $color-funeral-gold;
  flex-shrink: 0;
  margin-top: 5px;
}

.activity-line {
  width: 1px;
  flex: 1;
  min-height: 20px;
  background: $color-funeral-border;
  margin: 4px 0;
}

.activity-content {
  flex: 1;
  padding-bottom: 16px;
}

.activity-top {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 2px;
}

.activity-operator {
  font-size: 13px;
  font-weight: 600;
  color: $color-funeral-text-primary;
}

.activity-action {
  font-size: 13px;
  color: $color-funeral-gold;
}

.activity-target {
  font-size: 12px;
  color: $color-funeral-text-secondary;
  margin-bottom: 2px;
}

.activity-time {
  font-size: 11px;
  color: $color-funeral-text-muted;
  font-family: 'SF Mono', Monaco, monospace;
}

.vehicle-map {
  position: relative;
  border-radius: $radius-sm;
  overflow: hidden;
  background: $color-funeral-dark;
  border: 1px solid $color-funeral-border;
}

.map-svg {
  width: 100%;
  height: 280px;
  display: block;
}

.vehicle-marker {
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform-origin: center;
    transform: scale(1.15);
  }

  .vehicle-pulse {
    animation: vehiclePulse 2s ease-in-out infinite;
  }
}

@keyframes vehiclePulse {
  0%, 100% {
    opacity: 0.3;
    transform-origin: center;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform-origin: center;
    transform: scale(1.3);
  }
}

.map-legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid $color-funeral-border;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: $color-funeral-text-secondary;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;

  &.idle {
    background: #52C41A;
  }

  &.mission {
    background: #1890FF;
  }
}

.legend-icon {
  font-size: 13px;
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alert-item {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-radius: $radius-sm;
  border: 1px solid $color-funeral-border;
  transition: all 0.2s;

  &.error {
    background: rgba($color-status-error, 0.06);
    border-color: rgba($color-status-error, 0.25);

    .alert-icon {
      color: $color-status-error;
    }
  }

  &.warning {
    background: rgba($color-status-warning, 0.06);
    border-color: rgba($color-status-warning, 0.25);

    .alert-icon {
      color: $color-status-warning;
    }
  }

  &.info {
    background: rgba($color-status-info, 0.06);
    border-color: rgba($color-status-info, 0.25);

    .alert-icon {
      color: $color-status-info;
    }
  }
}

.alert-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-top: 1px;
}

.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-message {
  font-size: 13px;
  color: $color-funeral-text-secondary;
  line-height: 1.5;
  margin-bottom: 4px;
}

.alert-time {
  font-size: 11px;
  color: $color-funeral-text-muted;
  font-family: 'SF Mono', Monaco, monospace;
}

.business-timeline {
  display: flex;
  flex-direction: column;
}

.business-item {
  display: grid;
  grid-template-columns: 60px 40px 1fr 120px;
  gap: 12px;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 60px 40px 1fr;
  }
}

.business-time {
  font-size: 13px;
  font-weight: 600;
  color: $color-funeral-gold;
  font-family: 'SF Mono', Monaco, monospace;
  padding-top: 3px;
}

.business-node {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.business-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;

  &.register {
    background: #1890FF;
    box-shadow: 0 0 6px rgba(24, 144, 255, 0.5);
  }

  &.dispatch {
    background: #13C2C2;
    box-shadow: 0 0 6px rgba(19, 194, 194, 0.5);
  }

  &.arrive {
    background: #722ED1;
    box-shadow: 0 0 6px rgba(114, 46, 209, 0.5);
  }

  &.booking {
    background: #2F54EB;
    box-shadow: 0 0 6px rgba(47, 84, 235, 0.5);
  }

  &.farewell {
    background: #EB2F96;
    box-shadow: 0 0 6px rgba(235, 47, 150, 0.5);
  }

  &.cremation {
    background: #FA541C;
    box-shadow: 0 0 6px rgba(250, 84, 28, 0.5);
  }

  &.settlement {
    background: #52C41A;
    box-shadow: 0 0 6px rgba(82, 196, 26, 0.5);
  }

  &.cemetery {
    background: #FA8C16;
    box-shadow: 0 0 6px rgba(250, 140, 22, 0.5);
  }
}

.business-line {
  width: 1px;
  flex: 1;
  min-height: 16px;
  background: $color-funeral-border;
  margin: 2px 0;
}

.business-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 3px 0 14px;
  flex-wrap: wrap;
}

.business-type-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: $radius-sm;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;

  &.register {
    background: rgba(24, 144, 255, 0.15);
    color: #1890FF;
  }

  &.dispatch {
    background: rgba(19, 194, 194, 0.15);
    color: #13C2C2;
  }

  &.arrive {
    background: rgba(114, 46, 209, 0.15);
    color: #722ED1;
  }

  &.booking {
    background: rgba(47, 84, 235, 0.15);
    color: #2F54EB;
  }

  &.farewell {
    background: rgba(235, 47, 150, 0.15);
    color: #EB2F96;
  }

  &.cremation {
    background: rgba(250, 84, 28, 0.15);
    color: #FA541C;
  }

  &.settlement {
    background: rgba(82, 196, 26, 0.15);
    color: #52C41A;
  }

  &.cemetery {
    background: rgba(250, 140, 22, 0.15);
    color: #FA8C16;
  }
}

.business-content {
  font-size: 13px;
  color: $color-funeral-text-secondary;
}

.business-operator {
  font-size: 12px;
  color: $color-funeral-text-muted;
  padding-top: 3px;
  text-align: right;

  @media (max-width: 900px) {
    display: none;
  }
}
</style>
