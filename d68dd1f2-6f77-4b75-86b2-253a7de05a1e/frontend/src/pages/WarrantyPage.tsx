import React, { useState, useEffect } from 'react';
import {
  Card, Table, Tag, Space, Typography, Progress, Row, Col, Button, Badge,
  Empty, Alert, Statistic, Avatar, List, Modal, Form, Input, message, Segmented
} from 'antd';
import {
  SafetyCertificateOutlined, BellOutlined, MailOutlined, CalendarOutlined,
  ClockCircleOutlined, SendOutlined, ReloadOutlined, HistoryOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { warrantyApi } from '@/api';
import type { Warranty } from '@/types';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

const WarrantyPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [upcomingList, setUpcomingList] = useState<Warranty[]>([]);
  const [allList, setAllList] = useState<Warranty[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [viewMode, setViewMode] = useState<'upcoming' | 'all'>('upcoming');
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [selectedWarranty, setSelectedWarranty] = useState<Warranty | null>(null);
  const [notifyForm] = Form.useForm();

  useEffect(() => { loadData(); }, [viewMode, page]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (viewMode === 'upcoming') {
        setUpcomingList(await warrantyApi.upcoming(60));
      } else {
        const res = await warrantyApi.list({ page, pageSize });
        setAllList(res.data); setTotal(res.total);
      }
    } finally { setLoading(false); }
  };

  const getStatusConfig = (w: Warranty) => {
    const daysLeft = dayjs(w.endDate).diff(dayjs(), 'day');
    if (daysLeft <= 0) return { color: '#8c8c8c', text: '已过期', status: 'exception' as const, percent: 100 };
    if (daysLeft <= 30) return { color: '#ff4d4f', text: `即将到期 ${daysLeft}天`, status: 'exception' as const, percent: 90 };
    if (daysLeft <= 60) return { color: '#fa8c16', text: `60天内到期 ${daysLeft}天`, status: 'normal' as const, percent: 80 };
    const total = dayjs(w.endDate).diff(w.startDate, 'day');
    const passed = dayjs().diff(w.startDate, 'day');
    return {
      color: daysLeft <= 180 ? '#52c41a' : '#1677ff',
      text: `剩余 ${daysLeft} 天`,
      status: 'active' as const,
      percent: Math.min(Math.round((passed / total) * 100), 100)
    };
  };

  const handleSendNotify = async () => {
    try {
      await notifyForm.validateFields();
      message.success('质保提醒已发送');
      setNotifyModalOpen(false);
      notifyForm.resetFields();
    } catch {}
  };

  const columns = [
    {
      title: '客户', dataIndex: 'customerId', key: 'customer',
      render: () => <Space><Avatar size={28} style={{ backgroundColor: '#722ed1' }}><SafetyCertificateOutlined /></Avatar><span style={{ fontWeight: 500 }}>客户信息</span></Space>
    },
    { title: '质保月数', dataIndex: 'months', key: 'months', width: 100, render: v => <Tag color="purple">{v} 个月</Tag> },
    { title: '起始日期', dataIndex: 'startDate', key: 'startDate', width: 140, render: v => dayjs(v).format('YYYY-MM-DD') },
    { title: '到期日期', dataIndex: 'endDate', key: 'endDate', width: 140, render: v => dayjs(v).format('YYYY-MM-DD') },
    {
      title: '剩余进度', key: 'progress', width: 200,
      render: (_: any, r: Warranty) => {
        const cfg = getStatusConfig(r);
        return (
          <Space direction="vertical" size={0} style={{ width: 160 }}>
            <Progress percent={cfg.percent} size="small" status={cfg.status} strokeColor={cfg.color} showInfo={false} />
            <Space size={4}>
              <Badge color={cfg.color} /><Text type="secondary" style={{ fontSize: 12 }}>{cfg.text}</Text>
            </Space>
          </Space>
        );
      }
    },
    {
      title: '操作', key: 'action', width: 180, fixed: 'right' as const,
      render: (_: any, r: Warranty) => (
        <Space>
          <Button size="small" type="link" icon={<SendOutlined />} onClick={() => { setSelectedWarranty(r); setNotifyModalOpen(true); }}>
            发送提醒
          </Button>
          <Button size="small" type="link" icon={<HistoryOutlined />} onClick={() => navigate(`/work-orders/${r.workOrderId}`)}>
            查看工单
          </Button>
        </Space>
      )
    }
  ];

  const displayList = viewMode === 'upcoming' ? upcomingList : allList;
  const expiringCount = upcomingList.filter(w => dayjs(w.endDate).diff(dayjs(), 'day') <= 30).length;
  const warningCount = upcomingList.filter(w => {
    const d = dayjs(w.endDate).diff(dayjs(), 'day');
    return d > 30 && d <= 60;
  }).length;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <Space size="middle">
            <Title level={4} style={{ margin: 0 }}>
              <SafetyCertificateOutlined /> 质保追踪
            </Title>
            <Segmented
              value={viewMode}
              onChange={v => { setViewMode(v as any); setPage(1); }}
              options={[
                { label: <Space><BellOutlined /> 60天内到期 ({upcomingList.length})</Space>, value: 'upcoming' },
                { label: '全部质保记录', value: 'all' }
              ]}
            />
          </Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title={<Space><BellOutlined style={{ color: '#fa8c16' }} /> 30天内到期</Space>}
                value={expiringCount}
                valueStyle={{ color: '#ff4d4f' }}
              />
              {expiringCount > 0 && (
                <Button type="primary" danger size="small" block style={{ marginTop: 8 }} icon={<SendOutlined />}>
                  一键批量通知
                </Button>
              )}
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title={<Space><ClockCircleOutlined style={{ color: '#faad14' }} /> 31-60天内到期</Space>}
                value={warningCount}
                valueStyle={{ color: '#fa8c16' }}
              />
              {warningCount > 0 && (
                <Button size="small" block style={{ marginTop: 8 }} type="dashed" icon={<MailOutlined />}>
                  邮件提醒
                </Button>
              )}
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title={<Space><SafetyCertificateOutlined style={{ color: '#52c41a' }} /> 有效质保总数</Space>}
                value={viewMode === 'upcoming' ? upcomingList.length : total}
                valueStyle={{ color: '#52c41a' }}
              />
              <Button size="small" block style={{ marginTop: 8 }} type="dashed" icon={<CalendarOutlined />}>
                导出质保清单
              </Button>
            </Card>
          </Col>
        </Row>
      </Card>

      {viewMode === 'upcoming' && upcomingList.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<BellOutlined />}
          message={`有 ${expiringCount} 份质保将在 30 天内到期，建议及时提醒客户进行保养`}
          action={
            <Button size="small" type="primary" ghost danger icon={<SendOutlined />}
              onClick={() => message.success('已发送批量提醒通知')}>
              全部通知
            </Button>
          }
        />
      )}

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={displayList}
          columns={columns}
          pagination={viewMode === 'all' ? {
            current: page, pageSize, total,
            onChange: p => setPage(p),
            showTotal: t => `共 ${t} 条`
          } : false}
          locale={{ emptyText: <Empty description={viewMode === 'upcoming' ? '暂无到期质保，一切正常' : '暂无质保记录'} /> }}
        />
      </Card>

      <Modal
        title="发送质保到期提醒"
        open={notifyModalOpen}
        onCancel={() => setNotifyModalOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setNotifyModalOpen(false)}>取消</Button>
            <Button type="primary" icon={<SendOutlined />} onClick={handleSendNotify}>
              发送通知
            </Button>
          </Space>
        }
      >
        <Form form={notifyForm} layout="vertical">
          <Form.Item label="通知对象">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>站内消息</Text>
                <Switch defaultChecked />
              </div>
              <div>
                <Text strong>邮件通知</Text>
                <Switch defaultChecked />
              </div>
              <div>
                <Text strong>短信提醒（需开通服务）</Text>
                <Switch />
              </div>
            </Space>
          </Form.Item>
          <Form.Item name="message" label="自定义消息内容" initialValue="尊敬的客户，您的腕表质保即将到期，建议进行下一次定期保养。">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default WarrantyPage;
