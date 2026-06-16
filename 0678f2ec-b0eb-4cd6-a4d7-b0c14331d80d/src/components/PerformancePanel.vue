<script setup lang="ts">
import { computed, ref } from 'vue';
import { useApronStore } from '@/stores/apron';
import { useECharts } from '@/composables/useECharts';
import { Activity, Cpu, Clock, Gauge, ChevronDown, ChevronUp } from 'lucide-vue-next';
import type { EChartsOption } from 'echarts';

const store = useApronStore();
const isExpanded = ref(false);

const perf = computed(() => store.performance);
const status = computed(() => store.performanceStatus);

const chartOption = computed<EChartsOption>(() => {
  let history = perf.value.history.slice(-30);
  if (!history || history.length === 0) {
    const now = Date.now();
    history = Array.from({ length: 6 }, (_, i) => ({
      timestamp: now - (5 - i) * 60000,
      fps: 60,
      memoryUsed: 0,
      responseTime: 0,
    }));
  }
  const times = history.map(h => {
    const d = new Date(h.timestamp);
    return `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  });

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 11 },
      axisPointer: { type: 'cross' },
    },
    legend: {
      data: ['FPS', '内存(MB)', '响应(ms)'],
      textStyle: { color: '#94a3b8', fontSize: 10 },
      top: 0,
      right: 0,
      itemWidth: 8,
      itemHeight: 8,
    },
    grid: {
      left: '3%',
      right: '3%',
      top: '18%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: times,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#64748b', fontSize: 9 },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: 'FPS',
        min: 0,
        max: 70,
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
        axisLine: { show: false },
        axisLabel: { color: '#64748b', fontSize: 9 },
      },
      {
        type: 'value',
        name: 'MB/ms',
        min: 0,
        splitLine: { show: false },
        axisLine: { show: false },
        axisLabel: { color: '#64748b', fontSize: 9 },
      },
    ],
    series: [
      {
        name: 'FPS',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        data: history.map(h => h.fps),
        lineStyle: { color: '#10b981', width: 2 },
        itemStyle: { color: '#10b981' },
        yAxisIndex: 0,
      },
      {
        name: '内存(MB)',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        data: history.map(h => h.memoryUsed),
        lineStyle: { color: '#f59e0b', width: 2 },
        itemStyle: { color: '#f59e0b' },
        yAxisIndex: 1,
      },
      {
        name: '响应(ms)',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        data: history.map(h => h.responseTime),
        lineStyle: { color: '#8b5cf6', width: 2 },
        itemStyle: { color: '#8b5cf6' },
        yAxisIndex: 1,
      },
    ],
  };
});

const { chartRef } = useECharts(chartOption, 'dark');

const getStatusColor = (status: string) => {
  switch (status) {
    case 'good': return '#10b981';
    case 'warn': return '#f59e0b';
    case 'bad': return '#ef4444';
    default: return '#64748b';
  }
};

const formatBytes = (mb: number) => {
  if (mb < 1024) return `${mb} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
};

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
};
</script>

<template>
  <div class="performance-panel" :class="{ expanded: isExpanded }">
    <div class="perf-header" @click="toggleExpand">
      <div class="flex items-center gap-2">
        <Activity :size="16" class="text-cyan-400" />
        <span class="perf-title">性能监控</span>
        <span
          class="perf-status-badge"
          :style="{ backgroundColor: getStatusColor(status.isAllGood ? 'good' : 'warn') + '33', color: getStatusColor(status.isAllGood ? 'good' : 'warn') }"
        >
          {{ status.isAllGood ? '正常' : '关注' }}
        </span>
      </div>
      <component :is="isExpanded ? ChevronUp : ChevronDown" :size="16" class="text-gray-400" />
    </div>

    <div v-show="isExpanded" class="perf-content">
      <div class="perf-metrics">
        <div class="perf-metric">
          <div class="perf-metric-icon" :style="{ color: getStatusColor(status.fpsStatus) }">
            <Gauge :size="16" />
          </div>
          <div class="perf-metric-info">
            <span class="perf-metric-label">帧率 FPS</span>
            <span class="perf-metric-value" :style="{ color: getStatusColor(status.fpsStatus) }">
              {{ perf.fps }}
            </span>
          </div>
          <div class="perf-metric-constraint">≥ 55</div>
        </div>

        <div class="perf-metric">
          <div class="perf-metric-icon" :style="{ color: getStatusColor(status.memoryStatus) }">
            <Cpu :size="16" />
          </div>
          <div class="perf-metric-info">
            <span class="perf-metric-label">内存占用</span>
            <span class="perf-metric-value" :style="{ color: getStatusColor(status.memoryStatus) }">
              {{ formatBytes(perf.memoryUsed) }}
            </span>
          </div>
          <div class="perf-metric-constraint">≤ 100MB</div>
        </div>

        <div class="perf-metric">
          <div class="perf-metric-icon" :style="{ color: getStatusColor(status.responseStatus) }">
            <Clock :size="16" />
          </div>
          <div class="perf-metric-info">
            <span class="perf-metric-label">响应时间</span>
            <span class="perf-metric-value" :style="{ color: getStatusColor(status.responseStatus) }">
              {{ perf.lastResponseTime }} ms
            </span>
          </div>
          <div class="perf-metric-constraint">≤ 200ms</div>
        </div>
      </div>

      <div class="perf-timings">
        <div class="timing-row">
          <span class="timing-label">首屏绘制</span>
          <span class="timing-value" :class="{ ok: perf.firstPaint > 0 && perf.firstPaint <= 1000 }">
            {{ perf.firstPaint > 0 ? perf.firstPaint + ' ms' : '...' }}
          </span>
        </div>
        <div class="timing-row">
          <span class="timing-label">DOM加载</span>
          <span class="timing-value" :class="{ ok: perf.domContentLoaded > 0 && perf.domContentLoaded <= 1500 }">
            {{ perf.domContentLoaded > 0 ? perf.domContentLoaded + ' ms' : '...' }}
          </span>
        </div>
        <div class="timing-row">
          <span class="timing-label">页面加载</span>
          <span class="timing-value" :class="{ ok: perf.loadEvent > 0 && perf.loadEvent <= 2000 }">
            {{ perf.loadEvent > 0 ? perf.loadEvent + ' ms' : '...' }}
          </span>
        </div>
      </div>

      <div class="perf-chart">
        <div ref="chartRef" class="chart-container" style="height: 140px" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.performance-panel {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all 0.3s;
}

.perf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.perf-header:hover {
  background: rgba(34, 211, 238, 0.05);
}

.perf-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.perf-status-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
  font-family: var(--font-family-mono);
}

.perf-content {
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.perf-metrics {
  display: flex;
  gap: 12px;
}

.perf-metric {
  flex: 1;
  background: rgba(15, 23, 42, 0.6);
  border-radius: var(--radius-md);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--color-border);
}

.perf-metric-icon {
  opacity: 0.8;
}

.perf-metric-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.perf-metric-label {
  font-size: 10px;
  color: var(--color-text-muted);
}

.perf-metric-value {
  font-size: 18px;
  font-weight: 700;
  font-family: var(--font-family-mono);
}

.perf-metric-constraint {
  font-size: 10px;
  color: var(--color-text-muted);
  font-family: var(--font-family-mono);
  opacity: 0.6;
}

.perf-timings {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background: rgba(15, 23, 42, 0.6);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.timing-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
}

.timing-label {
  color: var(--color-text-secondary);
}

.timing-value {
  font-family: var(--font-family-mono);
  color: var(--color-text-muted);
  font-weight: 600;
}

.timing-value.ok {
  color: #10b981;
}

.perf-chart {
  background: rgba(15, 23, 42, 0.6);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  padding: 8px;
}

.chart-container {
  width: 100%;
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
</style>
