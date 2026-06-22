import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Layout,
  Card,
  Tag,
  Input,
  Select,
  Button,
  Pagination,
  Typography,
  Drawer,
  Empty,
  Spin,
} from 'antd'
import { SearchOutlined, FilterOutlined } from '@ant-design/icons'
import { heritageApi } from '@/api/heritage'
import { Heritage, HeritageCategory, HeritageLevel, HeritageCategoryMap, HeritageLevelMap, PageResult } from '@/types'

const { Sider, Content } = Layout
const { Title } = Typography
const { Search } = Input
const { Option } = Select

const HeritageList: React.FC = () => {
  const [heritages, setHeritages] = useState<Heritage[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(12)
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<HeritageCategory | undefined>()
  const [level, setLevel] = useState<HeritageLevel | undefined>()
  const [region, setRegion] = useState('')
  const [drawerVisible, setDrawerVisible] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await heritageApi.getPublicList({
        keyword: keyword || undefined,
        category,
        level,
        region: region || undefined,
        page,
        size,
      })
      const data = res.data as unknown as PageResult<Heritage>
      setHeritages(data.content || [])
      setTotal(data.totalElements || 0)
    } catch (error) {
      console.error('Failed to fetch heritages:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [page, size, category, level])

  const handleSearch = () => {
    setPage(0)
    fetchData()
  }

  const handleReset = () => {
    setKeyword('')
    setCategory(undefined)
    setLevel(undefined)
    setRegion('')
    setPage(0)
  }

  const FilterPanel = () => (
    <div style={{ padding: 16 }}>
      <Title level={5} style={{ color: '#c8a96e', marginBottom: 16 }}>
        <FilterOutlined /> 筛选条件
      </Title>

      <div style={{ marginBottom: 16 }}>
        <div style={{ color: '#a0a0a0', marginBottom: 8 }}>项目类别</div>
        <Select
          placeholder="全部类别"
          style={{ width: '100%' }}
          value={category}
          onChange={(val) => setCategory(val)}
          allowClear
        >
          {Object.entries(HeritageCategoryMap).map(([key, label]) => (
            <Option key={key} value={key}>
              {label}
            </Option>
          ))}
        </Select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ color: '#a0a0a0', marginBottom: 8 }}>项目级别</div>
        <Select
          placeholder="全部级别"
          style={{ width: '100%' }}
          value={level}
          onChange={(val) => setLevel(val)}
          allowClear
        >
          {Object.entries(HeritageLevelMap).map(([key, label]) => (
            <Option key={key} value={key}>
              {label}
            </Option>
          ))}
        </Select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ color: '#a0a0a0', marginBottom: 8 }}>所属地区</div>
        <Input
          placeholder="输入地区名称"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          onPressEnter={handleSearch}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="primary" onClick={handleSearch} style={{ flex: 1 }}>
          应用筛选
        </Button>
        <Button onClick={handleReset}>重置</Button>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Title level={2} style={{ color: '#c8a96e', margin: 0, flexShrink: 0 }}>
          非遗项目库
        </Title>
        <div style={{ flex: 1, minWidth: 280 }}>
          <Search
            placeholder="搜索非遗项目名称..."
            enterButton={<SearchOutlined />}
            size="large"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={handleSearch}
            style={{ maxWidth: 500 }}
          />
        </div>
        <Button
          type="text"
          icon={<FilterOutlined />}
          onClick={() => setDrawerVisible(true)}
          style={{ color: '#c8a96e' }}
          className="mobile-filter-btn"
        >
          筛选
        </Button>
      </div>

      <Layout style={{ background: 'transparent' }}>
        <Sider
          width={240}
          style={{ background: '#16213e', borderRadius: 8, marginRight: 16 }}
          className="desktop-filter"
          breakpoint="lg"
          collapsedWidth="0"
        >
          <FilterPanel />
        </Sider>

        <Content>
          <Drawer
            title="筛选条件"
            placement="right"
            onClose={() => setDrawerVisible(false)}
            open={drawerVisible}
            styles={{ body: { padding: 0 } }}
            className="mobile-filter"
          >
            <FilterPanel />
          </Drawer>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin size="large" />
            </div>
          ) : heritages.length === 0 ? (
            <Empty description="暂无匹配的非遗项目" style={{ padding: 48 }} />
          ) : (
            <div className="waterfall-container">
              {heritages.map((heritage) => (
                <div key={heritage.id} className="waterfall-item">
                  <Card
                    hoverable
                    className="card-hover"
                    cover={
                      <div
                        style={{
                          height: Math.random() * 100 + 160,
                          backgroundImage: heritage.coverImage
                            ? `url(${heritage.coverImage})`
                            : 'linear-gradient(135deg, #16213e, #0f3460)',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#c8a96e',
                          fontSize: 48,
                        }}
                      >
                        {!heritage.coverImage && '🏛️'}
                      </div>
                    }
                    style={{ borderRadius: 8 }}
                  >
                    <Link to={`/heritages/${heritage.id}`}>
                      <Card.Meta
                        title={<span style={{ color: '#e8e8e8' }}>{heritage.name}</span>}
                        description={
                          <div>
                            <div style={{ marginBottom: 8 }}>
                              <Tag color="gold">{HeritageCategoryMap[heritage.category]}</Tag>
                              <Tag color="blue">{HeritageLevelMap[heritage.level]}</Tag>
                              {heritage.region && <Tag>{heritage.region}</Tag>}
                            </div>
                            <div style={{ color: '#a0a0a0', fontSize: 12, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {heritage.summary}
                            </div>
                            <div style={{ marginTop: 8, color: '#707070', fontSize: 12 }}>
                              浏览 {heritage.viewCount} 次
                            </div>
                          </div>
                        }
                      />
                    </Link>
                  </Card>
                </div>
              ))}
            </div>
          )}

          {total > 0 && (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <Pagination
                current={page + 1}
                pageSize={size}
                total={total}
                showSizeChanger
                showQuickJumper
                showTotal={(t) => `共 ${t} 项`}
                onChange={(p, s) => {
                  setPage(p - 1)
                  setSize(s)
                }}
                pageSizeOptions={['12', '24', '36', '48']}
              />
            </div>
          )}
        </Content>
      </Layout>

      <style>{`
        @media (min-width: 992px) {
          .desktop-filter { display: block !important; }
          .mobile-filter-btn { display: none !important; }
        }
        @media (max-width: 991px) {
          .desktop-filter { display: none !important; }
          .mobile-filter-btn { display: inline-flex !important; }
        }
      `}</style>
    </div>
  )
}

export default HeritageList
