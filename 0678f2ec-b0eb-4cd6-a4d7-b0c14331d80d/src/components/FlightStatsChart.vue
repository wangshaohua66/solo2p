<script setup lang="ts">
import { computed } from 'vue';
import { useApronStore } from '@/stores/apron';
import { useECharts } from '@/composables/useECharts';
import { formatBeijingTime } from '@/utils/helpers';
import type { EChartsOption } from 'echarts';

const props = withDefaults(defineProps<{
  height?: string;
}>(), {
  height: '240px',
});

const store = useApronStore();

const chartOption = computed<EChartsOption>(() => {
  let history = store.flightHistory;
  if (!history || history.length === 0) {
    const now = Date.now();
    history = Array.from({ length: 6 }, (_, i) => ({
      timestamp: now - (5 - i) * 60000,
      arrivals: 0,
      departures: 0,
      delayed: 0,
    }));
  }
  const times = history.map(h => formatBeijingTime(h.timestamp, 'HH:mm'));

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#22d3ee', width: 1, type: 'dashed' },
      },
    },
    legend: {
      data: ['到达航班', '出发航班', '延误航班'],
      textStyle: { color: '#94a3b8', fontSize: 11 },
      top: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 10,
    },
    grid: {
      left: '3%',
      right: '3%',
      top: '15%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: times,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
      axisLine: { show: false },
      axisLabel: { color: '#64748b', fontSize: 10 },
      minInterval: 1,
    },
    series: [
      {
        name: '到达航班',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        data: history.map(h => h.arrivals),
        lineStyle: { color: '#3b82f6', width: 2 },
        itemStyle: { color: '#3b82f6' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.02)' },
            ],
          },
        },
      },
      {
        name: '出发航班',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        data: history.map(h => h.departures),
        lineStyle: { color: '#10b981', width: 2 },
        itemStyle: { color: '#10b981' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.02)' },
            ],
          },
        },
      },
      {
        name: '延误航班',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        data: history.map(h => h.delayed),
        lineStyle: { color: '#ef4444', width: 2 },
        itemStyle: { color: '#ef4444' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.02)' },
            ],
          },
        },
      },
    ],
  };
});

const { chartRef } = useECharts(chartOption, 'dark');
</script>

<template>
  <div class="flight-stats-chart">
    <div class="chart-header">
      <span class="chart-title">航班趋势</span>
      <span class="chart-subtitle">近30分钟</span>
    </div>
    <div ref="chartRef" class="chart-container" :style="{ height }" />
  </div>
</template>

<style scoped>
.flight-stats-chart {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.chart-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.chart-subtitle {
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: var(--font-family-mono);
}

.chart-container {
  width: 100%;
  min-height: 200px;
}
</style>
