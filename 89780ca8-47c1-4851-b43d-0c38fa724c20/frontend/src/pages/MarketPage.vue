<template>
  <div>
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2" style="font-family: 'Playfair Display', serif;">Digital Collectible Market</h1>
      <p class="text-sm" style="color: var(--text-secondary);">Discover, collect, and trade unique digital assets</p>
    </div>

    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <div class="flex-1 relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2" :size="18" style="color: var(--text-muted);" />
        <input
          v-model="store.search"
          class="w-full pl-10"
          placeholder="Search collections..."
        />
      </div>

      <div class="flex gap-2 flex-wrap">
        <button
          v-for="f in filters"
          :key="f.value"
          class="px-3 py-2 text-xs rounded-lg transition-all"
          :style="store.rarity === f.value
            ? 'background: rgba(212, 168, 83, 0.15); color: var(--gold); border: 1px solid var(--gold);'
            : 'border: 1px solid var(--border-color); color: var(--text-muted);'"
          @click="store.rarity = f.value"
        >
          {{ f.label }}
        </button>
      </div>

      <select
        v-model="store.sortBy"
        class="px-3 py-2 text-xs"
      >
        <option value="latest">Latest</option>
        <option value="price">Price</option>
        <option value="rarity">Rarity</option>
      </select>
    </div>

    <div
      v-if="store.filteredCollections.length > 0"
      class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5"
    >
      <CollectionCard
        v-for="item in store.filteredCollections"
        :key="item.id"
        :item="item"
        class="fade-in-up"
      />
    </div>

    <div v-else-if="store.loading" class="text-center py-20">
      <div class="inline-block w-8 h-8 border-2 rounded-full animate-spin" style="border-color: var(--gold); border-top-color: transparent;"></div>
      <p class="mt-3 text-sm" style="color: var(--text-muted);">Loading collections...</p>
    </div>

    <div v-else class="text-center py-20">
      <p class="text-sm" style="color: var(--text-muted);">No collections found</p>
    </div>

    <div v-if="store.hasMore" class="text-center mt-8">
      <button class="gold-btn text-sm" @click="store.loadMore()">Load More</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { Search } from 'lucide-vue-next'
import { useCollectionStore } from '@/stores/collection'
import CollectionCard from '@/components/CollectionCard.vue'

const store = useCollectionStore()

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Common', value: 'common' },
  { label: 'Rare', value: 'rare' },
  { label: 'Epic', value: 'epic' },
  { label: 'Legendary', value: 'legendary' },
]

onMounted(() => {
  if (store.collections.length === 0) store.fetchCollections()
})
</script>
