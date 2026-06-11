import { useState, useMemo } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Table, Button, message } from 'antd';
import { Zap, Beaker, Clock, DollarSign, FileDown, TrendingUp, TrendingDown } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import dayjs, { type Dayjs } from 'dayjs';
import { jsPDF } from 'jspdf';
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
  const [exporting, setExporting] = useState(false);

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

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;

      const formatCurrency = (val: number) => `¥${val.toFixed(2)}`;

      const addFooter = (pageNum: number, totalPages: number) => {
        doc.setFontSize(9);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Page ${pageNum} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      };

      const buildPage1 = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(232, 96, 44);
        doc.text('Glass Studio - Monthly Cost Report', pageWidth / 2, 30, {
          align: 'center',
        });

        doc.setFontSize(14);
        doc.setTextColor(60, 60, 60);
        doc.text(selectedMonth.format('YYYY-MM'), pageWidth / 2, 42, {
          align: 'center',
        });

        doc.setFontSize(10);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Generated at: ${dayjs().format('YYYY-MM-DD HH:mm')}`,
          pageWidth / 2,
          52,
          { align: 'center' }
        );

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Summary', margin, 70);

        const stats = [
          { label: 'Total Cost', value: mockMonthlyReport.totalCost, color: '#E8602C' },
          { label: 'Electricity', value: mockMonthlyReport.totalElectricityCost, color: '#3B6FA0' },
          { label: 'Material', value: mockMonthlyReport.totalMaterialCost, color: '#D4A574' },
          { label: 'Labor', value: mockMonthlyReport.totalLaborCost, color: '#8CB4D5' },
        ];

        const cardWidth = (contentWidth - 10) / 2;
        const cardHeight = 32;
        const startY = 80;

        stats.forEach((stat, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const x = margin + col * (cardWidth + 10);
          const y = startY + row * (cardHeight + 10);

          doc.setDrawColor(220, 220, 220);
          doc.setFillColor(250, 250, 250);
          doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(120, 120, 120);
          doc.text(stat.label, x + 8, y + 12);

          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(
            parseInt(stat.color.slice(1, 3), 16),
            parseInt(stat.color.slice(3, 5), 16),
            parseInt(stat.color.slice(5, 7), 16)
          );
          doc.text(formatCurrency(stat.value), x + 8, y + 24);
        });

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(
          `Total Firing Count: ${mockMonthlyReport.firingCount}`,
          margin,
          startY + 2 * (cardHeight + 10)
        );
      };

      const buildTablePages = () => {
        doc.addPage();

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Cost Breakdown', margin, 25);

        const tableTop = 35;
        const rowHeight = 8;
        const headerHeight = 10;

        const colHeaders = [
          'Schedule ID',
          'Kiln',
          'Member',
          'Electricity',
          'Material',
          'Labor',
          'Total',
          'Per Unit',
        ];

        const colWidths = [22, 22, 22, 24, 22, 20, 24, 24];
        const totalColWidth = colWidths.reduce((a, b) => a + b, 0);
        const tableLeft = (pageWidth - totalColWidth) / 2;

        let currentY = tableTop;

        const drawHeader = (y: number) => {
          doc.setFillColor(245, 245, 245);
          doc.setDrawColor(200, 200, 200);
          doc.rect(tableLeft, y, totalColWidth, headerHeight, 'FD');

          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(60, 60, 60);

          let x = tableLeft;
          colHeaders.forEach((header, i) => {
            doc.text(header, x + colWidths[i] / 2, y + 6.5, { align: 'center' });
            x += colWidths[i];
          });
        };

        const drawRow = (
          y: number,
          record: (typeof enrichedRecords)[0],
          isAlt: boolean,
          isTotal?: boolean
        ) => {
          if (isAlt && !isTotal) {
            doc.setFillColor(250, 250, 250);
            doc.rect(tableLeft, y, totalColWidth, rowHeight, 'F');
          }

          doc.setDrawColor(220, 220, 220);
          doc.line(tableLeft, y, tableLeft + totalColWidth, y);

          const values = [
            String(record.scheduleId),
            record.kilnName,
            record.memberName,
            formatCurrency(record.electricityCost),
            formatCurrency(record.materialCost),
            formatCurrency(record.laborCost),
            formatCurrency(record.totalCost),
            formatCurrency(record.costPerWorkpiece),
          ];

          doc.setFontSize(9);
          doc.setFont(isTotal ? 'helvetica' : 'helvetica', isTotal ? 'bold' : 'normal');
          doc.setTextColor(isTotal ? 232 : 60, isTotal ? 96 : 60, isTotal ? 44 : 60);

          let x = tableLeft;
          values.forEach((val, i) => {
            doc.text(val, x + colWidths[i] / 2, y + 5.5, { align: 'center' });
            x += colWidths[i];
          });

          doc.line(tableLeft, y + rowHeight, tableLeft + totalColWidth, y + rowHeight);
        };

        const checkPageBreak = (y: number, needed: number): number => {
          if (y + needed > pageHeight - margin) {
            doc.addPage();
            drawHeader(margin);
            return margin + headerHeight;
          }
          return y;
        };

        drawHeader(currentY);
        currentY += headerHeight;

        const totalsRecord = {
          scheduleId: 0,
          kilnName: '',
          memberName: '',
          electricityCost: 0,
          materialCost: 0,
          laborCost: 0,
          totalCost: 0,
          costPerWorkpiece: 0,
        };

        enrichedRecords.forEach((r) => {
          totalsRecord.electricityCost += r.electricityCost;
          totalsRecord.materialCost += r.materialCost;
          totalsRecord.laborCost += r.laborCost;
          totalsRecord.totalCost += r.totalCost;
        });

        enrichedRecords.forEach((record, idx) => {
          currentY = checkPageBreak(currentY, rowHeight + 4);
          drawRow(currentY, record, idx % 2 === 1);
          currentY += rowHeight;
        });

        currentY = checkPageBreak(currentY, rowHeight + 10);
        currentY += 4;

        const totalRow = {
          id: -1,
          scheduleId: 0,
          kilnName: 'Total',
          memberName: '',
          electricityCost: totalsRecord.electricityCost,
          materialCost: totalsRecord.materialCost,
          laborCost: totalsRecord.laborCost,
          totalCost: totalsRecord.totalCost,
          costPerWorkpiece: 0,
        };

        doc.setFillColor(255, 245, 240);
        doc.rect(tableLeft, currentY, totalColWidth, rowHeight, 'F');
        drawRow(currentY, totalRow, false, true);
      };

      buildPage1();
      buildTablePages();

      const totalPages = doc.internal.pages.length;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(i, totalPages);
      }

      const filename = `glass-studio-cost-report-${selectedMonth.format('YYYY-MM')}.pdf`;
      doc.save(filename);

      message.success('报表导出成功');
    } catch (error) {
      console.error('PDF export failed:', error);
      message.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
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
          loading={exporting}
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
