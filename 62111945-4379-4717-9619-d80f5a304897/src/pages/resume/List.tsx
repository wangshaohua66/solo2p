import { useState, useEffect } from 'react'
import {
  Card,
  List,
  Button,
  Tag,
  Space,
  Modal,
  message,
  Empty,
  Avatar,
  Switch,
  Tooltip
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  StarOutlined,
  UploadOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'antd'
import type { UploadProps } from 'antd'
import { Resume } from '@/types'
import { mockGetResumeList, mockDeleteResume, mockSetDefaultResume } from '@/mock/resume'
import './List.css'

const ResumeList = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [resumes, setResumes] = useState<Resume[]>([])

  useEffect(() => {
    loadResumes()
  }, [])

  const loadResumes = async () => {
    setLoading(true)
    try {
      const list = await mockGetResumeList()
      setResumes(list)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这份简历吗？此操作不可恢复。',
      onOk: async () => {
        await mockDeleteResume(id)
        message.success('删除成功')
        loadResumes()
      }
    })
  }

  const handleSetDefault = async (id: string) => {
    await mockSetDefaultResume(id)
    message.success('已设为默认简历')
    loadResumes()
  }

  const handleTogglePrivacy = async (id: string, isPublic: boolean) => {
    message.success(isPublic ? '简历已设为公开' : '简历已设为私密')
    loadResumes()
  }

  const uploadProps: UploadProps = {
    name: 'file',
    showUploadList: false,
    beforeUpload: (file) => {
      const isDoc = file.type === 'application/pdf' || 
                    file.type === 'application/msword' ||
                    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      if (!isDoc) {
        message.error('只能上传PDF或Word文件!')
        return false
      }
      message.success('简历解析中，请稍候...')
      setTimeout(() => {
        message.success('简历解析完成，已自动生成在线简历')
        loadResumes()
      }, 1500)
      return false
    }
  }

  return (
    <div className="resume-list-page">
      <Card 
        className="header-card"
        title={
          <div className="card-title">
            <FileTextOutlined className="title-icon" />
            我的简历
            <span className="resume-count">（{resumes.length}份）</span>
          </div>
        }
        extra={
          <Space>
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>上传简历</Button>
            </Upload>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/resume/new')}>
              新建简历
            </Button>
          </Space>
        }
      >
        <div className="privacy-tip">
          <Tip icon={<EyeOutlined />}>
            公开的简历会被企业搜索到，帮你获得更多机会
          </Tip>
        </div>

        {resumes.length > 0 ? (
          <List
            loading={loading}
            dataSource={resumes}
            renderItem={(resume) => (
              <List.Item className="resume-item card-hover">
                <div className="resume-main">
                  <div className="resume-header">
                    <div className="resume-title-section">
                      <h3 className="resume-title" onClick={() => navigate(`/resume/${resume.id}`)}>
                        {resume.title}
                        {resume.isDefault && (
                          <Tag color="gold" style={{ marginLeft: 8 }}>默认</Tag>
                        )}
                      </h3>
                      <div className="resume-basic">
                        <span>{resume.name}</span>
                        <span>·</span>
                        <span>{resume.gender === 'male' ? '男' : '女'}</span>
                        <span>·</span>
                        <span>{resume.age}岁</span>
                        <span>·</span>
                        <span>{resume.experience}年经验</span>
                        <span>·</span>
                        <span>{resume.education}</span>
                      </div>
                    </div>
                    <div className="resume-status">
                      <Tooltip title={resume.isPublic ? '简历公开，企业可见' : '简历私密，仅自己可见'}>
                        <Switch
                          checked={resume.isPublic}
                          onChange={(checked) => handleTogglePrivacy(resume.id, checked)}
                          checkedChildren={<EyeOutlined />}
                          unCheckedChildren={<EyeInvisibleOutlined />}
                        />
                      </Tooltip>
                    </div>
                  </div>

                  <div className="resume-skills">
                    {resume.skills.slice(0, 6).map((skill, idx) => (
                      <Tag key={idx} color="blue">{skill}</Tag>
                    ))}
                    {resume.skills.length > 6 && (
                      <Tag>+{resume.skills.length - 6}</Tag>
                    )}
                  </div>

                  <div className="resume-expect">
                    <span>期望职位：{resume.expectedPosition}</span>
                    <span>期望薪资：{resume.expectedSalaryMin / 1000}K-{resume.expectedSalaryMax / 1000}K</span>
                  </div>

                  <div className="resume-footer">
                    <span className="update-time">更新于 {resume.updatedAt}</span>
                    <Space size="middle">
                      {!resume.isDefault && (
                        <Button type="link" size="small" onClick={() => handleSetDefault(resume.id)}>
                          设为默认
                        </Button>
                      )}
                      <Button type="link" size="small" icon={<DownloadOutlined />}>
                        下载
                      </Button>
                      <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/resume/${resume.id}`)}>
                        编辑
                      </Button>
                      <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(resume.id)}>
                        删除
                      </Button>
                    </Space>
                  </div>
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无简历，快去创建第一份简历吧！" />
        )}
      </Card>
    </div>
  )
}

const Tip = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8c8c8c', fontSize: 13 }}>
    {icon}
    {children}
  </span>
)

export default ResumeList
