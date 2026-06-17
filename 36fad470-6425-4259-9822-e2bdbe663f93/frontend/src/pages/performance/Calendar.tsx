import { useEffect, useState } from 'react'
import { Calendar, Card, Badge, Select, Tag, Modal, List, Button, Space, message } from 'antd'
import type { CalendarProps } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchPerformances, setCurrentPerformance } from '@/store/performanceSlice'
import { fetchVenues } from '@/store/venueSlice'
import { PerformanceStatus, PerformanceType, VenueType } from '@/types'
import type { Performance, Venue } from '@/types'

const statusColors: Record<PerformanceStatus, string> = {
  [PerformanceStatus.PENDING]: 'orange',
  [PerformanceStatus.APPROVED]: 'green',
  [PerformanceStatus.REJECTED]: 'red',
  [PerformanceStatus.NEGOTIATING]: 'blue'
}

const statusLabels: Record<PerformanceStatus, string> = {
  [PerformanceStatus.PENDING]: '待审批',
  [PerformanceStatus.APPROVED]: '已通过',
  [PerformanceStatus.REJECTED]: '已驳回',
  [PerformanceStatus.NEGOTIATING]: '协商改期'
}

const typeLabels: Record<PerformanceType, string> = {
  [PerformanceType.DRAMA]: '话剧',
  [PerformanceType.CONCERT]: '音乐会',
  [PerformanceType.DANCE]: '舞蹈',
  [PerformanceType.OPERA]: '戏曲',
  [PerformanceType.CHILDREN]: '儿童剧'
}

const venueLabels: Record<VenueType, string> = {
  [VenueType.GRAND_THEATER]: '大剧院',
  [VenueType.CONCERT_HALL]: '音乐厅',
  [VenueType.SMALL_THEATER]: '小剧场'
}

export default function PerformanceCalendar() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { performances, loading } = useAppSelector((state) => state.performance)
  const { venues } = useAppSelector((state) => state.venue)
  const [selectedVenue, setSelectedVenue] = useState<string | undefined>()
  const [detailModal, setDetailModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null)
  const [dayPerformances, setDayPerformances] = useState<Performance[]>([])
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')

  useEffect(() => {
    dispatch(fetchPerformances())
    dispatch(fetchVenues())
  }, [dispatch])

  useEffect(() => {
    dispatch(fetchPerformances(selectedVenue ? { venueId: selectedVenue } : undefined))
  }, [selectedVenue, dispatch])

  const dateCellRender = (value: Dayjs) => {
    const dayPerfs = performances.filter((p) => {
      if (!p.startTime) return false
      return dayjs(p.startTime).isSame(value, 'day')
    })

    return (
      <ul className="events" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {dayPerfs.slice(0, 3).map((perf) => (
          <li key={perf.id} style={{ marginBottom: 4 }}>
            <Badge
              color={statusColors[perf.status]}
              text={
                <span
                  style={{
                    fontSize: 12,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'inline-block',
                    maxWidth: 'calc(100% - 10px)'
                  }}
                >
                  {perf.name}
                </span>
              }
            />
          </li>
        ))}
        {dayPerfs.length > 3 && (
          <li>
            <Tag color="default" style={{ fontSize: 12 }}>
              +{dayPerfs.length - 3} 更多
            </Tag>
          </li>
        )}
      </ul>
    )
  }

  const handleSelect: CalendarProps<Dayjs>['onSelect'] = (value) => {
    const dayPerfs = performances.filter((p) => {
      if (!p.startTime) return false
      return dayjs(p.startTime).isSame(value, 'day')
    })
    setSelectedDate(value)
    setDayPerformances(dayPerfs)
    setDetailModal(true)
  }

  const handleGoToSales = (perf: Performance) => {
    if (perf.status === PerformanceStatus.APPROVED) {
      navigate(`/sales/select/${perf.id}`)
    } else {
      message.warning('该演出尚未审批通过，无法选座购票')
    }
  }

  const handleGoToSeatConfig = (perf: Performance) => {
    dispatch(setCurrentPerformance(perf))
    navigate('/venue/seat-config')
  }

  return (
    <div>
      <div className="card-header">
        <div className="card-title">演出日历</div>
        <Space>
          <Select
            placeholder="选择场馆"
            style={{ width: 180 }}
            allowClear
            value={selectedVenue}
            onChange={setSelectedVenue}
            options={venues.map((v: Venue) => ({
              label: venueLabels[v.type] || v.name,
              value: v.id
            }))}
          />
          <Button type="primary" onClick={() => navigate('/performance/application')}>
            提交演出申请
          </Button>
        </Space>
      </div>

      <Card loading={loading}>
        <Calendar
          cellRender={dateCellRender}
          onSelect={handleSelect}
          headerRender={({ value, onChange, onTypeChange }) => (
            <div style={{ padding: 8, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button.Group>
                <Button
                  type={viewMode === 'month' ? 'primary' : 'default'}
                  onClick={() => {
                    setViewMode('month')
                    onTypeChange && onTypeChange('month')
                  }}
                >
                  月视图
                </Button>
                <Button
                  type={viewMode === 'week' ? 'primary' : 'default'}
                  onClick={() => {
                    setViewMode('week')
                  }}
                >
                  周视图
                </Button>
              </Button.Group>
            </div>
          )}
        />
      </Card>

      <Modal
        title={selectedDate ? selectedDate.format('YYYY年MM月DD日 演出列表') : '当日演出'}
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={null}
        width={640}
      >
        {dayPerformances.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#909399' }}>
            当日暂无演出安排
          </div>
        ) : (
          <List
            dataSource={dayPerformances}
            renderItem={(item) => (
              <List.Item
                key={item.id}
                actions={[
                  item.status === PerformanceStatus.APPROVED ? (
                    <Button type="link" onClick={() => handleGoToSales(item)}>
                      选座购票
                    </Button>
                  ) : null,
                  <Button type="link" onClick={() => handleGoToSeatConfig(item)}>
                    座位配置
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span style={{ fontSize: 16, fontWeight: 500 }}>{item.name}</span>
                      <Tag color={statusColors[item.status]}>{statusLabels[item.status]}</Tag>
                      <Tag color="blue">{typeLabels[item.type]}</Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4}>
                      <span>
                        场馆：{item.venueName} | 主办方：{item.organizerName}
                      </span>
                      {item.startTime && (
                        <span>
                          时间：{dayjs(item.startTime).format('HH:mm')} -{' '}
                          {dayjs(item.endTime).format('HH:mm')} | 时长：{item.expectedDuration}分钟
                        </span>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  )
}
