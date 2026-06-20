import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import styles from './index.module.scss'
import { memberApi } from '@/services/api'
import type { MemberInfo } from '@/types'

const MinePage: React.FC = () => {
  const [member, setMember] = useState<MemberInfo | null>(null)

  useEffect(() => {
    loadMember()
  }, [])

  async function loadMember() {
    const res = await memberApi.info()
    if (res.data) setMember(res.data)
  }

  function goLogin() {
    Taro.showToast({ title: '登录功能开发中', icon: 'none' })
  }

  const menus = [
    [
      { icon: '🎟️', label: '优惠券', extra: `${member?.coupons || 0}张可用` },
      { icon: '💎', label: '积分商城', extra: `${member?.points || 0}积分` },
      { icon: '🏆', label: '会员等级', extra: member?.levelName || '' }
    ],
    [
      { icon: '🎬', label: '观影记录', extra: `${member?.totalVisits || 0}次` },
      { icon: '📱', label: '绑定手机', extra: member?.phone || '去绑定' },
      { icon: '📍', label: '收货地址', extra: '' }
    ],
    [
      { icon: '🎁', label: '邀请好友', extra: '送积分' },
      { icon: '⚙️', label: '设置', extra: '' },
      { icon: '❓', label: '帮助与反馈', extra: '' }
    ]
  ]

  return (
    <ScrollView scrollY className={styles.container}>
      <View className={styles.profileHeader}>
        {member ? (
          <View className={styles.profileRow}>
            <View className={styles.avatar}>
              <Image className={styles.img} src={member.avatar} mode="aspectFill" />
            </View>
            <View className={styles.info}>
              <View className={styles.name}>
                <Text>{member.name}</Text>
                <Text className={styles.level}>{member.levelName}</Text>
              </View>
              <Text className={styles.phone}>{member.phone}</Text>
            </View>
            <Text className={styles.arrow}>›</Text>
          </View>
        ) : (
          <View className={styles.profileRow} onClick={goLogin}>
            <View className={styles.avatar} style={{ background: '#2a2b3d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 48, color: '#6b6f7e' }}>👤</Text>
            </View>
            <View className={styles.info}>
              <Text className={styles.name}>未登录</Text>
              <Text className={styles.phone}>点击登录享会员权益</Text>
            </View>
            <Text className={styles.arrow}>›</Text>
          </View>
        )}

        <View className={styles.statsRow}>
          <View className={styles.stat}>
            <Text className={styles.num}>{member?.points || 0}</Text>
            <Text className={styles.label}>可用积分</Text>
          </View>
          <View className={styles.stat}>
            <Text className={styles.num}>{member?.coupons || 0}</Text>
            <Text className={styles.label}>优惠券</Text>
          </View>
          <View className={styles.stat}>
            <Text className={styles.num}>{member?.totalVisits || 0}</Text>
            <Text className={styles.label}>观影次数</Text>
          </View>
          <View className={styles.stat}>
            <Text className={styles.num}>¥{member?.totalSpent || 0}</Text>
            <Text className={styles.label}>累计消费</Text>
          </View>
        </View>
      </View>

      {menus.map((group, gi) => (
        <View key={gi} className={styles.menuSection}>
          {gi === 0 && <Text className={styles.sectionTitle}>会员权益</Text>}
          {gi === 1 && <Text className={styles.sectionTitle}>订单与服务</Text>}
          {gi === 2 && <Text className={styles.sectionTitle}>更多</Text>}
          {group.map((m, mi) => (
            <View
              key={mi}
              className={styles.menuItem}
              onClick={() => Taro.showToast({ title: `${m.label}功能开发中`, icon: 'none' })}
            >
              <Text className={styles.icon}>{m.icon}</Text>
              <Text className={styles.label}>{m.label}</Text>
              <Text className={styles.extra}>{m.extra}</Text>
              <Text className={styles.arrow}>›</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  )
}

export default MinePage
