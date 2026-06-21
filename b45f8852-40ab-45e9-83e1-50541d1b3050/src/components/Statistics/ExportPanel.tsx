import { useState } from 'react';
import {
  Card,
  DatePicker,
  Checkbox,
  Button,
  List,
  Tag,
  message,
  Radio,
  Space,
  Tooltip,
} from 'antd';
import {
  Download,
  FileSpreadsheet,
  Clock,
  RefreshCw,
  History,
  CalendarRange,
  FileText,
  BarChart3,
} from 'lucide-react';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { Dayjs } from 'dayjs';
import { exportMonthlyPlanExcel } from '@/utils/exportUtils';
import { usePlanStore } from '@/store/planStore';
import { useEquipmentStore } from '@/store/equipmentStore';

interface ExportHistoryItem {
  id: string;
  fileName: string;
  fileSize: string;
  exportedAt: number;
  type: 'detail' | 'summary' | 'both';
  period: string;
}

const mockHistory: ExportHistoryItem[] = [
  {
    id: 'exp-001',
    fileName: '月度检修计划_202605.xlsx',
    fileSize: '128KB',
    exportedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    type: 'both',
    period: '2026年5月',
  },
  {
    id: 'exp-002',
    fileName: '检修任务明细_20260515_20260531.xlsx',
    fileSize: '86KB',
    exportedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    type: 'detail',
    period: '2026-05-15 ~ 2026-05-31',
  },
  {
    id: 'exp-003',
    fileName: '月度统计汇总_202604.xlsx',
    fileSize: '42KB',
    exportedAt: Date.now() - 12 * 24 * 60 * 60 * 1000,
    type: 'summary',
    period: '2026年4月',
  },
  {
    id: 'exp-004',
    fileName: '月度检修计划_202604.xlsx',
    fileSize: '156KB',
    exportedAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
    type: 'both',
    period: '2026年4月',
  },
  {
    id: 'exp-005',
    fileName: '检修任务明细_20260401_20260415.xlsx',
    fileSize: '72KB',
    exportedAt: Date.now() - 28 * 24 * 60 * 60 * 1000,
    type: 'detail',
    period: '2026-04-01 ~ 2026-04-15',
  },
];

const TypeTag = ({ type }: { type: ExportHistoryItem['type'] }) => {
  const map = {
    detail: { color: 'blue' as const, label: '明细' },
    summary: { color: 'purple' as const, label: '统计' },
    both: { color: 'green' as const, label: '明细+统计' },
  };
  const { color, label } = map[type];
  return <Tag color={color}>{label}</Tag>;
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ExportPanel = () => {
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [includeDetail, setIncludeDetail] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [format, setFormat] = useState<'excel'>('excel');
  const [exporting, setExporting] = useState(false);

  const tasks = usePlanStore((s) => s.tasks);
  const substations = useEquipmentStore((s) => s.substations);

  const handleDetailChange = (e: CheckboxChangeEvent) => {
    setIncludeDetail(e.target.checked);
  };

  const handleSummaryChange = (e: CheckboxChangeEvent) => {
    setIncludeSummary(e.target.checked);
  };

  const handleExportMonthly = async () => {
    try {
      setExporting(true);
      exportMonthlyPlanExcel(tasks, substations);
      setTimeout(() => {
        message.success('月度检修计划 Excel 导出成功');
        setExporting(false);
      }, 600);
    } catch {
      message.error('导出失败，请稍后重试');
      setExporting(false);
    }
  };

  const handleDownloadHistory = (item: ExportHistoryItem) => {
    message.success(`正在下载：${item.fileName}`);
  };

  return (
    <Card
      className="!shadow-sm"
      title={
        <span className="text-base font-semibold text-slate-800 inline-flex items-center gap-2">
          <Download size={16} className="text-dispatch-600" />
          数据导出
        </span>
      }
    >
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7">
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2.5">
                <CalendarRange size={14} className="text-dispatch-500" />
                选择时间段
              </div>
              <DatePicker.RangePicker
                value={dateRange as any}
                onChange={(v) => setDateRange(v as any)}
                style={{ width: '100%' }}
                size="large"
                placeholder={['开始日期', '结束日期']}
              />
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2.5">
                <BarChart3 size={14} className="text-dispatch-500" />
                数据类型
              </div>
              <Space size="large">
                <Checkbox
                  checked={includeDetail}
                  onChange={handleDetailChange}
                  className="!text-sm"
                >
                  <span className="text-slate-600">任务明细</span>
                </Checkbox>
                <Checkbox
                  checked={includeSummary}
                  onChange={handleSummaryChange}
                  className="!text-sm"
                >
                  <span className="text-slate-600">统计汇总</span>
                </Checkbox>
              </Space>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2.5">
                <FileText size={14} className="text-dispatch-500" />
                导出格式
              </div>
              <Radio.Group
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                optionType="button"
                buttonStyle="solid"
                size="middle"
              >
                <Radio.Button value="excel">
                  <span className="inline-flex items-center gap-1.5">
                    <FileSpreadsheet size={14} />
                    Excel (.xlsx)
                  </span>
                </Radio.Button>
              </Radio.Group>
            </div>

            <div className="pt-2">
              <Tooltip title="基于当前筛选的任务数据导出">
                <Button
                  type="primary"
                  size="large"
                  icon={
                    exporting ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )
                  }
                  onClick={handleExportMonthly}
                  loading={exporting}
                  disabled={!includeDetail && !includeSummary}
                  className="!h-11 !px-8 !text-base font-medium"
                >
                  导出Excel月度计划
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="col-span-5 border-l border-slate-200 pl-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <History size={14} className="text-dispatch-500" />
              历史导出记录
              <span className="text-xs text-slate-400 font-normal">（最近5个）</span>
            </div>
          </div>

          <List
            dataSource={mockHistory}
            split={false}
            locale={{ emptyText: '暂无导出记录' }}
            renderItem={(item) => (
              <List.Item
                className="!px-0 !py-3 border-b border-slate-100 last:border-0"
                actions={[
                  <Tooltip key="dl" title="重新下载">
                    <Button
                      type="link"
                      size="small"
                      icon={<Download size={14} />}
                      onClick={() => handleDownloadHistory(item)}
                      className="!p-0 !h-auto"
                    />
                  </Tooltip>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-dispatch-50 to-dispatch-100 flex items-center justify-center">
                      <FileSpreadsheet size={18} className="text-dispatch-600" />
                    </div>
                  }
                  title={
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 truncate max-w-[180px]">
                        {item.fileName}
                      </span>
                      <TypeTag type={item.type} />
                    </div>
                  }
                  description={
                    <div className="space-y-0.5 mt-1">
                      <div className="text-xs text-slate-500 inline-flex items-center gap-1">
                        <CalendarRange size={11} />
                        {item.period}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} />
                          {formatTime(item.exportedAt)}
                        </span>
                        <span>{item.fileSize}</span>
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </div>
    </Card>
  );
};

export default ExportPanel;
