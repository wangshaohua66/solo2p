import { useState, useEffect } from 'react'
import { Card, Table, Button, Input, Select, Tag, Space, Row, Col, DatePicker } from 'antd'
import { PlusOutlined, SearchOutlined, CalendarOutlined, EnvironmentOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { TableProps } from 'antd'
import dayjs from 'dayjs'
import { Recruitment, UserRole, PageResult } from '@/types'
import { mockGetRecruitmentList, mockGetCenters } from '@/mock/recruitment'
import { RootState } from '@/store'
import './List.css'

const { RangePicker } = DatePicker

const RecruitmentList = () => {
  const navigate = useNavigate()
  const role = useSelector((state: RootState) => state.auth.role)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Recruitment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [centerId, setCenterId] = useState<string>('all')
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    setCenters(mockGetCenters())
    loadData()
  }, [page, pageSize])

  const loadData = async () => {
    setLoading(true)
    try {
      const result: PageResult<Recruitment> = await mockGetRecruitmentList({
        page,
        pageSize,
        keyword,
        status,
        centerId: centerId === 'all' ? undefined : centerId
      })
      setData(result.list)
      setTotal(result.total)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    loadData()
  }

  const handleReset = () => {
    setKeyword('')
    setStatus('all')
    setCenterId('all')
    setPage(1)
    loadData()
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

  const columns: TableProps<Recruitment>['columns'] = [
    {
      title: '招聘会名称',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      render: (text, record) => (
        <a onClick={() => navigate(`/recruitment/${record.id}`)}>{text}</a>
      )
    },
    {
      title: '举办时间',
      key: 'time',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 13, color: '#262626' }}>
            {dayjs(record.startTime).format('YYYY-MM-DD')}
          </div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>
            {dayjs(record.startTime).format('HH:mm')} - {dayjs(record.endTime).format('HH:mm')}
          </div>
        </div>
      )
    },
    {
      title: '举办地点',
      dataIndex: 'location',
      key: 'location',
      width: 180,
      ellipsis: true
    },
    {
      title: '举办中心',
      dataIndex: 'centerName',
      key: 'centerName',
      width: 180,
      ellipsis: true
    },
    {
      title: '参会企业',
      dataIndex: 'enterpriseCount',
      key: 'enterpriseCount',
      width: 100,
      align: 'center'
    },
    {
      title: '岗位数',
      dataIndex: 'jobCount',
      key: 'jobCount',
      width: 80,
      align: 'center'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status) => getStatusTag(status)
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => navigate(`/recruitment/${record.id}`)}>
            详情
          </Button>
          {role === UserRole.ADMIN && (
            <Button type="link" size="small">展位管理</Button>
          )}
        </Space>
      )
    }
  ]

  return (
    <div className="recruitment-list-page">
      <Card className="filter-card">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder="搜索招聘会名称"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={5}>
            <Select
              placeholder="选择状态"
              value={status}
              onChange={setStatus}
              style={{ width: '100%' }}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'pending', label: '待开始' },
                { value: 'ongoing', label: '进行中' },
                { value: 'ended', label: '已结束' }
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={5}>
            <Select
              placeholder="选择人才中心"
              value={centerId}
              onChange={setCenterId}
              style={{ width: '100%' }}
              options={[
                { value: 'all', label: '全部中心' },
                ...centers.map(c => ({ value: c.id, label: c.name }))
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={4} lg={4}>
            <Space>
              <Button type="primary" onClick={handleSearch}>查询</Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card
        className="table-card"
        title="招聘会列表"
        extra={
          role === UserRole.ADMIN && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/recruitment/create')}>
              创建招聘会
            </Button>
          )
        }
      >
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
            showTotal: (total) => `共 ${total} 场`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            }
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  )
}

export default RecruitmentList
