import { defineStore } from 'pinia'
import type { Topic, ReviewItem, Material, Task } from '@/types'
import { getTopicList, getTopicDetail, createTopic, updateTopic, submitTopic, reviewTopic } from '@/api/topic'
import { getReviewList, submitReview } from '@/api/review'
import { getMaterialList, uploadMaterial } from '@/api/material'

export const useWorkflowStore = defineStore('workflow', {
  state: () => ({
    topics: [] as Topic[],
    topicsTotal: 0,
    currentTopic: null as Topic | null,
    reviews: [] as ReviewItem[],
    reviewsTotal: 0,
    materials: [] as Material[],
    materialsTotal: 0,
    tasks: [] as Task[],
    loading: {
      topics: false,
      topicDetail: false,
      reviews: false,
      materials: false,
      upload: false
    },
    filters: {
      topicStatus: undefined as Topic['status'] | undefined,
      programType: undefined as string | undefined,
      channel: undefined as string | undefined,
      keyword: ''
    }
  }),
  getters: {
    pendingReviewCount: (state) => {
      return state.reviews.filter(r => r.status === 'pending' || r.status === 'reviewing').length
    },
    topicsByStatus: (state) => {
      const grouped: Record<string, Topic[]> = {}
      state.topics.forEach(topic => {
        if (!grouped[topic.status]) {
          grouped[topic.status] = []
        }
        grouped[topic.status].push(topic)
      })
      return grouped
    }
  },
  actions: {
    async fetchTopics(params: {
      page: number
      pageSize: number
      status?: Topic['status']
      programType?: string
      channel?: string
      keyword?: string
    }) {
      this.loading.topics = true
      try {
        const res = await getTopicList(params)
        this.topics = res.list
        this.topicsTotal = res.total
        return res
      } finally {
        this.loading.topics = false
      }
    },
    
    async fetchTopicDetail(id: number) {
      this.loading.topicDetail = true
      try {
        const topic = await getTopicDetail(id)
        this.currentTopic = topic
        return topic
      } finally {
        this.loading.topicDetail = false
      }
    },
    
    async createNewTopic(data: Partial<Topic>) {
      const newTopic = await createTopic(data)
      this.topics.unshift(newTopic)
      return newTopic
    },
    
    async updateExistingTopic(id: number, data: Partial<Topic>) {
      const updated = await updateTopic(id, data)
      const index = this.topics.findIndex(t => t.id === id)
      if (index !== -1) {
        this.topics[index] = updated
      }
      if (this.currentTopic?.id === id) {
        this.currentTopic = updated
      }
      return updated
    },
    
    async submitTopicForReview(id: number) {
      await submitTopic(id)
      await this.fetchTopicDetail(id)
      const index = this.topics.findIndex(t => t.id === id)
      if (index !== -1) {
        this.topics[index].status = 'submitted'
      }
    },
    
    async reviewTopicItem(id: number, data: { status: 'approved' | 'rejected'; remark: string }) {
      await reviewTopic(id, data)
      await this.fetchTopicDetail(id)
    },
    
    async fetchReviews(params: {
      page: number
      pageSize: number
      status?: ReviewItem['status']
      type?: ReviewItem['type']
      currentLevel?: number
    }) {
      this.loading.reviews = true
      try {
        const res = await getReviewList(params)
        this.reviews = res.list
        this.reviewsTotal = res.total
        return res
      } finally {
        this.loading.reviews = false
      }
    },
    
    async submitReviewItem(itemId: number, data: {
      level: number
      status: 'approved' | 'rejected'
      comment: string
      version?: string
    }) {
      const result = await submitReview(itemId, data)
      const index = this.reviews.findIndex(r => r.id === itemId)
      if (index !== -1) {
        this.reviews[index].reviews.push(result)
      }
      return result
    },
    
    async fetchMaterials(params: {
      page: number
      pageSize: number
      type?: Material['type']
      keyword?: string
      tags?: string[]
    }) {
      this.loading.materials = true
      try {
        const res = await getMaterialList(params)
        this.materials = res.list
        this.materialsTotal = res.total
        return res
      } finally {
        this.loading.materials = false
      }
    },
    
    async uploadNewMaterial(
      file: File,
      onProgress?: (percent: number) => void,
      params?: { tags?: string[]; description?: string }
    ) {
      this.loading.upload = true
      try {
        const material = await uploadMaterial(file, onProgress, params)
        this.materials.unshift(material)
        return material
      } finally {
        this.loading.upload = false
      }
    },
    
    setFilters(filters: Partial<typeof this.filters>) {
      this.filters = { ...this.filters, ...filters }
    },
    
    clearCurrentTopic() {
      this.currentTopic = null
    }
  }
})
