import React, { useEffect, useState } from 'react'
import {
  Card,
  List,
  Typography,
  Button,
  Tag,
  Empty,
  Spin,
  Pagination,
  message,
  Row,
  Col,
  Badge,
} from 'antd'
import {
  BellOutlined,
  CheckOutlined,
  CalendarOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import { authApi } from '@/api/auth'
import { Notification, PageResult } from '@/types'

const { Title } = Typography

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await authApi.getNotifications({ page, size })
      const data = res.data as unknown as PageResult<Notification>
      setNotifications(data?.content || [])
      setTotal(data?.totalElements || 0)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [page, size])

  const handleMarkRead = async (id: string) => {
    try {
      await authApi.markNotificationRead(id)
      message.success('已标记为已读')
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    } catch (error) {
      console.error('Failed to mark notification read:', error)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await authApi.markAllRead()
      message.success('全部标记为已读')
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (error) {
      console.error('Failed to mark all read:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'BOOKING':
        return <CalendarOutlined style={{ color: '#1890ff' }} />
      case 'TRAINING':
        return <FileTextOutlined style={{ color: '#52c41a' }} />
      case 'SYSTEM':
        return <InfoCircleOutlined style={{ color: '#c8a96e' }} />
      default:
        return <BellOutlined style={{ color: '#c8a96e' }} />
    }
  }

  const getTypeTag = (type: string) => {
    switch (type) {
      case 'BOOKING':
        return <Tag color="blue">预约通知</Tag>
      case 'TRAINING':
        return <Tag color="green">培养通知</Tag>
      case 'SYSTEM':
        return <Tag color="gold">系统公告</Tag>
      default:
        return <Tag>其他通知</Tag>
    }
  }

  return (
    <div>
      <Row align="middle" justify="space-between" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ color: '#c8a96e', margin: 0 }}>
            <BellOutlined /> 消息通知中心
          </Title>
        </Col>
        <Col>
          <Button type="primary" icon={<CheckOutlined />} onClick={handleMarkAllRead}>
            全部已读
          </Button>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : notifications.length === 0 ? (
          <Empty description="暂无消息通知" style={{ padding: 48 }} />
        ) : (
          <>
            <List
              dataSource={notifications}
              renderItem={(item) => (
                <List.Item
                  style={{
                    padding: '16px 0',
                    borderBottom: '1px solid #2d3a4f',
                    background: item.read ? 'transparent' : 'rgba(200, 169, 110, 0.05)',
                    borderRadius: 8,
                    paddingLeft: 12,
                    paddingRight: 12,
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge dot={!item.read}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: '#0f3460',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                          }}
                        >
                          {getNotificationIcon(item.type)}
                        </div>
                      </Badge>
                    }
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#e8e8e8', fontWeight: item.read ? 400 : 600 }}>
                          {item.title}
                        </span>
                        {getTypeTag(item.type)}
                        {!item.read && (
                          <Button
                            type="text"
                            size="small"
                            onClick={() => handleMarkRead(item.id)}
                            style={{ color: '#c8a96e', padding: 0 }}
                          >
                            标记已读
                          </Button>
                        )}
                      </div>
                    }
                    description={
                      <div>
                        <div style={{ color: '#a0a0a0', marginBottom: 4 }}>{item.content}</div>
                        <div style={{ color: '#707070', fontSize: 12 }}>
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />

            {total > 0 && (
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <Pagination
                  current={page + 1}
                  pageSize={size}
                  total={total}
                  showSizeChanger
                  showTotal={(t) => `共 ${t} 条消息`}
                  onChange={(p, s) => {
                    setPage(p - 1)
                    setSize(s)
                  }}
                  pageSizeOptions={['10', '20', '50']}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

export default Notifications
