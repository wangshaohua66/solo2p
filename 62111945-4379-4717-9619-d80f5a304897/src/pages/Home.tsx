import { useState, useEffect } from 'react'
import { Row, Col, Card, Tag, Button, Space, Statistic, List, Avatar, Empty } from 'antd'
import {
  CalendarOutlined,
  ShopOutlined,
  UserOutlined,
  TeamOutlined,
  RightOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  StarOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { Recruitment, Job } from '@/types'
import { mockGetRecruitmentList } from '@/mock/recruitment'
import { mockRecommendJobs } from '@/mock/job'
import './Home.css'

const Home = () => {
  const navigate = useNavigate()
  const [recruitments, setRecruitments] = useState<Recruitment[]>([])
  const [recommendJobs, setRecommendJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [recResult, jobResult] = await Promise.all([
        mockGetRecruitmentList({ page: 1, pageSize: 4, status: 'all' }),
        mockRecommendJobs(6)
      ])
      setRecruitments(recResult.list)
      setRecommendJobs(jobResult)
    } finally {
      setLoading(false)
    }
  }

  const getStatusTag = (status: Recruitment['status']) => {
    const statusMap = {
      pending: { color: 'blue', text: '即将开始' },
      ongoing: { color: 'green', text: '进行中' },
      ended: { color: 'default', text: '已结束' }
    }
    const info = statusMap[status]
    return <Tag color={info.color}>{info.text}</Tag>
  }

  const formatSalary = (min: number, max: number) => {
    return `${min / 1000}K-${max / 1000}K`
  }

  const stats = [
    { title: '入驻企业', value: '2,000+', icon: <ShopOutlined />, color: '#1677ff' },
    { title: '优质岗位', value: '15,000+', icon: <StarOutlined />, color: '#52c41a' },
    { title: '求职者', value: '50,000+', icon: <UserOutlined />, color: '#faad14' },
    { title: '年度招聘会', value: '180场', icon: <TeamOutlined />, color: '#722ed1' }
  ]

  return (
    <div className="home-page">
      <Card className="welcome-banner">
        <div className="banner-content">
          <div>
            <h2>欢迎来到区域人才市场服务平台</h2>
            <p>连接人才与机遇，助力区域经济发展。8个县区人才服务中心联合运营。</p>
            <Space size="middle">
              <Button type="primary" size="large" onClick={() => navigate('/recruitment')}>
                查看招聘会
              </Button>
              <Button size="large" onClick={() => navigate('/jobs')}>
                浏览职位
              </Button>
            </Space>
          </div>
          <div className="banner-stats">
            <img src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20talent%20recruitment%20platform%20hero%20illustration%20with%20business%20people%20connecting%20professional%20clean%20design%20blue%20theme&image_size=landscape_4_3" 
                 alt="人才招聘" 
                 className="banner-image"
                 style={{ width: 300, height: 200, objectFit: 'cover', borderRadius: 8 }}
            />
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]} className="stats-row">
        {stats.map((stat, idx) => (
          <Col xs={12} sm={12} md={6} key={idx}>
            <Card className="stat-card">
              <div className="stat-icon" style={{ background: stat.color + '20', color: stat.color }}>
                {stat.icon}
              </div>
              <div>
                <div className="stat-value">{stat.value}</div>
                <div className="stat-title">{stat.title}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} className="content-row">
        <Col xs={24} lg={14}>
          <Card
            title={
              <div className="card-title">
                <CalendarOutlined className="title-icon" />
                近期招聘会
              </div>
            }
            extra={
              <Button type="link" onClick={() => navigate('/recruitment')}>
                查看更多 <RightOutlined style={{ fontSize: 12 }} />
              </Button>
            }
            className="section-card"
          >
            {recruitments.length > 0 ? (
              <List
                loading={loading}
                dataSource={recruitments}
                renderItem={(item) => (
                  <List.Item
                    className="recruitment-item card-hover"
                    onClick={() => navigate(`/recruitment/${item.id}`)}
                  >
                    <div className="recruitment-info">
                      <div className="recruitment-title">
                        {item.title}
                        {getStatusTag(item.status)}
                      </div>
                      <div className="recruitment-meta">
                        <span>
                          <ClockCircleOutlined /> {dayjs(item.startTime).format('YYYY-MM-DD HH:mm')}
                        </span>
                        <span>
                          <EnvironmentOutlined /> {item.location}
                        </span>
                        <span>
                          <ShopOutlined /> {item.enterpriseCount}家企业
                        </span>
                      </div>
                    </div>
                    <div className="recruitment-stats">
                      <div className="stat-item">
                        <div className="num">{item.jobCount}</div>
                        <div className="label">岗位</div>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无招聘会" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <div className="card-title">
                <StarOutlined className="title-icon" />
                推荐岗位
              </div>
            }
            extra={
              <Button type="link" onClick={() => navigate('/jobs')}>
                更多 <RightOutlined style={{ fontSize: 12 }} />
              </Button>
            }
            className="section-card"
          >
            {recommendJobs.length > 0 ? (
              <List
                loading={loading}
                dataSource={recommendJobs}
                renderItem={(job) => (
                  <List.Item
                    className="job-item card-hover"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <div className="job-header">
                      <span className="job-title">{job.title}</span>
                      <span className="job-salary">{formatSalary(job.salaryMin, job.salaryMax)}</span>
                    </div>
                    <div className="job-footer">
                      <span className="company-name">{job.enterpriseName}</span>
                      <div className="job-tags">
                        {job.tags.slice(0, 2).map((tag, idx) => (
                          <Tag key={idx} color="blue" style={{ margin: 0, marginRight: 4 }}>
                            {tag}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无推荐岗位" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Home
