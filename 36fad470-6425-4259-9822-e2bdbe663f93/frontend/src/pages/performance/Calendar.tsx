import { useEffect, useState, useMemo } from 'react'
import {
  Calendar,
  Card,
  Badge,
  Select,
  Tag,
  Modal,
  List,
  Button,
  Space,
  message,
  Typography,
  Tooltip
} from 'antd'
import type { CalendarProps } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchPerformances, setCurrentPerformance } from '@/store/performanceSlice'
import { fetchVenues } from '@/store/venueSlice'
import { PerformanceStatus, PerformanceType, VenueType } from '@/types'
import type { Performance, Venue } from '@/types'

const { Title } = Typography

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

type ViewMode = 'month' | 'week' | 'day'
const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => i + 8)

export default function PerformanceCalendar() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { performances, loading } = useAppSelector((state) => state.performance)
  const { venues } = useAppSelector((state) => state.venue)
  const [selectedVenue, setSelectedVenue] = useState<string | undefined>()
  const [detailModal, setDetailModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null)
  const [dayPerformances, setDayPerformances] = useState<Performance[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs())

  useEffect(() => {
    dispatch(fetchPerformances())
    dispatch(fetchVenues())
  }, [dispatch])

  useEffect(() => {
    dispatch(fetchPerformances(selectedVenue ? { venueId: selectedVenue } : undefined))
  }, [selectedVenue, dispatch])

  const getPerfsOnDate = (date: Dayjs) =>
    performances.filter((p) => {
      if (!p.startTime) return false
      return dayjs(p.startTime).isSame(date, 'day')
    })

  const weekDays = useMemo(() => {
    const start = currentDate.startOf('week')
    return Array.from({ length: 7 }, (_, i) => start.add(i, 'day'))
  }, [currentDate])

  const dateCellRender = (value: Dayjs) => {
    const dayPerfs = getPerfsOnDate(value)
    if (viewMode !== 'month') return null
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
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
    const dayPerfs = getPerfsOnDate(value)
    setSelectedDate(value)
    setDayPerformances(dayPerfs)
    setDetailModal(true)
  }

  const handlePanelChange = (date: Dayjs) => {
    setCurrentDate(date)
  }

  const openDayDetail = (date: Dayjs) => {
    setSelectedDate(date)
    setDayPerformances(getPerfsOnDate(date))
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

  const perfBackground = (status: PerformanceStatus) =>
    statusColors[status] === 'green' ? '#f6ffed' : '#f0f9ff'

  const renderWeekView = () => (
    <div className="week-view" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ padding: 10, border: '1px solid #f0f0f0', width: 70, background: '#fafafa' }}>
              时间
            </th>
            {weekDays.map((day) => (
              <th
                key={day.format('YYYY-MM-DD')}
                style={{
                  padding: '10px 8px',
                  border: '1px solid #f0f0f0',
                  background: day.isSame(dayjs(), 'day') ? '#e6f7ff' : '#fafafa',
                  minWidth: 120
                }}
              >
                <div style={{ fontWeight: 500 }}>{day.format('ddd')}</div>
                <div
                  style={{
                    fontSize: 13,
                    color: day.isSame(dayjs(), 'day') ? '#1890ff' : '#606266'
                  }}
                >
                  {day.format('MM/DD')}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIME_SLOTS.map((hour) => (
            <tr key={hour}>
              <td
                style={{
                  padding: '6px 10px',
                  border: '1px solid #f0f0f0',
                  fontSize: 12,
                  color: '#909399',
                  background: '#fafafa',
                  textAlign: 'center'
                }}
              >
                {String(hour).padStart(2, '0')}:00
              </td>
              {weekDays.map((day) => {
                const cellPerfs = getPerfsOnDate(day).filter(
                  (p) => dayjs(p.startTime).hour() === hour
                )
                return (
                  <td
                    key={`${day.format('YYYY-MM-DD')}-${hour}`}
                    style={{
                      padding: 4,
                      border: '1px solid #f0f0f0',
                      verticalAlign: 'top',
                      minHeight: 50
                    }}
                  >
                    {cellPerfs.length === 0 ? (
                      <div style={{ minHeight: 40 }} />
                    ) : (
                      cellPerfs.map((perf) => (
                        <Tooltip
                          key={perf.id}
                          title={`${perf.name} · ${dayjs(perf.startTime).format('HH:mm')}`}
                        >
                          <div
                            onClick={() => openDayDetail(day)}
                            style={{
                              background: perfBackground(perf.status),
                              padding: '4px 6px',
                              marginBottom: 2,
                              borderRadius: 4,
                              cursor: 'pointer',
                              borderLeft: `3px solid ${statusColors[perf.status]}`,
                              fontSize: 12,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <div style={{ fontWeight: 500 }}>{perf.name}</div>
                            <div style={{ color: '#909399', fontSize: 11 }}>
                              {dayjs(perf.startTime).format('HH:mm')} · {perf.venueName}
                            </div>
                          </div>
                        </Tooltip>
                      ))
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const renderDayView = () => {
    const dayPerfs = getPerfsOnDate(currentDate)
    return (
      <div className="day-view">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th
                style={{
                  padding: 10,
                  border: '1px solid #f0f0f0',
                  width: 120,
                  background: '#fafafa'
                }}
              >
                时间段
              </th>
              <th
                style={{
                  padding: 10,
                  border: '1px solid #f0f0f0',
                  background: '#e6f7ff'
                }}
              >
                {currentDate.format('YYYY年MM月DD日 dddd')}
              </th>
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((hour) => {
              const slotPerfs = dayPerfs.filter((p) => dayjs(p.startTime).hour() === hour)
              return (
                <tr key={hour}>
                  <td
                    style={{
                      padding: 10,
                      border: '1px solid #f0f0f0',
                      fontSize: 13,
                      background: '#fafafa',
                      textAlign: 'center',
                      color: '#606266',
                      verticalAlign: 'top'
                    }}
                  >
                    {String(hour).padStart(2, '0')}:00-{String(hour + 1).padStart(2, '0')}:00
                  </td>
                  <td
                    style={{
                      padding: 8,
                      border: '1px solid #f0f0f0',
                      minHeight: 60,
                      verticalAlign: 'top'
                    }}
                  >
                    {slotPerfs.length === 0 ? (
                      <div style={{ minHeight: 44 }} />
                    ) : (
                      slotPerfs.map((perf) => (
                        <div
                          key={perf.id}
                          onClick={() => {
                            setSelectedDate(currentDate)
                            setDayPerformances(dayPerfs)
                            setDetailModal(true)
                          }}
                          style={{
                            padding: '8px 12px',
                            marginBottom: 4,
                            borderRadius: 6,
                            background: perfBackground(perf.status),
                            borderLeft: `4px solid ${statusColors[perf.status]}`,
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{perf.name}</div>
                          <div style={{ fontSize: 12, color: '#909399' }}>
                            {dayjs(perf.startTime).format('HH:mm')} -{' '}
                            {dayjs(perf.endTime).format('HH:mm')} · {perf.venueName} ·{' '}
                            {typeLabels[perf.type]}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <Tag color={statusColors[perf.status]}>{statusLabels[perf.status]}</Tag>
                          </div>
                        </div>
                      ))
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const shiftDate = (dir: 1 | -1) => {
    const unit = viewMode === 'month' ? 'month' : viewMode === 'week' ? 'week' : 'day'
    setCurrentDate((d) => d.add(dir, unit))
  }

  const headerTitle = () => {
    if (viewMode === 'month') return currentDate.format('YYYY年MM月')
    if (viewMode === 'week')
      return `YYYY年MM月 第${currentDate.format('ww')}周 (${weekDays[0].format('MM/DD')}-${weekDays[6].format('MM/DD')})`
    return currentDate.format('YYYY年MM月DD日 dddd')
  }

  const ViewSwitcher = () => (
    <Button.Group>
      <Button type={viewMode === 'month' ? 'primary' : 'default'} onClick={() => setViewMode('month')}>
        月视图
      </Button>
      <Button type={viewMode === 'week' ? 'primary' : 'default'} onClick={() => setViewMode('week')}>
        周视图
      </Button>
      <Button type={viewMode === 'day' ? 'primary' : 'default'} onClick={() => setViewMode('day')}>
        日视图
      </Button>
    </Button.Group>
  )

  const renderViewContent = () => {
    if (viewMode === 'month') {
      return (
        <Calendar
          cellRender={dateCellRender}
          onSelect={handleSelect}
          onPanelChange={handlePanelChange}
          validRange={[dayjs().subtract(1, 'year'), dayjs().add(1, 'year')]}
          headerRender={() => (
            <div
              style={{
                padding: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Button.Group>
                  <Button onClick={() => shiftDate(-1)}>上一个</Button>
                  <Button onClick={() => setCurrentDate(dayjs())}>今天</Button>
                  <Button onClick={() => shiftDate(1)}>下一个</Button>
                </Button.Group>
                <Title level={5} style={{ margin: 0 }}>
                  {currentDate.format('YYYY年MM月')}
                </Title>
              </div>
              <ViewSwitcher />
            </div>
          )}
        />
      )
    }

    return (
      <div>
        <div
          style={{
            padding: '12px 8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #f0f0f0',
            marginBottom: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button.Group>
              <Button onClick={() => shiftDate(-1)}>上一个</Button>
              <Button onClick={() => setCurrentDate(dayjs())}>今天</Button>
              <Button onClick={() => shiftDate(1)}>下一个</Button>
            </Button.Group>
            <Title level={5} style={{ margin: 0 }}>
              {headerTitle()}
            </Title>
          </div>
          <ViewSwitcher />
        </div>
        {viewMode === 'week' ? renderWeekView() : renderDayView()}
      </div>
    )
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

      <Card loading={loading}>{renderViewContent()}</Card>

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
                          {dayjs(item.endTime).format('HH:mm')} | 时长：
                          {item.expectedDuration}分钟
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
