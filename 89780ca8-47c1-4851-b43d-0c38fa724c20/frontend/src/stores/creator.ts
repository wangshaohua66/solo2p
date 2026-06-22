import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface PublishForm {
  name: string
  description: string
  image: File | null
  imageUrl: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  limitedCount: number
  royaltyRate: number
}

export interface SubmittedCollection {
  id: string
  name: string
  status: 'pending' | 'reviewing' | 'approved' | 'rejected'
  submittedAt: string
  rarity: string
  count: number
}

export interface RoyaltyRecord {
  id: string
  collectionName: string
  amount: number
  status: 'pending' | 'settled'
  date: string
}

const MOCK_SUBMITTED: SubmittedCollection[] = [
  { id: 's1', name: 'Mystic Unicorn', status: 'approved', submittedAt: '2024-05-10', rarity: 'legendary', count: 100 },
  { id: 's2', name: 'Blade Dancer', status: 'reviewing', submittedAt: '2024-06-01', rarity: 'epic', count: 200 },
  { id: 's3', name: 'Stone Guardian', status: 'pending', submittedAt: '2024-06-15', rarity: 'rare', count: 500 },
  { id: 's4', name: 'Wind Runner', status: 'rejected', submittedAt: '2024-04-20', rarity: 'common', count: 1000 },
]

const MOCK_ROYALTIES: RoyaltyRecord[] = [
  { id: 'r1', collectionName: 'Mystic Unicorn', amount: 2.35, status: 'settled', date: '2024-06-01' },
  { id: 'r2', collectionName: 'Mystic Unicorn', amount: 1.82, status: 'settled', date: '2024-06-02' },
  { id: 'r3', collectionName: 'Mystic Unicorn', amount: 3.10, status: 'pending', date: '2024-06-15' },
  { id: 'r4', collectionName: 'Mystic Unicorn', amount: 0.95, status: 'pending', date: '2024-06-18' },
]

export const useCreatorStore = defineStore('creator', () => {
  const publishStep = ref(0)
  const publishForm = ref<PublishForm>({
    name: '',
    description: '',
    image: null,
    imageUrl: '',
    rarity: 'rare',
    limitedCount: 100,
    royaltyRate: 10,
  })
  const myCollections = ref<SubmittedCollection[]>([])
  const royaltyEarnings = ref<RoyaltyRecord[]>([])
  const loading = ref(false)

  async function submitCollection() {
    loading.value = true
    try {
      await new Promise(r => setTimeout(r, 1200))
      myCollections.value.unshift({
        id: `s-${Date.now()}`,
        name: publishForm.value.name,
        status: 'pending',
        submittedAt: new Date().toISOString().split('T')[0],
        rarity: publishForm.value.rarity,
        count: publishForm.value.limitedCount,
      })
      publishStep.value = 0
      publishForm.value = { name: '', description: '', image: null, imageUrl: '', rarity: 'rare', limitedCount: 100, royaltyRate: 10 }
    } finally {
      loading.value = false
    }
  }

  async function fetchMyCollections() {
    loading.value = true
    try {
      await new Promise(r => setTimeout(r, 400))
      myCollections.value = MOCK_SUBMITTED
    } finally {
      loading.value = false
    }
  }

  async function fetchRoyaltyEarnings() {
    loading.value = true
    try {
      await new Promise(r => setTimeout(r, 400))
      royaltyEarnings.value = MOCK_ROYALTIES
    } finally {
      loading.value = false
    }
  }

  function nextStep() {
    if (publishStep.value < 3) publishStep.value++
  }

  function prevStep() {
    if (publishStep.value > 0) publishStep.value--
  }

  return {
    publishStep,
    publishForm,
    myCollections,
    royaltyEarnings,
    loading,
    submitCollection,
    fetchMyCollections,
    fetchRoyaltyEarnings,
    nextStep,
    prevStep,
  }
})
