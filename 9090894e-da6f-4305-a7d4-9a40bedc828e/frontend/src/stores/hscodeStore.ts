import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { HSCode, HSChapter, TaxCalcItem, TaxCalcResult } from '@/types'
import {
  searchHSCodes,
  getHSCodeDetail,
  getHSChapterTree,
  getHSByChapter,
  getSearchHistory,
  getFavorites,
  toggleFavorite,
  getHSRecommendations
} from '@/api/hscode'
import { calculateTax, getRefundRate, getPolicyVersions } from '@/api/tax'

export const useHSCodeStore = defineStore('hscode', () => {
  const hscodes = ref<HSCode[]>([])
  const currentHSCode = ref<HSCode | null>(null)
  const chapters = ref<HSChapter[]>([])
  const searchHistory = ref<string[]>([])
  const favorites = ref<HSCode[]>([])
  const recommendations = ref<HSCode[]>([])
  const searchKeyword = ref('')
  const selectedChapter = ref<string>('')
  const loading = ref(false)
  const pagination = ref({ page: 1, pageSize: 20, total: 0 })

  const favoriteCodes = computed(() => favorites.value.map(f => f.code))

  async function search(keyword: string) {
    loading.value = true
    try {
      searchKeyword.value = keyword
      const res = await searchHSCodes(keyword, pagination.value.page, pagination.value.pageSize)
      hscodes.value = res.list || []
      pagination.value.total = res.total || 0
    } finally {
      loading.value = false
    }
  }

  async function getDetail(code: string) {
    loading.value = true
    try {
      const res = await getHSCodeDetail(code)
      currentHSCode.value = res
      return res
    } finally {
      loading.value = false
    }
  }

  async function fetchChapters() {
    loading.value = true
    try {
      const res = await getHSChapterTree()
      chapters.value = res || []
    } finally {
      loading.value = false
    }
  }

  async function filterByChapter(chapterCode: string) {
    loading.value = true
    try {
      selectedChapter.value = chapterCode
      const res = await getHSByChapter(chapterCode)
      hscodes.value = res || []
      pagination.value.total = res?.length || 0
    } finally {
      loading.value = false
    }
  }

  async function fetchHistory() {
    try {
      const res = await getSearchHistory()
      searchHistory.value = res || []
    } catch (e) {
      searchHistory.value = ['85171210', '85258013', '61091000', '95030031']
    }
  }

  async function fetchFavorites() {
    try {
      const res = await getFavorites()
      favorites.value = res || []
    } catch (e) {
      favorites.value = []
    }
  }

  async function setFavorite(code: string, isFavorite: boolean) {
    try {
      await toggleFavorite(code, isFavorite)
      if (isFavorite) {
        const codeData = hscodes.value.find(h => h.code === code)
        if (codeData && !favorites.value.some(f => f.code === code)) {
          favorites.value.push(codeData)
        }
      } else {
        favorites.value = favorites.value.filter(f => f.code !== code)
      }
    } catch (e) {
      console.error(e)
    }
  }

  async function fetchRecommendations(code: string) {
    try {
      const res = await getHSRecommendations(code)
      recommendations.value = res || []
    } catch (e) {
      recommendations.value = []
    }
  }

  function isFavorite(code: string) {
    return favoriteCodes.value.includes(code)
  }

  return {
    hscodes,
    currentHSCode,
    chapters,
    searchHistory,
    favorites,
    recommendations,
    searchKeyword,
    selectedChapter,
    loading,
    pagination,
    favoriteCodes,
    search,
    getDetail,
    fetchChapters,
    filterByChapter,
    fetchHistory,
    fetchFavorites,
    setFavorite,
    fetchRecommendations,
    isFavorite
  }
})

export const useTaxStore = defineStore('tax', () => {
  const calcItems = ref<TaxCalcItem[]>([])
  const calcResults = ref<TaxCalcResult[]>([])
  const policyVersions = ref<{ version: string; effectiveDate: string; description: string }[]>([])
  const selectedPolicyVersion = ref<string>('')
  const loading = ref(false)
  const totalRefund = computed(() =>
    calcResults.value.reduce((sum, r) => sum + r.refundAmount, 0)
  )
  const totalTaxBasis = computed(() =>
    calcResults.value.reduce((sum, r) => sum + r.taxBasis, 0)
  )

  function addCalcItem(item: Partial<TaxCalcItem> = {}) {
    calcItems.value.push({
      productName: item.productName || '',
      hsCode: item.hsCode || '',
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      currency: item.currency || 'USD',
      exchangeRate: item.exchangeRate || 7.2
    })
  }

  function removeCalcItem(index: number) {
    calcItems.value.splice(index, 1)
    calcResults.value.splice(index, 1)
  }

  function updateCalcItem(index: number, data: Partial<TaxCalcItem>) {
    if (calcItems.value[index]) {
      calcItems.value[index] = { ...calcItems.value[index], ...data }
    }
  }

  function clearCalcItems() {
    calcItems.value = []
    calcResults.value = []
  }

  async function calculate() {
    loading.value = true
    try {
      const validItems = calcItems.value.filter(item => item.hsCode && item.quantity > 0 && item.unitPrice > 0)
      const res = await calculateTax(validItems, selectedPolicyVersion.value)
      calcResults.value = res || []
      return res
    } finally {
      loading.value = false
    }
  }

  async function fetchPolicyVersions() {
    try {
      const res = await getPolicyVersions()
      policyVersions.value = res || []
      if (policyVersions.value.length > 0 && !selectedPolicyVersion.value) {
        selectedPolicyVersion.value = policyVersions.value[0].version
      }
    } catch (e) {
      policyVersions.value = [
        { version: '2024V1', effectiveDate: '2024-01-01', description: '2024年第一批退税率调整' },
        { version: '2023V3', effectiveDate: '2023-09-01', description: '2023年第三批退税率调整' },
        { version: '2023V1', effectiveDate: '2023-01-01', description: '2023年退税率基础版本' }
      ]
      selectedPolicyVersion.value = policyVersions.value[0].version
    }
  }

  async function getRate(hsCode: string) {
    try {
      return await getRefundRate(hsCode)
    } catch (e) {
      return { rate: 0.13, policyNo: '财税〔2024〕1号', effectiveDate: '2024-01-01' }
    }
  }

  return {
    calcItems,
    calcResults,
    policyVersions,
    selectedPolicyVersion,
    loading,
    totalRefund,
    totalTaxBasis,
    addCalcItem,
    removeCalcItem,
    updateCalcItem,
    clearCalcItems,
    calculate,
    fetchPolicyVersions,
    getRate
  }
})
