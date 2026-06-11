import { useState, useMemo } from 'react';
import { Tabs, Table, Select, Button, Tag, Drawer, Modal, Form, Input, Timeline, Space, message } from 'antd';
import { AlertTriangle, Eye, CheckCircle, Plus, List, Clock } from 'lucide-react';
import { mockIncidents, mockKilnOpenRecords, mockKilns } from '@/mocks';
import type { IncidentType, IncidentSeverity, Incident } from '@/types';

const PRIMARY = '#E8602C';

const SEVERITY_COLOR: Record<IncidentSeverity, string> = {
  LOW: 'blue',
  MEDIUM: 'orange',
  HIGH: 'red',
};

const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
};

const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  UNAUTHORIZED_OPEN: '违规开窑',
  TEMPERATURE_ANOMALY: '温度异常',
  OTHER: '其他',
};

export default function IncidentsPage() {
  const [activeTab, setActiveTab] = useState('incidents');
  const [typeFilter, setTypeFilter] = useState<IncidentType | undefined>();
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | undefined>();
  const [resolvedFilter, setResolvedFilter] = useState<boolean | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [kilnFilter, setKilnFilter] = useState<number | undefined>();
  const [violationFilter, setViolationFilter] = useState<boolean | undefined>();
  const [openRecordModalOpen, setOpenRecordModalOpen] = useState(false);
  const [openRecordForm] = Form.useForm();
  const [incidents, setIncidents] = useState(mockIncidents);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((i) => {
      if (typeFilter && i.type !== typeFilter) return false;
      if (severityFilter && i.severity !== severityFilter) return false;
      if (resolvedFilter !== undefined && i.resolved !== resolvedFilter) return false;
      return true;
    });
  }, [incidents, typeFilter, severityFilter, resolvedFilter]);

  const filteredKilnOpenRecords = useMemo(() => {
    return mockKilnOpenRecords.filter((r) => {
      if (kilnFilter && r.kilnId !== kilnFilter) return false;
      if (violationFilter !== undefined && r.isViolation !== violationFilter) return false;
      return true;
    });
  }, [kilnFilter, violationFilter]);

  const handleMarkResolved = (id: number) => {
    setIncidents((prev) =>
      prev.map((i) => (i.id === id ? { ...i, resolved: true, resolvedAt: new Date().toISOString().slice(0, 19) } : i)),
    );
    message.success('已标记为已解决');
  };

  const incidentColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '会员', dataIndex: 'memberName', key: 'memberName', width: 90 },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (v: IncidentType) => <Tag>{INCIDENT_TYPE_LABEL[v]}</Tag>,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (v: IncidentSeverity) => <Tag color={SEVERITY_COLOR[v]}>{SEVERITY_LABEL[v]}</Tag>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '是否已解决',
      dataIndex: 'resolved',
      key: 'resolved',
      width: 100,
      render: (v: boolean) =>
        v ? <Tag color="green">已解决</Tag> : <Tag color="red">未解决</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => v.replace('T', ' '),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: unknown, record: Incident) => (
        <Space>
          <Button
            size="small"
            icon={<Eye size={14} />}
            onClick={() => {
              setSelectedIncident(record);
              setDrawerOpen(true);
            }}
          >
            详情
          </Button>
          {!record.resolved && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircle size={14} />}
              onClick={() => handleMarkResolved(record.id)}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              标记已解决
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const openRecordColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '窑炉', dataIndex: 'kilnName', key: 'kilnName', width: 90 },
    { title: '关联排程', dataIndex: 'scheduleId', key: 'scheduleId', width: 100 },
    { title: '操作人', dataIndex: 'operatorName', key: 'operatorName', width: 90 },
    {
      title: '开窑时间',
      dataIndex: 'openTime',
      key: 'openTime',
      width: 170,
      render: (v: string) => v.replace('T', ' '),
    },
    {
      title: '开窑温度',
      dataIndex: 'temperatureAtOpen',
      key: 'temperatureAtOpen',
      width: 110,
      render: (v: number) => `${v}°C`,
    },
    {
      title: '是否违规',
      dataIndex: 'isViolation',
      key: 'isViolation',
      width: 100,
      render: (v: boolean) =>
        v ? <Tag color="red">违规</Tag> : <Tag color="green">正常</Tag>,
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
    },
  ];

  const incidentTimelineItems = filteredIncidents.map((i) => ({
    color: SEVERITY_COLOR[i.severity] as string,
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>#{i.id} {i.memberName}</span>
          <Tag>{INCIDENT_TYPE_LABEL[i.type]}</Tag>
          <Tag color={SEVERITY_COLOR[i.severity]}>{SEVERITY_LABEL[i.severity]}</Tag>
          {i.resolved ? <Tag color="green">已解决</Tag> : <Tag color="red">未解决</Tag>}
        </div>
        <span style={{ color: '#666', fontSize: 13 }}>{i.description}</span>
        <span style={{ color: '#999', fontSize: 12 }}>{i.createdAt.replace('T', ' ')}</span>
      </div>
    ),
  }));

  const renderIncidentsTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Select
            allowClear
            placeholder="类型筛选"
            style={{ width: 140 }}
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { label: '违规开窑', value: 'UNAUTHORIZED_OPEN' },
              { label: '温度异常', value: 'TEMPERATURE_ANOMALY' },
              { label: '其他', value: 'OTHER' },
            ]}
          />
          <Select
            allowClear
            placeholder="严重程度"
            style={{ width: 120 }}
            value={severityFilter}
            onChange={setSeverityFilter}
            options={[
              { label: '低', value: 'LOW' },
              { label: '中', value: 'MEDIUM' },
              { label: '高', value: 'HIGH' },
            ]}
          />
          <Select
            allowClear
            placeholder="解决状态"
            style={{ width: 120 }}
            value={resolvedFilter}
            onChange={setResolvedFilter}
            options={[
              { label: '未解决', value: false },
              { label: '已解决', value: true },
            ]}
          />
        </Space>
        <Space>
          <Button
            icon={viewMode === 'table' ? <Clock size={14} /> : <List size={14} />}
            onClick={() => setViewMode(viewMode === 'table' ? 'timeline' : 'table')}
          >
            {viewMode === 'table' ? '时间线视图' : '表格视图'}
          </Button>
        </Space>
      </div>

      {viewMode === 'table' ? (
        <Table
          dataSource={filteredIncidents}
          columns={incidentColumns}
          rowKey="id"
          size="middle"
          onRow={(record) => ({
            onClick: () => {
              setSelectedIncident(record);
              setDrawerOpen(true);
            },
            style: { cursor: 'pointer' },
          })}
        />
      ) : (
        <Timeline items={incidentTimelineItems} />
      )}
    </div>
  );

  const renderOpenRecordsTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Select
            allowClear
            placeholder="窑炉筛选"
            style={{ width: 140 }}
            value={kilnFilter}
            onChange={setKilnFilter}
            options={mockKilns.map((k) => ({ label: k.name, value: k.id }))}
          />
          <Select
            allowClear
            placeholder="违规状态"
            style={{ width: 120 }}
            value={violationFilter}
            onChange={setViolationFilter}
            options={[
              { label: '违规', value: true },
              { label: '正常', value: false },
            ]}
          />
        </Space>
        <Button
          type="primary"
          icon={<Plus size={14} />}
          onClick={() => setOpenRecordModalOpen(true)}
          style={{ background: PRIMARY, borderColor: PRIMARY }}
        >
          记录开窑
        </Button>
      </div>

      <Table
        dataSource={filteredKilnOpenRecords}
        columns={openRecordColumns}
        rowKey="id"
        size="middle"
        rowClassName={(record) => (record.isViolation ? 'violation-row' : '')}
      />
    </div>
  );

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'incidents',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} /> 事故记录
              </span>
            ),
            children: renderIncidentsTab(),
          },
          {
            key: 'openRecords',
            label: '开窑记录',
            children: renderOpenRecordsTab(),
          },
        ]}
      />

      <Drawer
        title="事故详情"
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedIncident(null);
        }}
        width={480}
      >
        {selectedIncident && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span style={{ color: '#999' }}>ID: </span>
              <span style={{ fontWeight: 600 }}>#{selectedIncident.id}</span>
            </div>
            <div>
              <span style={{ color: '#999' }}>会员: </span>
              <span>{selectedIncident.memberName}</span>
            </div>
            <div>
              <span style={{ color: '#999' }}>类型: </span>
              <Tag>{INCIDENT_TYPE_LABEL[selectedIncident.type]}</Tag>
            </div>
            <div>
              <span style={{ color: '#999' }}>严重程度: </span>
              <Tag color={SEVERITY_COLOR[selectedIncident.severity]}>
                {SEVERITY_LABEL[selectedIncident.severity]}
              </Tag>
            </div>
            <div>
              <span style={{ color: '#999' }}>描述: </span>
              <p style={{ margin: '4px 0' }}>{selectedIncident.description}</p>
            </div>
            <div>
              <span style={{ color: '#999' }}>状态: </span>
              {selectedIncident.resolved ? (
                <Tag color="green">已解决</Tag>
              ) : (
                <Tag color="red">未解决</Tag>
              )}
            </div>
            <div>
              <span style={{ color: '#999' }}>创建时间: </span>
              <span>{selectedIncident.createdAt.replace('T', ' ')}</span>
            </div>
            {selectedIncident.resolvedAt && (
              <div>
                <span style={{ color: '#999' }}>解决时间: </span>
                <span>{selectedIncident.resolvedAt.replace('T', ' ')}</span>
              </div>
            )}
            {!selectedIncident.resolved && (
              <Button
                type="primary"
                icon={<CheckCircle size={14} />}
                onClick={() => {
                  handleMarkResolved(selectedIncident.id);
                  setSelectedIncident({ ...selectedIncident, resolved: true });
                }}
                style={{ background: '#52c41a', borderColor: '#52c41a', marginTop: 8 }}
              >
                标记已解决
              </Button>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        title="记录开窑"
        open={openRecordModalOpen}
        onOk={() => {
          openRecordForm.validateFields().then(() => {
            message.success('开窑记录已添加');
            setOpenRecordModalOpen(false);
            openRecordForm.resetFields();
          });
        }}
        onCancel={() => {
          setOpenRecordModalOpen(false);
          openRecordForm.resetFields();
        }}
        okText="提交"
        cancelText="取消"
      >
        <Form form={openRecordForm} layout="vertical">
          <Form.Item name="kilnId" label="窑炉" rules={[{ required: true, message: '请选择窑炉' }]}>
            <Select placeholder="请选择窑炉">
              {mockKilns.map((k) => (
                <Select.Option key={k.id} value={k.id}>
                  {k.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="scheduleId" label="关联排程ID" rules={[{ required: true, message: '请输入排程ID' }]}>
            <Input type="number" placeholder="请输入排程ID" />
          </Form.Item>
          <Form.Item name="temperature" label="开窑温度 (°C)" rules={[{ required: true, message: '请输入温度' }]}>
            <Input type="number" placeholder="请输入温度" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .violation-row {
          background: #fff2f0 !important;
        }
        .violation-row:hover > td {
          background: #ffccc7 !important;
        }
      `}</style>
    </div>
  );
}
