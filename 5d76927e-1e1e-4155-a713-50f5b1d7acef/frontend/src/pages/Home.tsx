import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Carousel, Card, Row, Col, Button, Tag, Typography, Empty } from 'antd'
import { RightOutlined, EyeOutlined, FireOutlined } from '@ant-design/icons'
import { heritageApi } from '@/api/heritage'
import { Heritage, HeritageCategoryMap, HeritageLevelMap } from '@/types'

const { Title, Paragraph } = Typography

const Home: React.FC = () => {
  const [hotHeritages, setHotHeritages] = useState<Heritage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    heritageApi.getHotHeritages(8).then((res) => {
      setHotHeritages(res.data || [])
      setLoading(false)
    })
  }, [])

  const banners = [
    {
      title: '传承千年文化 · 守护非遗瑰宝',
      subtitle: '数字化保护 · 让传统文化焕发新生',
      image: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1600',
    },
    {
      title: '走进非遗世界 · 感受传统魅力',
      subtitle: '86项非遗项目 · 百位传承人 · 数字化档案',
      image: 'https://images.unsplash.com/photo-1555921015-5532091f6026?w=1600',
    },
    {
      title: '研学预约 · 亲身体验传统技艺',
      subtitle: '与传承人面对面 · 学习传统手艺',
      image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600',
    },
  ]

  return (
    <div>
      <Carousel autoplay effect="fade" style={{ marginBottom: 48, borderRadius: 12, overflow: 'hidden' }}>
        {banners.map((banner, index) => (
          <div key={index}>
            <div
              style={{
                height: 420,
                backgroundImage: `linear-gradient(135deg, rgba(15, 52, 96, 0.85), rgba(26, 26, 46, 0.9)), url(${banner.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: 24,
              }}
            >
              <Title level={1} className="gradient-text" style={{ fontSize: 48, marginBottom: 16 }}>
                {banner.title}
              </Title>
              <Paragraph style={{ fontSize: 18, color: '#c8a96e', marginBottom: 32 }}>
                {banner.subtitle}
              </Paragraph>
              <Link to="/heritages">
                <Button type="primary" size="large" icon={<RightOutlined />}>
                  探索非遗项目
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </Carousel>

      <div style={{ marginBottom: 48 }} className="ornament-border" style={{ padding: '24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <Title level={2} style={{ color: '#c8a96e', margin: 0 }}>
            <FireOutlined style={{ color: '#ff7a45', marginRight: 8 }} />
            热门非遗项目
          </Title>
          <Link to="/heritages">
            <Button type="link" icon={<RightOutlined />} style={{ color: '#c8a96e' }}>
              查看全部
            </Button>
          </Link>
        </div>

        {loading ? (
          <Empty description="加载中..." />
        ) : (
          <Row gutter={[16, 16]}>
            {hotHeritages.map((heritage) => (
              <Col xs={24} sm={12} md={8} lg={6} key={heritage.id}>
                <Card
                  hoverable
                  className="card-hover"
                  cover={
                    <div
                      style={{
                        height: 180,
                        backgroundImage: heritage.coverImage
                          ? `url(${heritage.coverImage})`
                          : 'linear-gradient(135deg, #16213e, #0f3460)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#c8a96e',
                        fontSize: 48,
                      }}
                    >
                      {!heritage.coverImage && '🏛️'}
                    </div>
                  }
                  style={{ borderRadius: 12, overflow: 'hidden' }}
                >
                  <Card.Meta
                    title={
                      <Link to={`/heritages/${heritage.id}`} style={{ color: '#e8e8e8' }}>
                        {heritage.name}
                      </Link>
                    }
                    description={
                      <div>
                        <div style={{ marginBottom: 8 }}>
                          <Tag color="gold">{HeritageCategoryMap[heritage.category]}</Tag>
                          <Tag color="blue">{HeritageLevelMap[heritage.level]}</Tag>
                        </div>
                        <Paragraph ellipsis={{ rows: 2 }} style={{ color: '#a0a0a0', fontSize: 12, margin: 0 }}>
                          {heritage.summary}
                        </Paragraph>
                        <div style={{ marginTop: 8, color: '#707070', fontSize: 12 }}>
                          <EyeOutlined /> {heritage.viewCount} 次浏览
                        </div>
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: 48 }}>
        <Col xs={24} md={8}>
          <Card className="card-hover" style={{ borderRadius: 12, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 48, color: '#c8a96e', marginBottom: 16 }}>📚</div>
            <Title level={3} style={{ color: '#e8e8e8' }}>
              数字化档案
            </Title>
            <Paragraph style={{ color: '#a0a0a0' }}>
              图文音视频多格式资料存档，自动提取元数据，版本历史追溯
            </Paragraph>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="card-hover" style={{ borderRadius: 12, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 48, color: '#c8a96e', marginBottom: 16 }}>👨‍🏫</div>
            <Title level={3} style={{ color: '#e8e8e8' }}>
              传承培养
            </Title>
            <Paragraph style={{ color: '#a0a0a0' }}>
              传承关系图谱可视化，年度培养计划管理，技艺考核与进度报告
            </Paragraph>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="card-hover" style={{ borderRadius: 12, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 48, color: '#c8a96e', marginBottom: 16 }}>🎓</div>
            <Title level={3} style={{ color: '#e8e8e8' }}>
              研学预约
            </Title>
            <Paragraph style={{ color: '#a0a0a0' }}>
              在线查看传承人档期，冲突检测，审批流程，消息通知
            </Paragraph>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Home
