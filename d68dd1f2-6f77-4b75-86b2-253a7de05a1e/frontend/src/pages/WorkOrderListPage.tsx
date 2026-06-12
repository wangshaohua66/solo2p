import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Input,
  Select,
  DatePicker,
  Button,
  Tag,
  Space,
  Typography,
  Skeleton,
  Empty,
  Badge,
  Avatar,
  Dropdown,
  Pagination,
  Tooltip,
  Divider,
  Modal,
  List,
  Radio
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  FilterOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  InboxOutlined,
  OrderedListOutlined,
  UserOutlined,
  CalendarOutlined,
  ReloadOutlined,
  MoreOutlined,
  EyeOutlined,
  EditOutlined,
  PrinterOutlined
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { workOrderApi } from '@/api';
import type { WorkOrder, WorkOrderStatus, WorkOrderListFilter } from '@/types';
import { STATUS_COLOR, STATUS_LABEL } from '@/types';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const WorkOrderListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<WorkOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [filter, setFilter] = useState<WorkOrderListFilter>({});
  const [searchInput, setSearchInput] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status) {
      setFilter((prev) => ({ ...prev, status: [status as WorkOrderStatus] }));
    }
  }, [searchParams]);

  useEffect(() => {
    loadList();
  }, [page, pageSize, filter]);

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await workOrderApi.list({
        page,
        pageSize,
        filter
      });
      setList(res.data);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setFilter((prev) => ({ ...prev, keyword: searchInput }));
    setPage(1);
  };

  const handleStatusChange = (values: WorkOrderStatus[]) => {
    setFilter((prev) => ({ ...prev, status: values }));
    setPage(1);
  };

  const handleDateChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setFilter((prev) => ({
        ...prev,
        dateFrom: dates[0]?.toISOString(),
        dateTo: dates[1]?.toISOString()
      }));
    } else {
      setFilter((prev) => ({ ...prev, dateFrom: undefined, dateTo: undefined }));
    }
    setPage(1);
  };

  const getPriorityTag = (priority: string) => {
    const map: Record<string, { color: string; label: string }> = {
      express: { color: 'red', label: '特快' },
      urgent: { color: 'orange', label: '加急' },
      normal: { color: 'default', label: '普通' }
    };
    const p = map[priority] || map.normal;
    return (
      <Tag color={p.color} style={{ borderRadius: 4 }}>
        {p.label}
      </Tag>
    );
  };

  const cardActions = (order: WorkOrder) => [
    <EyeOutlined
      key="view"
      title="查看详情"
      onClick={() => navigate(`/work-orders/${order.id}`)}
    />,
    <PrinterOutlined
      key="report"
      title="打印报告"
      onClick={() => navigate(`/report/${order.id}`)}
    />,
    <MoreOutlined key="more" />
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            <OrderedListOutlined /> 工单管理
            <Tag color="blue" style={{ marginLeft: 8, fontSize: 14 }}>
              共 {total} 条
            </Tag>
          </Title>
          <Space>
            <Radio.Group
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="grid">卡片视图</Radio.Button>
              <Radio.Button value="table">列表视图</Radio.Button>
            </Radio.Group>
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => navigate('/intake')}
            >
              新建工单
            </Button>
          </Space>
        </div>

        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              size="large"
              placeholder="搜索工单号、品牌、型号、序列号、客户姓名"
              prefix={<SearchOutlined />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
              suffix={
                <Button type="text" onClick={handleSearch}>
                  搜索
                </Button>
              }
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Button
              icon={<FilterOutlined />}
              onClick={() => setShowFilter(!showFilter)}
              size="large"
              block
              type={showFilter ? 'primary' : 'default'}
            >
              筛选
            </Button>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Button
              icon={<ReloadOutlined />}
              size="large"
              block
              onClick={() => {
                setFilter({});
                setSearchInput('');
                setPage(1);
              }}
            >
              重置
            </Button>
          </Col>
        </Row>

        {showFilter && (
          <Card
            size="small"
            style={{
              marginTop: 16,
              background: '#fafafa'
            }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>状态筛选</div>
                <Select
                  mode="multiple"
                  size="large"
                  placeholder="选择状态（可多选）"
                  style={{ width: '100%' }}
                  value={filter.status || []}
                  onChange={handleStatusChange}
                  allowClear
                  tagRender={(props) => (
                    <Tag
                      color={props.value && STATUS_COLOR[props.value as WorkOrderStatus]}
                      closable={props.closable}
                      onClose={props.onClose}
                      style={{ marginRight: 3, marginBottom: 3 }}
                    >
                      {STATUS_LABEL[props.value as WorkOrderStatus]}
                    </Tag>
                  )}
                >
                  {Object.entries(STATUS_LABEL).map(([key, label]) => (
                    <Option key={key} value={key}>
                      <Space>
                        <Badge color={STATUS_COLOR[key as WorkOrderStatus]} />
                        {label}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>进店日期</div>
                <RangePicker
                  size="large"
                  style={{ width: '100%' }}
                  onChange={handleDateChange}
                  showTime={false}
                  allowClear
                />
              </Col>
              <Col xs={24} md={8}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>优先级</div>
                <Select
                  size="large"
                  style={{ width: '100%' }}
                  placeholder="全部"
                  value={filter.priority}
                  onChange={(v) => {
                    setFilter((prev) => ({ ...prev, priority: v }));
                    setPage(1);
                  }}
                  allowClear
                >
                  <Option value="normal">普通</Option>
                  <Option value="urgent">加急</Option>
                  <Option value="express">特快</Option>
                </Select>
              </Col>
              <Col xs={24} md={8}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>分配技工</div>
                <Select
                  size="large"
                  style={{ width: '100%' }}
                  placeholder="全部"
                  allowClear
                >
                  <Option value={1}>张师傅</Option>
                  <Option value={2}>李师傅</Option>
                  <Option value={3}>王师傅</Option>
                </Select>
              </Col>
            </Row>
          </Card>
        )}
      </Card>

      {loading ? (
        <Row gutter={[16, 16]}>
          {[...Array(8)].map((_, i) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={i}>
              <Card>
                <Skeleton active paragraph={{ rows: 4 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : list.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '60px 0' }}>
          <Empty description="暂无工单数据" />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/intake')}
            style={{ marginTop: 16 }}
          >
            创建第一个工单
          </Button>
        </Card>
      ) : viewMode === 'grid' ? (
        <Row gutter={[16, 16]}>
          {list.map((order) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={order.id}>
              <Card
                className="workflow-card"
                hoverable
                onClick={() => navigate(`/work-orders/${order.id}`)}
                bodyStyle={{ padding: 16 }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 12
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {order.orderNumber}
                    </div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      {new Date(order.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <Badge
                    color={STATUS_COLOR[order.status]}
                    text={
                      <span style={{ fontSize: 12 }}>
                        {STATUS_LABEL[order.status]}
                      </span>
                    }
                  />
                </div>

                <Divider style={{ margin: '12px 0' }} />

                <div style={{ marginBottom: 8 }}>
                  <Avatar
                    size={32}
                    style={{
                      backgroundColor: STATUS_COLOR[order.status],
                      marginRight: 8
                    }}
                    icon={<ClockCircleOutlined />}
                  />
                  <span style={{ fontWeight: 500 }}>
                    {order.brand} {order.model}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: '#8c8c8c',
                    marginBottom: 12,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: 1.5
                  }}
                >
                  {order.problemDescription || '无故障描述'}
                </div>

                <Row gutter={[8, 8]}>
                  <Col span={12}>
                    <Space size={4} style={{ fontSize: 12, color: '#595959' }}>
                      <TeamOutlined />
                      {order.customer?.name || '-'}
                    </Space>
                  </Col>
                  <Col span={12} style={{ textAlign: 'right' }}>
                    {getPriorityTag(order.priority)}
                  </Col>
                  <Col span={12}>
                    <Space size={4} style={{ fontSize: 12, color: '#595959' }}>
                      <CalendarOutlined />
                      {order.estimatedDeliveryDate
                        ? dayjs(order.estimatedDeliveryDate).format('MM-DD')
                        : '未排期'}
                    </Space>
                  </Col>
                  <Col span={12}>
                    <div
                      style={{
                        textAlign: 'right',
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#fa8c16'
                      }}
                    >
                      ¥{order.totalPrice.toFixed(0)}
                    </div>
                  </Col>
                </Row>

                {order.repeatVisit && (
                  <Tag
                    color="gold"
                    icon={<ClockCircleOutlined />}
                    style={{ marginTop: 12 }}
                  >
                    返店复修
                  </Tag>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card bodyStyle={{ padding: 0 }}>
          <List
            dataSource={list}
            renderItem={(item) => (
              <List.Item
                style={{ padding: '16px 24px' }}
                onClick={() => navigate(`/work-orders/${item.id}`)}
              >
                <Row gutter={16} style={{ width: '100%' }} align="middle">
                  <Col xs={24} md={5}>
                    <div style={{ fontWeight: 600 }}>{item.orderNumber}</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      {new Date(item.intakeDate).toLocaleDateString('zh-CN')}
                    </div>
                  </Col>
                  <Col xs={24} md={6}>
                    <div>
                      {item.brand} {item.model}
                    </div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      序列号：{item.caseSerialNumber}
                    </div>
                  </Col>
                  <Col xs={12} md={4}>
                    <Space>
                      <UserOutlined /> {item.customer?.name}
                    </Space>
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                      {item.customer?.phone}
                    </div>
                  </Col>
                  <Col xs={6} md={3}>
                    <Badge color={STATUS_COLOR[item.status]} />
                    {STATUS_LABEL[item.status]}
                  </Col>
                  <Col xs={6} md={3}>
                    {getPriorityTag(item.priority)}
                  </Col>
                  <Col xs={12} md={2} style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: '#fa8c16' }}>
                      ¥{item.totalPrice.toFixed(0)}
                    </div>
                  </Col>
                  <Col xs={12} md={1} style={{ textAlign: 'right' }}>
                    <Space>
                      <Button
                        type="text"
                        icon={<EyeOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/work-orders/${item.id}`);
                        }}
                      />
                    </Space>
                  </Col>
                </Row>
              </List.Item>
            )}
          />
        </Card>
      )}

      {total > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '16px 0'
          }}
        >
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showQuickJumper
            showTotal={(t) => `共 ${t} 条`}
            onChange={(p, ps) => {
              setPage(p);
              setPageSize(ps);
            }}
          />
        </div>
      )}
    </Space>
  );
};

export default WorkOrderListPage;
