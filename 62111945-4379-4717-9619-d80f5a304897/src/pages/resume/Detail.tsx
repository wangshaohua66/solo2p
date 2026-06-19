import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Button,
  Row,
  Col,
  Tag,
  Divider,
  Empty,
  Spin,
  Avatar,
  Space,
  Descriptions,
  Timeline,
  Tooltip
} from 'antd'
import {
  ArrowLeftOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  EditOutlined,
  DownloadOutlined,
  StarOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons'
import { Resume } from '@/types'
import { mockGetResumeDetail } from '@/mock/resume'
import './Detail.css'

const ResumeDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [resume, setResume] = useState<Resume | null>(null)

  useEffect(() => {
    if (id) {
      loadResume()
    }
  }, [id])

  const loadResume = async () => {
    setLoading(true)
    try {
      const detail = await mockGetResumeDetail(id)
      setResume(detail)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!resume) {
    return (
      <Card>
        <Empty description="简历不存在" />
      </Card>
    )
  }

  return (
    <div className="resume-detail-page">
      <div className="page-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
        <Space>
          <Button icon={<DownloadOutlined />}>下载PDF</Button>
          <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/resume/${id}/edit`)}>
            编辑简历
          </Button>
        </Space>
      </div>

      <div className="resume-container">
        <Card className="resume-card">
          <div className="resume-header-section">
            <div className="resume-avatar-section">
              <Avatar size={80} icon={<UserOutlined />} />
              <div className="resume-basic-info">
                <h2 className="resume-name">{resume.name}</h2>
                <div className="resume-title-tag">
                  {resume.title}
                  {resume.isDefault && <Tag color="gold">默认简历</Tag>}
                </div>
                <div className="resume-contact">
                  <span><PhoneOutlined /> {resume.phone}</span>
                  <span><MailOutlined /> {resume.email}</span>
                </div>
              </div>
            </div>
            <div className="resume-expect-section">
              <div className="expect-item">
                <span className="expect-label">期望职位</span>
                <span className="expect-value">{resume.expectedPosition}</span>
              </div>
              <div className="expect-item">
                <span className="expect-label">期望薪资</span>
                <span className="expect-value salary">{resume.expectedSalaryMin / 1000}K-{resume.expectedSalaryMax / 1000}K</span>
              </div>
            </div>
          </div>

          <Divider />

          <Row gutter={40}>
            <Col xs={24} md={16}>
              <div className="section">
                <h3 className="section-title">
                  <SafetyCertificateOutlined className="section-icon" />
                  个人优势
                </h3>
                <div className="skills-tags">
                  {resume.skills.map((skill, idx) => (
                    <Tag key={idx} color="blue" className="skill-tag">{skill}</Tag>
                  ))}
                </div>
              </div>

              <div className="section">
                <h3 className="section-title">
                  <StarOutlined className="section-icon" />
                  工作经历
                </h3>
                <Timeline
                  className="experience-timeline"
                  items={resume.workExperience.map((exp) => ({
                    color: 'blue',
                    children: (
                      <div className="experience-item">
                        <div className="experience-header">
                          <span className="company-name">{exp.company}</span>
                          <span className="time-range">{exp.startTime} - {exp.endTime}</span>
                        </div>
                        <div className="position">{exp.position}</div>
                        <p className="description">{exp.description}</p>
                      </div>
                    )
                  }))}
                />
              </div>

              <div className="section">
                <h3 className="section-title">
                  <StarOutlined className="section-icon" />
                  项目经历
                </h3>
                <Timeline
                  className="experience-timeline"
                  items={resume.projectExperience.map((proj) => ({
                    color: 'green',
                    children: (
                      <div className="experience-item">
                        <div className="experience-header">
                          <span className="company-name">{proj.name}</span>
                          <span className="time-range">{proj.startTime} - {proj.endTime}</span>
                        </div>
                        <div className="position">{proj.role}</div>
                        <p className="description">{proj.description}</p>
                      </div>
                    )
                  }))}
                />
              </div>
            </Col>

            <Col xs={24} md={8}>
              <div className="side-section">
                <h4 className="side-title">基本信息</h4>
                <Descriptions column={1} size="small" className="info-list">
                  <Descriptions.Item label="性别">{resume.gender === 'male' ? '男' : '女'}</Descriptions.Item>
                  <Descriptions.Item label="年龄">{resume.age}岁</Descriptions.Item>
                  <Descriptions.Item label="工作年限">{resume.experience}年</Descriptions.Item>
                  <Descriptions.Item label="最高学历">{resume.education}</Descriptions.Item>
                  <Descriptions.Item label="现居住地">北京</Descriptions.Item>
                  <Descriptions.Item label="求职状态">在职-考虑机会</Descriptions.Item>
                </Descriptions>
              </div>

              <div className="side-section">
                <h4 className="side-title">教育经历</h4>
                {resume.educationExperience.map((edu, idx) => (
                  <div key={idx} className="edu-item">
                    <div className="edu-school">{edu.school}</div>
                    <div className="edu-major">{edu.major} · {edu.degree}</div>
                    <div className="edu-time">{edu.startTime} - {edu.endTime}</div>
                  </div>
                ))}
              </div>

              <div className="side-section">
                <h4 className="side-title">求职意向</h4>
                <div className="intent-item">
                  <span className="intent-label">期望职位</span>
                  <span className="intent-value">{resume.expectedPosition}</span>
                </div>
                <div className="intent-item">
                  <span className="intent-label">期望薪资</span>
                  <span className="intent-value">{resume.expectedSalaryMin / 1000}K-{resume.expectedSalaryMax / 1000}K</span>
                </div>
                <div className="intent-item">
                  <span className="intent-label">工作性质</span>
                  <span className="intent-value">全职</span>
                </div>
                <div className="intent-item">
                  <span className="intent-label">期望城市</span>
                  <span className="intent-value">北京</span>
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      </div>
    </div>
  )
}

export default ResumeDetail
