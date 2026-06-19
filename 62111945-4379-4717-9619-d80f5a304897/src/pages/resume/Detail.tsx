import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Button,
  Tag,
  Divider,
  Empty,
  Spin,
  Avatar,
  Space,
  Descriptions,
  Timeline,
  Rate,
  Progress,
  List
} from 'antd'
import {
  ArrowLeftOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  EditOutlined,
  DownloadOutlined,
  StarOutlined,
  SafetyCertificateOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  BankOutlined,
  FileTextOutlined,
  TrophyOutlined,
  BulbOutlined,
  AimOutlined,
  PaperClipOutlined
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

  const completeRate = 85

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

      <div className="resume-layout">
        <div className="resume-left-panel">
          <Card className="profile-card" bordered={false}>
            <div className="profile-header">
              <Avatar size={100} icon={<UserOutlined />} className="profile-avatar" />
              <div className="profile-info">
                <h1 className="profile-name">{resume.name}</h1>
                <div className="profile-title">
                  {resume.title}
                  {resume.isDefault && <Tag color="gold" className="default-tag">默认简历</Tag>}
                </div>
                <div className="profile-contact-row">
                  <span className="contact-item">
                    <PhoneOutlined className="contact-icon" />
                    {resume.phone}
                  </span>
                  <span className="contact-item">
                    <MailOutlined className="contact-icon" />
                    {resume.email}
                  </span>
                </div>
                <div className="profile-contact-row">
                  <span className="contact-item">
                    <EnvironmentOutlined className="contact-icon" />
                    北京市朝阳区
                  </span>
                  <span className="contact-item">
                    <CalendarOutlined className="contact-icon" />
                    {resume.experience}年经验
                  </span>
                </div>
              </div>
            </div>

            <Divider className="profile-divider" />

            <div className="complete-section">
              <div className="complete-header">
                <span className="complete-label">简历完整度</span>
                <span className="complete-value">{completeRate}%</span>
              </div>
              <Progress percent={completeRate} showInfo={false} strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }} />
            </div>
          </Card>

          <Card className="section-card" bordered={false} title={
            <span className="card-title">
              <AimOutlined className="title-icon" />
              求职意向
            </span>
          }>
            <Descriptions column={2} size="small" className="intent-list">
              <Descriptions.Item label="期望职位">{resume.expectedPosition}</Descriptions.Item>
              <Descriptions.Item label="期望薪资">
                <span className="salary-text">{resume.expectedSalaryMin / 1000}K-{resume.expectedSalaryMax / 1000}K</span>
              </Descriptions.Item>
              <Descriptions.Item label="期望城市">北京</Descriptions.Item>
              <Descriptions.Item label="工作性质">全职</Descriptions.Item>
              <Descriptions.Item label="求职状态">在职-考虑机会</Descriptions.Item>
              <Descriptions.Item label="到岗时间">随时到岗</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card className="section-card" bordered={false} title={
            <span className="card-title">
              <SafetyCertificateOutlined className="title-icon" />
              技能特长
            </span>
          }>
            <div className="skills-container">
              {resume.skills.map((skill, idx) => (
                <Tag key={idx} color="blue" className="skill-tag-large">{skill}</Tag>
              ))}
            </div>
            <Divider className="skill-divider" />
            <div className="skill-rating-list">
              <div className="skill-rating-item">
                <span className="skill-name">Java</span>
                <Rate disabled defaultValue={4} className="skill-rate" />
              </div>
              <div className="skill-rating-item">
                <span className="skill-name">Spring Boot</span>
                <Rate disabled defaultValue={5} className="skill-rate" />
              </div>
              <div className="skill-rating-item">
                <span className="skill-name">MySQL</span>
                <Rate disabled defaultValue={4} className="skill-rate" />
              </div>
              <div className="skill-rating-item">
                <span className="skill-name">Redis</span>
                <Rate disabled defaultValue={3} className="skill-rate" />
              </div>
            </div>
          </Card>

          <Card className="section-card" bordered={false} title={
            <span className="card-title">
              <BankOutlined className="title-icon" />
              教育背景
            </span>
          }>
            <div className="education-list">
              {resume.educationExperience.map((edu, idx) => (
                <div key={idx} className="education-item">
                  <div className="education-left">
                    <div className="education-school">{edu.school}</div>
                    <div className="education-major">{edu.major} · {edu.degree}</div>
                  </div>
                  <div className="education-right">
                    <span className="education-time">{edu.startTime} - {edu.endTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="section-card" bordered={false} title={
            <span className="card-title">
              <PaperClipOutlined className="title-icon" />
              简历附件
            </span>
          }>
            <List
              size="small"
              dataSource={[
                { name: '个人简历.pdf', size: '2.5MB', type: 'pdf' },
                { name: '作品集.docx', size: '1.2MB', type: 'doc' },
                { name: '学历证明.jpg', size: '800KB', type: 'image' }
              ]}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button type="link" size="small" icon={<DownloadOutlined />}>
                      下载
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<FileTextOutlined style={{ fontSize: 24, color: '#1677ff' }} />}
                    title={item.name}
                    description={item.size}
                  />
                </List.Item>
              )}
            />
          </Card>
        </div>

        <div className="resume-right-panel">
          <Card className="section-card" bordered={false} title={
            <span className="card-title">
              <StarOutlined className="title-icon" />
              工作经历
            </span>
          }>
            <Timeline
              className="experience-timeline"
              items={resume.workExperience.map((exp: any, idx: number) => ({
                color: idx === 0 ? 'blue' : 'gray',
                children: (
                  <div className="experience-item">
                    <div className="experience-header">
                      <div className="experience-company">
                        <span className="company-name">{exp.company}</span>
                        {exp.industry && <Tag color="green" className="company-tag">{exp.industry}</Tag>}
                      </div>
                      <span className="time-range">
                        <CalendarOutlined /> {exp.startTime} - {exp.endTime}
                      </span>
                    </div>
                    <div className="experience-position">
                      <span className="position-name">{exp.position}</span>
                      {exp.salary && <span className="position-salary">{exp.salary}</span>}
                    </div>
                    <div className="experience-desc">
                      <h5 className="desc-title">工作描述：</h5>
                      <p className="desc-content">{exp.description}</p>
                    </div>
                    {exp.achievements && (
                      <div className="experience-achievements">
                        <h5 className="desc-title">主要业绩：</h5>
                        <ul className="achievement-list">
                          {exp.achievements.map((item: string, i: number) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              }))}
            />
          </Card>

          <Card className="section-card" bordered={false} title={
            <span className="card-title">
              <BulbOutlined className="title-icon" />
              项目经验
            </span>
          }>
            <Timeline
              className="experience-timeline"
              items={resume.projectExperience.map((proj: any, idx: number) => ({
                color: idx === 0 ? 'green' : 'gray',
                children: (
                  <div className="project-item">
                    <div className="project-header">
                      <span className="project-name">{proj.name}</span>
                      <span className="project-time">{proj.startTime} - {proj.endTime}</span>
                    </div>
                    {proj.role && (
                      <div className="project-role">
                        <Tag color="blue">{proj.role}</Tag>
                        {proj.responsibility && <Tag color="purple">{proj.responsibility}</Tag>}
                      </div>
                    )}
                    <div className="project-desc">
                      <h5 className="desc-title">项目描述：</h5>
                      <p className="desc-content">{proj.description}</p>
                    </div>
                    {proj.techStack && proj.techStack.length > 0 && (
                      <div className="project-tech">
                        <h5 className="desc-title">技术栈：</h5>
                        <div className="tech-tags">
                          {proj.techStack.map((tech: string, i: number) => (
                            <Tag key={i}>{tech}</Tag>
                          ))}
                        </div>
                      </div>
                    )}
                    {proj.achievements && proj.achievements.length > 0 && (
                      <div className="project-achievements">
                        <h5 className="desc-title">项目成果：</h5>
                        <ul className="achievement-list">
                          {proj.achievements.map((item: string, i: number) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              }))}
            />
          </Card>

          <Card className="section-card" bordered={false} title={
            <span className="card-title">
              <TrophyOutlined className="title-icon" />
              荣誉证书
            </span>
          }>
            <div className="certificate-list">
              <div className="cert-item">
                <div className="cert-icon">🏆</div>
                <div className="cert-info">
                  <div className="cert-name">软件设计师（中级）</div>
                  <div className="cert-org">工业和信息化部</div>
                  <div className="cert-time">2021年获得</div>
                </div>
              </div>
              <div className="cert-item">
                <div className="cert-icon">📜</div>
                <div className="cert-info">
                  <div className="cert-name">PMP项目管理专业人士认证</div>
                  <div className="cert-org">PMI</div>
                  <div className="cert-time">2022年获得</div>
                </div>
              </div>
              <div className="cert-item">
                <div className="cert-icon">🥇</div>
                <div className="cert-info">
                  <div className="cert-name">年度优秀员工</div>
                  <div className="cert-org">某某科技有限公司</div>
                  <div className="cert-time">2023年度</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ResumeDetail
