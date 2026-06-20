import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, List, Tag, Calendar, Badge, Empty, Button, Space } from 'antd';
import { CalendarOutlined, FileTextOutlined, DollarOutlined, WarningOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { TodoItem, SystemAlert, Schedule } from '../types';
import { generateMockTodos, generateMockAlerts, generateMockSchedules, generateMockAnalytics } from '../utils/mockData';
import { formatRelativeTime } from '../utils/dateUtils';
import { formatCurrency, formatLargeNumber, formatPercent } from '../utils/exportUtils';

const priorityColors: Record<string, string> = {
  high: 'red',
  medium: 'gold',
  low: 'blue',
  warning: 'orange',
};

const alertLevelColors: Record<string, string> = {
  error: 'red',
  warning: 'gold',
  info: 'blue',
};

const Dashboard: React.FC = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const currencyFormatter = (value: number | string) => formatCurrency(Number(value));
  const percentFormatter = (value: number | string) => formatPercent(Number(value));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      setTodos(generateMockTodos());
      setAlerts(generateMockAlerts());
      setSchedules(generateMockSchedules(50));
      setAnalytics(generateMockAnalytics());
      setLoading(false);
    };
    fetchData();
  }, []);

  const getListData = (value: any) => {
    const dateStr = value.format('YYYY-MM-DD');
    const daySchedules = schedules.filter(s => 
      s.startDate <= dateStr && s.endDate >= dateStr
    );
    return daySchedules.map(s => ({
      type: s.status === 'ongoing' ? 'success' : s.status === 'pending' ? 'warning' : 'default',
      content: s.exhibitionName,
    }));
  };

  const cellRender = (current: any, info: { type: string }) => {
    if (info.type === 'month') {
      const monthStr = current.format('YYYY-MM');
      const monthSchedules = schedules.filter(s => 
        s.startDate.startsWith(monthStr) || s.endDate.startsWith(monthStr)
      );
      if (monthSchedules.length > 0) {
        return (
          <div className="absolute bottom-0 right-0 w-full text-right pr-1 pb-1">
            <Tag color="blue" className="!text-xs">{monthSchedules.length}场</Tag>
          </div>
        );
      }
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="年度总客流"
              value={analytics?.totalVisitors || 0}
              formatter={formatLargeNumber}
              prefix={<CalendarOutlined className="text-blue-500" />}
              valueStyle={{ color: '#165DFF' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="年度总收入"
              value={analytics?.totalRevenue || 0}
              formatter={currencyFormatter}
              prefix={<DollarOutlined className="text-green-500" />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="档期利用率"
              value={analytics?.scheduleUtilization || 0}
              formatter={percentFormatter}
              prefix={<CheckCircleOutlined className="text-purple-500" />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="展位利用率"
              value={analytics?.boothUtilization || 0}
              formatter={percentFormatter}
              prefix={<FileTextOutlined className="text-orange-500" />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined className="text-blue-500" />
                待办事项
                <Tag color="red">{todos.filter(t => t.priority === 'high').length}</Tag>
              </Space>
            }
            extra={<Button type="link" size="small">查看全部</Button>}
            loading={loading}
          >
            {todos.length > 0 ? (
              <List
                dataSource={todos}
                renderItem={(item) => (
                  <List.Item
                    className="hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors"
                    actions={[
                      <Button type="link" size="small" key="view">处理</Button>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Badge color={priorityColors[item.priority]} />
                      }
                      title={
                        <Space>
                          <span className="font-medium">{item.title}</span>
                          <Tag color={priorityColors[item.priority]}>
                            {item.priority === 'high' ? '紧急' : item.priority === 'medium' ? '重要' : '普通'}
                          </Tag>
                        </Space>
                      }
                      description={
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-gray-500">{item.description}</span>
                          <span className="text-xs text-gray-400">
                            截止: {formatRelativeTime(item.deadline)}
                          </span>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无待办事项" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <WarningOutlined className="text-orange-500" />
                系统提醒
                <Tag color="red">{alerts.filter(a => !a.read).length}</Tag>
              </Space>
            }
            loading={loading}
            className="h-full"
          >
            {alerts.length > 0 ? (
              <List
                dataSource={alerts}
                renderItem={(item) => (
                  <List.Item className={`border-l-4 pl-3 ${!item.read ? 'bg-blue-50 -mx-3 px-4 py-2 rounded' : ''}`}
                    style={{ borderLeftColor: item.level === 'error' ? '#ef4444' : item.level === 'warning' ? '#eab308' : '#3b82f6' }}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <span className="font-medium text-sm">{item.title}</span>
                          {!item.read && <Badge color="red" />}
                        </Space>
                      }
                      description={
                        <div className="text-sm text-gray-500">
                          <div>{item.message}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {formatRelativeTime(item.createdAt)}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无系统提醒" />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <CalendarOutlined className="text-blue-500" />
            档期日历
          </Space>
        }
        loading={loading}
      >
        <Calendar
          cellRender={(current) => {
            const listData = getListData(current);
            return (
              <ul className="events p-0 m-0">
                {listData.map((item, idx) => (
                  <li key={idx} className="text-xs mb-1">
                    <Badge color={item.type as any} text={item.content} />
                  </li>
                ))}
              </ul>
            );
          }}
          cellRender={cellRender}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
