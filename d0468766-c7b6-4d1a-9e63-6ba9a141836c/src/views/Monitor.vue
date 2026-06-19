<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import * as ElIcons from '@element-plus/icons-vue'
import SectionPanel from '@/components/SectionPanel.vue'
import BaseChart from '@/components/BaseChart.vue'
import StatCard from '@/components/StatCard.vue'
import { monitorApi } from '@/api'
import type { MonitorHall } from '@/types'

const loading = ref(true)
const halls = ref<MonitorHall[]>([])
const refreshKey = ref(0)

onMounted(load)

async function load() {
  loading.value = true
  halls.value = await monitorApi.getHalls()
  loading.value = false
}

setInterval(() => {
  refreshKey.value++
  halls.value = halls.value.map((h) => ({
    ...h,
    temperature: Math.round((h.temperature + (Math.random() - 0.5) * 0.4) * 10) / 10,
    humidity: Math.round((h.humidity + (Math.random() - 0.5) * 1.5) * 10) / 10,
    progress: h.status === '放映中' ? Math.min(100, h.progress + Math.random() * 3) : h.progress
  }))
}, 3000)

const stats = computed(() => ({
  total: halls.value.length,
  playing: halls.value.filter((h) => h.status === '放映中').length,
  idle: halls.value.filter((h) => h.status === '空闲' || h.status === '待机').length,
  alert: halls.value.filter((h) => h.devices.some((d) => d.status !== 'normal')).length
}))

const statusMeta: Record<string, { color: string; bg: string; icon: string }> = {
  放映中: { color: '#4ADE80', bg: 'rgba(74,222,128,0.12)', icon: 'VideoPlay' },
  空闲: { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)', icon: 'VideoPause' },
  清洁: { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', icon: 'Brush' },
  故障: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: 'WarnTriangleFilled' },
  待机: { color: '#a0a3b1', bg: 'rgba(160,163,177,0.12)', icon: 'CircleClose' }
}

const envChart = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['温度(℃)', '湿度(%)'], textStyle: { color: '#a0a3b1' }, top: 0 },
  grid: { top: 40, right: 20, bottom: 30, left: 40 },
  xAxis: { type: 'category', data: Array.from({ length: 12 }, (_, i) => `${i * 2}:00`), axisLabel: { color: '#a0a3b1', fontSize: 10 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
  yAxis: { type: 'value', axisLabel: { color: '#a0a3b1' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
  series: [
    { name: '温度(℃)', type: 'line', smooth: true, data: Array.from({ length: 12 }, () => Math.round((20 + Math.random() * 4) * 10) / 10), lineStyle: { color: '#F0C75E' }, itemStyle: { color: '#F0C75E' } },
    { name: '湿度(%)', type: 'line', smooth: true, data: Array.from({ length: 12 }, () => Math.round((45 + Math.random() * 15) * 10) / 10), lineStyle: { color: '#60A5FA' }, itemStyle: { color: '#60A5FA' } }
  ]
}))

const deviceIcon: Record<string, string> = { 放映机: 'Film', 音响系统: 'Headset', 空调: 'Snowflake', 灯光: 'Sunny' }
const deviceStatus: Record<string, string> = { normal: '正常', warning: '预警', error: '故障' }
</script>

<template>
  <div class="monitor-page" v-loading="loading">
    <div class="top-bar">
      <div class="stat-row">
        <StatCard label="监控影厅" :value="stats.total" unit="厅" icon="Monitor" accent="gold" />
        <StatCard label="放映中" :value="stats.playing" unit="厅" icon="VideoPlay" accent="success" />
        <StatCard label="空闲/待机" :value="stats.idle" unit="厅" icon="VideoPause" accent="info" />
        <StatCard label="设备告警" :value="stats.alert" unit="项" icon="WarnTriangleFilled" accent="crimson" />
      </div>
      <div class="refresh">
        <span class="live-dot" />实时刷新中 · <span class="num">{{ refreshKey }}</span>
        <el-button size="small" :icon="(ElIcons as any).Refresh" @click="load">刷新</el-button>
      </div>
    </div>

    <SectionPanel title="影厅状态监控墙" subtitle="对接 TMS 系统 · 实时放映状态与环境数据">
      <div class="hall-wall">
        <div v-for="h in halls" :key="h.id" class="hall-card" :class="h.status">
          <div class="hc-glow" :style="{ background: statusMeta[h.status].bg }" />
          <div class="hc-head">
            <div class="hc-status" :style="{ color: statusMeta[h.status].color, background: statusMeta[h.status].bg }">
              <component :is="(ElIcons as any)[statusMeta[h.status].icon]" />
              {{ h.status }}
            </div>
            <strong>{{ h.hallName }}</strong>
          </div>

          <div class="hc-movie" v-if="h.status === '放映中'">
            <component :is="(ElIcons as any).Film" />
            <span>{{ h.movie }}</span>
            <span class="num">{{ Math.round(h.progress) }}%</span>
          </div>
          <div class="hc-movie placeholder" v-else>
            <span>{{ h.status === '清洁' ? '清洁中' : h.status === '空闲' ? '空闲待排片' : '待机维护' }}</span>
          </div>

          <div class="hc-progress" v-if="h.status === '放映中'">
            <div class="prog-track"><i :style="{ width: `${h.progress}%`, background: statusMeta[h.status].color }" /></div>
          </div>

          <div class="hc-env">
            <div class="env-item">
              <component :is="(ElIcons as any).Sunrise" />
              <div><strong class="num">{{ h.temperature }}</strong><span>℃</span></div>
            </div>
            <div class="env-item">
              <component :is="(ElIcons as any).Drizzling" />
              <div><strong class="num">{{ h.humidity }}</strong><span>%</span></div>
            </div>
            <div class="env-item">
              <component :is="(ElIcons as any).User" />
              <div><strong class="num">{{ h.audience }}</strong><span>/{{ h.capacity }}</span></div>
            </div>
          </div>

          <div class="hc-devices">
            <div v-for="d in h.devices" :key="d.name" class="device-chip" :class="d.status">
              <component :is="(ElIcons as any)[deviceIcon[d.name] || 'Setting']" />
              <span>{{ d.name }}</span>
              <i class="dev-dot" />
            </div>
          </div>
        </div>
      </div>
    </SectionPanel>

    <SectionPanel title="环境数据曲线" subtitle="今日影厅温湿度变化趋势">
      <BaseChart :option="envChart" height="260px" />
    </SectionPanel>
  </div>
</template>

<style scoped lang="scss">
.monitor-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.top-bar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
  flex: 1;
}
.refresh {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--c-text-secondary);
  white-space: nowrap;
  .num {
    color: $gold;
  }
}
.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $success;
  animation: pulse-gold 1.5s infinite;
  box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.6);
}

