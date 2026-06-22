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
  Divider,
  List,
  Statistic,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  ShareAltOutlined,
  UserOutlined,
  ApartmentOutlined,
  TrophyOutlined,
  BookOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { inheritorApi } from '@/api/inheritor'
import { heritageApi } from '@/api/heritage'
import { Inheritor, Heritage, ApprenticeRecord } from '@/types'

const { Title, Paragraph } = Typography
const { TabPane } = Tabs

const InheritorProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [inheritor, setInheritor] = useState<Inheritor | null>(null)
  const [heritages, setHeritages] = useState<Heritage[]>([])
  const [inheritanceTree, setInheritanceTree] = useState<Inheritor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const [inheritorRes, treeRes] = await Promise.all([
          inheritorApi.getPublicDetail(id),
          inheritorApi.getInheritanceTree(id),
        ])
        const data = inheritorRes.data
        setInheritor(data || null)
        setInheritanceTree(treeRes.data || [])

        if (data?.heritageIds?.length) {
          const heritageResults = await Promise.all(
            data.heritageIds.map((hid) => heritageApi.getPublicDetail(hid).catch(() => null))
          )
          setHeritages(heritageResults.filter((h) => h?.data).map((h) => h!.data!))
        }
      } catch (error) {
        console.error('Failed to fetch inheritor profile:', error)
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

  const getTreeOption = () => {
    if (inheritanceTree.length === 0) return null

    const findMaster = () => {
      const current = inheritanceTree.find((i) => i.id === id)
      if (!current?.masterId) return current
      let master = inheritanceTree.find((i) => i.id === current.masterId)
      while (master?.masterId) {
        const next = inheritanceTree.find((i) => i.id === master.masterId)
        if (!next) break
        master = next
      }
      return master || current
    }

    const buildTree = (nodeId: string | undefined): any => {
      const node = inheritanceTree.find((i) => i.id === nodeId)
      if (!node) return null
      const children = inheritanceTree
        .filter((i) => i.masterId === nodeId)
        .map((c) => buildTree(c.id))
        .filter(Boolean)

      return {
        name: node.name,
        value: node.age ? `${node.age}岁` : '',
        itemStyle: {
          color: node.id === id ? '#c8a96e' : '#0f3460',
        },
        children: children.length ? children : undefined,
      }
    }

    const root = findMaster()
    const data = buildTree(root?.id)

    return {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
      },
      series: [
        {
          type: 'tree',
          data: data ? [data] : [],
          top: '10%',
          left: '10%',
          bottom: '10%',
          right: '20%',
          symbolSize: 12,
          orient: 'LR',
          label: {
            position: 'left',
            verticalAlign: 'middle',
            align: 'right',
            fontSize: 14,
            color: '#e8e8e8',
          },
          leaves: {
            label: {
              position: 'right',
              verticalAlign: 'middle',
              align: 'left',
              color: '#e8e8e8',
            },
          },
          lineStyle: {
            color: '#c8a96e',
            width: 2,
            curveness: 0.5,
          },
          emphasis: {
            focus: 'descendant',
          },
          expandAndCollapse: true,
          animationDuration: 550,
          animationDurationUpdate: 750,
        },
      ],
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!inheritor) {
    return <Empty description="传承人不存在" style={{ padding: 64 }} />
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ color: '#c8a96e' }}>
          返回
        </Button>
      </div>

      <Card style={{ borderRadius: 12, marginBottom: 24 }} className="ornament-border" styles={{ body: { padding: 32 } }}>
        <Row gutter={32} align="middle">
          <Col xs={24} md={6} style={{ textAlign: 'center' }}>
            <Avatar
              size={140}
              src={inheritor.avatar}
              icon={<UserOutlined />}
              style={{
                backgroundColor: '#c8a96e',
                border: '4px solid #0f3460',
                fontSize: 56,
              }}
            />
          </Col>
          <Col xs={24} md={18}>
            <Title level={2} className="gradient-text" style={{ fontSize: 36, marginBottom: 12 }}>
              {inheritor.name}
            </Title>
            <div style={{ marginBottom: 16 }}>
              {inheritor.gender && <Tag color="blue">{inheritor.gender}</Tag>}
              {inheritor.age && <Tag>{inheritor.age}岁</Tag>}
              {inheritor.ethnicity && <Tag color="purple">{inheritor.ethnicity}</Tag>}
              {inheritor.region && <Tag color="gold">{inheritor.region}</Tag>}
            </div>
            <Paragraph style={{ color: '#c8c8c8', fontSize: 15, lineHeight: 1.8, marginBottom: 16 }}>
              {inheritor.bio || '暂无简介'}
            </Paragraph>
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <Statistic
                  title={<span style={{ color: '#a0a0a0' }}>传承项目</span>}
                  value={inheritor.heritageIds?.length || 0}
                  valueStyle={{ color: '#c8a96e' }}
                  prefix={<TrophyOutlined />}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title={<span style={{ color: '#a0a0a0' }}>收徒人数</span>}
                  value={inheritor.apprenticeCount || inheritor.studentIds?.length || 0}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<TeamOutlined />}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title={<span style={{ color: '#a0a0a0' }}>授课时长</span>}
                  value={inheritor.totalTeachingHours || 0}
                  suffix="小时"
                  valueStyle={{ color: '#1890ff' }}
                  prefix={<ClockCircleOutlined />}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Button type="primary" icon={<CalendarOutlined />} onClick={() => navigate('/booking')} block>
                  预约研学
                </Button>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Tabs defaultActiveKey="profile" style={{ background: '#16213e', borderRadius: 12, padding: 8 }}>
            <TabPane tab={<span><ApartmentOutlined /> 传承关系图谱</span>} key="tree">
              <div style={{ padding: 16 }}>
                {inheritanceTree.length > 0 ? (
                  <ReactECharts option={getTreeOption()} style={{ height: 400 }} />
                ) : (
                  <Empty description="暂无传承关系数据" />
                )}
              </div>
            </TabPane>

            <TabPane tab={<span><BookOutlined /> 个人简介</span>} key="profile">
              <div style={{ padding: 16 }}>
                <Descriptions column={2} size="middle" bordered style={{ marginBottom: 24 }}>
                  <Descriptions.Item label="姓名" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                    {inheritor.name}
                  </Descriptions.Item>
                  <Descriptions.Item label="性别" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                    {inheritor.gender || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="出生年月" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                    {inheritor.birthDate ? new Date(inheritor.birthDate).toLocaleDateString() : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="民族" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                    {inheritor.ethnicity || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="籍贯" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                    {inheritor.region || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="总授课时长" labelStyle={{ color: '#a0a0a0' }} contentStyle={{ color: '#e8e8e8' }}>
                    {inheritor.totalTeachingHours} 小时
                  </Descriptions.Item>
                </Descriptions>

                {inheritor.skillCharacteristics && (
                  <>
                    <Title level={4} style={{ color: '#c8a96e' }}>
                      技艺特点
                    </Title>
                    <Paragraph style={{ fontSize: 15, lineHeight: 1.8 }}>{inheritor.skillCharacteristics}</Paragraph>
                  </>
                )}

                {inheritor.representativeWorks && (
                  <>
                    <Divider />
                    <Title level={4} style={{ color: '#c8a96e' }}>
                      代表作品
                    </Title>
                    <Paragraph style={{ fontSize: 15, lineHeight: 1.8 }}>{inheritor.representativeWorks}</Paragraph>
                  </>
                )}
              </div>
            </TabPane>

            <TabPane tab={<span><TeamOutlined /> 收徒记录 ({inheritor.apprenticeRecords?.length || 0})</span>} key="apprentices">
              <div style={{ padding: 16 }}>
                {inheritor.apprenticeRecords?.length ? (
                  <List
                    dataSource={inheritor.apprenticeRecords}
                    renderItem={(item: ApprenticeRecord) => (
                      <List.Item style={{ padding: '16px 0', borderBottom: '1px solid #2d3a4f' }}>
                        <List.Item.Meta
                          title={<span style={{ color: '#e8e8e8' }}>{item.apprenticeName}</span>}
                          description={
                            <div>
                              <div style={{ color: '#a0a0a0' }}>
                                {new Date(item.startDate).toLocaleDateString()}
                                {item.endDate && ` - ${new Date(item.endDate).toLocaleDateString()}`}
                              </div>
                              <div style={{ color: '#707070', marginTop: 4 }}>
                                状态：{item.status}
                                {item.assessmentResult && ` | 考核：${item.assessmentResult}`}
                              </div>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="暂无收徒记录" />
                )}
              </div>
            </TabPane>
          </Tabs>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<span style={{ color: '#c8a96e' }}>传承项目</span>} style={{ marginBottom: 24, borderRadius: 12 }}>
            {heritages.length === 0 ? (
              <Empty description="暂无传承项目" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                dataSource={heritages}
                renderItem={(item: Heritage) => (
                  <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #2d3a4f' }}>
                    <Link to={`/heritages/${item.id}`} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          backgroundImage: item.coverImage ? `url(${item.coverImage})` : 'linear-gradient(135deg, #16213e, #0f3460)',
                          backgroundSize: 'cover',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 24,
                        }}
                      >
                        🏛️
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#e8e8e8' }}>{item.name}</div>
                        <div style={{ color: '#707070', fontSize: 12 }}>
                          {item.region}
                        </div>
                      </div>
                    </Link>
                  </List.Item>
                )}
              />
            )}
          </Card>

          <Card title={<span style={{ color: '#c8a96e' }}>联系方式</span>} style={{ borderRadius: 12 }}>
            <Button icon={<ShareAltOutlined />} onClick={handleShare} block style={{ marginBottom: 12 }}>
              分享传承人档案
            </Button>
            <Link to="/booking">
              <Button type="primary" icon={<CalendarOutlined />} block>
                预约非遗研学
              </Button>
            </Link>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default InheritorProfile
