import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Hospital } from '@/types'

export const useAppStore = defineStore('app', () => {
  const loading = ref<boolean>(false)
  const currentHospitalId = ref<number | null>(null)

  function setLoading(val: boolean) {
    loading.value = val
  }

  function setCurrentHospitalId(id: number | null) {
    currentHospitalId.value = id
  }

  return {
    loading, currentHospitalId,
    setLoading, setCurrentHospitalId
  }
}, {
  persist: { key: 'pet-med-app', paths: ['currentHospitalId'] }
})
