import { defineStore } from 'pinia'
import { ref } from 'vue'
import { stats as statsApi, booking, maintenance, notification } from '@/api'
import type { DashboardStats, Booking, Maintenance, Notification, CenterStats, RankingItem } from '@/types'

export const useStatsStore = defineStore(
  'stats',
  () => {
    const dashboardStats = ref<DashboardStats | null>(null)
    const utilizationTrend = ref<{ xAxis: string[]; series: any[] } | null>(null)
    const categoryDistribution = ref<{ name: string; value: number }[]>([])
    const todayBookings = ref<Booking[]>([])
    const pendingBookings = ref<Booking[]>([])
    const pendingMaintenance = ref<Maintenance[]>([])
    const unreadNotifications = ref<Notification[]>([])
    const centerRanking = ref<CenterStats[]>([])
    const loading = ref<boolean>(false)

    const fetchDashboardStats = async () => {
      loading.value = true
      try {
        dashboardStats.value = await statsApi.getDashboard()
        return dashboardStats.value
      } finally {
        loading.value = false
      }
    }

    const fetchUtilizationTrend = async (days: number = 30) => {
      loading.value = true
      try {
        utilizationTrend.value = await statsApi.getTrend({ days })
        return utilizationTrend.value
      } finally {
        loading.value = false
      }
    }

    const fetchCategoryDistribution = async () => {
      loading.value = true
      try {
        const data = await statsApi.getUtilization({ dimension: 'category' })
        categoryDistribution.value = data.series.map((s: any) => ({
          name: s.name,
          value: s.data.reduce((a: number, b: number) => a + b, 0)
        }))
        return categoryDistribution.value
      } finally {
        loading.value = false
      }
    }

    const fetchTodayBookings = async () => {
      loading.value = true
      try {
        const today = new Date().toISOString().split('T')[0]
        const response = await booking.getList({
          startTime: `${today}T00:00:00`,
          endTime: `${today}T23:59:59`,
          pageSize: 10
        })
        todayBookings.value = response.items
        return todayBookings.value
      } finally {
        loading.value = false
      }
    }

    const fetchPendingBookings = async () => {
      loading.value = true
      try {
        const response = await booking.getList({
          status: 'confirmed',
          pageSize: 5
        })
        pendingBookings.value = response.items
        return pendingBookings.value
      } finally {
        loading.value = false
      }
    }

    const fetchPendingMaintenance = async () => {
      loading.value = true
      try {
        const response = await maintenance.getList({
          status: 'scheduled',
          pageSize: 5
        })
        pendingMaintenance.value = response.items
        return pendingMaintenance.value
      } finally {
        loading.value = false
      }
    }

    const fetchUnreadNotifications = async () => {
      loading.value = true
      try {
        const response = await notification.getList({
          isRead: false,
          pageSize: 5
        })
        unreadNotifications.value = response.items
        return unreadNotifications.value
      } finally {
        loading.value = false
      }
    }

    const fetchCenterRanking = async () => {
      loading.value = true
      try {
        const data = await statsApi.getCenterStats()
        centerRanking.value = data.xAxis.map((name: string, index: number) => ({
          centerId: index + 1,
          centerName: name,
          equipmentCount: data.series[0]?.data[index] || 0,
          bookedHours: data.series[1]?.data[index] || 0,
          utilizationRate: data.series[2]?.data[index] || 0
        })).sort((a: CenterStats, b: CenterStats) => b.utilizationRate - a.utilizationRate)
        return centerRanking.value
      } finally {
        loading.value = false
      }
    }

    const fetchAllDashboardData = async () => {
      loading.value = true
      try {
        await Promise.all([
          fetchDashboardStats(),
          fetchUtilizationTrend(30),
          fetchCategoryDistribution(),
          fetchTodayBookings(),
          fetchPendingBookings(),
          fetchPendingMaintenance(),
          fetchUnreadNotifications(),
          fetchCenterRanking()
        ])
      } finally {
        loading.value = false
      }
    }

    return {
      dashboardStats,
      utilizationTrend,
      categoryDistribution,
      todayBookings,
      pendingBookings,
      pendingMaintenance,
      unreadNotifications,
      centerRanking,
      loading,
      fetchDashboardStats,
      fetchUtilizationTrend,
      fetchCategoryDistribution,
      fetchTodayBookings,
      fetchPendingBookings,
      fetchPendingMaintenance,
      fetchUnreadNotifications,
      fetchCenterRanking,
      fetchAllDashboardData
    }
  }
)
