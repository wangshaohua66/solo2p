import { useState, useEffect } from 'react';
import { Card, Button, Space, Input, Table, Tag, Modal, List, Avatar, QRCode, Empty, Row, Col, Statistic, Tabs, message } from 'antd';
import { SearchOutlined, CalendarOutlined, UserOutlined, QrcodeOutlined, EnvironmentOutlined, PhoneOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { generateMockSchedules, generateMockBooths } from '../utils/mockData';
import type { Schedule, Booth, Appointment } from '../types';
import { formatDate } from '../utils/dateUtils';

const { Search } = Input;

const VisitorPage: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [boothModalVisible, setBoothModalVisible] = useState(false);
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);
  const [appointmentModalVisible, setAppointmentModalVisible] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      const mockSchedules = generateMockSchedules(20);
      const mockBooths = generateMockBooths('venue-1', 50);
      setSchedules(mockSchedules.filter(s => s.status === 'ongoing' || s.status === 'approved'));
      setBooths(mockBooths);
      setAppointments([
        {
          id: 'app-1',
          visitorId: 'v-1',
          visitorName: '张先生',
          exhibitorId: 'e-1',
          exhibitorName: '华为技术有限公司',
          scheduleId: 'sch-1001',
          boothId: 'booth-5001',
          boothNo: 'A01',
          scheduledTime: new Date(Date.now() + 3600000).toISOString(),
          topic: '智能产品合作洽谈',
          status: 'confirmed',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'app-2',
          visitorId: 'v-1',
          visitorName: '张先生',
          exhibitorId: 'e-2',
          exhibitorName: '阿里巴巴集团',
          scheduleId: 'sch-1001',
          boothId: 'booth-5002',
          boothNo: 'A02',
          scheduledTime: new Date(Date.now() + 7200000).toISOString(),
          topic: '云计算解决方案交流',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filteredSchedules = schedules.filter(s => 
    s.exhibitionName.includes(searchKeyword) ||
    s.organizerName?.includes(searchKeyword) ||
    s.exhibitionType.includes(searchKeyword)
  );

  const filteredBooths = booths.filter(b =>
    b.boothNo.includes(searchKeyword) ||
    b.exhibitorName?.includes(searchKeyword)
  );

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
  };

  const handleBoothClick = (booth: Booth) => {
    setSelectedBooth(booth);
    setBoothModalVisible(true);
  };

  const handleMakeAppointment = (booth: Booth) => {
    setSelectedBooth(booth);
    setAppointmentModalVisible(true);
  };

  const handleAppointmentSubmit = () => {
    if (selectedBooth) {
      const newAppointment: Appointment = {
        id: `app-${Date.now()}`,
        visitorId: 'v-1',
        visitorName: '张先生',
        exhibitorId: selectedBooth.exhibitorId || '',
        exhibitorName: selectedBooth.exhibitorName || '',
        scheduleId: selectedBooth.scheduleId || '',
        boothId: selectedBooth.id,
        boothNo: selectedBooth.boothNo,
        scheduledTime: new Date(Date.now() + 3600000).toISOString(),
        topic: '业务洽谈',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      setAppointments(prev => [newAppointment, ...prev]);
      message.success('预约申请已提交，等待参展商确认');
      setAppointmentModalVisible(false);
      setBoothModalVisible(false);
    }
  };

  const scheduleColumns = [
    {
      title: '展会名称',
      dataIndex: 'exhibitionName',
      key: 'exhibitionName',
      render: (text: string, record: Schedule) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-xs text-gray-400">{record.exhibitionType}</div>
        </div>
      ),
    },
    {
      title: '主办方',
      dataIndex: 'organizerName',
      key: 'organizerName',
    },
    {
      title: '展览日期',
      key: 'date',
      render: (_: any, record: Schedule) => (
        <div>
          <div>{formatDate(record.startDate)} - {formatDate(record.endDate)}</div>
          <div className="text-xs text-gray-400">
            搭建: {formatDate(record.setupStartDate)} | 撤展: {formatDate(record.teardownEndDate)}
          </div>
        </div>
      ),
    },
    {
      title: '预计观众',
      dataIndex: 'expectedVisitors',
      key: 'expectedVisitors',
      render: (num: number) => num?.toLocaleString() + ' 人',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'ongoing' ? 'green' : 'blue'}>
          {status === 'ongoing' ? '进行中' : '即将开始'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: () => (
        <Space>
          <Button type="link" size="small">查看详情</Button>
          <Button type="primary" size="small">预约参观</Button>
        </Space>
      ),
    },
  ];

  const boothColumns = [
    {
      title: '展位号',
      dataIndex: 'boothNo',
      key: 'boothNo',
      width: 100,
      render: (text: string, record: Booth) => (
        <Tag color={record.zone === 'A' ? 'red' : record.zone === 'B' ? 'gold' : record.zone === 'C' ? 'green' : 'blue'}>
          {text}
        </Tag>
      ),
    },
    {
      title: '参展商',
      dataIndex: 'exhibitorName',
      key: 'exhibitorName',
      render: (text: string) => text || '-',
    },
    {
      title: '区域',
      dataIndex: 'zone',
      key: 'zone',
      width: 80,
      render: (zone: string) => `${zone}区`,
    },
    {
      title: '面积',
      dataIndex: 'area',
      key: 'area',
      width: 80,
      render: (area: number) => `${area} ㎡`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={
          status === 'available' ? 'green' :
          status === 'reserved' ? 'gold' :
          status === 'sold' ? 'blue' :
          status === 'occupied' ? 'red' : 'gray'
        }>
          {status === 'available' ? '可用' :
           status === 'reserved' ? '预订' :
           status === 'sold' ? '已售' :
           status === 'occupied' ? '占用' : '维护'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: Booth) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleBoothClick(record)}>详情</Button>
          {record.exhibitorName && (
            <Button type="primary" size="small" onClick={() => handleMakeAppointment(record)}>
              预约洽谈
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const appointmentStatusColors: Record<string, string> = {
    pending: 'gold',
    confirmed: 'green',
    cancelled: 'gray',
    completed: 'blue',
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12}>
            <h1 className="text-2xl font-bold mb-2">欢迎参观市级国际会展中心</h1>
            <p className="text-blue-100 mb-4">探索精彩展会，预约心仪展位，轻松规划您的参观行程</p>
            <Space>
              <Button type="primary" size="large" icon={<QrcodeOutlined />} onClick={() => setQrModalVisible(true)}>
                生成签到码
              </Button>
              <Button size="large" ghost icon={<CalendarOutlined />}>
                查看活动日程
              </Button>
            </Space>
          </Col>
          <Col xs={24} md={12}>
            <Row gutter={[16, 16]}>
              <Col xs={12}>
                <div className="text-center bg-white/10 rounded-lg p-4">
                  <div className="text-3xl font-bold">{schedules.filter(s => s.status === 'ongoing').length}</div>
                  <div className="text-sm text-blue-100">正在进行</div>
                </div>
              </Col>
              <Col xs={12}>
                <div className="text-center bg-white/10 rounded-lg p-4">
                  <div className="text-3xl font-bold">{appointments.length}</div>
                  <div className="text-sm text-blue-100">我的预约</div>
                </div>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Card
        extra={
          <Search
            placeholder="搜索展会、参展商、展位号"
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            style={{ width: 400 }}
            onSearch={handleSearch}
          />
        }
      >
        <Tabs
          items={[
            {
              key: 'schedules',
              label: (
                <Space>
                  <CalendarOutlined />
                  展会活动
                </Space>
              ),
              children: (
                <Table
                  columns={scheduleColumns}
                  dataSource={filteredSchedules}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'booths',
              label: (
                <Space>
                  <EnvironmentOutlined />
                  参展商查询
                </Space>
              ),
              children: (
                <Table
                  columns={boothColumns}
                  dataSource={filteredBooths}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'appointments',
              label: (
                <Space>
                  <UserOutlined />
                  我的预约
                </Space>
              ),
              children: appointments.length > 0 ? (
                <List
                  dataSource={appointments}
                  renderItem={(item) => (
                    <List.Item
                      className="hover:bg-gray-50 rounded-lg transition-colors"
                      actions={[
                        item.status === 'pending' && <Button type="link" size="small" danger>取消预约</Button>,
                        item.status === 'confirmed' && <Button type="link" size="small">查看详情</Button>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<Avatar icon={<UserOutlined />} />}
                        title={
                          <Space>
                            <span className="font-medium">{item.exhibitorName}</span>
                            <Tag color={appointmentStatusColors[item.status]}>
                              {item.status === 'pending' ? '待确认' :
                               item.status === 'confirmed' ? '已确认' :
                               item.status === 'cancelled' ? '已取消' : '已完成'}
                            </Tag>
                          </Space>
                        }
                        description={
                          <div className="space-y-1">
                            <div className="flex items-center gap-4 text-sm">
                              <span><EnvironmentOutlined className="mr-1" /> 展位 {item.boothNo}</span>
                              <span><ClockCircleOutlined className="mr-1" /> {formatDate(item.scheduledTime)}</span>
                            </div>
                            <div className="text-sm text-gray-500">洽谈主题: {item.topic}</div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无预约记录" />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="展位详情"
        open={boothModalVisible}
        onCancel={() => setBoothModalVisible(false)}
        footer={
          selectedBooth?.exhibitorName ? (
            <Button type="primary" onClick={() => handleMakeAppointment(selectedBooth)}>
              预约洽谈
            </Button>
          ) : null
        }
        width={500}
      >
        {selectedBooth && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Tag color={selectedBooth.zone === 'A' ? 'red' : selectedBooth.zone === 'B' ? 'gold' : 'green'} className="!text-base !px-3 !py-1">
                  展位 {selectedBooth.boothNo}
                </Tag>
              </div>
              <Tag color={
                selectedBooth.status === 'available' ? 'green' :
                selectedBooth.status === 'reserved' ? 'gold' :
                selectedBooth.status === 'sold' ? 'blue' : 'red'
              }>
                {selectedBooth.status === 'available' ? '可用' :
                 selectedBooth.status === 'reserved' ? '预订' :
                 selectedBooth.status === 'sold' ? '已售' : '占用'}
              </Tag>
            </div>
            {selectedBooth.exhibitorName && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-gray-500 text-sm mb-1">参展商</div>
                <div className="text-lg font-semibold">{selectedBooth.exhibitorName}</div>
              </div>
            )}
            <Row gutter={16}>
              <Col span={8}>
                <div className="text-gray-500 text-sm">所在区域</div>
                <div className="font-medium">{selectedBooth.zone}区</div>
              </Col>
              <Col span={8}>
                <div className="text-gray-500 text-sm">展位面积</div>
                <div className="font-medium">{selectedBooth.area} ㎡</div>
              </Col>
              <Col span={8}>
                <div className="text-gray-500 text-sm">价格</div>
                <div className="font-medium text-blue-600">¥{(selectedBooth.customPrice || selectedBooth.basePrice).toLocaleString()}</div>
              </Col>
            </Row>
            <div>
              <div className="text-gray-500 text-sm mb-2">配套设施</div>
              <div className="flex flex-wrap gap-1">
                {selectedBooth.facilities.map((f, i) => (
                  <Tag key={i}>{f}</Tag>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="预约洽谈"
        open={appointmentModalVisible}
        onCancel={() => setAppointmentModalVisible(false)}
        onOk={handleAppointmentSubmit}
        okText="提交预约"
        width={500}
      >
        {selectedBooth && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-gray-500 text-sm mb-1">预约参展商</div>
              <div className="text-lg font-semibold">{selectedBooth.exhibitorName}</div>
              <div className="text-sm text-gray-500 mt-1">
                展位: {selectedBooth.boothNo} | 面积: {selectedBooth.area}㎡
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-sm mb-2">洽谈主题</div>
              <Input placeholder="请输入您想洽谈的主题" />
            </div>
            <div>
              <div className="text-gray-500 text-sm mb-2">期望时间</div>
              <Input placeholder="请输入您期望的洽谈时间" />
            </div>
            <div>
              <div className="text-gray-500 text-sm mb-2">联系电话</div>
              <Input prefix={<PhoneOutlined />} placeholder="请输入您的联系电话" />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="观众签到码"
        open={qrModalVisible}
        onCancel={() => setQrModalVisible(false)}
        footer={null}
        width={400}
        centered
      >
        <div className="text-center py-4">
          <div className="inline-block p-4 bg-white rounded-lg shadow-inner mb-4">
            <QRCode value="visitor-checkin-12345" size={200} level="H" />
          </div>
          <h3 className="text-lg font-semibold mb-2">张先生的参观签到码</h3>
          <p className="text-gray-500 text-sm mb-4">请在入口处出示此二维码进行签到</p>
          <div className="bg-gray-50 rounded-lg p-3 text-left">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">有效期</span>
                <span>当日有效</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">参观展会</span>
                <span>国际智能家居博览会</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default VisitorPage;
