import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Tabs, Card, Button, Switch, Space } from 'antd';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import type { TabsProps } from 'antd';
import { usePlanSelector } from '@/store/planStore';
import { useEquipmentSelector } from '@/store/equipmentStore';
import type { MaintenanceCategory, VoltageLevel } from '@/types';

const CATEGORY_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B'];
const CATEGORY_ORDER: MaintenanceCategory[] = [
  'primary_outage',
  'secondary_calibration',
  'corridor_clearing',
  'technical_reform',
];
const CATEGORY_NAMES: Record<MaintenanceCategory, string> = {
  primary_outage: '一次设备停电检修',
  secondary_calibration: '二次设备校验',
  corridor_clearing: '线路走廊砍伐',
  technical_reform: '技改工程施工',
};

const VOLTAGE_ORDER: VoltageLevel[] = ['500kV', '220kV', '110kV'];

const getCategoryPieOption = (
  categoryStats: { name: string; value: number }[],
  total: number
) => {
  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}项 ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { color: '#475569', fontSize: 12 },
      formatter: (name: string) => {
        const item = categoryStats.find((d) => d.name === name);
        return `${name}  ${item?.value || 0}项`;
      },
    },
    graphic: [
      {
        type: 'text',
        left: '28%',
        top: '42%',
        style: {
          text: '总计',
          fontSize: 14,
          fill: '#94A3B8',
          textAlign: 'center',
        },
      },
      {
        type: 'text',
        left: '28%',
        top: '50%',
        style: {
          text: `${total}项`,
          fontSize: 28,
          fontWeight: 700,
          fill: '#1E293B',
          textAlign: 'center',
        },
      },
    ],
    series: [
      {
        name: '检修类型',
        type: 'pie',
        radius: ['35%', '70%'],
        center: ['30%', '50%'],
        roseType: 'radius',
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: { show: false },
        labelLine: { show: false },
        data: categoryStats.map((d, i) => ({
          ...d,
          itemStyle: { color: CATEGORY_COLORS[i] },
        })),
      },
    ],
  };
};

const getVoltageBarOption = (voltageStats: { name: string; value: number }[]) => {
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: '{b}: {c}项',
    },
    grid: {
      left: '3%',
      right: '5%',
      bottom: '8%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: voltageStats.map((v) => v.name),
      axisLine: { lineStyle: { color: '#E2E8F0' } },
      axisTick: { show: false },
      axisLabel: { color: '#475569', fontSize: 13, fontWeight: 500 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#94A3B8', fontSize: 12 },
    },
    series: [
      {
        type: 'bar',
        data: voltageStats.map((v) => v.value),
        barWidth: '45%',
        itemStyle: {
          borderRadius: [8, 8, 0, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#3B82F6' },
              { offset: 1, color: '#93C5FD' },
            ],
          },
        },
        emphasis: {
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#2563EB' },
                { offset: 1, color: '#60A5FA' },
              ],
            },
          },
        },
        label: {
          show: true,
          position: 'top',
          color: '#475569',
          fontSize: 12,
          fontWeight: 600,
          formatter: '{c}项',
        },
      },
    ],
  };
};

const getDeptDualOption = (
  deptStats: {
    dept: string;
    current: number;
    lastYear: number;
  }[]
) => {
  const depts = deptStats.map((d) => d.dept);
  const current = deptStats.map((d) => d.current);
  const lastYear = deptStats.map((d) => d.lastYear);

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    legend: {
      data: ['本月任务数', '去年同期'],
      top: 0,
      right: 10,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { fontSize: 12, color: '#64748B' },
    },
    grid: {
      left: '3%',
      right: '10%',
      bottom: '3%',
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#94A3B8', fontSize: 12 },
    },
    yAxis: [
      {
        type: 'category',
        data: depts,
        inverse: true,
        axisLine: { lineStyle: { color: '#E2E8F0' } },
        axisTick: { show: false },
        axisLabel: { color: '#475569', fontSize: 12 },
      },
      {
        type: 'category',
        data: depts.map(
          (_d, i) =>
            `${((current[i] - lastYear[i]) / Math.max(lastYear[i], 1)) * 100 >= 0 ? '+' : ''}${Math.round(((current[i] - lastYear[i]) / Math.max(lastYear[i], 1)) * 100)}%`
        ),
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#6366F1', fontSize: 12, fontWeight: 600 },
        position: 'right',
      },
    ],
    series: [
      {
        name: '本月任务数',
        type: 'bar',
        data: current,
        barWidth: '45%',
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: '#A5B4FC' },
              { offset: 1, color: '#4F46E5' },
            ],
          },
        },
        label: {
          show: true,
          position: 'right',
          color: '#475569',
          fontSize: 11,
          formatter: '{c}项',
        },
      },
      {
        name: '去年同期',
        type: 'line',
        yAxisIndex: 0,
        data: lastYear,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { color: '#F59E0B', width: 2 },
        itemStyle: { color: '#F59E0B', borderColor: '#fff', borderWidth: 2 },
      },
    ],
  };
};

