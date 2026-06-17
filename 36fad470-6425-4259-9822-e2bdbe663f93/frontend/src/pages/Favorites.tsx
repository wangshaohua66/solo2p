import { useState, useEffect } from 'react'
import {
  Card,
  List,
  Button,
  Empty,
  Spin,
  message,
  Tag,
  Space,
  Typography,
  Popconfirm
} from 'antd'
import {
  HeartFilled,
  DeleteOutlined,
  CalendarOutlined,
  ArrowRightOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { api } from '@/api'
import type { Favorite } from '@/types'

const { Title, Text } = Typography

export default function Favorites() {
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const loadFavorites = async () => {
    setLoading(true)
    try {
      const res = await api.get('/favorites', { params: { pageSize: 100 } })
      const data = res.data?.favorites || res.data?.data || []
      setFavorites(data)
      setTotal(res.data?.total || data.length)
    } catch {
      message.error('加载收藏列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFavorites()
  }, [])

  const handleRemove = async (performanceId: string) => {
    try {
      await api.post('/favorites/remove', { performanceId })
      message.success('已取消收藏')
      loadFavorites()
    } catch {
      message.error('取消收藏失败')
    }
  }

  const handleGoToPerformance = (performanceId: string) => {
    navigate(`/performance/calendar`)
  }

  return (
    <div>
      <div className="card-header">
        <div className="card-title">
          <Space>
            <HeartFilled style={{ color: '#ff4d4f' }} />
            我的收藏
          </Space>
        </div>
      </div>

      <Card>
        <Spin spinning={loading}>
          {favorites.length === 0 ? (
            <Empty
              description="暂无收藏的演出"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" onClick={() => navigate('/performance/calendar')}>
                去发现演出
              </Button>
            </Empty>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">共收藏 {total} 场演出</Text>
              </div>
              <List
                dataSource={favorites}
                renderItem={(item) => (
                  <List.Item
                    key={item.id}
                    actions={[
                      <Popconfirm
                        title="确定要取消收藏吗？"
                        onConfirm={() => handleRemove(item.performanceId)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                        >
                          取消收藏
                        </Button>
                      </Popconfirm>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <div
                          style={{
                            width: 80,
                            height: 80,
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: 24
                          }}
                        >
                          <CalendarOutlined />
                        </div>
                      }
                      title={
                        <Space>
                          <Title level={5} style={{ margin: 0 }}>
                            {item.performanceName}
                          </Title>
                          <Tag color="red">
                            <HeartFilled /> 已收藏
                          </Tag>
                        </Space>
                      }
                      description={
                        <div style={{ marginTop: 8 }}>
                          <Space direction="vertical" size={4}>
                            <Text type="secondary">
                              收藏时间：{dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                            </Text>
                            <Button
                              type="link"
                              onClick={() => handleGoToPerformance(item.performanceId)}
                              style={{ padding: 0 }}
                            >
                              查看演出详情 <ArrowRightOutlined />
                            </Button>
                          </Space>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </>
          )}
        </Spin>
      </Card>
    </div>
  )
}
