import React, { useState, useEffect } from 'react'
import { View, Text, Input, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import styles from './index.module.scss'
import { cinemaApi, movieApi } from '@/services/api'
import type { Cinema, Movie } from '@/types'

const HomePage: React.FC = () => {
  const [cinemas, setCinemas] = useState<Cinema[]>([])
  const [hotMovies, setHotMovies] = useState<Movie[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [cRes, mRes] = await Promise.all([
        cinemaApi.list(),
        movieApi.list('热映')
      ])
      if (cRes.data) setCinemas(cRes.data)
      if (mRes.data) setHotMovies(mRes.data.slice(0, 8))
    } catch (e) {
      console.error('[Home] fetch error', (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function onCinemaClick(cinema: Cinema) {
    Taro.navigateTo({ url: `/pages/booking/index?cinemaId=${cinema.id}&cinemaName=${encodeURIComponent(cinema.name)}` })
  }

  function onMovieClick(movie: Movie) {
    console.log('[Home] movie click', movie.id)
  }

  return (
    <ScrollView scrollY className={styles.container}>
      <View className={styles.header}>
        <View className={styles.locationBar}>
          <Text className={styles.city}>📍 北京</Text>
          <Text className={styles.arrow}>▼</Text>
        </View>
        <View className={styles.searchBox}>
          <Text className={styles.icon}>🔍</Text>
          <Input
            className={styles.input}
            placeholder="搜索影院/影片"
            placeholderTextColor="#6b6f7e"
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
          />
        </View>
        <View className={styles.promo}>
          <Text className={styles.promoTitle}>端午特惠 · 全场立减10元</Text>
          <Text className={styles.promoSub}>IMAX 低至 ¥39 起</Text>
          <Text className={styles.promoBadge}>抢票</Text>
        </View>
      </View>

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>🔥 热映中</Text>
          <Text className={styles.more}>全部 ›</Text>
        </View>
        <ScrollView scrollX className={styles.movieRow}>
          {hotMovies.map(m => (
            <View key={m.id} className={styles.movieCard} onClick={() => onMovieClick(m)}>
              <View className={styles.poster}>
                <Image className={styles.posterImg} src={m.poster} mode="aspectFill" />
                <Text className={styles.rating}>★ {m.rating}</Text>
                <Text className={styles.statusTag}>{m.status}</Text>
              </View>
              <View className={styles.movieInfo}>
                <Text className={styles.name}>{m.name}</Text>
                <Text className={styles.meta}>{m.genre} · {m.duration}分钟</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>🎬 附近影院</Text>
          <Text className={styles.more}>全部 ›</Text>
        </View>
      </View>

      <View className={styles.cinemaList}>
        {cinemas.map(c => (
          <View key={c.id} className={styles.cinemaCard} onClick={() => onCinemaClick(c)}>
            <View className={styles.cardTop}>
              <View className={styles.left}>
                <Text className={styles.name}>{c.name}</Text>
                <View className={styles.tags}>
                  {c.tags.slice(0, 3).map(t => (
                    <Text key={t} className={styles.tag}>{t}</Text>
                  ))}
                </View>
              </View>
              <View className={styles.right}>
                <Text className={styles.rating}>★ {c.rating}</Text>
                <Text className={styles.price}>
                  <Text className={styles.num}>¥{c.minPrice}</Text> 起
                </Text>
              </View>
            </View>
            <View className={styles.cardMiddle}>
              <Text className={styles.addr}>📍 {c.address}</Text>
              <Text className={styles.distance}>{c.distance}</Text>
            </View>
            <View className={styles.cardBottom}>
              <Text className={styles.info}>🕐 {c.businessHours} · {c.halls}个影厅</Text>
              <View className={styles.btn}>
                <Text>购票</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

export default HomePage
