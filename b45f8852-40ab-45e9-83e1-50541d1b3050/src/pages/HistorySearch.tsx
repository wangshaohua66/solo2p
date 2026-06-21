import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  DatePicker,
  Select,
  Input,
  Table,
  Tag,
  Space,
  Drawer,
  Descriptions,
  Divider,
  Avatar,
  Upload,
  message,
  Empty,
  Tooltip,
} from 'antd';
import type { UploadProps } from 'antd';
import {
  Search as SearchIcon,
  FilterX,
  CalendarRange,
  FileText,
  Download,
  Upload as UploadIcon,
  Eye,
  User,
  Clock,
  CheckCircle2,
  FileCheck,
  FileWarning,
} from 'lucide-react';
import type {
  MaintenanceTask,
  VoltageLevel,
  MaintenanceCategory,
  ApprovalStatus,
} from '@/types';
import { usePlanStore } from '@/store/planStore';
import { useEquipmentStore } from '@/store/equipmentStore';
import { formatDateTime } from '@/utils/dateUtils';
import { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { Search } = Input;

const VOLTAGE_LEVELS: VoltageLevel[] = ['500kV', '220kV', '110kV'];

const CATEGORY_OPTIONS: { label: string; value: MaintenanceCategory; color: string }[] = [
  { label: '一次设备停电检修', value: 'primary_outage', color: 'red' },
  { label: '二次设备校验', value: 'secondary_calibration', color: 'blue' },
  { label: '线路走廊砍伐', value: 'corridor_clearing', color: 'green' },
  { label: '技改工程施工', value: 'technical_reform', color: 'orange' },
];

const STATUS_OPTIONS: { label: string; value: ApprovalStatus; color: string; icon: string }[] = [
  { label: '草稿', value: 'draft', color: 'default', icon: '📝' },
  { label: '待审核', value: 'submitted', color: 'processing', icon: '⏳' },
  { label: '审核中', value: 'reviewing', color: 'blue', icon: '🔍' },
  { label: '已批准', value: 'approved', color: 'success', icon: '✅' },
  { label: '已驳回', value: 'rejected', color: 'error', icon: '❌' },
  { label: '已完成', value: 'completed', color: 'purple', icon: '🏁' },
];

interface ReportFile {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedAt: number;
}

const mockReportFiles: ReportFile[] = [
  { id: 'r-001', name: '检修报告_20260615.pdf', size: '2.4MB', type: 'PDF', uploadedAt: Date.now() - 3 * 24 * 3600 * 1000 },
  { id: 'r-002', name: '验收记录_20260615.xlsx', size: '186KB', type: 'Excel', uploadedAt: Date.now() - 3 * 24 * 3600 * 1000 + 3600000 },
  { id: 'r-003', name: '现场照片_20260615.zip', size: '18.6MB', type: 'ZIP', uploadedAt: Date.now() - 3 * 24 * 3600 * 1000 + 7200000 },
];

const getStatusTag = (status: ApprovalStatus) => {
  const opt = STATUS_OPTIONS.find((s) => s.value === status);
  return (
    <Tag color={opt?.color as any} className="!text-xs !py-0 !h-6 !leading-6 !px-3 font-medium">
      {opt ? `${opt.icon} ${opt.label}` : status}
    </Tag>
  );
};

const getCategoryTag = (cat: MaintenanceCategory) => {
  const opt = CATEGORY_OPTIONS.find((c) => c.value === cat);
  return (
    <Tag color={opt?.color as any} bordered={false} className="!text-xs !py-0 !h-5 !leading-5">
      {opt?.label || cat}
    </Tag>
  );
};

const HistorySearch = () => {
  const tasks = usePlanStore((s) => s.tasks);
  const initTasks = usePlanStore((s) => s.initTasks);
  const { substations, initData } = useEquipmentStore();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [filterTimeRange, setFilterTimeRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [filterVoltage, setFilterVoltage] = useState<VoltageLevel[]>([]);
  const [filterCategory, setFilterCategory] = useState<MaintenanceCategory[]>([]);
  const [filterStatus, setFilterStatus] = useState<ApprovalStatus[]>([]);
  const [filterApplicant, setFilterApplicant] = useState<string>('');
  const [filterKeyword, setFilterKeyword] = useState<string>('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);

  useEffect(() => {
    initTasks();
    initData();
  }, [initTasks, initData]);

  const filteredData = useMemo(() => {
    return tasks.filter((t) => {
      if (filterTimeRange && filterTimeRange[0] && filterTimeRange[1]) {
        const s = filterTimeRange[0].valueOf();
        const e = filterTimeRange[1].valueOf();
        if (t.endTime < s || t.startTime > e) return false;
      }
      if (filterVoltage.length > 0) {
        const station = substations.find((s) => t.affectedStationIds.includes(s.id));
        if (!station || !filterVoltage.includes(station.voltageLevel)) return false;
      }
      if (filterCategory.length > 0 && !filterCategory.includes(t.category)) return false;
      if (filterStatus.length > 0 && !filterStatus.includes(t.approvalStatus)) return false;
      if (filterApplicant && !t.applicant.includes(filterApplicant)) return false;
      if (filterKeyword) {
        const kw = filterKeyword.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(kw);
        const matchContent = t.workContent.toLowerCase().includes(kw);
        const matchDept = t.department.toLowerCase().includes(kw);
        if (!matchTitle && !matchContent && !matchDept) return false;
      }
      return true;
    });
  }, [tasks, filterTimeRange, filterVoltage, filterCategory, filterStatus, filterApplicant, filterKeyword, substations]);

  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  const handleReset = () => {
    setFilterTimeRange(null);
    setFilterVoltage([]);
    setFilterCategory([]);
    setFilterStatus([]);
    setFilterApplicant('');
    setFilterKeyword('');
    setPage(1);
  };

  const handleSearch = () => {
    setPage(1);
    message.success(`查询完成，共找到 ${filteredData.length} 条记录`);
  };

  const getVoltage = (task: MaintenanceTask) => {
    const s = substations.find((st) => task.affectedStationIds.includes(st.id));
    return s?.voltageLevel || '—';
  };

  const fileUploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    beforeUpload: (file) => {
      message.success(`文件 ${file.name} 上传中...`);
      return false;
    },
  };

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'title',
      key: 'title',
      width: 280,
      fixed: 'left' as const,
      render: (v: string, record: MaintenanceTask) => (
        <Tooltip title={v}>
          <span
            className="font-medium text-slate-800 truncate cursor-pointer hover:text-dispatch-600 transition-colors"
            onClick={() => {
              setSelectedTask(record);
              setDetailOpen(true);
            }}
          >
            {v}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '设备/变电站',
      dataIndex: 'station',
      key: 'station',
      width: 200,
      render: (_: unknown, record: MaintenanceTask) => {
        const stationNames = record.affectedStationIds
          .map((sid) => substations.find((s) => s.id === sid)?.name)
          .filter(Boolean)
          .join('、');
        return (
          <span className="text-sm text-slate-600">
            {stationNames || record.equipmentId || record.lineId || '—'}
          </span>
        );
      },
    },
    {
      title: '电压等级',
      dataIndex: 'voltage',
      key: 'voltage',
      width: 100,
      render: (_: unknown, r: MaintenanceTask) => (
        <Tag color="geekblue" bordered={false} className="!text-xs !py-0 !h-5">
          {getVoltage(r)}
        </Tag>
      ),
    },
    {
      title: '检修类型',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (v: MaintenanceCategory) => getCategoryTag(v),
    },
    {
      title: '执行时间',
      dataIndex: 'time',
      key: 'time',
      width: 260,
      render: (_: unknown, r: MaintenanceTask) => (
        <div className="text-xs text-slate-600 leading-relaxed">
          <div>{formatDateTime(r.startTime)}</div>
          <div className="text-slate-400 mt-0.5">至 {formatDateTime(r.endTime)}</div>
        </div>
      ),
    },
    {
      title: '时长(h)',
      dataIndex: 'outageDurationH',
      key: 'outageDurationH',
      width: 80,
      align: 'center' as const,
      render: (v: number) => (
        <span className="font-semibold tabular-nums text-slate-700">{v}</span>
      ),
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 120,
      render: (name: string) => (
        <div className="flex items-center gap-2">
          <Avatar
            size={24}
            className="!w-6 !h-6 !text-[11px] bg-gradient-to-br from-dispatch-400 to-dispatch-600"
            icon={<User size={12} />}
          >
            {name.charAt(0)}
          </Avatar>
          <span className="text-sm text-slate-700">{name}</span>
        </div>
      ),
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 140,
      render: (v: string) => <span className="text-sm text-slate-600">{v}</span>,
    },
    {
      title: '审批状态',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      width: 110,
      render: (v: ApprovalStatus) => getStatusTag(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: unknown, record: MaintenanceTask) => (
        <Tooltip title="查看详情与验收报告">
          <Button
            type="link"
            size="small"
            icon={<Eye size={14} />}
            onClick={() => {
              setSelectedTask(record);
              setDetailOpen(true);
            }}
            className="!h-auto !p-0"
          >
            查看
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="page-container space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">历史记录查询</h1>
        <p className="text-sm text-slate-500">查询历史检修任务、查看验收报告与相关资料</p>
      </div>

      <Card className="!shadow-sm" title={<span className="text-sm font-semibold text-slate-700 inline-flex items-center gap-2"><FilterX size={14} className="text-dispatch-500" />高级筛选条件</span>}>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-4">
            <div className="text-xs text-slate-500 mb-1.5 inline-flex items-center gap-1"><FileText size={11} />设备名称 / 关键词</div>
            <Search
              allowClear
              placeholder="输入任务名称、设备、部门、工作内容等关键词..."
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              onSearch={handleSearch}
              enterButton={<span className="inline-flex items-center gap-1"><SearchIcon size={14} />搜索</span>}
              size="large"
            />
          </div>

          <div className="col-span-4">
            <div className="text-xs text-slate-500 mb-1.5 inline-flex items-center gap-1"><CalendarRange size={11} />检修时间范围</div>
            <RangePicker
              value={filterTimeRange as any}
              onChange={(v) => setFilterTimeRange(v as any)}
              style={{ width: '100%' }}
              size="large"
              placeholder={['开始日期', '结束日期']}
            />
          </div>

          <div className="col-span-4">
            <div className="text-xs text-slate-500 mb-1.5 inline-flex items-center gap-1"><User size={11} />申请人</div>
            <Input
              allowClear
              placeholder="请输入申请人姓名"
              value={filterApplicant}
              onChange={(e) => setFilterApplicant(e.target.value)}
              size="large"
            />
          </div>

          <div className="col-span-3">
            <div className="text-xs text-slate-500 mb-1.5">电压等级</div>
            <Select
              allowClear
              mode="multiple"
              maxTagCount="responsive"
              value={filterVoltage}
              onChange={(v) => setFilterVoltage(v as VoltageLevel[])}
              placeholder="全部电压等级"
              size="large"
              style={{ width: '100%' }}
              options={VOLTAGE_LEVELS.map((vl) => ({ label: vl, value: vl }))}
            />
          </div>

          <div className="col-span-3">
            <div className="text-xs text-slate-500 mb-1.5">检修类型</div>
            <Select
              allowClear
              mode="multiple"
              maxTagCount="responsive"
              value={filterCategory}
              onChange={(v) => setFilterCategory(v as MaintenanceCategory[])}
              placeholder="全部类型"
              size="large"
              style={{ width: '100%' }}
              options={CATEGORY_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
            />
          </div>

          <div className="col-span-3">
            <div className="text-xs text-slate-500 mb-1.5">审批状态</div>
            <Select
              allowClear
              mode="multiple"
              maxTagCount="responsive"
              value={filterStatus}
              onChange={(v) => setFilterStatus(v as ApprovalStatus[])}
              placeholder="全部状态"
              size="large"
              style={{ width: '100%' }}
              options={STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
            />
          </div>

          <div className="col-span-3 flex items-end gap-2 justify-end">
            <Button size="large" icon={<FilterX size={16} />} onClick={handleReset} className="!h-10">重置</Button>
            <Button type="primary" size="large" icon={<SearchIcon size={16} />} onClick={handleSearch} className="!h-10">查询</Button>
          </div>
        </div>
      </Card>

      <Card className="!shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-slate-800">历史记录</span>
            <Tag color="geekblue" bordered={false} className="!text-xs">共 {filteredData.length} 条</Tag>
          </div>
          <Space size="middle">
            <Upload {...fileUploadProps}>
              <Button size="large" icon={<UploadIcon size={16} />} className="!h-10">上传报告</Button>
            </Upload>
            <Button size="large" icon={<Download size={16} />} className="!h-10">导出结果</Button>
          </Space>
        </div>
        <Table
          rowKey="id"
          columns={columns as any}
          dataSource={pagedData}
          scroll={{ x: 1700, y: 520 }}
          size="middle"
          locale={{ emptyText: <Empty description="暂无符合条件的历史记录" /> }}
          pagination={{
            current: page,
            pageSize,
            total: filteredData.length,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (t, range) => `第 ${range[0]}-${range[1]} 条，共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      <Drawer
        title={<span className="text-base font-semibold text-slate-800 inline-flex items-center gap-2"><FileCheck size={16} className="text-dispatch-600" />任务详情与验收报告</span>}
        width={720}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        maskClosable
        destroyOnHidden
      >
        {selectedTask && (
          <div className="space-y-5">
            <Descriptions
              title={<span className="text-sm font-semibold text-dispatch-700">基本信息</span>}
              column={2}
              size="small"
              bordered
            >
              <Descriptions.Item label="任务名称" span={2}>
                <span className="font-medium">{selectedTask.title}</span>
              </Descriptions.Item>
              <Descriptions.Item label="编号">
                <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{selectedTask.id}</code>
              </Descriptions.Item>
              <Descriptions.Item label="审批状态">{getStatusTag(selectedTask.approvalStatus)}</Descriptions.Item>
              <Descriptions.Item label="检修类型">{getCategoryTag(selectedTask.category)}</Descriptions.Item>
              <Descriptions.Item label="电压等级">
                <Tag color="geekblue" bordered={false}>{getVoltage(selectedTask)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="开始时间" span={2}>{formatDateTime(selectedTask.startTime)}</Descriptions.Item>
              <Descriptions.Item label="结束时间" span={2}>{formatDateTime(selectedTask.endTime)}</Descriptions.Item>
              <Descriptions.Item label="停电时长"><span className="font-semibold tabular-nums">{selectedTask.outageDurationH} 小时</span></Descriptions.Item>
              <Descriptions.Item label="损失容量"><span className="font-semibold tabular-nums text-red-600">{selectedTask.lostCapacity} MVA</span></Descriptions.Item>
              <Descriptions.Item label="申请人">{selectedTask.applicant}</Descriptions.Item>
              <Descriptions.Item label="所属部门">{selectedTask.department}</Descriptions.Item>
            </Descriptions>

            <Descriptions
              title={<span className="text-sm font-semibold text-dispatch-700">工作内容</span>}
              column={1}
              size="small"
              bordered
            >
              <Descriptions.Item label="工作描述">
                <p className="text-sm text-slate-700 leading-relaxed m-0">{selectedTask.workContent || '—'}</p>
              </Descriptions.Item>
              <Descriptions.Item label="影响变电站">
                <Space size="small" wrap>
                  {selectedTask.affectedStationIds.map((sid) => {
                    const s = substations.find((st) => st.id === sid);
                    return <Tag key={sid} color="purple" bordered={false}>{s?.name || sid}</Tag>;
                  })}
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <Divider className="!my-2" />

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-dispatch-700 inline-flex items-center gap-2"><FileText size={14} />验收报告与相关文件</div>
                <Upload {...fileUploadProps}>
                  <Button size="small" type="primary" icon={<UploadIcon size={12} />} className="!h-8">
                    上传文件
                  </Button>
                </Upload>
              </div>

              {mockReportFiles.length === 0 ? (
                <Empty description="暂无报告文件" image={Empty.PRESENTED_IMAGE_SIMPLE} className="!py-8" />
              ) : (
                <div className="space-y-2">
                  {mockReportFiles.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-dispatch-50/40 hover:border-dispatch-200 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-dispatch-50 to-dispatch-100 flex items-center justify-center flex-shrink-0">
                          {f.type === 'PDF' ? (
                            <FileWarning size={20} className="text-red-500" />
                          ) : f.type === 'Excel' ? (
                            <FileCheck size={20} className="text-emerald-500" />
                          ) : (
                            <FileText size={20} className="text-dispatch-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate group-hover:text-dispatch-700">{f.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                            <Tag color={f.type === 'PDF' ? 'red' : f.type === 'Excel' ? 'green' : 'blue'} bordered={false} className="!text-[10px] !py-0 !h-4 !leading-4">{f.type}</Tag>
                            <span>{f.size}</span>
                            <span className="inline-flex items-center gap-0.5"><Clock size={10} />{formatDateTime(f.uploadedAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip title="预览">
                          <Button type="link" size="small" icon={<Eye size={13} />} className="!p-0 !h-auto">预览</Button>
                        </Tooltip>
                        <Tooltip title="下载">
                          <Button type="link" size="small" icon={<Download size={13} />} className="!p-0 !h-auto">下载</Button>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Divider className="!my-2" />

            <Descriptions
              title={<span className="text-sm font-semibold text-dispatch-700 inline-flex items-center gap-2"><CheckCircle2 size={14} />验收结论</span>}
              column={1}
              size="small"
              bordered
            >
              <Descriptions.Item label="验收结果">
                <div className="flex items-center gap-2">
                  <Tag color="success" icon={<CheckCircle2 size={12} />} className="!py-0 !h-6 font-medium">验收合格</Tag>
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="验收人">张工 / 李工</Descriptions.Item>
              <Descriptions.Item label="验收时间">{formatDateTime(selectedTask.endTime + 3600 * 1000)}</Descriptions.Item>
              <Descriptions.Item label="验收备注">
                <p className="text-sm text-slate-700 leading-relaxed m-0">
                  检修工作已按计划完成，设备各项试验数据合格，现场清理完毕，安全措施已拆除，具备送电条件。
                </p>
              </Descriptions.Item>
            </Descriptions>

            <Divider className="!my-2" />
            <div className="flex justify-end">
              <Button onClick={() => setDetailOpen(false)}>关闭</Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default HistorySearch;
