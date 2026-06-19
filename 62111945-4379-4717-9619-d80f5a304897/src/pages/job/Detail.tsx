import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Row,
  Col,
  Divider,
  message,
  Avatar,
  Space,
  Modal,
  Select
} from 'antd'
import {
  ArrowLeftOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  ShopOutlined,
  UserOutlined,
  StarOutlined,
  ShareAltOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import { Job, Resume } from '@/types'
import { mockGetJobDetail } from '@/mock/job'
import { mockGetResumeList, mockApplyJob } from '@/mock/resume'
import './Detail.css'

const JobDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [applyModalVisible, setApplyModalVisible] = useState(false)
  const [resumes, setResumes] = useState<Resume[]>([])
  const [selectedResume, setSelectedResume] = useState<string>('')
  const [applying, setApplying] = useState(false)
  const [isCollected, setIsCollected] = useState(false)

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const detail = await mockGetJobDetail(id!)
      setJob(detail)
    } finally {
      setLoading(false)
    }
  }

  const formatSalary = (min: number, max: number) => {
    return `${min / 1000}K-${max / 1000}K`
  }

  const handleApply = async () => {
    if (!selectedResume) {
      message.warning('请选择要投递的简历')
      return
    }
    setApplying(true)
    try {
      await mockApplyJob(id!, selectedResume)
      message.success('简历投递成功！企业将在3个工作日内给予回复')
      setApplyModalVisible(false)
    } catch (error: any) {
      message.error(error.message || '投递失败')
    } finally {
      setApplying(false)
    }
  }

  const openApplyModal = async () => {
    const resumeList = await mockGetResumeList()
    setResumes(resumeList)
    if (resumeList.length > 0) {
      const defaultResume = resumeList.find(r => r.isDefault) || resumeList[0]
      setSelectedResume(defaultResume.id)
    }
    setApplyModalVisible(true)
  }

  const handleCollect = () => {
    setIsCollected(!isCollected)
    message.success(isCollected ? '已取消收藏' : '收藏成功')
  }

  if (!job && !loading) {
    return (
      <Card>
        <Empty description="职位不存在" />
      </Card>
    )
  }

  return (
    <div className="job-detail-page">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        返回列表
      </Button>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card className="job-info-card" loading={loading}>
            <div className="job-header">
              <div>
                <h1 className="job-title">{job?.title}</h1>
                <div className="job-tags">
                  <Tag color="red" className="salary-tag">
                    {job && formatSalary(job.salaryMin, job.salaryMax)}
                  </Tag>
                  <Tag><EnvironmentOutlined /> {job?.location}</Tag>
                  <Tag><ClockCircleOutlined /> {job?.experience}</Tag>
                  <Tag>{job?.education}</Tag>
                  {job?.tags.map((tag, idx) => (
                    <Tag key={idx} color="blue">{tag}</Tag>
                  ))}
                </div>
              </div>
              <div className="job-actions">
                <Button 
                  type={isCollected ? 'primary' : 'default'} 
                  icon={<StarOutlined />}
                  onClick={handleCollect}
                >
                  {isCollected ? '已收藏' : '收藏'}
                </Button>
                <Button icon={<ShareAltOutlined />}>分享</Button>
              </div>
            </div>

            <Divider />

            <div className="section">
              <h3 className="section-title">职位描述</h3>
              <div className="section-content">
                {job?.description.split('\n').map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            </div>

            <div className="section">
              <h3 className="section-title">任职要求</h3>
              <div className="section-content">
                {job?.requirements.split('\n').map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            </div>

            <div className="apply-bottom">
              <Button type="primary" size="large" onClick={openApplyModal}>
                立即投递
              </Button>
              <span className="apply-tip">已有 {job?.applyCount} 人投递</span>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="company-card" loading={loading}>
            <div className="company-header">
              <Avatar size={56} icon={<ShopOutlined />} />
              <div className="company-info">
                <h3 className="company-name">{job?.enterpriseName}</h3>
                <p className="company-desc">互联网 · 1000-9999人</p>
              </div>
            </div>
            <Divider />
            <div className="company-detail">
              <p><span>公司行业：</span>互联网/信息技术</p>
              <p><span>公司规模：</span>1000-9999人</p>
              <p><span>公司地址：</span>{job?.location}</p>
            </div>
            <Button block>查看公司主页</Button>
          </Card>

          <Card className="tips-card" title="温馨提示">
            <ul>
              <li>如招聘方以任何名义向您收取费用，均属违法行为</li>
              <li>请保护好个人隐私，不要轻易提供身份证等敏感信息</li>
              <li>面试请选择正规办公场所，注意人身安全</li>
            </ul>
          </Card>
        </Col>
      </Row>

      <Modal
        title="投递简历"
        open={applyModalVisible}
        onCancel={() => setApplyModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setApplyModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={applying} onClick={handleApply}>
            确认投递
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8, color: '#666' }}>您即将向「{job?.title}」岗位投递简历</p>
        </div>
        <Select
          placeholder="请选择要投递的简历"
          value={selectedResume}
          onChange={setSelectedResume}
          style={{ width: '100%' }}
          options={resumes.map(r => ({
            value: r.id,
            label: `${r.title}${r.isDefault ? '（默认）' : ''}`
          }))}
        />
      </Modal>
    </div>
  )
}

export default JobDetail
