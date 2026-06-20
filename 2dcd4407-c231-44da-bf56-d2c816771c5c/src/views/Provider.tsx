import { useState, useEffect } from 'react';
import { Card, Button, Space, Table, Tag, Modal, Form, Input, Select, DatePicker, Rate, message, Row, Col, Statistic, Badge } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, WarningOutlined, StarOutlined } from '@ant-design/icons';
import { generateMockProviders, generateMockServiceOrders } from '../utils/mockData';
import type { ServiceProvider, ServiceOrder } from '../types';
import { formatDate } from '../utils/dateUtils';
import { formatCurrency } from '../utils/exportUtils';

const { Option } = Select;

const serviceTypeLabels: Record<string, string> = {
  construction: '搭建服务',
  logistics: '物流服务',
  catering: '餐饮服务',
  cleaning: '清洁服务',
  security: '安保服务',
  equipment: '设备租赁',
  other: '其他服务',
};

const statusColors: Record<string, string> = {
  pending: 'gold',
  approved: 'green',
  rejected: 'red',
  suspended: 'orange',
  expired: 'gray',
};

const orderStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: '待派单', color: 'gold' },
  assigned: { label: '已派单', color: 'blue' },
  accepted: { label: '已接单', color: 'cyan' },
  in_progress: { label: '进行中', color: 'processing' },
  completed: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'gray' },
};

