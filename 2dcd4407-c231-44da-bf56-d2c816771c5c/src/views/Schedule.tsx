import { useState, useEffect } from 'react';
import { Card, Button, Space, Modal, Form, Input, Select, DatePicker, message, Tag, Row, Col, Statistic } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckCircleOutlined, LockOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons';
import ScheduleGantt from '../components/ScheduleGantt';
import { useScheduleStore } from '../stores/scheduleStore';
import { generateMockVenues } from '../utils/mockData';
import type { Schedule, Venue } from '../types';
import { formatDate } from '../utils/dateUtils';

const { RangePicker } = DatePicker;
const { Option } = Select;

const SchedulePage: React.FC = () => {
  const { schedules, venues, loading, fetchSchedules, createSchedule, approveSchedule, lockSchedule, cancelSchedule, checkConflict } = useScheduleStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [conflicts, setConflicts] = useState<Schedule[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    if (venues.length === 0) {
      useScheduleStore.setState({ venues: generateMockVenues() });
    }
    fetchSchedules();
  }, [fetchSchedules, venues.length]);

  const handleScheduleClick = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setDetailVisible(true);
  };

  const handleScheduleDragEnd = async (schedule: Schedule, newStart: string, newEnd: string) => {
    const conflictResult = await checkConflict(schedule.id, newStart, newEnd, schedule.venueIds);
    if (conflictResult.hasConflict) {
      setConflicts(conflictResult.conflicts);
      Modal.confirm({
        title: '档期冲突警告',
        icon: <WarningOutlined className="text-red-500" />,
        content: (
          <div>
            <p className="mb-2">调整后的档期与以下档期存在冲突：</p>
            {conflictResult.conflicts.map(c => (
              <Tag key={c.id} color="red" className="mb-1">
                {c.exhibitionName} ({formatDate(c.startDate)} - {formatDate(c.endDate)})
              </Tag>
            ))}
          </div>
        ),
        okText: '确认调整',
        cancelText: '取消',
        onOk: async () => {
          message.success('档期已调整，冲突已记录');
        },
      });
    } else {
      message.success('档期调整成功');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const [startDate, endDate] = values.dateRange;
      const newSchedule: Partial<Schedule> = {
        exhibitionName: values.exhibitionName,
        organizerName: values.organizerName,
        venueIds: values.venueIds,
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
        setupStartDate: startDate.subtract(2, 'day').format('YYYY-MM-DD'),
        teardownEndDate: endDate.add(1, 'day').format('YYYY-MM-DD'),
        exhibitionType: values.exhibitionType,
        expectedVisitors: values.expectedVisitors,
        description: values.description,
        status: 'pending',
      };
      await createSchedule(newSchedule as Schedule);
      message.success('档期申请已提交');
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('提交失败，请重试');
    }
  };

  const handleApprove = async () => {
    if (selectedSchedule) {
      await approveSchedule(selectedSchedule.id);
      message.success('档期已批准');
      setDetailVisible(false);
    }
  };

  const handleLock = async () => {
    if (selectedSchedule) {
      await lockSchedule(selectedSchedule.id);
      message.success('档期已锁定');
      setDetailVisible(false);
    }
  };

  const handleCancel = async () => {
    if (selectedSchedule) {
      Modal.confirm({
        title: '确认取消',
        content: `确定要取消档期「${selectedSchedule.exhibitionName}」吗？`,
        onOk: async () => {
          await cancelSchedule(selectedSchedule.id);
          message.success('档期已取消');
          setDetailVisible(false);
        },
      });
    }
  };

  const statistics = {
    total: schedules.length,
    pending: schedules.filter(s => s.status === 'pending').length,
    approved: schedules.filter(s => s.status === 'approved' || s.status === 'locked').length,
    ongoing: schedules.filter(s => s.status === 'ongoing').length,
    completed: schedules.filter(s => s.status === 'completed').length,
    conflict: schedules.filter(s => s.hasConflict).length,
  };

  return (
    <div className="space-y-6">
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="总档期" value={statistics.total} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="待审批" value={statistics.pending} valueStyle={{ color: '#eab308' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="已批准" value={statistics.approved} valueStyle={{ color: '#3b82f6' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="进行中" value={statistics.ongoing} valueStyle={{ color: '#22c55e' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="已完成" value={statistics.completed} valueStyle={{ color: '#6b7280' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="冲突" value={statistics.conflict} valueStyle={{ color: '#ef4444' }} />
          </Card>
        </Col>
      </Row>

      <Card
        title="档期管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => fetchSchedules()}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              申请档期
            </Button>
          </Space>
        }
      >
        <ScheduleGantt
          schedules={schedules}
          venues={venues}
          loading={loading}
          onScheduleClick={handleScheduleClick}
          onScheduleDragEnd={handleScheduleDragEnd}
        />
      </Card>

      <Modal
        title="申请新档期"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="exhibitionName"
            label="展会名称"
            rules={[{ required: true, message: '请输入展会名称' }]}
          >
            <Input placeholder="请输入展会名称" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="organizerName"
                label="主办方"
                rules={[{ required: true, message: '请输入主办方' }]}
              >
                <Input placeholder="请输入主办方名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="exhibitionType"
                label="展会类型"
                rules={[{ required: true, message: '请选择展会类型' }]}
              >
                <Select placeholder="请选择类型">
                  <Option value="消费类">消费类</Option>
                  <Option value="科技类">科技类</Option>
                  <Option value="医疗类">医疗类</Option>
                  <Option value="文化类">文化类</Option>
                  <Option value="工业类">工业类</Option>
                  <Option value="食品类">食品类</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="venueIds"
            label="选择展厅/会议室"
            rules={[{ required: true, message: '请选择场地' }]}
          >
            <Select mode="multiple" placeholder="请选择场地">
              {venues.map(v => (
                <Option key={v.id} value={v.id}>
                  {v.name} ({v.area}㎡)
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="dateRange"
            label="展览日期"
            rules={[{ required: true, message: '请选择日期范围' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="expectedVisitors"
            label="预计观众数"
            rules={[{ required: true, message: '请输入预计观众数' }]}
          >
            <Input type="number" placeholder="请输入预计观众数" />
          </Form.Item>
          <Form.Item name="description" label="备注说明">
            <Input.TextArea rows={3} placeholder="请输入备注说明" />
          </Form.Item>
          <Form.Item className="!mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交申请</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="档期详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          selectedSchedule && selectedSchedule.status === 'pending' ? (
            <Space>
              <Button danger icon={<CloseCircleOutlined />} onClick={handleCancel}>
                取消档期
              </Button>
              <Button icon={<LockOutlined />} onClick={handleLock}>
                锁定
              </Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleApprove}>
                批准
              </Button>
            </Space>
          ) : selectedSchedule && selectedSchedule.status !== 'cancelled' && selectedSchedule.status !== 'completed' ? (
            <Space>
              {(selectedSchedule.status === 'approved' || selectedSchedule.status === 'ongoing') && (
                <Button danger icon={<CloseCircleOutlined />} onClick={handleCancel}>
                  取消档期
                </Button>
              )}
              {selectedSchedule.status === 'approved' && (
                <Button icon={<LockOutlined />} onClick={handleLock}>
                  锁定
                </Button>
              )}
            </Space>
          ) : null
        }
        width={600}
      >
        {selectedSchedule && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">{selectedSchedule.exhibitionName}</h3>
              <Tag color={selectedSchedule.status === 'approved' ? 'blue' : selectedSchedule.status === 'pending' ? 'gold' : selectedSchedule.status === 'ongoing' ? 'green' : 'gray'}>
                {selectedSchedule.status === 'pending' ? '待审批' : selectedSchedule.status === 'approved' ? '已批准' : selectedSchedule.status === 'locked' ? '已锁定' : selectedSchedule.status === 'ongoing' ? '进行中' : selectedSchedule.status === 'completed' ? '已完成' : '已取消'}
              </Tag>
            </div>
            <Row gutter={16}>
              <Col span={12}>
                <div className="text-gray-500 text-sm">主办方</div>
                <div className="font-medium">{selectedSchedule.organizerName}</div>
              </Col>
              <Col span={12}>
                <div className="text-gray-500 text-sm">展会类型</div>
                <div className="font-medium">{selectedSchedule.exhibitionType}</div>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <div className="text-gray-500 text-sm">展览日期</div>
                <div className="font-medium">{formatDate(selectedSchedule.startDate)} ~ {formatDate(selectedSchedule.endDate)}</div>
              </Col>
              <Col span={12}>
                <div className="text-gray-500 text-sm">预计观众</div>
                <div className="font-medium">{selectedSchedule.expectedVisitors?.toLocaleString()} 人</div>
              </Col>
            </Row>
            <div>
              <div className="text-gray-500 text-sm mb-1">使用场地</div>
              <div className="flex flex-wrap gap-1">
                {selectedSchedule.venues?.map(v => (
                  <Tag key={v.id}>{v.name}</Tag>
                ))}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-sm mb-1">搭建/撤展</div>
              <div className="text-sm">
                搭建: {formatDate(selectedSchedule.setupStartDate)}<br />
                撤展: {formatDate(selectedSchedule.teardownEndDate)}
              </div>
            </div>
            {selectedSchedule.description && (
              <div>
                <div className="text-gray-500 text-sm mb-1">备注说明</div>
                <div className="text-sm">{selectedSchedule.description}</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SchedulePage;
