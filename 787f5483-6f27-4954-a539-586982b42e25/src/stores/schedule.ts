import { defineStore } from 'pinia'
import type { ScheduleItem } from '@/types'
import { getSchedule, createScheduleItem, updateScheduleItem, deleteScheduleItem, reorderSchedule } from '@/api/schedule'

export const useScheduleStore = defineStore('schedule', {
  state: () => ({
    schedules: [] as ScheduleItem[],
    selectedDate: new Date().toISOString().split('T')[0],
    selectedChannel: 'news' as 'news' | 'city' | 'public',
    loading: false,
    viewMode: 'timeline' as 'timeline' | 'list'
  }),
  getters: {
    schedulesByChannel: (state) => {
      const grouped: Record<string, ScheduleItem[]> = {
        news: [],
        city: [],
        public: []
      }
      state.schedules.forEach(item => {
        if (grouped[item.channelId]) {
          grouped[item.channelId].push(item)
        }
      })
      return grouped
    },
    totalDuration: (state) => {
      return state.schedules.reduce((sum, item) => sum + item.duration, 0)
    },
    scheduleGaps: (state) => {
      const gaps: { startTime: string; endTime: string; duration: number }[] = []
      const sorted = [...state.schedules].sort((a, b) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
      
      for (let i = 0; i < sorted.length - 1; i++) {
        const currentEnd = new Date(sorted[i].endTime).getTime()
        const nextStart = new Date(sorted[i + 1].startTime).getTime()
        if (currentEnd < nextStart) {
          gaps.push({
            startTime: sorted[i].endTime,
            endTime: sorted[i + 1].startTime,
            duration: Math.floor((nextStart - currentEnd) / 60000)
          })
        }
      }
      return gaps
    }
  },
  actions: {
    async fetchSchedule() {
      this.loading = true
      try {
        const data = await getSchedule({
          channelId: this.selectedChannel,
          date: this.selectedDate
        })
        this.schedules = data
        return data
      } finally {
        this.loading = false
      }
    },
    
    async addScheduleItem(data: Partial<ScheduleItem>) {
      const newItem = await createScheduleItem({
        ...data,
        channelId: this.selectedChannel
      })
      this.schedules.push(newItem)
      return newItem
    },
    
    async updateScheduleItem(id: number, data: Partial<ScheduleItem>) {
      const updated = await updateScheduleItem(id, data)
      const index = this.schedules.findIndex(s => s.id === id)
      if (index !== -1) {
        this.schedules[index] = updated
      }
      return updated
    },
    
    async removeScheduleItem(id: number) {
      await deleteScheduleItem(id)
      this.schedules = this.schedules.filter(s => s.id !== id)
    },
    
    async reorderItems(items: { id: number; order: number }[]) {
      await reorderSchedule(this.selectedChannel, this.selectedDate, items)
      await this.fetchSchedule()
    },
    
    setSelectedDate(date: string) {
      this.selectedDate = date
      this.fetchSchedule()
    },
    
    setSelectedChannel(channel: 'news' | 'city' | 'public') {
      this.selectedChannel = channel
      this.fetchSchedule()
    },
    
    setViewMode(mode: 'timeline' | 'list') {
      this.viewMode = mode
    }
  },
  persist: {
    key: 'schedule-store',
    storage: localStorage,
    paths: ['selectedDate', 'selectedChannel', 'viewMode']
  }
})