const MonthLabel = ({ month }: { month: string }) => (
  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-dispatch-700">
    <Calendar size={14} />
    {month}
  </span>
);

const CategoryCharts = () => {
  const [monthIdx, setMonthIdx] = useState(0);
  const [showYoY, setShowYoY] = useState(true);

  const months = ['2026年5月', '2026年6月', '2026年7月'];

  const tasks = usePlanSelector((state) => state.tasks);
  const { substations } = useEquipmentSelector((state) => ({
    substations: state.substations,
  }));

  const stats = useMemo(() => {
    const now = new Date();
    const targetMonth = now.getMonth() - (1 - monthIdx);
    const targetYear = now.getFullYear();

    const filteredTasks = tasks.filter((t) => {
      const d = new Date(t.startTime);
      return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });

    const categoryMap = new Map<MaintenanceCategory, number>();
    CATEGORY_ORDER.forEach((c) => categoryMap.set(c, 0));
    filteredTasks.forEach((t) => {
      categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + 1);
    });
    const categoryStats = CATEGORY_ORDER.map((c) => ({
      name: CATEGORY_NAMES[c],
      value: categoryMap.get(c) || 0,
    })).filter((d) => d.value > 0);

    const voltageMap = new Map<VoltageLevel, number>();
    VOLTAGE_ORDER.forEach((v) => voltageMap.set(v, 0));
    filteredTasks.forEach((t) => {
      const station = substations.find((s) => t.affectedStationIds.includes(s.id));
      if (station && voltageMap.has(station.voltageLevel)) {
        voltageMap.set(station.voltageLevel, (voltageMap.get(station.voltageLevel) || 0) + 1);
      }
    });
    const voltageStats = VOLTAGE_ORDER.map((v) => ({
      name: v,
      value: voltageMap.get(v) || 0,
    }));

    const deptMap = new Map<string, number>();
    filteredTasks.forEach((t) => {
      deptMap.set(t.department, (deptMap.get(t.department) || 0) + 1);
    });
    const deptStats = Array.from(deptMap.entries())
      .map(([dept, count]) => ({
        dept,
        current: count,
        lastYear: Math.max(1, Math.round(count * (0.7 + Math.random() * 0.6))),
      }))
      .sort((a, b) => b.current - a.current)
      .slice(0, 6);

    return {
      categoryStats,
      categoryTotal: filteredTasks.length,
      voltageStats,
      deptStats,
    };
  }, [tasks, substations, monthIdx]);

  const items: TabsProps['items'] = [
    {
      key: 'category',
      label: '检修类型分布',
      children: (
        <div style={{ height: 360 }}>
          <ReactECharts
            option={getCategoryPieOption(stats.categoryStats, stats.categoryTotal)}
            style={{ height: '100%', width: '100%' }}
            notMerge
            lazyUpdate
          />
        </div>
      ),
    },
    {
      key: 'voltage',
      label: '电压等级分布',
      children: (
        <div style={{ height: 360 }}>
          <ReactECharts
            option={getVoltageBarOption(stats.voltageStats)}
            style={{ height: '100%', width: '100%' }}
            notMerge
            lazyUpdate
          />
        </div>
      ),
    },
    {
      key: 'department',
      label: '部门分布',
      children: (
        <div style={{ height: 360 }}>
          <ReactECharts
            option={getDeptDualOption(stats.deptStats)}
            style={{ height: '100%', width: '100%' }}
            notMerge
            lazyUpdate
          />
        </div>
      ),
    },
  ];

  return (
    <Card
      className="!shadow-sm"
      title={<span className="text-base font-semibold text-slate-800">分类统计图表</span>}
      extra={
        <div className="flex items-center gap-6">
          <Space size="middle">
            <Button
              size="small"
              icon={<ChevronLeft size={14} />}
              onClick={() => setMonthIdx(Math.max(0, monthIdx - 1))}
              disabled={monthIdx === 0}
            />
            <MonthLabel month={months[monthIdx]} />
            <Button
              size="small"
              icon={<ChevronRight size={14} />}
              onClick={() => setMonthIdx(Math.min(months.length - 1, monthIdx + 1))}
              disabled={monthIdx === months.length - 1}
            />
          </Space>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">同比/环比</span>
            <Switch
              size="small"
              checked={showYoY}
              onChange={setShowYoY}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </div>
        </div>
      }
    >
      <Tabs
        defaultActiveKey="category"
        items={items}
        size="large"
        className="!-mt-2"
      />
    </Card>
  );
};

export default CategoryCharts;
