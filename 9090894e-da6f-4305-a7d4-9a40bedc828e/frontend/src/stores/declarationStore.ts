import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Declaration,
  DeclarationFilter,
  Pagination,
  DeclarationStatus,
  DeclarationItem
} from '@/types'
import {
  getDeclarationList,
  createDeclaration,
  updateDeclaration,
  deleteDeclaration,
  submitDeclaration,
  batchSubmitDeclarations,
  withdrawDeclaration
} from '@/api/declaration'

export const useDeclarationStore = defineStore('declaration', () => {
  const declarations = ref<Declaration[]>([])
  const currentDeclaration = ref<Declaration | null>(null)
  const selectedIds = ref<string[]>([])
  const loading = ref(false)
  const filter = ref<DeclarationFilter>({
    keyword: '',
    status: '',
    platform: '',
    declareType: '',
    dateRange: null,
    enterpriseName: ''
  })
  const pagination = ref<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0
  })

  const selectedCount = computed(() => selectedIds.value.length)
  const allSelected = computed(
    () => declarations.value.length > 0 && selectedIds.value.length === declarations.value.length
  )
  const isSomeSelected = computed(
    () => selectedIds.value.length > 0 && selectedIds.value.length < declarations.value.length
  )

  const selectedDeclarations = computed(() =>
    declarations.value.filter(d => selectedIds.value.includes(d.id))
  )

  function setFilter(newFilter: Partial<DeclarationFilter>) {
    filter.value = { ...filter.value, ...newFilter }
  }

  function resetFilter() {
    filter.value = {
      keyword: '',
      status: '',
      platform: '',
      declareType: '',
      dateRange: null,
      enterpriseName: ''
    }
  }

  function setPagination(newPagination: Partial<Pagination>) {
    pagination.value = { ...pagination.value, ...newPagination }
  }

  function toggleSelect(id: string) {
    const index = selectedIds.value.indexOf(id)
    if (index === -1) {
      selectedIds.value.push(id)
    } else {
      selectedIds.value.splice(index, 1)
    }
  }

  function toggleSelectAll() {
    if (allSelected.value) {
      selectedIds.value = []
    } else {
      selectedIds.value = declarations.value.map(d => d.id)
    }
  }

  function clearSelection() {
    selectedIds.value = []
  }

  async function fetchDeclarations() {
    loading.value = true
    try {
      const res = await getDeclarationList(filter.value, pagination.value)
      declarations.value = res.list || []
      pagination.value.total = res.total || 0
    } finally {
      loading.value = false
    }
  }

  async function fetchDeclaration(id: string) {
    loading.value = true
    try {
      const res = await fetch(`/api/declarations/${id}`)
      currentDeclaration.value = await res.json()
      return currentDeclaration.value
    } finally {
      loading.value = false
    }
  }

  async function addDeclaration(data: Partial<Declaration>) {
    loading.value = true
    try {
      const res = await createDeclaration(data)
      declarations.value.unshift(res)
      pagination.value.total += 1
      return res
    } finally {
      loading.value = false
    }
  }

  async function editDeclaration(id: string, data: Partial<Declaration>) {
    loading.value = true
    try {
      const res = await updateDeclaration(id, data)
      const index = declarations.value.findIndex(d => d.id === id)
      if (index !== -1) {
        declarations.value[index] = res
      }
      return res
    } finally {
      loading.value = false
    }
  }

  async function removeDeclaration(id: string) {
    loading.value = true
    try {
      await deleteDeclaration(id)
      declarations.value = declarations.value.filter(d => d.id !== id)
      selectedIds.value = selectedIds.value.filter(sid => sid !== id)
      pagination.value.total -= 1
    } finally {
      loading.value = false
    }
  }

  async function submit(id: string) {
    loading.value = true
    try {
      const res = await submitDeclaration(id)
      const index = declarations.value.findIndex(d => d.id === id)
      if (index !== -1) {
        declarations.value[index] = res
      }
      return res
    } finally {
      loading.value = false
    }
  }

  async function batchSubmit() {
    loading.value = true
    try {
      const res = await batchSubmitDeclarations(selectedIds.value)
      res.forEach(updated => {
        const index = declarations.value.findIndex(d => d.id === updated.id)
        if (index !== -1) {
          declarations.value[index] = updated
        }
      })
      clearSelection()
      return res
    } finally {
      loading.value = false
    }
  }

  async function withdraw(id: string, reason: string) {
    loading.value = true
    try {
      const res = await withdrawDeclaration(id, reason)
      const index = declarations.value.findIndex(d => d.id === id)
      if (index !== -1) {
        declarations.value[index] = res
      }
      return res
    } finally {
      loading.value = false
    }
  }

  function generateDeclareNo() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `CB${year}${month}${day}${rand}`
  }

  function calculateTotals(items: DeclarationItem[]) {
    let totalAmount = 0
    let taxRefundAmount = 0
    items.forEach(item => {
      totalAmount += item.totalAmount
      taxRefundAmount += item.totalAmount * 0.13
    })
    return { totalAmount, taxRefundAmount }
  }

  return {
    declarations,
    currentDeclaration,
    selectedIds,
    loading,
    filter,
    pagination,
    selectedCount,
    allSelected,
    isSomeSelected,
    selectedDeclarations,
    setFilter,
    resetFilter,
    setPagination,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    fetchDeclarations,
    fetchDeclaration,
    addDeclaration,
    editDeclaration,
    removeDeclaration,
    submit,
    batchSubmit,
    withdraw,
    generateDeclareNo,
    calculateTotals
  }
})
