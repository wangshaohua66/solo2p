<script setup lang="ts">
import { computed, ref } from 'vue';
import { useApronStore } from '@/stores/apron';
import { useECharts } from '@/composables/useECharts';
import { VEHICLE_TYPE_LABELS, VEHICLE_TYPE_COLORS } from '@/utils/constants';
import type { EChartsOption } from 'echarts';

const props = withDefaults(defineProps<{
  height?: string;
}>(), {
  height: '240px',
});

const store = useApronStore();
const chartType = ref<'pie' | 'bar'>('pie');

const chartOption = computed<EChartsOption>(() => {
  const byStatus = store.vehiclesByStatus;
  const byType: Record<string, number> = {};
  const vehicles = store.vehicles || [];
  vehicles.forEach(v => {
    byType[v.type] = (byType[v.type] || 0) + 1;
  });

  if (Object.keys(byType).length === 0) {
    byType['baggage'] = 0;
    byType['fuel'] = 0;
    byType['catering'] = 0;
  }

  if (chartType.value === 'pie') {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        formatter: '{b}: {c}辆 ({d}%)',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'center',
        textStyle: { color: '#94a3b8', fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['65%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#0f172a',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              color: '#e2e8f0',
            },
          },
          labelLine: {
            show: false,
          },
          data: Object.entries(byType).map(([type, count]) => ({
            name: VEHICLE_TYPE_LABELS[type as keyof typeof VEHICLE_TYPE_LABELS] || type,
            value: count,
            itemStyle: {
              color: VEHICLE_TYPE_COLORS[type as keyof typeof VEHICLE_TYPE_COLORS] || '#64748b',
            },
          })),
        },
      ],
    };
  }

  const statusLabels = ['空闲', '移动', '作业中'];
  const statusData = [
    byStatus?.idle ?? 0,
    byStatus?.moving ?? 0,
    byStatus?.working ?? 0,
  ];
  const statusColors = ['#64748b', '#3b82f6', '#10b981'];

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      axisPointer: { type: 'shadow' },
    },
    grid: {
      left: '3%',
      right: '10%',
      top: '10%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: statusLabels,
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
        type: 'bar',
        barWidth: '40%',
        data: statusData.map((value, index) => ({
          value,
          itemStyle: {
            color: statusColors[index],
            borderRadius: [4, 4, 0, 0],
          },
        })),
      },
    ],
  };
});

const { chartRef, updateOption } = useECharts(chartOption, 'dark');

const toggleChartType = () => {
  chartType.value = chartType.value === 'pie' ? 'bar' : 'pie';
};
</script>

<template>
  <div class="vehicle-dispatch-chart">
    <div class="chart-header">
      <span class="chart-title">车辆分布</span>
      <button class="chart-toggle" @click="toggleChartType">
        {{ chartType === 'pie' ? '按状态' : '按类型' }}
      </button>
    </div>
    <div ref="chartRef" class="chart-container" :style="{ height }" />
  </div>
</template>

<style scoped>
.vehicle-dispatch-chart {
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

.chart-toggle {
  font-size: 10px;
  padding: 4px 10px;
  background: rgba(34, 211, 238, 0.15);
  color: #22d3ee;
  border: 1px solid rgba(34, 211, 238, 0.3);
  border-radius: 12px;
  cursor: pointer;
  font-family: var(--font-family-mono);
  transition: all 0.2s;
}

.chart-toggle:hover {
  background: rgba(34, 211, 238, 0.25);
}

.chart-container {
  width: 100%;
  min-height: 200px;
}
</style>
