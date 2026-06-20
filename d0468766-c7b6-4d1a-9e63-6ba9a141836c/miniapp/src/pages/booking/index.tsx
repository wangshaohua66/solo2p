import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import styles from './index.module.scss'
import { movieApi, cinemaApi, scheduleApi, seatApi, bookingApi } from '@/services/api'
import type { ScheduleItem, Seat, Movie, Cinema } from '@/types'

const MAX_SEATS = 8

const dateList = [
  { date: '2026-06-19', week: '今天', tag: '端午' },
  { date: '2026-06-20', week: '周六', tag: '' },
  { date: '2026-06-21', week: '周日', tag: '' },
  { date: '2026-06-22', week: '周一', tag: '' },
  { date: '2026-06-23', week: '周二', tag: '' },
  { date: '2026-06-24', week: '周三', tag: '' },
  { date: '2026-06-25', week: '周四', tag: '' }
]

const BookingPage: React.FC = () => {
  const router = useRouter()
  const { cinemaId = 'C01', cinemaName = '', movieId = '', movieName = '', orderId = '' } = router.params

  const [step, setStep] = useState<'schedule' | 'seat'>('schedule')
  const [movie, setMovie] = useState<Movie | null>(null)
  const [cinema, setCinema] = useState<Cinema | null>(null)
  const [selectedDate, setSelectedDate] = useState('2026-06-19')
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null)
  const [seats, setSeats] = useState<Seat[]>([])
  const [seatRows, setSeatRows] = useState(8)
  const [seatCols, setSeatCols] = useState(15)
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    init()
  }, [cinemaId, movieId])

  useEffect(() => {
    loadSchedules()
  }, [selectedDate, cinemaId, movieId])

  async function init() {
    try {
      const mq: any = {}
      if (movieId) mq.movieId = movieId
      if (cinemaId) mq.cinemaId = cinemaId
      const [mRes, cRes] = await Promise.all([
        movieId ? movieApi.detail(movieId) : Promise.resolve({ data: null }),
        cinemaId ? cinemaApi.detail(cinemaId) : Promise.resolve({ data: null })
      ])
      if (mRes.data) setMovie(mRes.data)
      if (cRes.data) setCinema(cRes.data)
    } catch (e) {
      console.error('[Booking] init error', (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function loadSchedules() {
    const params: any = { date: selectedDate }
    if (cinemaId) params.cinemaId = cinemaId
    if (movieId) params.movieId = movieId
    const res = await scheduleApi.list(params)
    if (res.data) setSchedules(res.data)
  }

  async function selectSession(s: ScheduleItem) {
    if (s.status === 'sold_out' || s.status === 'finished') {
      Taro.showToast({ title: s.status === 'sold_out' ? '本场已售罄' : '本场已结束', icon: 'none' })
      return
    }
    Taro.showLoading({ title: '加载座位...' })
    try {
      const res = await seatApi.getSeats(s.id, 8, 15)
      if (res.data) {
        setSeats(res.data.seats)
        setSeatRows(res.data.rows)
        setSeatCols(res.data.cols)
        setSelectedSchedule(s)
        setSelectedSeats([])
        setStep('seat')
      }
    } catch (e) {
      console.error('[Booking] selectSession error', (e as Error).message)
    } finally {
      Taro.hideLoading()
    }
  }

  function backToSchedule() {
    setStep('schedule')
    setSelectedSeats([])
    setSeats([])
  }

  function toggleSeat(seat: Seat) {
    if (seat.status === 'sold' || seat.status === 'locked') {
      Taro.showToast({ title: seat.status === 'sold' ? '该座位已售出' : '该座位已被锁定', icon: 'none' })
      return
    }
    setSelectedSeats((prev) => {
      const idx = prev.findIndex(s => s.id === seat.id)
      if (idx >= 0) {
        return prev.filter((_, i) => i !== idx)
      }
      if (prev.length >= MAX_SEATS) {
        Taro.showToast({ title: `最多可选${MAX_SEATS}个座位`, icon: 'none' })
        return prev
      }
      return [...prev, seat]
    })
  }

  const totalPrice = useMemo(
    () => selectedSeats.reduce((sum, s) => sum + (selectedSchedule?.price || s.price), 0),
    [selectedSeats, selectedSchedule]
  )

  async function confirmOrder() {
    if (selectedSeats.length === 0 || !selectedSchedule) return
    Taro.showLoading({ title: '下单中...' })
    try {
      const createRes = await bookingApi.create({
        scheduleId: selectedSchedule.id,
        movieName: selectedSchedule.movieName,
        cinemaName: selectedSchedule.cinemaName,
        hallName: selectedSchedule.hallName,
        showTime: `${selectedSchedule.date} ${selectedSchedule.startTime}`,
        seats: selectedSeats.map(s => ({ seatId: s.id, rowLabel: s.rowLabel, colLabel: s.colLabel })),
        totalAmount: totalPrice
      })
      if (!createRes.success || !createRes.data) {
        Taro.showToast({ title: createRes.message || '下单失败', icon: 'none' })
        return
      }
      Taro.hideLoading()
      Taro.showModal({
        title: '确认支付',
        content: `已选${selectedSeats.length}个座位，合计¥${totalPrice}`,
        confirmText: '微信支付',
        success: async (res) => {
          if (!res.confirm) return
          Taro.showLoading({ title: '支付中...' })
          const payRes = await bookingApi.pay(createRes.data!.id, 'wechat', totalPrice)
          Taro.hideLoading()
          if (payRes.success) {
            Taro.showToast({ title: '支付成功', icon: 'success' })
            setTimeout(() => {
              Taro.redirectTo({ url: '/pages/order/index' })
            }, 1200)
          } else {
            Taro.showToast({ title: payRes.message || '支付失败', icon: 'none' })
          }
        }
      })
    } catch (e) {
      Taro.hideLoading()
      console.error('[Booking] confirm error', (e as Error).message)
      Taro.showToast({ title: '下单失败', icon: 'none' })
    }
  }

  const groupedSchedules = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    schedules.forEach(s => {
      const key = s.hallName
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    })
    return Array.from(map.entries())
  }, [schedules])

  const seatMapByRow = useMemo(() => {
    const map: Record<number, Seat[]> = {}
    seats.forEach(s => {
      if (!map[s.row]) map[s.row] = []
      map[s.row].push(s)
    })
    Object.values(map).forEach(row => row.sort((a, b) => a.col - b.col))
    return map
  }, [seats])

  const selectedSeatText = selectedSeats
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map(s => `${s.rowLabel}排${s.colLabel}座`)
    .join('、')

  if (!step) return null

  // ========== 场次选择 ==========
  if (step === 'schedule') {
    return (
      <View className={styles.container}>
        {movie && (
          <View className={styles.movieBar}>
            <View className={styles.poster}>
              <Image className={styles.img} src={movie.poster} mode="aspectFill" />
            </View>
            <View className={styles.info}>
              <Text className={styles.name}>{movie.name}</Text>
              <Text className={styles.meta}>{movie.genre} · {movie.duration}分钟</Text>
              <Text className={styles.rating}>★ {movie.rating}</Text>
            </View>
          </View>
        )}
        {cinema && (
          <View className={styles.cinemaBar}>
            <View>
              <Text className={styles.name}>{cinema.name}</Text>
              <Text className={styles.addr}>📍 {cinema.address}</Text>
            </View>
            <Text className={styles.arrow}>›</Text>
          </View>
        )}

        <ScrollView scrollX className={styles.dateRow}>
          {dateList.map(d => (
            <View
              key={d.date}
              className={`${styles.dateItem} ${selectedDate === d.date ? styles.active : ''}`}
              onClick={() => setSelectedDate(d.date)}
            >
              <Text className={styles.w}>{d.week}</Text>
              <Text className={styles.d}>{d.date.slice(5)}</Text>
              {d.tag && <Text className={styles.tag}>{d.tag}</Text>}
            </View>
          ))}
        </ScrollView>

        <ScrollView scrollY className={styles.sessionList}>
          {groupedSchedules.length === 0 && (
            <View style={{ textAlign: 'center', padding: '100rpx 0', color: '#6b6f7e' }}>
              <Text>该日暂无排片</Text>
            </View>
          )}
          {groupedSchedules.map(([hall, list]) => (
            <View key={hall} style={{ marginBottom: 24 }}>
              <View style={{ fontSize: 24, color: '#a0a3b1', marginBottom: 12, paddingLeft: 4 }}>
                <Text>{hall}</Text>
                <Text style={{ marginLeft: 8, color: '#6b6f7e' }}>{list[0]?.hallType}</Text>
              </View>
              {list.map(s => {
                const soldPct = s.seatsTotal ? Math.round((s.seatsSold / s.seatsTotal) * 100) : 0
                return (
                  <View
                    key={s.id}
                    className={`${styles.sessionCard} ${s.status === 'sold_out' ? styles.sold : ''}`}
                    onClick={() => selectSession(s)}
                  >
                    <View className={styles.left}>
                      <Text className={styles.time}>{s.startTime}</Text>
                      <Text className={styles.end}>散场 {s.endTime}</Text>
                    </View>
                    <View className={styles.center}>
                      <Text className={styles.type}>{s.language} {s.version}</Text>
                      <Text className={styles.lang}>{soldPct}% 已售</Text>
                    </View>
                    <View className={styles.right}>
                      <View className={styles.price}>
                        <Text className={styles.small}>¥</Text>
                        <Text>{s.price}</Text>
                      </View>
                      <Text className={styles.tip}>
                        {s.status === 'sold_out' ? '已售罄' : s.status === 'finished' ? '已结束' : '选座购票'}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    )
  }

  // ========== 座位选择 ==========
  return (
    <View className={styles.container}>
      <View className={styles.seatSection}>
        <View className={styles.backBtn} onClick={backToSchedule}>
          <Text>‹ 返回场次</Text>
        </View>
        {selectedSchedule && (
          <View style={{ textAlign: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 30, fontWeight: 600, color: '#f5f6fa' }}>{selectedSchedule.movieName}</Text>
            <Text style={{ color: '#a0a3b1', fontSize: 22, marginLeft: 12 }}>
              {selectedSchedule.date} {selectedSchedule.startTime}
            </Text>
            <View style={{ color: '#6b6f7e', fontSize: 22, marginTop: 4 }}>
              <Text>{selectedSchedule.hallName}</Text>
              <Text style={{ marginLeft: 12 }}>{selectedSchedule.language} {selectedSchedule.version}</Text>
            </View>
          </View>
        )}
        <View className={styles.screen} />
        <Text className={styles.screenLabel}>— 银幕 SCREEN —</Text>

        <View className={styles.seatMap}>
          {Object.keys(seatMapByRow).sort((a, b) => Number(a) - Number(b)).map(rk => {
            const row = seatMapByRow[Number(rk)]
            const rowLabel = row[0]?.rowLabel || ''
            const maxCol = Math.max(...row.map(s => s.col))
            return (
              <View key={rk} className={styles.seatRow}>
                <Text className={styles.rowLabel}>{rowLabel}</Text>
                {Array.from({ length: seatCols }, (_, ci) => {
                  const seat = row.find(s => s.col === ci)
                  if (!seat) return <View key={ci} className={`${styles.seat} ${styles.aisle}`} />
                  const isSelected = selectedSeats.some(s => s.id === seat.id)
                  const cls = [styles.seat]
                  if (seat.type === 'vip') cls.push(styles.vip)
                  if (isSelected) cls.push(styles.selected)
                  else if (seat.status === 'sold') cls.push(styles.sold)
                  else if (seat.status === 'locked') cls.push(styles.locked)
                  else cls.push(styles.available)
                  return (
                    <View
                      key={seat.id}
                      className={cls.join(' ')}
                      onClick={() => toggleSeat(seat)}
                    />
                  )
                })}
                <Text className={styles.rowLabel}>{rowLabel}</Text>
              </View>
            )
          })}
        </View>

        <View className={styles.legend}>
          <View className={styles.item}><View className={`${styles.box} ${styles.avail}`} /><Text>可选</Text></View>
          <View className={styles.item}><View className={`${styles.box} ${styles.sel}`} /><Text>已选</Text></View>
          <View className={styles.item}><View className={`${styles.box} ${styles.sold}`} /><Text>已售</Text></View>
          <View className={styles.item}><View className={`${styles.box} ${styles.lock}`} /><Text>锁定</Text></View>
        </View>

        <View className={styles.tip}>
          <Text>· 每张订单最多可选{MAX_SEATS}个座位</Text>
          {'\n'}· 选中座位后请在15分钟内完成支付，超时将自动释放
          {'\n'}· VIP 厅票价¥{selectedSchedule ? Math.round(selectedSchedule.price * 1.5) : 58}，普通厅票价¥{selectedSchedule?.price || 39}
        </View>
      </View>

      {selectedSeats.length > 0 && (
        <View className={styles.selectedList}>
          <Text className={styles.title}>已选{selectedSeats.length}个座位</Text>
          <View className={styles.row}>
            <Text className={styles.label}>座位</Text>
            <Text className={styles.value}>{selectedSeatText}</Text>
          </View>
          <View className={styles.row}>
            <Text className={styles.label}>单价</Text>
            <Text className={styles.value}>¥{selectedSchedule?.price || selectedSeats[0]?.price || 39}/张</Text>
          </View>
          <View className={styles.row}>
            <Text className={styles.label}>合计</Text>
            <Text className={styles.total}>¥{totalPrice}</Text>
          </View>
        </View>
      )}

      <View className={styles.checkoutBar}>
        <View className={styles.left}>
          {selectedSeats.length > 0 ? (
            <Text className={styles.seats}>{selectedSeatText}</Text>
          ) : (
            <Text className={styles.empty}>请先选择座位</Text>
          )}
          <Text className={styles.count}>已选 {selectedSeats.length} 个座位</Text>
        </View>
        <View className={styles.right}>
          <View className={styles.amount}>
            {selectedSeats.length > 0 ? (
              <View className={styles.num}>
                <Text className={styles.small}>¥</Text>
                <Text>{totalPrice}</Text>
              </View>
            ) : (
              <View className={styles.num} style={{ fontSize: 24, color: '#6b6f7e', fontWeight: 400 }}>
                <Text>¥0</Text>
              </View>
            )}
          </View>
          <View
            className={styles.payBtn}
            onClick={confirmOrder}
          >
            <Text>确认选座</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export default BookingPage
