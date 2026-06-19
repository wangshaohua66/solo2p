import { useState, useEffect } from 'react'
import { Card, List, Tag, Input, Select, Button, Row, Col, Empty, Pagination, Space } from 'antd'
import { SearchOutlined, EnvironmentOutlined, ClockCircleOutlined, ShopOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { Job, PageResult } from '@/types'
import { mockGetJobList } from '@/mock/job'
import './List.css'

const cities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安']
const experiences = ['不限', '应届', '1-3年', '3-5年', '5-10年', '10年以上']
const educations = ['不限', '大专', '本科', '硕士', '博士']

const JobList = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [keyword, setKeyword] = useState('')
  const [city, setCity] = useState('all')
  const [experience, setExperience] = useState('all')
  const [education, setEducation] = useState('all')
  const [salaryRange, setSalaryRange] = useState('all')

  useEffect(() => {
    loadJobs()
  }, [page, pageSize])

  const loadJobs = async () => {
    setLoading(true)
    try {
      let salaryMin: number | undefined
      let salaryMax: number | undefined
      
      if (salaryRange !== 'all') {
        const [min, max] = salaryRange.split('-').map(Number)
        salaryMin = min * 1000
        salaryMax = max * 1000
      }

      const result: PageResult<Job> = await mockGetJobList({
        page,
        pageSize,
        keyword,
        city: city === 'all' ? undefined : city,
        experience: experience === 'all' ? undefined : experience,
        education: education === 'all' ? undefined : education,
        salaryMin,
        salaryMax
      })
      setJobs(result.list)
      setTotal(result.total)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    loadJobs()
  }

  const formatSalary = (min: number, max: number) => {
    return `${min / 1000}K-${max / 1000}K`
  }

  return (
    <div className="job-list-page">
      <Card className="filter-card">
        <div className="filter-section">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Input.Search
                placeholder="搜索职位、公司或技能"
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onSearch={handleSearch}
                enterButton
                size="large"
              />
            </Col>
            <Col xs={24} md={4}>
              <Select
                placeholder="城市"
                value={city}
                onChange={(val) => { setCity(val); setPage(1); loadJobs() }}
                style={{ width: '100%' }}
                size="large"
                options={[
                  { value: 'all', label: '全部城市' },
                  ...cities.map(c => ({ value: c, label: c }))
                ]}
              />
            </Col>
            <Col xs={24} md={4}>
              <Select
                placeholder="经验"
                value={experience}
                onChange={(val) => { setExperience(val); setPage(1); loadJobs() }}
                style={{ width: '100%' }}
                size="large"
                options={experiences.map(e => ({ value: e, label: e }))}
              />
            </Col>
            <Col xs={24} md={4}>
              <Select
                placeholder="学历"
                value={education}
                onChange={(val) => { setEducation(val); setPage(1); loadJobs() }}
                style={{ width: '100%' }}
                size="large"
                options={educations.map(e => ({ value: e, label: e }))}
              />
            </Col>
            <Col xs={24} md={4}>
              <Select
                placeholder="薪资"
                value={salaryRange}
                onChange={(val) => { setSalaryRange(val); setPage(1); loadJobs() }}
                style={{ width: '100%' }}
                size="large"
                options={[
                  { value: 'all', label: '不限薪资' },
                  { value: '5-10', label: '5K-10K' },
                  { value: '10-15', label: '10K-15K' },
                  { value: '15-20', label: '15K-20K' },
                  { value: '20-30', label: '20K-30K' },
                  { value: '30-50', label: '30K以上' }
                ]}
              />
            </Col>
          </Row>
        </div>
      </Card>

      <Card className="job-list-card" title={`职位列表（${total}）`}>
        {jobs.length > 0 ? (
          <>
            <List
              loading={loading}
              grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
              dataSource={jobs}
              renderItem={(job) => (
                <List.Item>
                  <Card 
                    className="job-card card-hover"
                    hoverable
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <div className="job-card-header">
                      <h3 className="job-title">{job.title}</h3>
                      <span className="job-salary">{formatSalary(job.salaryMin, job.salaryMax)}</span>
                    </div>
                    <div className="job-company">
                      <ShopOutlined /> {job.enterpriseName}
                    </div>
                    <div className="job-meta">
                      <span><EnvironmentOutlined /> {job.location}</span>
                      <span><ClockCircleOutlined /> {job.experience}</span>
                    </div>
                    <div className="job-tags">
                      {job.tags.slice(0, 4).map((tag, idx) => (
                        <Tag key={idx} color="blue">{tag}</Tag>
                      ))}
                    </div>
                    <div className="job-footer">
                      <span className="apply-count">{job.applyCount}人投递</span>
                      <Button type="primary" size="small">立即投递</Button>
                    </div>
                  </Card>
                </List.Item>
              )}
            />
            <div className="pagination-wrapper">
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                showSizeChanger
                showQuickJumper
                showTotal={(total) => `共 ${total} 个职位`}
                onChange={(p, ps) => {
                  setPage(p)
                  setPageSize(ps)
                }}
              />
            </div>
          </>
        ) : (
          <Empty description="暂无职位信息" />
        )}
      </Card>
    </div>
  )
}

export default JobList
