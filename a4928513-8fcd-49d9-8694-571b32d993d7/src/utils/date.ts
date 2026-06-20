import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export { dayjs }

export function formatDate(date: string | Date | number, format = 'YYYY-MM-DD'): string {
  return dayjs(date).format(format)
}

export function formatDateTime(date: string | Date | number, format = 'YYYY-MM-DD HH:mm'): string {
  return dayjs(date).format(format)
}

export function formatTime(date: string | Date | number, format = 'HH:mm'): string {
  return dayjs(date).format(format)
}

export function fromNow(date: string | Date | number): string {
  return dayjs(date).fromNow()
}

export function getWeekRange(base?: string | Date): { start: string; end: string; days: string[] } {
  const start = dayjs(base).startOf('week').add(1, 'day')
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    days.push(start.add(i, 'day').format('YYYY-MM-DD'))
  }
  return {
    start: start.format('YYYY-MM-DD'),
    end: start.add(6, 'day').format('YYYY-MM-DD'),
    days
  }
}

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  return {
    start: dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('YYYY-MM-DD'),
    end: dayjs(`${year}-${String(month).padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD')
  }
}

export function generateTimeSlots(
  startHour = 7,
  endHour = 20,
  interval = 30
): { start: string; end: string; label: string }[] {
  const slots = []
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += interval) {
      const start = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const endM = m + interval
      const endH = endM >= 60 ? h + 1 : h
      const end = `${String(endH).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
      slots.push({ start, end, label: `${start}-${end}` })
    }
  }
  return slots
}

export function isTimeOverlap(
  s1: string,
  e1: string,
  s2: string,
  e2: string
): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  return !(toMin(e1) <= toMin(s2) || toMin(s1) >= toMin(e2))
}
