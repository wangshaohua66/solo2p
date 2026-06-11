import { useState, useMemo } from 'react';
import { Card, Row, Col, Button, Timeline, Modal, Form, Select, Input, DatePicker, Tag, Alert, message } from 'antd';
import { Thermometer, Wrench, AlertTriangle, Calendar } from 'lucide-react';
import ReactECharts from 'echarts-for-react';

import HealthBadge from '@/components/HealthBadge';
import KilnTypeTag from '@/components/KilnTypeTag';
import { mockKilns, mockMaintenanceOrders } from '@/mocks';
import type { HealthStatus, MaintenanceType } from '@/types';

const PRIMARY = '#E8602C';

const healthPercentMap: Record<HealthStatus, number> = {
  HEALTHY: 92,
  WARNING: 68,
  CRITICAL: 35,
};

const MAINTENANCE_TYPE_LABEL: Record<MaintenanceType, { label: string; color: string }> = {
  ROUTINE: { label: '例行维护', color: 'blue' },
  EMERGENCY: { label: '紧急维护', color: 'red' },
};

const STATUS_TAG: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待处理', color: 'orange' },
  IN_PROGRESS: { label: '进行中', color: 'blue' },
  COMPLETED: { label: '已完成', color: 'green' },
};

export default function EquipmentPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const gaugeOptions = useMemo(() => {
    return mockKilns.map((kiln) => ({
      option: {
        series: [
          {
            type: 'gauge',
            startAngle: 220,
            endAngle: -40,
            min: 0,
            max: 100,
            progress: { show: true, width: 14, itemStyle: { color: kiln.healthStatus === 'HEALTHY' ? '#52c41a' : kiln.healthStatus === 'WARNING' ? '#faad14' : '#ff4d4f' } },
            axisLine: { lineStyle: { width: 14, color: [[1, '#e8e8e8']] } },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            pointer: { show: false },
            anchor: { show: false },
            title: { show: false },
            detail: {
              valueAnimation: true,
              fontSize: 22,
              fontWeight: 700,
              color: kiln.healthStatus === 'HEALTHY' ? '#52c41a' : kiln.healthStatus === 'WARNING' ? '#faad14' : '#ff4d4f',
              offsetCenter: [0, 0],
              formatter: '{value}%',
            },
            data: [{ value: healthPercentMap[kiln.healthStatus] }],
          },
        ],
      },
      kiln,
    }));
  }, []);

  const handleSubmit = () => {
    form.validateFields().then(() => {
      message.success('工单创建成功');
      setModalOpen(false);
      form.resetFields();
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Row gutter={16}>
        {gaugeOptions.map(({ option, kiln }) => (
          <Col span={8} key={kiln.id}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 600, color: '#2D2D2D' }}>{kiln.name}</span>
                  <KilnTypeTag type={kiln.type} />
                </div>
                <HealthBadge status={kiln.healthStatus} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 16 }}>
                    <Thermometer size={20} color={PRIMARY} />
                    <span style={{ fontSize: 36, fontWeight: 700, color: PRIMARY }}>{kiln.currentTemperature ?? 0}</span>
                    <span style={{ fontSize: 16, color: '#999' }}>°C</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#666' }}>
                    <span>累计烧制: <b>{kiln.totalFiringCount}</b> 次</span>
                    <span>上次维护: <b>{kiln.lastMaintenanceDate ?? '无'}</b></span>
                    <span>加热阻抗: <b>{kiln.heatingElementImpedance}</b> Ω</span>
                  </div>
                </div>
                <div style={{ width: 130 }}>
                  <ReactECharts option={option} style={{ height: 130 }} />
                </div>
              </div>

              {(kiln.healthStatus === 'WARNING' || kiln.healthStatus === 'CRITICAL') && (
                <Alert
                  style={{ marginTop: 12 }}
                  type={kiln.healthStatus === 'CRITICAL' ? 'error' : 'warning'}
                  showIcon
                  icon={<AlertTriangle size={16} />}
                  message={kiln.healthStatus === 'CRITICAL' ? '设备状态危险，请立即维护' : '设备状态异常，建议安排维护'}
                  action={
                    <Button
                      size="small"
                      danger={kiln.healthStatus === 'CRITICAL'}
                      onClick={() => {
                        form.setFieldsValue({ kilnId: kiln.id });
                        setModalOpen(true);
                      }}
                    >
                      创建工单
                    </Button>
                  }
                />
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        title="维护记录"
        extra={
          <Button
            type="primary"
            icon={<Wrench size={16} />}
            onClick={() => setModalOpen(true)}
            style={{ background: PRIMARY, borderColor: PRIMARY }}
          >
            创建维护工单
          </Button>
        }
      >
        <Timeline
          items={mockMaintenanceOrders.map((order) => ({
            color: order.type === 'EMERGENCY' ? 'red' : 'blue',
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{order.kilnName}</span>
                  <Tag color={MAINTENANCE_TYPE_LABEL[order.type].color}>
                    {MAINTENANCE_TYPE_LABEL[order.type].label}
                  </Tag>
                  <Tag color={STATUS_TAG[order.status]?.color}>
                    {STATUS_TAG[order.status]?.label}
                  </Tag>
                </div>
                <span style={{ color: '#666', fontSize: 13 }}>{order.description}</span>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#999' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={12} /> 计划: {order.scheduledDate}
                  </span>
                  {order.completedDate && <span>完成: {order.completedDate}</span>}
                </div>
              </div>
            ),
          }))}
        />
      </Card>

      <Modal
        title="创建维护工单"
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="kilnId" label="窑炉" rules={[{ required: true, message: '请选择窑炉' }]}>
            <Select placeholder="请选择窑炉">
              {mockKilns.map((k) => (
                <Select.Option key={k.id} value={k.id}>
                  {k.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select placeholder="请选择类型">
              <Select.Option value="ROUTINE">例行维护</Select.Option>
              <Select.Option value="EMERGENCY">紧急维护</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true, message: '请输入描述' }]}>
            <Input.TextArea rows={3} placeholder="请描述维护需求" />
          </Form.Item>
          <Form.Item name="scheduledDate" label="计划日期" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
