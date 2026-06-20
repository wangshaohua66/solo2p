import React from 'react'
import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'

const CinemaDetailPage: React.FC = () => {
  return (
    <View className={styles.container}>
      <Text className={styles.icon}>🎬</Text>
      <Text className={styles.title}>影院详情页</Text>
      <Text className={styles.tip}>功能正在开发中...</Text>
    </View>
  )
}

export default CinemaDetailPage
