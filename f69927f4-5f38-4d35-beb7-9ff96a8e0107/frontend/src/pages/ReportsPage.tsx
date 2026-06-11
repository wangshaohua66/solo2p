import { useState, useMemo } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Table, Button, message } from 'antd';
import { Zap, Beaker, Clock, DollarSign, FileDown, TrendingUp, TrendingDown } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import dayjs, { type Dayjs } from 'dayjs';
import { mockCostRecords, mockMonthlyReport, mockSchedules } from '@/mocks';
import type { CostRecord } from '@/types';

const PRIMARY = '#E8602C';
const SECONDARY = '#3B6FA0';

const scheduleMap = Object.fromEntries(mockSchedules.map((s) => [s.id, s]));

const enrichedRecords: (CostRecord & { kilnName: string; memberName: string })[] =
  mockCostRecords.map((r) => {
    const schedule = scheduleMap[r.scheduleId];
    return {
      ...r,
      kilnName: schedule?.kilnName ?? '-',
      memberName: schedule?.memberName ?? '-',
    };
  });

const dailyCosts = Array.from({ length: 10 }, (_, i) => {
  const day = i + 1;
  return {
    day: `6/${day}`,
    electricity: Math.round(20 + Math.random() * 30 * 10) / 10,
    material: Math.round(40 + Math.random() * 80 * 10) / 10,
    labor: Math.round(15 + Math.random() * 25 * 10) / 10,
  };
});

const kilnCostData = mockSchedules.reduce<
  Record<string, { electricity: number; material: number; labor: number }>
>((acc, s) => {
  if (!acc[s.kilnName]) acc[s.kilnName] = { electricity: 0, material: 0, labor: 0 };
  return acc;
}, {});

enrichedRecords.forEach((r) => {
  if (kilnCostData[r.kilnName]) {
    kilnCostData[r.kilnName].electricity += r.electricityCost;
    kilnCostData[r.kilnName].material += r.materialCost;
    kilnCostData[r.kilnName].labor += r.laborCost;
  }
});

const pieData = Object.entries(kilnCostData).map(([name, costs]) => ({
  name,
  value: Math.round((costs.electricity + costs.material + costs.labor) * 100) / 100,
}));

const columns = [
  { title: '排程ID', dataIndex: 'scheduleId', key: 'scheduleId', width: 90 },
  { title: '窑炉', dataIndex: 'kilnName', key: 'kilnName', width: 100 },
  { title: '会员', dataIndex: 'memberName', key: 'memberName', width: 100 },
  {
    title: '电费',
    dataIndex: 'electricityCost',
    key: 'electricityCost',
    width: 100,
    render: (v: number) => `¥${v.toFixed(2)}`,
  },
  {
    title: '原料费',
    dataIndex: 'materialCost',
    key: 'materialCost',
    width: 100,
    render: (v: number) => `¥${v.toFixed(2)}`,
  },
  {
    title: '工时费',
    dataIndex: 'laborCost',
    key: 'laborCost',
    width: 100,
    render: (v: number) => `¥${v.toFixed(2)}`,
  },
  {
    title: '总成本',
    dataIndex: 'totalCost',
    key: 'totalCost',
    width: 110,
    render: (v: number) => <span style={{ fontWeight: 600 }}>¥{v.toFixed(2)}</span>,
  },
  {
    title: '单件成本',
    dataIndex: 'costPerWorkpiece',
    key: 'costPerWorkpiece',
    width: 110,
    render: (v: number) => `¥${v.toFixed(2)}`,
  },
];

export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());

  const barOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['电费', '原料', '工时'], top: 0 },
      grid: { left: 48, right: 16, top: 40, bottom: 32 },
      xAxis: { type: 'category', data: dailyCosts.map((d) => d.day) },
      yAxis: { type: 'value', name: '成本 (¥)' },
      series: [
        {
          name: '电费',
          type: 'bar',
          stack: 'cost',
          data: dailyCosts.map((d) => d.electricity),
          itemStyle: { color: PRIMARY },
        },
        {
          name: '原料',
          type: 'bar',
          stack: 'cost',
          data: dailyCosts.map((d) => d.material),
          itemStyle: { color: SECONDARY },
        },
        {
          name: '工时',
          type: 'bar',
          stack: 'cost',
          data: dailyCosts.map((d) => d.labor),
          itemStyle: { color: '#8CB4D5' },
        },
      ],
    }),
    [],
  );

  const pieOption = useMemo(
    () => ({
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
      legend: { orient: 'vertical', right: 16, top: 'center' },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { show: true, formatter: '{b}\n{d}%' },
          data: pieData.map((item, idx) => ({
            ...item,
            itemStyle: { color: [PRIMARY, SECONDARY, '#8CB4D5', '#D4A574'][idx % 4] },
          })),
        },
      ],
    }),
    [],
  );

  const handleExportPDF = () => {
    message.success('PDF导出功能开发中');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <DatePicker
          picker="month"
          value={selectedMonth}
          onChange={(v) => v && setSelectedMonth(v)}
          style={{ width: 200 }}
        />
        <Button
          type="primary"
          icon={<FileDown size={16} />}
          onClick={handleExportPDF}
          style={{ background: PRIMARY, borderColor: PRIMARY }}
        >
          导出PDF
        </Button>
      </div>

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月总成本"
              value={mockMonthlyReport.totalCost}
              prefix={<DollarSign size={18} color={PRIMARY} />}
              suffix="¥"
              valueStyle={{ color: PRIMARY }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: '#52c41a', fontSize: 13 }}>
              <TrendingUp size={14} /> 12.5%
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="电费合计"
              value={mockMonthlyReport.totalElectricityCost}
              prefix={<Zap size={18} color={SECONDARY} />}
              suffix="¥"
              valueStyle={{ color: SECONDARY }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: '#ff4d4f', fontSize: 13 }}>
              <TrendingDown size={14} /> 3.2%
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="原料合计"
              value={mockMonthlyReport.totalMaterialCost}
              prefix={<Beaker size={18} color="#D4A574" />}
              suffix="¥"
              valueStyle={{ color: '#D4A574' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: '#52c41a', fontSize: 13 }}>
              <TrendingUp size={14} /> 5.8%
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="工时合计"
              value={mockMonthlyReport.totalLaborCost}
              prefix={<Clock size={18} color="#8CB4D5" />}
              suffix="¥"
              valueStyle={{ color: '#8CB4D5' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: '#52c41a', fontSize: 13 }}>
              <TrendingUp size={14} /> 1.4%
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card title="每日成本明细">
            <ReactECharts option={barOption} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="窑炉成本分布">
            <ReactECharts option={pieOption} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>

      <Card title="成本记录明细">
        <Table
          dataSource={enrichedRecords}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>
    </div>
  );
}
