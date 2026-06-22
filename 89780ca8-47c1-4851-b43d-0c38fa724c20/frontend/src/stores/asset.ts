import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Collection } from './collection'

export interface MyAsset extends Collection {
  acquiredAt: string
  acquiredPrice: number
  tokenId: string
}

const MOCK_ASSETS: MyAsset[] = [
  { id: '1', name: 'Cosmic Phoenix', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cosmic%20phoenix%20digital%20art%20neon%20flames&image_size=square', rarity: 'legendary', price: 12.85, previousPrice: 11.2, description: 'A mythical bird reborn from cosmic flames', creator: 'ArtistX', createdAt: '2024-01-15', volume24h: 5240, owners: 42, acquiredAt: '2024-02-10', acquiredPrice: 9.5, tokenId: 'TK-0001' },
  { id: '2', name: 'Neon Dragon', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=neon%20dragon%20cyberpunk%20digital%20art&image_size=square', rarity: 'epic', price: 8.45, previousPrice: 8.8, description: 'Cyberpunk dragon with glowing circuits', creator: 'PixelMaster', createdAt: '2024-02-20', volume24h: 3120, owners: 68, acquiredAt: '2024-03-15', acquiredPrice: 6.2, tokenId: 'TK-0002' },
  { id: '3', name: 'Crystal Golem', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=crystal%20golem%20fantasy%20mineral%20art&image_size=square', rarity: 'rare', price: 3.2, previousPrice: 2.9, description: 'A guardian made of enchanted crystals', creator: 'GemCraft', createdAt: '2024-03-10', volume24h: 1890, owners: 156, acquiredAt: '2024-04-01', acquiredPrice: 2.8, tokenId: 'TK-0003' },
  { id: '6', name: 'Stellar Knight', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=stellar%20knight%20space%20armor%20sci-fi&image_size=square', rarity: 'epic', price: 6.75, previousPrice: 5.9, description: 'A warrior clad in star-forged armor', creator: 'CosmicForge', createdAt: '2024-01-28', volume24h: 4200, owners: 89, acquiredAt: '2024-05-20', acquiredPrice: 5.5, tokenId: 'TK-0006' },
  { id: '8', name: 'Void Serpent', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=void%20serpent%20dark%20cosmic%20snake&image_size=square', rarity: 'legendary', price: 18.5, previousPrice: 20.1, description: 'A serpent that slithers between dimensions', creator: 'VoidArt', createdAt: '2024-02-14', volume24h: 7800, owners: 28, acquiredAt: '2024-03-28', acquiredPrice: 16.0, tokenId: 'TK-0008' },
  { id: '5', name: 'Aqua Sprite', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=aqua%20sprite%20water%20fairy%20digital&image_size=square', rarity: 'common', price: 0.85, previousPrice: 0.8, description: 'A playful water spirit', creator: 'AquaStudio', createdAt: '2024-05-01', volume24h: 890, owners: 512, acquiredAt: '2024-06-05', acquiredPrice: 0.6, tokenId: 'TK-0005' },
]

export const useAssetStore = defineStore('asset', () => {
  const myAssets = ref<MyAsset[]>([])
  const loading = ref(false)
  const filterRarity = ref('all')
  const sortBy = ref<'value' | 'date'>('value')

  const totalValue = computed(() => myAssets.value.reduce((s, a) => s + a.price, 0))
  const totalProfit = computed(() => myAssets.value.reduce((s, a) => s + (a.price - a.acquiredPrice), 0))

  const filteredAssets = computed(() => {
    let result = [...myAssets.value]
    if (filterRarity.value !== 'all') {
      result = result.filter(a => a.rarity === filterRarity.value)
    }
    if (sortBy.value === 'value') {
      result.sort((a, b) => b.price - a.price)
    } else {
      result.sort((a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime())
    }
    return result
  })

  async function fetchMyAssets() {
    loading.value = true
    try {
      await new Promise(r => setTimeout(r, 400))
      myAssets.value = MOCK_ASSETS
    } finally {
      loading.value = false
    }
  }

  async function transferAsset(assetId: string, toAddress: string) {
    await new Promise(r => setTimeout(r, 800))
    console.log('Transfer:', assetId, toAddress)
    return { success: true }
  }

  async function exportAsset(assetId: string) {
    await new Promise(r => setTimeout(r, 600))
    console.log('Export:', assetId)
    return { success: true, exportUrl: 'https://example.com/export/' + assetId }
  }

  return {
    myAssets,
    loading,
    filterRarity,
    sortBy,
    totalValue,
    totalProfit,
    filteredAssets,
    fetchMyAssets,
    transferAsset,
    exportAsset,
  }
})
