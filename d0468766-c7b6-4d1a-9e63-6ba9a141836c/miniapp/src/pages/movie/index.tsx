import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import styles from './index.module.scss'
import { movieApi } from '@/services/api'
import type { Movie } from '@/types'

const tabs = [
  { key: '热映', label: '正在热映' },
  { key: '即将上映', label: '即将上映' },
  { key: '点映', label: '点映场' }
]

const MoviePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('热映')
  const [list, setList] = useState<Movie[]>([])

  useEffect(() => {
    loadList()
  }, [activeTab])

  async function loadList() {
    const res = await movieApi.list(activeTab)
    if (res.data) setList(res.data)
  }

  function goBook(m: Movie) {
    Taro.navigateTo({ url: `/pages/booking/index?movieId=${m.id}&movieName=${encodeURIComponent(m.name)}` })
  }

  function boFormat(n: number): string {
    if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`
    if (n >= 10000) return `${Math.round(n / 10000)}万`
    return String(n)
  }

  return (
    <View className={styles.container}>
      <View className={styles.tabs}>
        {tabs.map(t => (
          <View
            key={t.key}
            className={`${styles.tab} ${activeTab === t.key ? styles.active : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            <Text>{t.label}</Text>
          </View>
        ))}
      </View>
      <ScrollView scrollY className={styles.movieList}>
        {list.map(m => (
          <View key={m.id} className={styles.movieItem} onClick={() => goBook(m)}>
            <View className={styles.poster}>
              <Image className={styles.img} src={m.poster} mode="aspectFill" />
              <Text className={styles.status}>{m.status}</Text>
            </View>
            <View className={styles.info}>
              <Text className={styles.title}>{m.name}</Text>
              <Text className={styles.genre}>{m.genre} · {m.duration}分钟</Text>
              {m.status === '热映' && m.boxOffice > 0 && (
                <Text className={styles.rating}>
                  <Text className={styles.label}>累计票房</Text>
                  {boFormat(m.boxOffice)}
                </Text>
              )}
              {m.status !== '热映' && m.wantSee > 0 && (
                <Text className={styles.rating}>
                  <Text className={styles.label}>想看人数</Text>
                  {boFormat(m.wantSee)}
                </Text>
              )}
              {m.rating > 0 && m.status === '热映' && (
                <Text className={styles.rating}>
                  <Text className={styles.label}>评分</Text>
                  ★ {m.rating}
                </Text>
              )}
              <View className={styles.meta}>
                <Text className={styles.date}>{m.releaseDate} 上映</Text>
                {m.status === '热映' && (
                  <View className={styles.btn} onClick={(e) => { e.stopPropagation(); goBook(m); }}>
                    <Text>购票</Text>
                  </View>
                )}
                {m.status !== '热映' && (
                  <View className={styles.btn} onClick={(e) => { e.stopPropagation(); Taro.showToast({ title: '暂未开售', icon: 'none' }) }}>
                    <Text>想看</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

export default MoviePage
