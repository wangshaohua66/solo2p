import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Card,
  Row,
  Col,
  Typography,
  Tabs,
  Tag,
  Empty,
  Spin,
  Button,
  message,
} from 'antd'
import { EyeOutlined, ExpandOutlined } from '@ant-design/icons'
import { heritageApi } from '@/api/heritage'
import { Heritage, HeritageCategory, HeritageCategoryMap, HeritageLevelMap } from '@/types'
import SocialShare from '@/components/SocialShare'

const { Title, Paragraph } = Typography
const { TabPane } = Tabs

const Exhibition: React.FC = () => {
  const [heritages, setHeritages] = useState<Heritage[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<HeritageCategory | 'ALL'>('ALL')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await heritageApi.getPublicList({ size: 50 })
        const data = res.data as any
        setHeritages(data?.content || [])
      } catch (error) {
        console.error('Failed to fetch exhibition data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredHeritages = activeCategory === 'ALL'
    ? heritages
    : heritages.filter((h) => h.category === activeCategory)

  const handleShare = async (name: string) => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      message.success(`${name} 链接已复制`)
    } catch {
      message.info('请手动复制链接分享')
    }
  }

  const categories: { key: HeritageCategory | 'ALL'; label: string }[] = [
    { key: 'ALL', label: '全部' },
    ...Object.entries(HeritageCategoryMap).map(([key, label]) => ({
      key: key as HeritageCategory,
      label,
    })),
  ]

  return (
    <div>
      <div
        style={{
          textAlign: 'center',
          padding: '48px 24px',
          marginBottom: 32,
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(15, 52, 96, 0.8), rgba(26, 26, 46, 0.9))',
        }}
      >
        <Title level={1} className="gradient-text" style={{ fontSize: 42, marginBottom: 16 }}>
          非遗数字展厅
        </Title>
        <Paragraph style={{ fontSize: 16, color: '#c8c8c8', maxWidth: 600, margin: '0 auto' }}>
          沉浸式漫游非遗文化世界，领略传统技艺、音乐、舞蹈、戏剧、民俗的独特魅力
        </Paragraph>
        <Link to="/exhibition/virtual">
          <Button
            type="primary"
            size="large"
            icon={<ExpandOutlined />}
            style={{ marginTop: 24, background: '#c8a96e', borderColor: '#c8a96e', height: 48, fontSize: 16, paddingInline: 32 }}
          >
            进入虚拟展厅漫游
          </Button>
        </Link>
      </div>

      <Card style={{ borderRadius: 12, marginBottom: 24 }} styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeCategory}
          onChange={(key) => setActiveCategory(key as any)}
          items={categories.map((c) => ({
            key: c.key,
            label: c.label,
          }))}
          style={{ padding: '0 16px' }}
        />
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64 }}>
          <Spin size="large" />
        </div>
      ) : filteredHeritages.length === 0 ? (
        <Empty description="暂无展品" style={{ padding: 64 }} />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredHeritages.map((heritage) => (
            <Col xs={24} sm={12} md={8} lg={6} key={heritage.id}>
              <Card
                hoverable
                className="card-hover"
                cover={
                  <div
                    style={{
                      height: 200,
                      backgroundImage: heritage.coverImage
                        ? `url(${heritage.coverImage})`
                        : 'linear-gradient(135deg, #16213e, #0f3460)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#c8a96e',
                      fontSize: 64,
                      position: 'relative',
                    }}
                  >
                    {!heritage.coverImage && '🏛️'}
                    <div
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        background: 'rgba(15, 52, 96, 0.8)',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        color: '#c8a96e',
                      }}
                    >
                      <EyeOutlined /> {heritage.viewCount}
                    </div>
                  </div>
                }
                style={{ borderRadius: 12 }}
                actions={[
                  <Link to={`/heritages/${heritage.id}`} key="view">
                    <Button type="link" size="small">
                      <EyeOutlined /> 查看详情
                    </Button>
                  </Link>,
                  <SocialShare type="heritage" targetId={heritage.id} title={heritage.name} key="share" />,
                ]}
              >
                <Card.Meta
                  title={
                    <Link to={`/heritages/${heritage.id}`} style={{ color: '#e8e8e8' }}>
                      {heritage.name}
                    </Link>
                  }
                  description={
                    <div>
                      <Tag color="gold">{HeritageCategoryMap[heritage.category]}</Tag>
                      <Tag color="blue">{HeritageLevelMap[heritage.level]}</Tag>
                      <Paragraph
                        ellipsis={{ rows: 2 }}
                        style={{ color: '#a0a0a0', fontSize: 12, marginTop: 8, marginBottom: 0 }}
                      >
                        {heritage.summary}
                      </Paragraph>
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )
}

export default Exhibition
