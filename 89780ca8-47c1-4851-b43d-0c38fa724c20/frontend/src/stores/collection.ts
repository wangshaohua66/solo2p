import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Collection {
  id: string
  name: string
  image: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  price: number
  previousPrice: number
  description: string
  creator: string
  createdAt: string
  volume24h: number
  owners: number
}

const MOCK_COLLECTIONS: Collection[] = [
  { id: '1', name: 'Cosmic Phoenix', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cosmic%20phoenix%20digital%20art%20neon%20flames&image_size=square', rarity: 'legendary', price: 12.85, previousPrice: 11.2, description: 'A mythical bird reborn from cosmic flames', creator: 'ArtistX', createdAt: '2024-01-15', volume24h: 5240, owners: 42 },
  { id: '2', name: 'Neon Dragon', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=neon%20dragon%20cyberpunk%20digital%20art&image_size=square', rarity: 'epic', price: 8.45, previousPrice: 8.8, description: 'Cyberpunk dragon with glowing circuits', creator: 'PixelMaster', createdAt: '2024-02-20', volume24h: 3120, owners: 68 },
  { id: '3', name: 'Crystal Golem', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=crystal%20golem%20fantasy%20mineral%20art&image_size=square', rarity: 'rare', price: 3.2, previousPrice: 2.9, description: 'A guardian made of enchanted crystals', creator: 'GemCraft', createdAt: '2024-03-10', volume24h: 1890, owners: 156 },
  { id: '4', name: 'Shadow Wolf', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=shadow%20wolf%20dark%20fantasy%20art&image_size=square', rarity: 'rare', price: 2.85, previousPrice: 3.1, description: 'A wolf spirit from the shadow realm', creator: 'DarkArts', createdAt: '2024-04-05', volume24h: 2100, owners: 203 },
  { id: '5', name: 'Aqua Sprite', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=aqua%20sprite%20water%20fairy%20digital&image_size=square', rarity: 'common', price: 0.85, previousPrice: 0.8, description: 'A playful water spirit', creator: 'AquaStudio', createdAt: '2024-05-01', volume24h: 890, owners: 512 },
  { id: '6', name: 'Stellar Knight', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=stellar%20knight%20space%20armor%20sci-fi&image_size=square', rarity: 'epic', price: 6.75, previousPrice: 5.9, description: 'A warrior clad in star-forged armor', creator: 'CosmicForge', createdAt: '2024-01-28', volume24h: 4200, owners: 89 },
  { id: '7', name: 'Ember Fox', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ember%20fox%20fire%20animal%20fantasy&image_size=square', rarity: 'common', price: 1.2, previousPrice: 1.15, description: 'A fox with ember-lit fur', creator: 'FirePaw', createdAt: '2024-06-12', volume24h: 560, owners: 340 },
  { id: '8', name: 'Void Serpent', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=void%20serpent%20dark%20cosmic%20snake&image_size=square', rarity: 'legendary', price: 18.5, previousPrice: 20.1, description: 'A serpent that slithers between dimensions', creator: 'VoidArt', createdAt: '2024-02-14', volume24h: 7800, owners: 28 },
  { id: '9', name: 'Frost Giant', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=frost%20giant%20ice%20warrior%20winter&image_size=square', rarity: 'epic', price: 7.3, previousPrice: 6.8, description: 'An ancient giant from the frozen wastes', creator: 'IceRealm', createdAt: '2024-03-22', volume24h: 3450, owners: 54 },
  { id: '10', name: 'Forest Spirit', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=forest%20spirit%20nature%20glow%20art&image_size=square', rarity: 'common', price: 0.65, previousPrice: 0.7, description: 'A gentle guardian of the woodland', creator: 'NatureDao', createdAt: '2024-04-18', volume24h: 420, owners: 680 },
  { id: '11', name: 'Thunder Hawk', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=thunder%20hawk%20lightning%20bird%20storm&image_size=square', rarity: 'rare', price: 4.1, previousPrice: 3.7, description: 'A majestic hawk wreathed in lightning', creator: 'StormWing', createdAt: '2024-05-10', volume24h: 1780, owners: 124 },
  { id: '12', name: 'Golden Lotus', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=golden%20lotus%20flower%20sacred%20art&image_size=square', rarity: 'legendary', price: 15.2, previousPrice: 14.0, description: 'A sacred flower of immense power', creator: 'SacredArt', createdAt: '2024-06-01', volume24h: 6200, owners: 35 },
]

export const useCollectionStore = defineStore('collection', () => {
  const collections = ref<Collection[]>([])
  const currentCollection = ref<Collection | null>(null)
  const loading = ref(false)
  const search = ref('')
  const rarity = ref<string>('all')
  const sortBy = ref<'price' | 'latest' | 'rarity'>('latest')
  const page = ref(1)
  const hasMore = ref(true)

  const filteredCollections = computed(() => {
    let result = [...collections.value]

    if (search.value) {
      const s = search.value.toLowerCase()
      result = result.filter(c => c.name.toLowerCase().includes(s) || c.creator.toLowerCase().includes(s))
    }

    if (rarity.value !== 'all') {
      result = result.filter(c => c.rarity === rarity.value)
    }

    const rarityOrder: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 }
    if (sortBy.value === 'price') {
      result.sort((a, b) => b.price - a.price)
    } else if (sortBy.value === 'latest') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } else if (sortBy.value === 'rarity') {
      result.sort((a, b) => rarityOrder[b.rarity] - rarityOrder[a.rarity])
    }

    return result
  })

  async function fetchCollections() {
    loading.value = true
    try {
      await new Promise(r => setTimeout(r, 400))
      collections.value = MOCK_COLLECTIONS
      hasMore.value = false
    } finally {
      loading.value = false
    }
  }

  async function fetchCollection(id: string) {
    loading.value = true
    try {
      await new Promise(r => setTimeout(r, 300))
      const found = MOCK_COLLECTIONS.find(c => c.id === id)
      currentCollection.value = found || null
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (loading.value || !hasMore.value) return
    page.value++
    await fetchCollections()
  }

  return {
    collections,
    currentCollection,
    loading,
    search,
    rarity,
    sortBy,
    page,
    hasMore,
    filteredCollections,
    fetchCollections,
    fetchCollection,
    loadMore,
  }
})
