import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type { Trial } from '@/types'
import { trialApi } from '@/api/modules'
import dayjs, { Dayjs } from 'dayjs'

export const useTrialStore = defineStore('trial', () => {
  const trials = ref<Trial[]>([])
  const calendarEvents = ref<any[]>([])
  const loading = ref(false)
  const filters = reactive({
    case: null as number | null,
    presiding_lawyer: null as number | null,
    result: '',
    start: '',
    end: ''
  })

  async function fetchTrials(params?: any) {
    loading.value = true
    try {
      const res = await trialApi.list({ ...filters, ...params })
      trials.value = res.data.results
      return res.data
    } finally {
      loading.value = false
    }
  }

  async function fetchCalendar(start?: Dayjs, end?: Dayjs, lawyerId?: number) {
    const params: any = {}
    if (start) params.start = start.format('YYYY-MM-DD')
    if (end) params.end = end.format('YYYY-MM-DD')
    if (lawyerId) params.lawyer = lawyerId
    const res = await trialApi.calendar(params)
    calendarEvents.value = res.data
    return res.data
  }

  async function createTrial(data: any) {
    const res = await trialApi.create(data)
    trials.value.unshift(res.data)
    return res.data
  }

  async function updateTrial(id: number, data: any) {
    const res = await trialApi.update(id, data)
    const idx = trials.value.findIndex(t => t.id === id)
    if (idx > -1) trials.value[idx] = res.data
    return res.data
  }

  async function deleteTrial(id: number) {
    await trialApi.delete(id)
    trials.value = trials.value.filter(t => t.id !== id)
    calendarEvents.value = calendarEvents.value.filter((e: any) => e.id !== id)
  }

  async function checkConflict(data: any) {
    return await trialApi.checkConflict(data)
  }

  function setFilters(newFilters: Partial<typeof filters>) {
    Object.assign(filters, newFilters)
  }

  return {
    trials, calendarEvents, loading, filters,
    fetchTrials, fetchCalendar, createTrial, updateTrial, deleteTrial,
    checkConflict, setFilters
  }
})