const ProviderPage: React.FC = () => {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'providers' | 'orders'>('providers');
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [orderDetailVisible, setOrderDetailVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [reviewForm] = Form.useForm();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      setProviders(generateMockProviders(20));
      setOrders(generateMockServiceOrders(30));
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleApprove = (id: string) => {
    Modal.confirm({
      title: '审核通过',
      content: '确定通过该服务商的资质审核吗？',
      onOk: () => {
        setProviders(prev => prev.map(p => p.id === id ? { ...p, status: 'approved' as const } : p));
        message.success('审核通过');
      },
    });
  };

  const handleReject = (id: string) => {
    Modal.confirm({
      title: '审核拒绝',
      content: '确定拒绝该服务商的资质申请吗？',
      onOk: () => {
        setProviders(prev => prev.map(p => p.id === id ? { ...p, status: 'rejected' as const } : p));
        message.success('已拒绝');
      },
    });
  };

  const handleSuspend = (id: string) => {
    Modal.confirm({
      title: '暂停服务',
      content: '确定暂停该服务商的服务资格吗？',
      onOk: () => {
        setProviders(prev => prev.map(p => p.id === id ? { ...p, status: 'suspended' as const } : p));
        message.success('已暂停');
      },
    });
  };

  const handleCompleteOrder = (orderId: string) => {
    Modal.confirm({
      title: '确认完工',
      content: '确定该服务已完成吗？',
      onOk: () => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'completed' as const } : o));
        message.success('已确认完工');
      },
    });
  };

  const handleReviewSubmit = async (values: any) => {
    if (selectedOrder) {
      setOrders(prev => prev.map(o => 
        o.id === selectedOrder.id 
          ? { ...o, rating: values.rating, review: values.review, status: 'completed' as const }
          : o
      ));
      message.success('评价已提交');
      setReviewModalVisible(false);
      reviewForm.resetFields();
    }
  };

  const expiringCount = providers.filter(p => {
    const days = Math.ceil((new Date(p.qualificationExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 30 && p.status === 'approved';
  }).length;

  const providerColumns = [
    {
      title: '服务商名称',
      dataIndex: 'companyName',
      key: 'companyName',
      render: (text: string, record: ServiceProvider) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-xs text-gray-400">{serviceTypeLabels[record.serviceType]}</div>
        </div>
      ),
    },
    {
      title: '联系人',
      dataIndex: 'contactPerson',
      key: 'contactPerson',
      render: (text: string, record: ServiceProvider) => (
        <div>
          <div>{text}</div>
          <div className="text-xs text-gray-400">{record.contactPhone}</div>
        </div>
      ),
    },
    {
      title: '报价范围',
      dataIndex: 'quoteRange',
      key: 'quoteRange',
      render: (range: { min: number; max: number }) => (
        <span>{formatCurrency(range.min)} - {formatCurrency(range.max)}</span>
      ),
    },
    {
      title: '评分',
      dataIndex: 'rating',
      key: 'rating',
      width: 180,
      render: (rating: number, record: ServiceProvider) => (
        <Space>
          <Rate disabled value={rating} allowHalf className="text-sm" />
          <span className="text-gray-500 text-sm">({record.reviewCount})</span>
        </Space>
      ),
    },
    {
      title: '资质到期',
      dataIndex: 'qualificationExpiry',
      key: 'qualificationExpiry',
      render: (date: string) => {
        const days = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return (
          <Space>
            {days <= 30 && <Badge status="warning" />}
            <span className={days <= 30 ? 'text-orange-500' : ''}>
              {formatDate(date)}
              {days <= 30 && ` (${days}天后到期)`}
            </span>
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColors[status]}>
          {status === 'pending' ? '待审核' :
           status === 'approved' ? '已通过' :
           status === 'rejected' ? '已拒绝' :
           status === 'suspended' ? '已暂停' : '已过期'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: ServiceProvider) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => { setSelectedProvider(record); setDetailVisible(true); }}>
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Button type="link" size="small" onClick={() => handleApprove(record.id)}>
                通过
              </Button>
              <Button type="link" size="small" danger onClick={() => handleReject(record.id)}>
                拒绝
              </Button>
            </>
          )}
          {record.status === 'approved' && (
            <Button type="link" size="small" onClick={() => handleSuspend(record.id)}>
              暂停
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const orderColumns = [
    {
      title: '服务单号',
      dataIndex: 'id',
      key: 'id',
      width: 120,
    },
    {
      title: '展会名称',
      dataIndex: 'scheduleName',
      key: 'scheduleName',
    },
    {
      title: '服务商',
      dataIndex: 'providerName',
      key: 'providerName',
    },
    {
      title: '服务类型',
      dataIndex: 'serviceType',
      key: 'serviceType',
      render: (type: string) => serviceTypeLabels[type],
    },
    {
      title: '预约时间',
      dataIndex: 'scheduledTime',
      key: 'scheduledTime',
      render: (time: string) => formatDate(time),
    },
    {
      title: '报价金额',
      dataIndex: 'quotedAmount',
      key: 'quotedAmount',
      render: (amount: number) => formatCurrency(amount),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = orderStatusLabels[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '评价',
      dataIndex: 'rating',
      key: 'rating',
      render: (rating: number) => rating ? <Rate disabled value={rating} allowHalf className="text-xs" /> : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: ServiceOrder) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => { setSelectedOrder(record); setOrderDetailVisible(true); }}>
            详情
          </Button>
          {record.status === 'in_progress' && (
            <Button type="link" size="small" onClick={() => handleCompleteOrder(record.id)}>
              完工
            </Button>
          )}
          {record.status === 'completed' && !record.rating && (
            <Button type="link" size="small" onClick={() => { setSelectedOrder(record); setReviewModalVisible(true); }}>
              评价
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="服务商总数" value={providers.length} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="已审核通过" value={providers.filter(p => p.status === 'approved').length} valueStyle={{ color: '#22c55e' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="待审核" value={providers.filter(p => p.status === 'pending').length} valueStyle={{ color: '#eab308' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="即将到期" value={expiringCount} valueStyle={{ color: '#f97316' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="服务单总数" value={orders.length} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="进行中" value={orders.filter(o => o.status === 'in_progress').length} valueStyle={{ color: '#3b82f6' }} />
          </Card>
        </Col>
      </Row>

      <Card
        tabList={[
          { key: 'providers', tab: '服务商管理' },
          { key: 'orders', tab: '服务订单' },
        ]}
        activeTabKey={activeTab}
        onTabChange={(key) => setActiveTab(key as 'providers' | 'orders')}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />}>
              {activeTab === 'providers' ? '添加服务商' : '新增服务单'}
            </Button>
          </Space>
        }
      >
        {activeTab === 'providers' ? (
          <Table
            columns={providerColumns}
            dataSource={providers}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        ) : (
          <Table
            columns={orderColumns}
            dataSource={orders}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>

      <Modal
        title="服务商详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          selectedProvider && selectedProvider.status === 'pending' ? (
            <Space>
              <Button danger icon={<CloseCircleOutlined />} onClick={() => handleReject(selectedProvider.id)}>
                拒绝
              </Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => handleApprove(selectedProvider.id)}>
                通过审核
              </Button>
            </Space>
          ) : null
        }
        width={600}
      >
        {selectedProvider && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">{selectedProvider.companyName}</h3>
              <Tag color={statusColors[selectedProvider.status]}>
                {selectedProvider.status === 'pending' ? '待审核' :
                 selectedProvider.status === 'approved' ? '已通过' :
                 selectedProvider.status === 'rejected' ? '已拒绝' :
                 selectedProvider.status === 'suspended' ? '已暂停' : '已过期'}
              </Tag>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <Row gutter={16}>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">服务类型</div>
                  <div className="font-medium">{serviceTypeLabels[selectedProvider.serviceType]}</div>
                </Col>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">综合评分</div>
                  <Space>
                    <Rate disabled value={selectedProvider.rating} allowHalf />
                    <span>({selectedProvider.reviewCount}条评价)</span>
                  </Space>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">联系人</div>
                  <div className="font-medium">{selectedProvider.contactPerson}</div>
                </Col>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">联系电话</div>
                  <div className="font-medium">{selectedProvider.contactPhone}</div>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">资质证书</div>
                  <div className="font-medium">{selectedProvider.qualificationCert}</div>
                </Col>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">有效期至</div>
                  <div className="font-medium">
                    <Space>
                      {formatDate(selectedProvider.qualificationExpiry)}
                      {Math.ceil((new Date(selectedProvider.qualificationExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 30 && (
                        <Tag color="orange"><WarningOutlined /> 即将到期</Tag>
                      )}
                    </Space>
                  </div>
                </Col>
              </Row>
              <div>
                <div className="text-gray-500 text-sm">报价范围</div>
                <div className="font-medium">{formatCurrency(selectedProvider.quoteRange.min)} - {formatCurrency(selectedProvider.quoteRange.max)}</div>
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-sm mb-2">公司简介</div>
              <div className="text-sm">{selectedProvider.description}</div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="服务单详情"
        open={orderDetailVisible}
        onCancel={() => setOrderDetailVisible(false)}
        footer={
          selectedOrder && selectedOrder.status === 'in_progress' ? (
            <Space>
              <Button type="primary" onClick={() => handleCompleteOrder(selectedOrder.id)}>
                确认完工
              </Button>
            </Space>
          ) : selectedOrder && selectedOrder.status === 'completed' && !selectedOrder.rating ? (
            <Space>
              <Button type="primary" onClick={() => { setOrderDetailVisible(false); setReviewModalVisible(true); }}>
                服务评价
              </Button>
            </Space>
          ) : null
        }
        width={600}
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">{selectedOrder.id.toUpperCase()}</h3>
              <Tag color={orderStatusLabels[selectedOrder.status].color}>
                {orderStatusLabels[selectedOrder.status].label}
              </Tag>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <Row gutter={16}>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">展会名称</div>
                  <div className="font-medium">{selectedOrder.scheduleName}</div>
                </Col>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">服务类型</div>
                  <div className="font-medium">{serviceTypeLabels[selectedOrder.serviceType]}</div>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">服务商</div>
                  <div className="font-medium">{selectedOrder.providerName}</div>
                </Col>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">服务地点</div>
                  <div className="font-medium">{selectedOrder.location}</div>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">预约时间</div>
                  <div className="font-medium">
                    <Space>
                      <ClockCircleOutlined />
                      {formatDate(selectedOrder.scheduledTime)}
                    </Space>
                  </div>
                </Col>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">预计时长</div>
                  <div className="font-medium">{selectedOrder.estimatedDuration} 小时</div>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">报价金额</div>
                  <div className="font-medium text-lg text-blue-600">{formatCurrency(selectedOrder.quotedAmount)}</div>
                </Col>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">实际金额</div>
                  <div className="font-medium text-lg text-green-600">
                    {selectedOrder.actualAmount ? formatCurrency(selectedOrder.actualAmount) : '待确认'}
                  </div>
                </Col>
              </Row>
              <div>
                <div className="text-gray-500 text-sm">联系人</div>
                <div className="font-medium">{selectedOrder.contactPerson} - {selectedOrder.contactPhone}</div>
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-sm mb-2">服务描述</div>
              <div className="text-sm">{selectedOrder.description}</div>
            </div>
            {selectedOrder.rating && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-gray-500 text-sm mb-2">服务评价</div>
                <Space className="mb-2">
                  <Rate disabled value={selectedOrder.rating} allowHalf />
                  <span className="font-medium">{selectedOrder.rating}分</span>
                </Space>
                <div className="text-sm">{selectedOrder.review}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="服务评价"
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={reviewForm} layout="vertical" onFinish={handleReviewSubmit}>
          <Form.Item
            name="rating"
            label="服务评分"
            rules={[{ required: true, message: '请进行评分' }]}
          >
            <Rate allowHalf />
          </Form.Item>
          <Form.Item
            name="review"
            label="评价内容"
            rules={[{ required: true, message: '请输入评价内容' }]}
          >
            <Input.TextArea rows={4} placeholder="请输入您的评价..." />
          </Form.Item>
          <Form.Item className="!mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setReviewModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交评价</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProviderPage;
