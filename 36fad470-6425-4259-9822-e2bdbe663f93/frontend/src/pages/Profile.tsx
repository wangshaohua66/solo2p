import { useState, useEffect } from 'react'
import { Card, Descriptions, Avatar, Divider, List, Tag, Button, Space, Row, Col, Spin } from 'antd'
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyOutlined,
  LogoutOutlined,
  ShoppingOutlined,
  HeartOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { logout } from '@/store/authSlice'
import { UserRole } from '@/types'
import { api } from '@/api'

const roleLabels: Record<UserRole, string> = {
  [UserRole.VENUE_ADMIN]: '场馆管理员',
  [UserRole.ORGANIZER]: '演出主办方',
  [UserRole.FINANCE]: '财务人员',
  [UserRole.AUDIENCE]: '观众'
}

const menuData = [
  {
    key: 'orders',
    icon: <ShoppingOutlined />,
    title: '我的订单',
    description: '查看订单历史和电子票',
    path: '/orders'
  },
  {
    key: 'favorites',
    icon: <HeartOutlined />,
    title: '我的收藏',
    description: '关注的演出和艺术家',
    path: '/favorites'
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    title: '账户设置',
    description: '修改密码和通知偏好',
    path: '#'
  }
]

export default function Profile() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((state) => state.auth)
  const [statsLoading, setStatsLoading] = useState(false)
  const [stats, setStats] = useState({
    orderCount: 0,
    attendedCount: 0,
    favoriteCount: 0
  })

  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const [ordersRes, favoritesRes] = await Promise.all([
        api.get('/orders', { params: { pageSize: 100 } }),
        api.get('/favorites', { params: { pageSize: 100 } })
      ])
      const orders = ordersRes.data?.orders || ordersRes.data?.data || []
      const favorites = favoritesRes.data?.favorites || favoritesRes.data?.data || []
      const attended = orders.filter((o: any) => o.status === 'used').length
      setStats({
        orderCount: orders.length,
        attendedCount: attended,
        favoriteCount: favorites.length
      })
    } catch {
      // 使用默认值
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Avatar
                size={96}
                icon={<UserOutlined />}
                style={{ marginBottom: 16 }}
              />
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
                {user?.name || '用户'}
              </div>
              <Tag color="blue" style={{ marginBottom: 16 }}>
                <SafetyOutlined /> {user ? roleLabels[user.role] : ''}
              </Tag>
            </div>
            <Divider style={{ margin: '16px 0' }} />
            <List
              dataSource={menuData}
              renderItem={(item) => (
                <List.Item
                  style={{ cursor: 'pointer', padding: '12px 0' }}
                  onClick={() => item.path !== '#' && navigate(item.path)}
                >
                  <List.Item.Meta
                    avatar={<div style={{ fontSize: 20, color: '#1677ff' }}>{item.icon}</div>}
                    title={item.title}
                    description={item.description}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card title="个人信息">
            <Descriptions column={1} bordered size="middle">
              <Descriptions.Item label="用户名">
                {user?.username || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="姓名">
                {user?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item
                label={
                  <span>
                    <MailOutlined style={{ marginRight: 4 }} />
                    邮箱
                  </span>
                }
              >
                {user?.email || '-'}
              </Descriptions.Item>
              <Descriptions.Item
                label={
                  <span>
                    <PhoneOutlined style={{ marginRight: 4 }} />
                    手机号
                  </span>
                }
              >
                {user?.phone || '未绑定'}
              </Descriptions.Item>
              <Descriptions.Item label="用户角色">
                <Tag color="blue">{user ? roleLabels[user.role] : '-'}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="统计概览" style={{ marginTop: 16 }}>
            <Spin spinning={statsLoading}>
              <Row gutter={16}>
                <Col span={8}>
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 16,
                      background: '#f0f5ff',
                      borderRadius: 8,
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate('/orders')}
                  >
                    <div style={{ fontSize: 28, fontWeight: 600, color: '#1677ff' }}>{stats.orderCount}</div>
                    <div style={{ color: '#606266', marginTop: 4 }}>累计订单</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 16,
                      background: '#f6ffed',
                      borderRadius: 8
                    }}
                  >
                    <div style={{ fontSize: 28, fontWeight: 600, color: '#52c41a' }}>{stats.attendedCount}</div>
                    <div style={{ color: '#606266', marginTop: 4 }}>已观演出</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 16,
                      background: '#fff7e6',
                      borderRadius: 8,
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate('/favorites')}
                  >
                    <div style={{ fontSize: 28, fontWeight: 600, color: '#fa8c16' }}>{stats.favoriteCount}</div>
                    <div style={{ color: '#606266', marginTop: 4 }}>收藏演出</div>
                  </div>
                </Col>
              </Row>
            </Spin>
          </Card>

          <Card style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                danger
                block
                icon={<LogoutOutlined />}
                onClick={handleLogout}
              >
                退出登录
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
