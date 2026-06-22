import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Tag,
  Typography,
  Row,
  Col,
  Avatar,
  Button,
  Tabs,
  Empty,
  Spin,
  Descriptions,
  Image,
  Divider,
  List,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  SoundOutlined,
  FileTextOutlined,
  ShareAltOutlined,
  UserOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { heritageApi } from '@/api/heritage'
import { inheritorApi } from '@/api/inheritor'
import {
  Heritage,
  HeritageCategoryMap,
  HeritageLevelMap,
  Inheritor,
  MediaFile,
  VersionHistory,
} from '@/types'
import InterviewPlayer from '@/components/InterviewPlayer'
import SocialShare from '@/components/SocialShare'

const { Title, Paragraph } = Typography
const { TabPane } = Tabs

const HeritageDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [heritage, setHeritage] = useState<Heritage | null>(null)
  const [inheritors, setInheritors] = useState<Inheritor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const [heritageRes, inheritorsRes] = await Promise.all([
          heritageApi.getPublicDetail(id),
          inheritorApi.getByHeritage(id),
        ])
        setHeritage(heritageRes.data || null)
        setInheritors(inheritorsRes.data || [])
      } catch (error) {
        console.error('Failed to fetch heritage detail:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      message.success('链接已复制到剪贴板')
    } catch {
      message.info(`分享链接: ${window.location.href}`)
    }
  }

  const renderMedia = (media: MediaFile) => {
    if (media.type === 'IMAGE') {
      return (
        <div key={media.id} style={{ marginBottom: 16 }}>
          <Image
            src={media.fileUrl}
            alt={media.fileName}
            style={{ width: '100%', borderRadius: 8 }}
            fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%2316213e' width='400' height='300'/%3E%3Ctext fill='%23c8a96e' font-size='24' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3E图片%3C/text%3E%3C/svg%3E"
          />
          {media.description && (
            <div style={{ color: '#a0a0a0', fontSize: 12, marginTop: 8 }}>{media.description}</div>
          )}
        </div>
      )
    }
    if (media.type === 'VIDEO') {
      return (
        <div key={media.id} style={{ marginBottom: 16 }}>
          <video
            controls
            preload="metadata"
            style={{ width: '100%', borderRadius: 8, background: '#000' }}
            src={media.fileUrl}
          >
            您的浏览器不支持视频播放
          </video>
          <div style={{ color: '#a0a0a0', fontSize: 12, marginTop: 8 }}>
            {media.description || media.fileName}
          </div>
        </div>
      )
    }
    if (media.type === 'AUDIO') {
      return (
        <Card key={media.id} size="small" style={{ marginBottom: 16 }}>
          <SoundOutlined style={{ color: '#c8a96e', marginRight: 8 }} />
          {media.fileName}
          <audio controls preload="metadata" style={{ width: '100%', marginTop: 8 }} src={media.fileUrl}>
            您的浏览器不支持音频播放
          </audio>
        </Card>
      )
    }
    if (media.type === 'INTERVIEW') {
      return <InterviewPlayer key={media.id} media={media} />
    }
    return (
      <Card key={media.id} size="small" style={{ marginBottom: 16 }}>
        <FileTextOutlined style={{ color: '#c8a96e', marginRight: 8 }} />
        {media.fileName}
      </Card>
    )
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!heritage) {
    return <Empty description="非遗项目不存在" style={{ padding: 64 }} />
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ color: '#c8a96e' }}>
          返回列表
        </Button>
      </div>

      <div
        style={{
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 24,
          backgroundImage: heritage.coverImage
            ? `linear-gradient(135deg, rgba(15, 52, 96, 0.9), rgba(26, 26, 46, 0.95)), url(${heritage.coverImage})`
            : 'linear-gradient(135deg, #16213e, #0f3460)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          padding: 48,
        }}
      >
        <Row gutter={24} align="middle">
          <Col xs={24} md={16}>
            <div style={{ marginBottom: 12 }}>
              <Tag color="gold" style={{ fontSize: 14, padding: '4px 12px' }}>
                {HeritageCategoryMap[heritage.category]}
              </Tag>
              <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                {HeritageLevelMap[heritage.level]}
              </Tag>
              {heritage.region && <Tag style={{ fontSize: 14, padding: '4px 12px' }}>{heritage.region}</Tag>}
            </div>
            <Title level={1} className="gradient-text" style={{ fontSize: 42, marginBottom: 16 }}>
              {heritage.name}
            </Title>
            <Paragraph style={{ fontSize: 16, color: '#c8c8c8', marginBottom: 24 }}>
              {heritage.summary}
            </Paragraph>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ color: '#a0a0a0' }}>
                <EyeOutlined /> {heritage.viewCount} 次浏览
              </span>
              <span style={{ color: '#a0a0a0' }}>
                <CalendarOutlined /> 收录于 {new Date(heritage.createdAt).toLocaleDateString()}
              </span>
              <SocialShare type="heritage" targetId={heritage.id} title={heritage.name} />
              <Link to="/booking">
                <Button type="primary">预约研学</Button>
              </Link>
            </div>
          </Col>
        </Row>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Tabs defaultActiveKey="intro" style={{ background: '#16213e', borderRadius: 12, padding: 8 }}>
            <TabPane tab="项目介绍" key="intro">
              <div style={{ padding: 16 }}>
                <Title level={4} style={{ color: '#c8a96e' }}>
                  项目概述
                </Title>
                <Paragraph style={{ fontSize: 15, lineHeight: 1.8 }}>{heritage.description || heritage.summary}</Paragraph>

                {heritage.history && (
                  <>
                    <Divider />
                    <Title level={4} style={{ color: '#c8a96e' }}>
                      历史渊源
                    </Title>
                    <Paragraph style={{ fontSize: 15, lineHeight: 1.8 }}>{heritage.history}</Paragraph>
                  </>
                )}

                {heritage.characteristics && (
                  <>
                    <Divider />
                    <Title level={4} style={{ color: '#c8a96e' }}>
                      技艺特点
                    </Title>
                    <Paragraph style={{ fontSize: 15, lineHeight: 1.8 }}>{heritage.characteristics}</Paragraph>
                  </>
                )}
              </div>
            </TabPane>

            <TabPane tab={`媒体资料 (${heritage.mediaFiles.length})`} key="media">
              <div style={{ padding: 16 }}>
                {heritage.mediaFiles.length === 0 ? (
                  <Empty description="暂无媒体资料" />
                ) : (
                  <Row gutter={[16, 16]}>
                    {heritage.mediaFiles.filter((m) => m.type === 'IMAGE').map((media) => (
                      <Col xs={24} sm={12} key={media.id}>
                        {renderMedia(media)}
                      </Col>
                    ))}
                    {heritage.mediaFiles
                      .filter((m) => m.type !== 'IMAGE')
                      .map((media) => (
                        <Col xs={24} key={media.id}>
                          {renderMedia(media)}
                        </Col>
                      ))}
                  </Row>
                )}
              </div>
            </TabPane>

            <TabPane tab={`版本历史 (${heritage.versionHistory.length})`} key="versions">
              <div style={{ padding: 16 }}>
                <List
                  dataSource={[...heritage.versionHistory].reverse()}
                  renderItem={(item: VersionHistory) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <span style={{ color: '#c8a96e' }}>
                            {item.version} - {new Date(item.modifiedAt).toLocaleDateString()}
                          </span>
                        }
                        description={
                          <div>
                            <div style={{ color: '#a0a0a0' }}>{item.changeLog}</div>
                            <div style={{ color: '#707070', fontSize: 12, marginTop: 4 }}>
                              修改人：{item.modifiedBy}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            </TabPane>
          </Tabs>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<span style={{ color: '#c8a96e' }}>代表性传承人</span>} style={{ marginBottom: 24, borderRadius: 12 }}>
            {inheritors.length === 0 ? (
              <Empty description="暂无传承人信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                dataSource={inheritors}
                renderItem={(item: Inheritor) => (
                  <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #2d3a4f' }}>
                    <Link to={`/inheritors/${item.id}`} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12 }}>
                      <Avatar size={48} src={item.avatar} icon={<UserOutlined />} style={{ backgroundColor: '#c8a96e' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#e8e8e8', fontWeight: 500 }}>{item.name}</div>
                        <div style={{ color: '#707070', fontSize: 12 }}>
                          {item.age && `${item.age}岁 · `}{item.region}
                        </div>
                      </div>
                    </Link>
                  </List.Item>
                )}
              />
            )}
          </Card>

          <Card title={<span style={{ color: '#c8a96e' }}>项目信息</span>} style={{ borderRadius: 12 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="项目类别" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                {HeritageCategoryMap[heritage.category]}
              </Descriptions.Item>
              <Descriptions.Item label="项目级别" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                {HeritageLevelMap[heritage.level]}
              </Descriptions.Item>
              <Descriptions.Item label="所属地区" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                {heritage.region || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="传承人数" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                {heritage.inheritorIds.length} 位
              </Descriptions.Item>
              <Descriptions.Item label="浏览次数" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                {heritage.viewCount} 次
              </Descriptions.Item>
              <Descriptions.Item label="收录时间" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                {new Date(heritage.createdAt).toLocaleDateString()}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default HeritageDetail
