import { useState, useMemo, useEffect } from 'react'
import {
  Card,
  DatePicker,
  Select,
  Space,
  Tag,
  Tooltip,
  Row,
  Col,
  Statistic,
  Alert,
  Spin,
  message
} from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { DeviceCategory } from '@/types'
import { api } from '@/api'

const { RangePicker } = DatePicker

interface ScheduleItem {
  id: string
  deviceId: string
  deviceName: string
  category: DeviceCategory
  performanceId: string
  performanceName: string
  startTime: string
  endTime: string
  quantity: number
  conflict?: boolean
}

const categoryLabels: Record<DeviceCategory, string> = {
  [DeviceCategory.LIGHTING]: '灯光',
  [DeviceCategory.SOUND]: '音响',
  [DeviceCategory.STAGE]: '舞美'
}

const categoryColors: Record<DeviceCategory, string> = {
  [DeviceCategory.LIGHTING]: '#faad14',
  [DeviceCategory.SOUND]: '#1890ff',
  [DeviceCategory.STAGE]: '#722ed1'
}

export default function DeviceSchedule() {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(1, 'day'),
    dayjs().add(7, 'day')
  ])
  const [categoryFilter, setCategoryFilter] = useState<DeviceCategory | undefined>()
  const [dateZoom, setDateZoom] = useState<'day' | 'hour'>('hour')
  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(false)

  const flattenSchedule = (devices: any[]): ScheduleItem[] => {
    const result: ScheduleItem[] = []
    devices.forEach((device) => {
      const usages = device.usages || device.usage || device.schedules || []
      usages.forEach((usage: any, idx: number) => {
        result.push({
          id: `${device.id || device._id}-${idx}`,
          deviceId: device.id || device._id,
          deviceName: device.name || device.deviceName,
          category: device.category as DeviceCategory,
          performanceId: usage.performanceId || usage.performance?.id || '',
          performanceName: usage.performanceName || usage.performance?.name || '未命名演出',
          startTime: usage.startTime || usage.start,
          endTime: usage.endTime || usage.end,
          quantity: usage.quantity || 1,
          conflict: usage.conflict || false
        })
      })
    })
    return result
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = {}
      if (dateRange && dateRange[0]) params.startDate = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.endDate = dateRange[1].format('YYYY-MM-DD')
      if (categoryFilter) params.category = categoryFilter

      const res = await api.get('/devices/schedule', { params })
      const raw = res.data?.devices || res.data?.schedule || res.data?.data || []
      const flat = Array.isArray(raw) && raw.length > 0 && (raw[0].usages || raw[0].usage || raw[0].schedules)
        ? flattenSchedule(raw)
        : raw as ScheduleItem[]
      setScheduleData(flat)
    } catch (err: any) {
      message.error(err?.response?.data?.message || '加载设备调度失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [dateRange, categoryFilter])

  const filteredSchedule = useMemo(() => {
    return scheduleData
  }, [scheduleData])

  const conflictCount = filteredSchedule.filter((s) => s.conflict).length

  const groupedByDevice = useMemo(() => {
    const groups: Record<string, ScheduleItem[]> = {}
    filteredSchedule.forEach((item) => {
      if (!groups[item.deviceId]) {
        groups[item.deviceId] = []
      }
      groups[item.deviceId].push(item)
    })
    return groups
  }, [filteredSchedule])

  const timeStart = dateRange[0]
  const timeEnd = dateRange[1]
  const totalHours = timeEnd.diff(timeStart, 'hour')
  const totalDays = timeEnd.diff(timeStart, 'day') + 1

  const hoursPerDay = dateZoom === 'hour' ? 24 : 1
  const totalUnits = dateZoom === 'hour' ? totalHours : totalDays
  const unitWidth = Math.max(40, Math.min(80, 1200 / totalUnits))

  const getBarStyle = (item: ScheduleItem) => {
    const start = dayjs(item.startTime)
    const end = dayjs(item.endTime)

    let leftPercent: number
    let widthPercent: number

    if (dateZoom === 'hour') {
      const leftHours = start.diff(timeStart, 'hour', true)
      const durationHours = end.diff(start, 'hour', true)
      leftPercent = (leftHours / totalHours) * 100
      widthPercent = (durationHours / totalHours) * 100
    } else {
      const leftDays = start.startOf('day').diff(timeStart.startOf('day'), 'day')
      const durationDays = end.endOf('day').diff(start.startOf('day'), 'day') + 1
      leftPercent = (leftDays / totalDays) * 100
      widthPercent = (durationDays / totalDays) * 100
    }

    return {
      left: `${Math.max(0, leftPercent)}%`,
      width: `${Math.min(100 - leftPercent, widthPercent)}%`,
      backgroundColor: item.conflict ? '#ff4d4f' : categoryColors[item.category]
    }
  }

  const renderTimeHeaders = () => {
    const headers = []
    if (dateZoom === 'hour') {
      for (let day = 0; day < totalDays; day++) {
        const currentDay = timeStart.add(day, 'day')
        headers.push(
          <div
            key={`day-${day}`}
            style={{
              width: `${(24 / totalHours) * 100}%`,
              textAlign: 'center',
              borderRight: '1px solid #ebeef5',
              padding: '4px 0',
              fontWeight: 500,
              background: '#fafafa'
            }}
          >
            {currentDay.format('MM-DD ddd')}
          </div>
        )
      }
    } else {
      for (let day = 0; day < totalDays; day++) {
        const currentDay = timeStart.add(day, 'day')
        headers.push(
          <div
            key={`day-${day}`}
            style={{
              width: `${(1 / totalDays) * 100}%`,
              textAlign: 'center',
              borderRight: '1px solid #ebeef5',
              padding: '4px 0',
              fontWeight: 500,
              background: '#fafafa'
            }}
          >
            {currentDay.format('MM-DD ddd')}
          </div>
        )
      }
    }
    return headers
  }

  return (
    <div>
      <div className="card-header">
        <div className="card-title">设备调度甘特图</div>
        <Space>
          <Select
            style={{ width: 120 }}
            value={categoryFilter}
            onChange={setCategoryFilter}
            allowClear
            placeholder="设备类别"
            options={Object.entries(categoryLabels).map(([value, label]) => ({
              value,
              label
            }))}
          />
          <Select
            style={{ width: 100 }}
            value={dateZoom}
            onChange={(v) => setDateZoom(v as 'day' | 'hour')}
            options={[
              { value: 'day', label: '按天' },
              { value: 'hour', label: '按小时' }
            ]}
          />
          <RangePicker
            showTime={dateZoom === 'hour'}
            value={dateRange}
            onChange={(v) => v && setDateRange(v as [Dayjs, Dayjs])}
          />
        </Space>
      </div>

      {conflictCount > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`检测到 ${conflictCount} 个设备调度冲突`}
          description="红色标记的时段存在设备数量不足或时间重叠问题，请及时调整"
          style={{ marginBottom: 16 }}
          closable
        />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title="调度任务" value={filteredSchedule.length} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="涉及设备" value={Object.keys(groupedByDevice).length} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="冲突告警"
              value={conflictCount}
              valueStyle={{ color: conflictCount > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Spin spinning={loading}>
        <div style={{ display: 'flex', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
          {Object.entries(categoryLabels).map(([cat, label]) => (
            <Space key={cat} size={4}>
              <div
                style={{
                  width: 16,
                  height: 12,
                  backgroundColor: categoryColors[cat as DeviceCategory],
                  borderRadius: 2
                }}
              />
              <span style={{ fontSize: 12 }}>{label}</span>
            </Space>
          ))}
          <Space size={4}>
            <div style={{ width: 16, height: 12, backgroundColor: '#ff4d4f', borderRadius: 2 }} />
            <span style={{ fontSize: 12, color: '#ff4d4f' }}>冲突</span>
          </Space>
        </div>

        <div className="gantt-chart">
          <div
            style={{
              display: 'flex',
              border: '1px solid #ebeef5',
              borderBottom: 'none'
            }}
          >
            <div
              style={{
                width: 180,
                minWidth: 180,
                padding: '8px 12px',
                fontWeight: 500,
                background: '#fafafa',
                borderRight: '1px solid #ebeef5'
              }}
            >
              设备
            </div>
            <div style={{ flex: 1, display: 'flex' }}>{renderTimeHeaders()}</div>
          </div>

          {Object.entries(groupedByDevice).map(([deviceId, items]) => (
            <div
              key={deviceId}
              className="gantt-row"
              style={{ border: '1px solid #ebeef5', borderTop: 'none' }}
            >
              <div className="gantt-label">
                <Space size={4}>
                  <Tag color={categoryColors[items[0].category]}>
                    {categoryLabels[items[0].category]}
                  </Tag>
                  <span>{items[0].deviceName}</span>
                </Space>
              </div>
              <div className="gantt-timeline">
                {items.map((item) => (
                  <Tooltip
                    key={item.id}
                    title={
                      <div>
                        <div>
                          <strong>{item.performanceName}</strong>
                        </div>
                        <div>数量：{item.quantity}</div>
                        <div>
                          时段：{dayjs(item.startTime).format('MM-DD HH:mm')} -{' '}
                          {dayjs(item.endTime).format('MM-DD HH:mm')}
                        </div>
                        {item.conflict && (
                          <div style={{ color: '#ff4d4f' }}>⚠️ 设备调度冲突</div>
                        )}
                      </div>
                    }
                  >
                    <div className="gantt-bar" style={getBarStyle(item)}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.performanceName} ({item.quantity})
                      </span>
                    </div>
                  </Tooltip>
                ))}
              </div>
            </div>
          ))}
        </div>
        </Spin>
      </Card>
    </div>
  )
}
