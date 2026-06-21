import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  RefreshCw,
  Upload as UploadIcon,
  Download,
  FilterX,
  Edit3,
  Trash2,
  Workflow,
  Eye,
} from 'lucide-react';
import {
  Card as AntCard,
  Button as AntButton,
  DatePicker as AntDatePicker,
  Checkbox as AntCheckbox,
  Select as AntSelect,
  Input as AntInput,
  Table as AntTable,
  Tag as AntTag,
  Space as AntSpace,
  Drawer as AntDrawer,
  Tooltip as AntTooltip,
  Popconfirm as AntPopconfirm,
  Descriptions as AntDescriptions,
  Divider as AntDivider,
  Avatar as AntAvatar,
  Badge as AntBadge,
  Upload as AntUpload,
  message as AntMessage,
} from 'antd';
import type { UploadProps } from 'antd';
import type {
  MaintenanceTask,
  VoltageLevel,
  MaintenanceCategory,
  ApprovalStatus,
  EquipmentType,
} from '@/types';
import { usePlanSelector, usePlanStore } from '@/store/planStore';
import { useEquipmentStore } from '@/store/equipmentStore';
import { formatDateTime } from '@/utils/dateUtils';
import { exportMonthlyPlanExcel } from '@/utils/exportUtils';
import ScheduleGrid from '@/components/ScheduleGrid';
import PlanForm from '@/components/PlanForm';
import ApprovalFlow from '@/components/ApprovalFlow';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

const { RangePicker } = AntDatePicker;
const { Search: AntSearch } = AntInput;

const VOLTAGE_LEVELS: VoltageLevel[] = ['500kV', '220kV', '110kV'];

const CATEGORY_OPTIONS: { label: string; value: MaintenanceCategory; color: string }[] = [
  { label: '一次设备停电检修', value: 'primary_outage', color: 'red' },
  { label: '二次设备校验', value: 'secondary_calibration', color: 'blue' },
  { label: '线路走廊砍伐', value: 'corridor_clearing', color: 'green' },
  { label: '技改工程施工', value: 'technical_reform', color: 'orange' },
];

const EQUIPMENT_TYPES: { label: string; value: EquipmentType }[] = [
  { label: '主变压器', value: 'transformer' },
  { label: '断路器', value: 'breaker' },
  { label: '隔离开关', value: 'disconnector' },
  { label: '母线', value: 'busbar' },
  { label: '线路', value: 'line' },
];

const STATUS_OPTIONS: { label: string; value: ApprovalStatus; color: string; icon: string }[] = [
  { label: '草稿', value: 'draft', color: 'default', icon: '📝' },
  { label: '待审核', value: 'submitted', color: 'processing', icon: '⏳' },
  { label: '审核中', value: 'reviewing', color: 'blue', icon: '🔍' },
  { label: '已批准', value: 'approved', color: 'success', icon: '✅' },
  { label: '已驳回', value: 'rejected', color: 'error', icon: '❌' },
  { label: '已完成', value: 'completed', color: 'purple', icon: '🏁' },
];

const getStatusTag = (status: ApprovalStatus) => {
  const opt = STATUS_OPTIONS.find((s) => s.value === status);
  return (
    <AntTag
      color={opt?.color as any}
      className="!text-xs !py-0 !h-6 !leading-6 !px-3 font-medium"
    >
      {opt ? `${opt.icon} ${opt.label}` : status}
    </AntTag>
  );
};

const getCategoryTag = (cat: MaintenanceCategory) => {
  const opt = CATEGORY_OPTIONS.find((c) => c.value === cat);
  return (
    <AntTag
      color={opt?.color as any}
      bordered={false}
      className="!text-xs !py-0 !h-5 !leading-5"
    >
      {opt?.label || cat}
    </AntTag>
  );
};

