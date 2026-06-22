<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold" style="font-family: 'Playfair Display', serif;">My Assets</h1>
        <p class="text-sm mt-1" style="color: var(--text-secondary);">Manage your digital collection</p>
      </div>
      <div class="flex gap-3">
        <div class="glass px-4 py-2 text-center">
          <p class="text-xs" style="color: var(--text-muted);">Total Value</p>
          <p class="text-lg font-bold font-mono" style="color: var(--gold);">{{ assetStore.totalValue.toFixed(2) }} ETH</p>
        </div>
        <div class="glass px-4 py-2 text-center">
          <p class="text-xs" style="color: var(--text-muted);">Profit/Loss</p>
          <p class="text-lg font-bold font-mono" :style="`color: ${assetStore.totalProfit >= 0 ? 'var(--green-up)' : 'var(--red-down)'};`">
            {{ assetStore.totalProfit >= 0 ? '+' : '' }}{{ assetStore.totalProfit.toFixed(2) }} ETH
          </p>
        </div>
      </div>
    </div>

    <div class="flex gap-4 mb-6">
      <div class="flex gap-2">
        <button
          v-for="f in rarityFilters"
          :key="f.value"
          class="px-3 py-1.5 text-xs rounded-lg transition-all"
          :style="assetStore.filterRarity === f.value
            ? 'background: rgba(212, 168, 83, 0.15); color: var(--gold); border: 1px solid var(--gold);'
            : 'border: 1px solid var(--border-color); color: var(--text-muted);'"
          @click="assetStore.filterRarity = f.value"
        >
          {{ f.label }}
        </button>
      </div>
      <select v-model="assetStore.sortBy" class="px-3 py-1.5 text-xs">
        <option value="value">Sort by Value</option>
        <option value="date">Sort by Date</option>
      </select>
    </div>

    <div v-if="assetStore.filteredAssets.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
      <div
        v-for="asset in assetStore.filteredAssets"
        :key="asset.id"
        class="glass-card overflow-hidden cursor-pointer transition-shadow duration-300 hover:shadow-lg fade-in-up"
        style="box-shadow: none;"
        @click="$router.push(`/assets/${asset.id}`)"
      >
        <div class="relative overflow-hidden" style="aspect-ratio: 1;">
          <img :src="asset.image" :alt="asset.name" class="w-full h-full object-cover" />
          <span
            class="absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
            :class="`badge-${asset.rarity}`"
          >
            {{ asset.rarity }}
          </span>
        </div>
        <div class="p-4">
          <h3 class="text-sm font-semibold mb-2" style="color: var(--text-primary);">{{ asset.name }}</h3>
          <div class="flex justify-between text-xs">
            <div>
              <span style="color: var(--text-muted);">Acquired</span>
              <p class="font-mono" style="color: var(--text-secondary);">{{ asset.acquiredAt }}</p>
            </div>
            <div class="text-right">
              <span style="color: var(--text-muted);">Current Value</span>
              <p class="font-mono font-semibold" style="color: var(--gold);">{{ asset.price.toFixed(2) }} ETH</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="assetStore.loading" class="text-center py-20">
      <div class="inline-block w-8 h-8 border-2 rounded-full animate-spin" style="border-color: var(--gold); border-top-color: transparent;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAssetStore } from '@/stores/asset'

const assetStore = useAssetStore()

const rarityFilters = [
  { label: 'All', value: 'all' },
  { label: 'Common', value: 'common' },
  { label: 'Rare', value: 'rare' },
  { label: 'Epic', value: 'epic' },
  { label: 'Legendary', value: 'legendary' },
]

onMounted(() => {
  if (assetStore.myAssets.length === 0) assetStore.fetchMyAssets()
})
</script>
