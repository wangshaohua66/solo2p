import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import styles from './index.module.scss'
import { bookingApi } from '@/services/api'
import type { BookingOrder } from '@/types'

const statusTabs = [
  { key: 'all', label: '全部' },
  { key: 'paid', label: '待观影' },
  { key: 'pending', label: '待支付' },
  { key: 'finished', label: '已完成' }
]

const statusLabel: Record<string, string> = {
  pending: '待支付',
  paid: '已支付',
  cancelled: '已取消',
  refunded: '已退款'
}

const OrderPage: React.FC = () => {
  const [tab, setTab] = useState('all')
  const [orders, setOrders] = useState<BookingOrder[]>([])

  useEffect(() => {
    loadOrders()
  }, [tab])

  async function loadOrders() {
    const res = await bookingApi.list(tab === 'all' ? undefined : tab)
    if (res.data) setOrders(res.data)
  }

  function payOrder(o: BookingOrder) {
    Taro.showLoading({ title: '支付中...' })
    bookingApi.pay(o.id, 'wechat', o.totalAmount).then(() => {
      Taro.hideLoading()
      Taro.showToast({ title: '支付成功', icon: 'success' })
      loadOrders()
    })
  }

  function cancelOrder(o: BookingOrder) {
    Taro.showModal({
      title: '取消订单',
      content: '确定要取消这笔订单吗？',
      success: (res) => {
        if (res.confirm) {
          Taro.showToast({ title: '已取消', icon: 'none' })
        }
      }
    })
  }

  function showQr(o: BookingOrder) {
    Taro.navigateTo({ url: `/pages/booking/index?orderId=${o.id}` })
  }

  return (
    <View className={styles.container}>
      <View className={styles.tabs}>
        {statusTabs.map(t => (
          <View
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.active : ''}`}
            onClick={() => setTab(t.key)}
          >
            <Text>{t.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView scrollY className={styles.orderList}>
        {orders.length === 0 && (
          <View className={styles.empty}>
            <Text className={styles.icon}>🎬</Text>
            <Text className={styles.tip}>暂无订单，去选一场好看的电影吧</Text>
          </View>
        )}
        {orders.map(o => (
          <View key={o.id} className={styles.orderCard}>
            <View className={styles.header}>
              <Text className={styles.time}>{o.createdAt}</Text>
              <Text className={`${styles.status} ${styles[o.status]}`}>
                {statusLabel[o.status] || o.status}
              </Text>
            </View>
            <View className={styles.body}>
              <View className={styles.info}>
                <Text className={styles.movie}>{o.movieName}</Text>
                <Text className={styles.cinema}>{o.cinemaName}</Text>
                <Text className={styles.hall}>{o.hallName} · {o.showTime}</Text>
                <Text className={styles.seats}>
                  {o.seats.map(s => `${s.rowLabel}排${s.colLabel}座`).join('、')}
                </Text>
              </View>
              <View className={styles.amount}>
                <Text className={styles.num}>¥{o.totalAmount}</Text>
                <Text className={styles.label}>共{o.seats.length}张</Text>
              </View>
            </View>
            <View className={styles.footer}>
              {o.status === 'pending' && (
                <>
                  <View className={styles.btn} onClick={() => cancelOrder(o)}>
                    <Text>取消订单</Text>
                  </View>
                  <View className={`${styles.btn} ${styles.primary}`} onClick={() => payOrder(o)}>
                    <Text>立即支付</Text>
                  </View>
                </>
              )}
              {o.status === 'paid' && (
                <View className={`${styles.btn} ${styles.primary}`} onClick={() => showQr(o)}>
                  <Text>查看电子票</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

export default OrderPage