const PlanSchedule = () => {
  const {
    tasks,
    filteredTasks,
    loading,
    initTasks,
    setFilters,
    filters,
    deleteTask,
    setEditingTask,
    setSelectedTask,
    editingTask,
  } = usePlanSelector((state) => ({
    tasks: state.tasks,
    filteredTasks: state.filteredTasks,
    loading: state.loading,
    initTasks: state.initTasks,
    setFilters: state.setFilters,
    filters: state.filters,
    deleteTask: state.deleteTask,
    setEditingTask: state.setEditingTask,
    setSelectedTask: state.setSelectedTask,
    editingTask: state.editingTask,
  }));
  const { substations, initData } = useEquipmentStore();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [approvalDrawerOpen, setApprovalDrawerOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedTask, setSelectedTaskLocal] = useState<MaintenanceTask | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    initTasks();
    initData();
  }, [initTasks, initData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await initTasks();
    setRefreshing(false);
    AntMessage.success('数据已刷新');
  };

  const handleExport = () => {
    exportMonthlyPlanExcel(filteredTasks.length > 0 ? filteredTasks : tasks, substations);
  };

  const uploadProps: UploadProps = {
    name: 'file',
    accept: '.xlsx,.xls,.csv',
    showUploadList: false,
    beforeUpload: (file) => {
      AntMessage.success(`已选择文件：${file.name}，正在解析...`);
      return false;
    },
  };

  const handleEdit = (task: MaintenanceTask) => {
    setEditingTask(task);
    setPlanFormOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteTask(id);
    AntMessage.success('任务已删除');
  };

  const handleOpenApproval = (task: MaintenanceTask) => {
    if (!task) return;
    setSelectedTaskLocal(task);
    setSelectedTask(task.id);
    setApprovalDrawerOpen(true);
  };

  const handleOpenDetail = (task: MaintenanceTask) => {
    setSelectedTaskLocal(task);
    setDetailDrawerOpen(true);
  };

  const handleCreateNew = () => {
    setEditingTask(null);
    setPlanFormOpen(true);
  };

  const handleSearch = (value: string) => {
    setFilters({ keyword: value || undefined });
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters({
      timeRange: undefined,
      voltageLevels: undefined,
      categories: undefined,
      statuses: undefined,
      keyword: undefined,
      department: undefined,
      equipmentTypes: undefined,
    });
    setPage(1);
  };

  const getEquipmentVoltage = (task: MaintenanceTask) => {
    const station = substations.find((s) => task.affectedStationIds.includes(s.id));
    return station?.voltageLevel || '—';
  };

  const getEquipmentName = (task: MaintenanceTask) => {
    if (task.equipmentId) return task.equipmentId;
    if (task.lineId) return task.lineId;
    return '—';
  };

  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, page, pageSize]);

  const getEquipmentFullName = (task: MaintenanceTask) => {
    if (task.equipmentId) {
      const eq = useEquipmentStore.getState().equipments.find(e => e.id === task.equipmentId);
      if (eq) {
        const station = substations.find(s => s.id === eq.substationId);
        return station ? `${station.name}·${eq.name}` : eq.name;
      }
      return task.equipmentId;
    }
    if (task.lineId) {
      const line = useEquipmentStore.getState().lines.find(l => l.id === task.lineId);
      if (line) return line.name;
      return task.lineId;
    }
    return '—';
  };

  const columns = [
    {
      title: '任务名',
      dataIndex: 'title',
      key: 'title',
      width: 260,
      fixed: 'left' as const,
      render: (_: unknown, record: MaintenanceTask) => (
        <div className="flex items-center gap-2 min-w-0">
          <AntBadge
            status={record.approvalStatus === 'rejected' ? 'error' : record.approvalStatus === 'approved' ? 'success' : record.approvalStatus === 'completed' ? 'default' : 'processing'}
          />
          <AntTooltip title={record.title}>
            <span className="font-medium text-slate-800 truncate">{record.title}</span>
          </AntTooltip>
        </div>
      ),
    },
    {
      title: '设备名',
      dataIndex: 'equipmentName',
      key: 'equipmentName',
      width: 200,
      render: (_: unknown, record: MaintenanceTask) => (
        <AntTooltip title={getEquipmentFullName(record)}>
          <span className="text-slate-700 text-sm truncate block">{getEquipmentFullName(record)}</span>
        </AntTooltip>
      ),
    },
    {
      title: '电压等级',
      dataIndex: 'voltage',
      key: 'voltage',
      width: 100,
      render: (_: unknown, record: MaintenanceTask) => (
        <AntTag color="geekblue" bordered={false} className="!text-xs !py-0 !h-5">
          {getEquipmentVoltage(record)}
        </AntTag>
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
      title: '计划时间',
      dataIndex: 'time',
      key: 'time',
      width: 320,
      render: (_: unknown, record: MaintenanceTask) => (
        <div className="text-xs text-slate-600 leading-relaxed">
          <div>{formatDateTime(record.startTime)}</div>
          <div className="text-slate-400 mt-0.5">至 {formatDateTime(record.endTime)}</div>
        </div>
      ),
    },
    {
      title: '时长h',
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
      width: 100,
      render: (name: string) => (
        <div className="flex items-center gap-2">
          <AntAvatar
            size={24}
            className="!w-6 !h-6 !text-[11px] bg-gradient-to-br from-dispatch-400 to-dispatch-600"
          >
            {name.charAt(0)}
          </AntAvatar>
          <span className="text-sm text-slate-700">{name}</span>
        </div>
      ),
    },
    {
      title: '审批状态',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      width: 120,
      render: (v: ApprovalStatus) => getStatusTag(v),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right' as const,
      render: (_: unknown, record: MaintenanceTask) => (
        <AntSpace size="small" wrap>
          <AntTooltip title="查看详情">
            <AntButton
              type="link"
              size="small"
              icon={<Eye size={14} />}
              onClick={() => handleOpenDetail(record)}
              className="!h-auto !p-0"
            />
          </AntTooltip>
          <AntTooltip title="审批流程">
            <AntButton
              type="link"
              size="small"
              icon={<Workflow size={14} />}
              onClick={() => handleOpenApproval(record)}
              className="!h-auto !p-0 !text-dispatch-600"
            />
          </AntTooltip>
          {record.approvalStatus === 'draft' && (
            <>
              <AntTooltip title="编辑">
                <AntButton
                  type="link"
                  size="small"
                  icon={<Edit3 size={14} />}
                  onClick={() => handleEdit(record)}
                  className="!h-auto !p-0"
                />
              </AntTooltip>
              <AntTooltip title="删除">
                <AntPopconfirm
                  title="确定删除该任务？"
                  description="删除后将无法恢复"
                  onConfirm={() => handleDelete(record.id)}
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <AntButton
                    type="link"
                    size="small"
                    danger
                    icon={<Trash2 size={14} />}
                    className="!h-auto !p-0"
                  />
                </AntPopconfirm>
              </AntTooltip>
            </>
          )}
        </AntSpace>
      ),
    },
  ];

  return (
    <div className="page-container space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">检修计划调度</h1>
          <p className="text-sm text-slate-500">创建、管理和调度电网检修计划任务</p>
        </div>
        <AntSpace size="middle">
          <AntButton
            type="primary"
            size="large"
            icon={<Plus size={16} />}
            onClick={handleCreateNew}
            className="!h-11 !px-6"
          >
            新建任务
          </AntButton>
          <AntUpload {...uploadProps}>
            <AntButton size="large" icon={<UploadIcon size={16} />} className="!h-11">
              批量导入
            </AntButton>
          </AntUpload>
          <AntButton
            size="large"
            icon={<Download size={16} />}
            onClick={handleExport}
            className="!h-11"
          >
            批量导出
          </AntButton>
          <AntButton
            size="large"
            icon={<RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />}
            onClick={handleRefresh}
            className="!h-11"
          >
            刷新
          </AntButton>
        </AntSpace>
      </div>

      <AntCard className="!shadow-sm" size="small">
        <div className="flex items-center gap-2 mb-4 font-medium text-slate-700 text-sm">
          <FilterX size={14} className="text-dispatch-500" />
          筛选条件
        </div>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3">
            <div className="text-xs text-slate-500 mb-1.5">时间范围</div>
            <RangePicker
              value={filters.timeRange ? [dayjs(filters.timeRange[0]), dayjs(filters.timeRange[1])] as any : null}
              onChange={(v) =>
                setFilters({
                  timeRange: v ? [(v[0] as Dayjs).valueOf(), (v[1] as Dayjs).valueOf()] : undefined,
                })
              }
              style={{ width: '100%' }}
              placeholder={['开始日期', '结束日期']}
            />
          </div>
          <div className="col-span-3">
            <div className="text-xs text-slate-500 mb-1.5">电压等级</div>
            <AntCheckbox.Group
              value={filters.voltageLevels || []}
              onChange={(v) =>
                setFilters({
                  voltageLevels: v.length > 0 ? (v as VoltageLevel[]) : undefined,
                })
              }
              options={VOLTAGE_LEVELS.map((vl) => ({ label: vl, value: vl }))}
              className="!flex !gap-4 !flex-wrap"
            />
          </div>
          <div className="col-span-2">
            <div className="text-xs text-slate-500 mb-1.5">设备类型</div>
            <AntSelect
              allowClear
              mode="multiple"
              maxTagCount="responsive"
              placeholder="全部类型"
              value={filters.equipmentTypes || []}
              onChange={(v) =>
                setFilters({ equipmentTypes: v.length > 0 ? (v as EquipmentType[]) : undefined })
              }
              options={EQUIPMENT_TYPES}
              style={{ width: '100%' }}
            />
          </div>
          <div className="col-span-2">
            <div className="text-xs text-slate-500 mb-1.5">检修类型</div>
            <AntSelect
              allowClear
              mode="multiple"
              maxTagCount="responsive"
              value={filters.categories || []}
              onChange={(v) =>
                setFilters({ categories: v.length > 0 ? (v as MaintenanceCategory[]) : undefined })
              }
              placeholder="全部类型"
              options={CATEGORY_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="col-span-2">
            <div className="text-xs text-slate-500 mb-1.5">审批状态</div>
            <AntSelect
              allowClear
              mode="multiple"
              maxTagCount="responsive"
              value={filters.statuses || []}
              onChange={(v) =>
                setFilters({ statuses: v.length > 0 ? (v as ApprovalStatus[]) : undefined })
              }
              placeholder="全部状态"
              options={STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="col-span-8">
            <div className="text-xs text-slate-500 mb-1.5">关键词搜索</div>
            <AntSearch
              allowClear
              placeholder="输入任务名称、设备名、申请人等关键词..."
              defaultValue={filters.keyword}
              onSearch={handleSearch}
              enterButton
              size="large"
            />
          </div>
          <div className="col-span-4 flex items-end gap-2 justify-end">
            <AntButton
              size="large"
              icon={<FilterX size={16} />}
              onClick={handleResetFilters}
              className="!h-10"
            >
              重置
            </AntButton>
            <AntButton
              type="primary"
              size="large"
              icon={<Search size={16} />}
              onClick={() => setPage(1)}
              className="!h-10"
            >
              查询
            </AntButton>
          </div>
        </div>
      </AntCard>

      <div className="h-[520px]">
        <ScheduleGrid />
      </div>

      <AntCard className="!shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-slate-800">任务列表</span>
            <AntTag color="geekblue" bordered={false} className="!text-xs">
              共 {filteredTasks.length} 条
            </AntTag>
          </div>
        </div>
        <AntTable
          rowKey="id"
          loading={loading}
          columns={columns as any}
          dataSource={pagedData}
          scroll={{ x: 1600, y: 500 }}
          size="middle"
          pagination={{
            current: page,
            pageSize,
            total: filteredTasks.length,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (t, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          onRow={(record) => ({
            onDoubleClick: () => handleOpenDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      </AntCard>

      <PlanForm
        open={planFormOpen}
        onClose={() => setPlanFormOpen(false)}
        editingTask={editingTask as MaintenanceTask | null}
      />

      <AntDrawer
        title={
          <span className="text-base font-semibold text-slate-800 inline-flex items-center gap-2">
            <Workflow size={16} className="text-dispatch-600" />
            审批流程：{selectedTask?.title}
          </span>
        }
        width={560}
        open={approvalDrawerOpen}
        onClose={() => setApprovalDrawerOpen(false)}
        maskClosable
        destroyOnClose
        extra={
          selectedTask && (
            <AntTag color="geekblue" bordered={false} className="!ml-2">
              编号：{selectedTask.id}
            </AntTag>
          )
        }
      >
        {selectedTask && <ApprovalFlow task={selectedTask} currentRole="reviewer" />}
      </AntDrawer>

      <AntDrawer
        title={
          <span className="text-base font-semibold text-slate-800 inline-flex items-center gap-2">
            <Eye size={16} className="text-dispatch-600" />
            任务详情
          </span>
        }
        width={720}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        maskClosable
        destroyOnHidden
      >
        {selectedTask && (
          <div className="space-y-5">
            <AntDescriptions
              title={<span className="text-sm font-semibold text-dispatch-700">基本信息</span>}
              column={2}
              size="small"
              bordered
            >
              <AntDescriptions.Item label="任务名称" span={2}>
                <span className="font-medium">{selectedTask.title}</span>
              </AntDescriptions.Item>
              <AntDescriptions.Item label="编号">
                <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{selectedTask.id}</code>
              </AntDescriptions.Item>
              <AntDescriptions.Item label="审批状态">
                {getStatusTag(selectedTask.approvalStatus)}
              </AntDescriptions.Item>
              <AntDescriptions.Item label="检修类型">
                {getCategoryTag(selectedTask.category)}
              </AntDescriptions.Item>
              <AntDescriptions.Item label="电压等级">
                <AntTag color="geekblue" bordered={false}>
                  {getEquipmentVoltage(selectedTask)}
                </AntTag>
              </AntDescriptions.Item>
              <AntDescriptions.Item label="开始时间" span={2}>
                {formatDateTime(selectedTask.startTime)}
              </AntDescriptions.Item>
              <AntDescriptions.Item label="结束时间" span={2}>
                {formatDateTime(selectedTask.endTime)}
              </AntDescriptions.Item>
              <AntDescriptions.Item label="停电时长">
                <span className="font-semibold tabular-nums">{selectedTask.outageDurationH} 小时</span>
              </AntDescriptions.Item>
              <AntDescriptions.Item label="损失容量">
                <span className="font-semibold tabular-nums text-red-600">{selectedTask.lostCapacity} MVA</span>
              </AntDescriptions.Item>
              <AntDescriptions.Item label="申请人">
                <div className="flex items-center gap-2">
                  <AntAvatar size={20} className="!w-5 !h-5 !text-[10px] bg-gradient-to-br from-dispatch-400 to-dispatch-600">
                    {selectedTask.applicant.charAt(0)}
                  </AntAvatar>
                  {selectedTask.applicant}
                </div>
              </AntDescriptions.Item>
              <AntDescriptions.Item label="所属部门">
                {selectedTask.department}
              </AntDescriptions.Item>
              <AntDescriptions.Item label="影响用户等级">
                <AntTag color={selectedTask.affectedUserLevel === 'A' ? 'red' : selectedTask.affectedUserLevel === 'B' ? 'orange' : 'blue'} bordered={false}>
                  {selectedTask.affectedUserLevel}级用户
                </AntTag>
              </AntDescriptions.Item>
              <AntDescriptions.Item label="停电级别">
                <AntTag color={selectedTask.outageLevel === 'level1' ? 'red' : selectedTask.outageLevel === 'level2' ? 'orange' : 'green'} bordered={false}>
                  {selectedTask.outageLevel === 'level1' ? '一级停电' : selectedTask.outageLevel === 'level2' ? '二级停电' : '三级停电'}
                </AntTag>
              </AntDescriptions.Item>
            </AntDescriptions>

            <AntDescriptions
              title={<span className="text-sm font-semibold text-dispatch-700">工作内容</span>}
              column={1}
              size="small"
              bordered
            >
              <AntDescriptions.Item label="工作描述">
                <p className="text-sm text-slate-700 leading-relaxed m-0">
                  {selectedTask.workContent || '—'}
                </p>
              </AntDescriptions.Item>
              {selectedTask.loadTransferPlan && (
                <AntDescriptions.Item label="负荷转移方案">
                  <p className="text-sm text-slate-700 leading-relaxed m-0">
                    {selectedTask.loadTransferPlan}
                  </p>
                </AntDescriptions.Item>
              )}
              <AntDescriptions.Item label="影响变电站">
                <AntSpace size="small" wrap>
                  {selectedTask.affectedStationIds.map((sid) => {
                    const s = substations.find((st) => st.id === sid);
                    return (
                      <AntTag key={sid} color="purple" bordered={false}>
                        {s?.name || sid}
                      </AntTag>
                    );
                  })}
                </AntSpace>
              </AntDescriptions.Item>
            </AntDescriptions>

            <AntDivider className="!my-2" />
            <div className="flex justify-end gap-2">
              <AntButton onClick={() => setDetailDrawerOpen(false)}>关闭</AntButton>
              <AntButton
                type="primary"
                icon={<Workflow size={14} />}
                onClick={() => {
                  setDetailDrawerOpen(false);
                  setTimeout(() => handleOpenApproval(selectedTask), 200);
                }}
              >
                查看审批流程
              </AntButton>
            </div>
          </div>
        )}
      </AntDrawer>
    </div>
  );
};

export default PlanSchedule;
