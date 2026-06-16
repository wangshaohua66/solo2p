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
  let history = store.alertHistory;
  if (!history || history.length === 0) {
    const now = Date.now();
    history = Array.from({ length: 6 }, (_, i) => ({
      timestamp: now - (5 - i) * 60000,
      red: 0,
      orange: 0,
      blue: 0,
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
      axisPointer: { type: 'shadow' },
    },
    legend: {
      data: ['红色告警', '橙色告警', '蓝色提示'],
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
      data: times,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
      axisLine: { show: false },
      axisLabel: { color: '#64748b', fontSize: 10 },
    },
    series: [
      {
        name: '红色告警',
        type: 'bar',
        stack: 'total',
        barWidth: '50%',
        data: history.map(h => h.red),
        itemStyle: {
          color: '#ef4444',
          borderRadius: [0, 0, 0, 0],
        },
      },
      {
        name: '橙色告警',
        type: 'bar',
        stack: 'total',
        data: history.map(h => h.orange),
        itemStyle: {
          color: '#f59e0b',
          borderRadius: [0, 0, 0, 0],
        },
      },
      {
        name: '蓝色提示',
        type: 'bar',
        stack: 'total',
        data: history.map(h => h.blue),
        itemStyle: {
          color: '#3b82f6',
          borderRadius: [3, 3, 0, 0],
        },
      },
    ],
  };
});

const { chartRef } = useECharts(chartOption, 'dark');
</script>

<template>
  <div class="alert-trend-chart">
    <div class="chart-header">
      <span class="chart-title">告警趋势</span>
      <span class="chart-subtitle">近30分钟</span>
    </div>
    <div ref="chartRef" class="chart-container" :style="{ height }" />
  </div>
</template>

<style scoped>
.alert-trend-chart {
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
