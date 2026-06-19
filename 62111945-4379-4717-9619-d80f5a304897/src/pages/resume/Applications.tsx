import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Tag,
  Select,
  Button,
  Space,
  Modal,
  message,
  Rate,
  Row,
  Col
} from 'antd'
import { EyeOutlined, VideoCameraOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { TableProps } from 'antd'
import { ApplicationRecord } from '@/types'
import { mockGetApplicationList } from '@/mock/resume'
import './Applications.css'

const Applications = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ApplicationRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState<string>('all')
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [currentApp, setCurrentApp] = useState<ApplicationRecord | null>(null)

  useEffect(() => {
    loadData()
  }, [page, pageSize, status])

  const loadData = async () => {
    setLoading(true)
    try {
      const result: any = await mockGetApplicationList({
        page,
        pageSize,
        status: status === 'all' ? undefined : status
      })
      setData(result.list)
      setTotal(result.total)
    } finally {
      setLoading(false)
    }
  }

  const getStatusTag = (status: ApplicationRecord['status']) => {
    const map: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      applied: { color: 'blue', text: '已投递', icon: <CheckCircleOutlined /> },
      viewed: { color: 'purple', text: '已查看', icon: <EyeOutlined /> },
      interview: { color: 'orange', text: '面试中', icon: <VideoCameraOutlined /> },
      offer: { color: 'green', text: '已Offer', icon: <CheckCircleOutlined /> },
      rejected: { color: 'default', text: '未通过', icon: <CloseCircleOutlined /> }
    }
    const info = map[status]
    return (
      <Tag color={info.color} icon={info.icon}>
        {info.text}
      </Tag>
    )
  }

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return '#52c41a'
    if (score >= 80) return '#1677ff'
    if (score >= 70) return '#faad14'
    return '#8c8c8c'
  }

  const handleViewDetail = (record: ApplicationRecord) => {
    setCurrentApp(record)
    setDetailModalVisible(true)
  }

  const columns: TableProps<ApplicationRecord>['columns'] = [
    {
      title: '职位信息',
      key: 'job',
      width: 250,
      render: (_, record) => (
        <div>
          <div className="job-title" onClick={() => navigate(`/jobs/${record.jobId}`)}>
            {record.jobTitle}
          </div>
          <div className="company-name">{record.enterpriseName}</div>
        </div>
      )
    },
    {
      title: '投递简历',
      dataIndex: 'resumeTitle',
      key: 'resumeTitle',
      width: 120
    },
    {
      title: '匹配度',
      key: 'matchScore',
      width: 120,
      render: (_, record) => (
        record.matchScore ? (
          <div className="match-score">
            <div 
              className="score-circle"
              style={{ borderColor: getMatchScoreColor(record.matchScore), color: getMatchScoreColor(record.matchScore) }}
            >
              {record.matchScore}%
            </div>
          </div>
        ) : '-'
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => getStatusTag(status)
    },
    {
      title: '投递时间',
      dataIndex: 'appliedAt',
      key: 'appliedAt',
      width: 180
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
            查看详情
          </Button>
          {record.status === 'interview' && (
            <Button type="link" size="small" onClick={() => navigate('/interviews')}>
              查看面试
            </Button>
          )}
        </Space>
      )
    }
  ]

  const statusOptions = [
    { value: 'all', label: '全部状态' },
    { value: 'applied', label: '已投递' },
    { value: 'viewed', label: '已查看' },
    { value: 'interview', label: '面试中' },
    { value: 'offer', label: '已Offer' },
    { value: 'rejected', label: '未通过' }
  ]

  return (
    <div className="applications-page">
      <Card className="filter-card">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="选择状态"
              value={status}
              onChange={setStatus}
              style={{ width: '100%' }}
              options={statusOptions}
            />
          </Col>
          <Col xs={24} sm={12} md={18}>
            <div className="stats-summary">
              <span>共投递 <strong>{total}</strong> 份简历</span>
              <span>面试邀请 <strong className="orange">{data.filter(d => d.status === 'interview').length}</strong> 个</span>
              <span>获得Offer <strong className="green">{data.filter(d => d.status === 'offer').length}</strong> 个</span>
            </div>
          </Col>
        </Row>
      </Card>

      <Card className="table-card" title="投递记录">
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            }
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      <Modal
        title="投递详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {currentApp && (
          <div className="app-detail">
            <div className="detail-header">
              <h3>{currentApp.jobTitle}</h3>
              {getStatusTag(currentApp.status)}
            </div>
            <div className="detail-company">{currentApp.enterpriseName}</div>
            
            <div className="detail-section">
              <div className="detail-row">
                <span className="label">投递简历：</span>
                <span className="value">{currentApp.resumeTitle}</span>
              </div>
              <div className="detail-row">
                <span className="label">匹配度：</span>
                <span className="value" style={{ color: getMatchScoreColor(currentApp.matchScore || 0), fontWeight: 600 }}>
                  {currentApp.matchScore}%
                </span>
              </div>
              <div className="detail-row">
                <span className="label">投递时间：</span>
                <span className="value">{currentApp.appliedAt}</span>
              </div>
              <div className="detail-row">
                <span className="label">最近更新：</span>
                <span className="value">{currentApp.updatedAt}</span>
              </div>
            </div>

            <div className="detail-section">
              <h4>投递进度</h4>
              <div className="progress-steps">
                <div className="step completed">
                  <div className="step-icon">✓</div>
                  <div className="step-text">简历投递</div>
                </div>
                <div className={`step ${currentApp.status !== 'applied' ? 'completed' : ''}`}>
                  <div className="step-icon">2</div>
                  <div className="step-text">企业查看</div>
                </div>
                <div className={`step ${['interview', 'offer'].includes(currentApp.status) ? 'completed' : ''}`}>
                  <div className="step-icon">3</div>
                  <div className="step-text">面试邀约</div>
                </div>
                <div className={`step ${currentApp.status === 'offer' ? 'completed' : ''}`}>
                  <div className="step-icon">4</div>
                  <div className="step-text">发放Offer</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Applications
