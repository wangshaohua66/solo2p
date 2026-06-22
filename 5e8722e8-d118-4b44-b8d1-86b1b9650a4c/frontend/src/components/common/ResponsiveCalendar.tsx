import { useState, useEffect } from 'react'
import { Calendar, List, Tag, Button, Space } from 'antd'
import { LeftOutlined, RightOutlined, CalendarOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import './ResponsiveCalendar.scss'

interface ResponsiveCalendarProps {
  value?: Dayjs
  defaultValue?: Dayjs
  onSelect?: (date: Dayjs) => void
  disabledDate?: (current: Dayjs) => boolean
  slotItems?: Record<string, any[]>
  mobileBreakpoint?: number
}

function ResponsiveCalendar({
  value,
  defaultValue,
  onSelect,
  disabledDate,
  slotItems = {},
  mobileBreakpoint = 768,
}: ResponsiveCalendarProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Dayjs>(value || defaultValue || dayjs())
  const [listMonth, setListMonth] = useState<Dayjs>(value || defaultValue || dayjs())

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [mobileBreakpoint])

  useEffect(() => {
    if (value) {
      setSelectedDate(value)
    }
  }, [value])

  const handleDateSelect = (date: Dayjs) => {
    if (disabledDate && disabledDate(date)) return
    setSelectedDate(date)
    onSelect?.(date)
  }

  const getDaysInMonth = (month: Dayjs) => {
    const days: Dayjs[] = []
    const daysInMonth = month.daysInMonth()
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(month.date(i))
    }
    return days
  }

  const handlePrevMonth = () => {
    setListMonth(listMonth.subtract(1, 'month'))
  }

  const handleNextMonth = () => {
    setListMonth(listMonth.add(1, 'month'))
  }

  const handleToday = () => {
    const today = dayjs()
    setListMonth(today)
    handleDateSelect(today)
  }

  const renderMobileView = () => {
    const days = getDaysInMonth(listMonth)
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']

    return (
      <div className="responsive-calendar-mobile">
        <div className="mobile-calendar-header">
          <Space size={8}>
            <Button size="small" icon={<LeftOutlined />} onClick={handlePrevMonth} />
            <span className="month-title">{listMonth.format('YYYY年MM月')}</span>
            <Button size="small" icon={<RightOutlined />} onClick={handleNextMonth} />
          </Space>
          <Button size="small" onClick={handleToday}>今天</Button>
        </div>

        <div className="weekday-row">
          {weekDays.map(day => (
            <div key={day} className="weekday-item">{day}</div>
          ))}
        </div>

        <div className="days-grid">
          {days.map(day => {
            const isSelected = day.isSame(selectedDate, 'day')
            const isToday = day.isSame(dayjs(), 'day')
            const isDisabled = disabledDate ? disabledDate(day) : false
            const items = slotItems[day.format('YYYY-MM-DD')] || []
            const hasItems = items.length > 0

            return (
              <div
                key={day.format('YYYY-MM-DD')}
                className={`day-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => !isDisabled && handleDateSelect(day)}
              >
                <div className="day-number">{day.date()}</div>
                {hasItems && <div className="day-dot" />}
              </div>
            )
          })}
        </div>

        <div className="selected-info">
          <div className="selected-date">
            <CalendarOutlined /> {selectedDate.format('YYYY年MM月DD日 dddd')}
          </div>
          {slotItems[selectedDate.format('YYYY-MM-DD')]?.length > 0 ? (
            <List
              size="small"
              dataSource={slotItems[selectedDate.format('YYYY-MM-DD')]}
              renderItem={(item: any) => (
                <List.Item>
                  <List.Item.Meta
                    title={item.title || item.name}
                    description={item.time || item.desc}
                  />
                  {item.tag && <Tag color={item.tagColor || 'blue'}>{item.tag}</Tag>}
                </List.Item>
              )}
            />
          ) : (
            <div className="no-items">当日暂无安排</div>
          )}
        </div>
      </div>
    )
  }

  const renderDesktopView = () => {
    return (
      <div className="responsive-calendar-desktop">
        <Calendar
          fullscreen={false}
          value={selectedDate}
          onSelect={handleDateSelect}
          disabledDate={disabledDate}
        />
      </div>
    )
  }

  return (
    <div className="responsive-calendar">
      {isMobile ? renderMobileView() : renderDesktopView()}
    </div>
  )
}

export default ResponsiveCalendar
