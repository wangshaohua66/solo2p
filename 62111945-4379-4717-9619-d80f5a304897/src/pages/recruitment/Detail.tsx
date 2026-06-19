import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Row,
  Col,
  Statistic,
  Tabs,
  List,
  Avatar,
  Empty,
  Modal,
  message,
  Space,
  Divider
} from 'antd'
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  ShopOutlined,
  UserOutlined,
  QrcodeOutlined,
  TeamOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import { QRCodeSVG } from 'qrcode.react'
import dayjs from 'dayjs'
import { Recruitment, Booth } from '@/types'
import { mockGetRecruitmentDetail, mockGetBoothList } from '@/mock/recruitment'
import './Detail.css'

const { TabPane } = Tabs

const RecruitmentDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [recruitment, setRecruitment] = useState<Recruitment | null>(null)
  const [booths, setBooths] = useState<Booth[]>([])
  const [loading, setLoading] = useState(true)
  const [qrModalVisible, setQrModalVisible] = useState(false)
  const [activeArea, setActiveArea] = useState('all')

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [detail, boothList] = await Promise.all([
        mockGetRecruitmentDetail(id!),
        mockGetBoothList(id!)
      ])
      setRecruitment(detail)
      setBooths(boothList)
    } finally {
      setLoading(false)
    }
  }

  const getStatusTag = (status: Recruitment['status']) => {
    const map = {
      pending: { color: 'blue', text: '待开始' },
      ongoing: { color: 'green', text: '进行中' },
      ended: { color: 'default', text: '已结束' }
    }
    const info = map[status]
    return <Tag color={info.color}>{info.text}</Tag>
  }

  const getBoothStatusColor = (status: Booth['status']) => {
    const map = {
      available: '#f0f0f0',
      assigned: '#1677ff',
      checked_in: '#52c41a'
    }
    return map[status]
  }

  const handleSignUp = () => {
    message.success('报名成功！请准时参加招聘会')
  }

  const filteredBooths = activeArea === 'all' 
    ? booths 
    : booths.filter(b => b.area === activeArea)

  const areaList = [...new Set(booths.map(b => b.area))]

  if (!recruitment && !loading) {
    return (
      <Card>
        <Empty description="招聘会不存在" />
      </Card>
    )
  }

  return (
    <div className="recruitment-detail-page">
      <div className="detail-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
          返回列表
        </Button>
        <Card className="info-card" loading={loading}>
          <div className="info-header">
            <div>
              <h2 className="title">
                {recruitment?.title}
                {recruitment && getStatusTag(recruitment.status)}
              </h2>
              <div className="meta">
                <span><CalendarOutlined /> {dayjs(recruitment?.startTime).format('YYYY-MM-DD HH:mm')} - {dayjs(recruitment?.endTime).format('HH:mm')}</span>
                <span><EnvironmentOutlined /> {recruitment?.location}</span>
                <span><TeamOutlined /> {recruitment?.centerName}</span>
              </div>
            </div>
            <Space>
              <Button icon={<QrcodeOutlined />} onClick={() => setQrModalVisible(true)}>
                签到二维码
              </Button>
              <Button type="primary" onClick={handleSignUp}>
                立即报名
              </Button>
            </Space>
          </div>

          <Divider />

          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <Statistic title="参会企业" value={recruitment?.enterpriseCount} prefix={<ShopOutlined />} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="提供岗位" value={recruitment?.jobCount} prefix={<FileTextOutlined />} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="展位数量" value={recruitment?.boothCount} prefix={<ShopOutlined />} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="已签到" value={recruitment?.signInCount} prefix={<UserOutlined />} />
            </Col>
          </Row>
        </Card>
      </div>

      <Card className="detail-content">
        <Tabs defaultActiveKey="info">
          <TabPane tab="招聘会介绍" key="info">
            <div className="description">
              <h3>招聘会简介</h3>
              <p>{recruitment?.description}</p>
              
              <h3>参会说明</h3>
              <ul>
                <li>请携带个人简历，建议准备多份纸质简历</li>
                <li>提前了解参会企业信息，针对性投递</li>
                <li>遵守会场秩序，听从工作人员引导</li>
                <li>注意个人财物安全，保管好随身物品</li>
              </ul>

              <h3>交通指引</h3>
              <p>地铁：地铁1号线XX站A出口，步行500米即到</p>
              <p>公交：乘坐XX路、XX路到XX站下车</p>
              <p>自驾：场地设有停车场，凭参会凭证免费停车</p>
            </div>
          </TabPane>

          <TabPane tab="展位图" key="booth">
            <div className="booth-map-section">
              <div className="area-filter">
                <Button.Group>
                  <Button 
                    type={activeArea === 'all' ? 'primary' : 'default'}
                    onClick={() => setActiveArea('all')}
                  >
                    全部
                  </Button>
                  {areaList.map(area => (
                    <Button 
                      key={area}
                      type={activeArea === area ? 'primary' : 'default'}
                      onClick={() => setActiveArea(area)}
                    >
                      {area}
                    </Button>
                  ))}
                </Button.Group>
                <div className="legend">
                  <span><em style={{ background: '#f0f0f0' }}></em> 空闲</span>
                  <span><em style={{ background: '#1677ff' }}></em> 已分配</span>
                  <span><em style={{ background: '#52c41a' }}></em> 已签到</span>
                </div>
              </div>

              <div className="booth-grid">
                {filteredBooths.map(booth => (
                  <div 
                    key={booth.id}
                    className="booth-item"
                    style={{ borderColor: getBoothStatusColor(booth.status) }}
                    title={booth.enterpriseName || '空闲展位'}
                  >
                    <div className="booth-number">{booth.boothNumber}</div>
                    <div className="booth-name" style={{ color: booth.enterpriseName ? '#262626' : '#bfbfbf' }}>
                      {booth.enterpriseName || '待分配'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabPane>

          <TabPane tab="参会企业" key="enterprises">
            <List
              loading={loading}
              dataSource={booths.filter(b => b.enterpriseName)}
              renderItem={(booth) => (
                <List.Item className="enterprise-item">
                  <List.Item.Meta
                    avatar={<Avatar size={48} icon={<ShopOutlined />} />}
                    title={booth.enterpriseName}
                    description={
                      <Space>
                        <Tag color="blue">展位号：{booth.boothNumber}</Tag>
                        <Tag color="green">{booth.area}</Tag>
                      </Space>
                    }
                  />
                  <Button type="link">查看岗位</Button>
                </List.Item>
              )}
            />
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="招聘会签到二维码"
        open={qrModalVisible}
        onCancel={() => setQrModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setQrModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <div className="qr-code-container">
          <QRCodeSVG
            value={`https://talent.example.com/signin?recruitmentId=${id}`}
            size={200}
            level="H"
            includeMargin
          />
          <p style={{ marginTop: 16, color: '#666', textAlign: 'center' }}>
            扫码即可完成签到入场
          </p>
          <p style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
            招聘会：{recruitment?.title}
          </p>
        </div>
      </Modal>
    </div>
  )
}

export default RecruitmentDetail
