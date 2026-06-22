import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface DailyStat {
  date: string
  trades: number
  volume: number
  users: number
  newCollections: number
}

export interface HotRanking {
  rank: number
  name: string
  volume: number
  change: number
  trades: number
}

export interface CreatorRanking {
  rank: number
  name: string
  earnings: number
  collections: number
  followers: number
}

const MOCK_DAILY: DailyStat[] = [
  { date: '2024-06-16', trades: 1240, volume: 85600, users: 3200, newCollections: 15 },
  { date: '2024-06-15', trades: 1180, volume: 78900, users: 3050, newCollections: 12 },
  { date: '2024-06-14', trades: 1320, volume: 92300, users: 3400, newCollections: 18 },
  { date: '2024-06-13', trades: 1050, volume: 67800, users: 2800, newCollections: 10 },
  { date: '2024-06-12', trades: 1400, volume: 95200, users: 3600, newCollections: 22 },
  { date: '2024-06-11', trades: 1280, volume: 88400, users: 3350, newCollections: 16 },
  { date: '2024-06-10', trades: 1100, volume: 72600, users: 2950, newCollections: 14 },
]

const MOCK_HOT: HotRanking[] = [
  { rank: 1, name: 'Cosmic Phoenix', volume: 128500, change: 15.2, trades: 892 },
  { rank: 2, name: 'Void Serpent', volume: 95200, change: -3.8, trades: 654 },
  { rank: 3, name: 'Golden Lotus', volume: 82400, change: 22.5, trades: 721 },
  { rank: 4, name: 'Stellar Knight', volume: 68300, change: 8.1, trades: 543 },
  { rank: 5, name: 'Neon Dragon', volume: 54700, change: -1.2, trades: 412 },
  { rank: 6, name: 'Frost Giant', volume: 43200, change: 5.7, trades: 356 },
  { rank: 7, name: 'Thunder Hawk', volume: 38100, change: 12.3, trades: 289 },
  { rank: 8, name: 'Crystal Golem', volume: 29800, change: -6.4, trades: 234 },
]

const MOCK_CREATORS: CreatorRanking[] = [
  { rank: 1, name: 'ArtistX', earnings: 45200, collections: 8, followers: 12500 },
  { rank: 2, name: 'VoidArt', earnings: 38600, collections: 5, followers: 8900 },
  { rank: 3, name: 'CosmicForge', earnings: 32400, collections: 6, followers: 7200 },
  { rank: 4, name: 'SacredArt', earnings: 28100, collections: 4, followers: 6800 },
  { rank: 5, name: 'PixelMaster', earnings: 21800, collections: 7, followers: 5400 },
]

export const useStatisticsStore = defineStore('statistics', () => {
  const dailyStats = ref<DailyStat[]>([])
  const hotRanking = ref<HotRanking[]>([])
  const creatorRanking = ref<CreatorRanking[]>([])
  const loading = ref(false)
  const dateRange = ref<{ start: string; end: string }>({
    start: '2024-06-10',
    end: '2024-06-16',
  })

  const todayStats = ref({
    trades: 1240,
    volume: 85600,
    users: 3200,
    collections: 156,
    tradesChange: 8.5,
    volumeChange: 12.3,
    usersChange: 5.1,
    collectionsChange: 3.8,
  })

  async function fetchStats() {
    loading.value = true
    try {
      await new Promise(r => setTimeout(r, 500))
      dailyStats.value = MOCK_DAILY
      hotRanking.value = MOCK_HOT
      creatorRanking.value = MOCK_CREATORS
    } finally {
      loading.value = false
    }
  }

  return {
    dailyStats,
    hotRanking,
    creatorRanking,
    loading,
    dateRange,
    todayStats,
    fetchStats,
  }
})