.hall-wall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.hall-card {
  @include card-base;
  padding: 16px;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s ease;
  &:hover {
    transform: translateY(-2px);
  }
  &.故障 {
    border-color: rgba(239, 68, 68, 0.5);
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.15), $shadow-inset;
  }
}
.hc-glow {
  position: absolute;
  top: -30%;
  right: -20%;
  width: 70%;
  height: 100%;
  border-radius: 50%;
  filter: blur(20px);
  opacity: 0.6;
  pointer-events: none;
}
.hc-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
  z-index: 1;
  strong {
    font-size: 13px;
    color: var(--c-text-primary);
    text-align: right;
    max-width: 140px;
    line-height: 1.3;
  }
}
.hc-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}
.hc-movie {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px 0 8px;
  font-size: 13px;
  color: var(--c-text-primary);
  position: relative;
  z-index: 1;
  span:first-of-type {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .num {
    color: $success;
    font-weight: 600;
  }
  &.placeholder {
    color: var(--c-text-tertiary);
    font-size: 12px;
  }
}
.hc-progress {
  margin-bottom: 12px;
  position: relative;
  z-index: 1;
  .prog-track {
    height: 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
    i {
      display: block;
      height: 100%;
      border-radius: 2px;
      transition: width 0.5s ease;
    }
  }
}
.hc-env {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 12px;
  position: relative;
  z-index: 1;
}
.env-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  svg {
    font-size: 16px;
    color: var(--c-text-tertiary);
  }
  div {
    strong {
      font-size: 15px;
      color: var(--c-text-primary);
    }
    span {
      font-size: 10px;
      color: var(--c-text-tertiary);
      margin-left: 2px;
    }
  }
}
.hc-devices {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  position: relative;
  z-index: 1;
}
.device-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  font-size: 11px;
  color: var(--c-text-secondary);
  svg {
    font-size: 12px;
  }
  .dev-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: $success;
  }
  &.warning .dev-dot {
    background: $warning;
    animation: pulse-gold 1s infinite;
  }
  &.error .dev-dot {
    background: $danger;
    animation: pulse-gold 0.8s infinite;
  }
  &.warning {
    color: $warning;
  }
  &.error {
    color: $danger;
  }
}
</style>
