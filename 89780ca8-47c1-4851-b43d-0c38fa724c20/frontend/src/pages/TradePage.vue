<template>
  <div>
    <div class="flex items-center gap-4 mb-6">
      <button class="p-2 rounded-lg transition-colors" style="color: var(--text-secondary);" @click="$router.push('/')">
        <ArrowLeft :size="20" />
      </button>
      <div v-if="collection" class="flex items-center gap-3">
        <img :src="collection.image" class="w-10 h-10 rounded-lg object-cover" />
        <div>
          <h1 class="text-xl font-bold" style="font-family: 'Playfair Display', serif;">{{ collection.name }}</h1>
          <div class="flex items-center gap-2">
            <span class="text-xs" style="color: var(--text-muted);">by {{ collection.creator }}</span>
            <span
              class="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
              :class="`badge-${collection.rarity}`"
            >
              {{ collection.rarity }}
            </span>
          </div>
        </div>
      </div>
      <div class="ml-auto flex items-center gap-4">
        <div class="text-right">
          <p class="text-xs" style="color: var(--text-muted);">Current Price</p>
          <p class="text-xl font-bold font-mono" style="color: var(--gold);">{{ tradeStore.currentPrice.toFixed(2) }} ETH</p>
        </div>
        <div :style="`color: ${priceChange >= 0 ? 'var(--green-up)' : 'var(--red-down)'};`" class="text-sm font-medium">
          {{ priceChange >= 0 ? '+' : '' }}{{ priceChange.toFixed(2) }}%
        </div>
      </div>
    </div>

    <div class="flex gap-4 mb-4" style="min-height: 420px;">
      <div class="w-2/5">
        <OrderBook />
      </div>
      <div class="flex-1">
        <KLineChart />
      </div>
    </div>

    <TradeForm />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { useCollectionStore } from '@/stores/collection'
import { useTradeStore } from '@/stores/trade'
import OrderBook from '@/components/OrderBook.vue'
import KLineChart from '@/components/KLineChart.vue'
import TradeForm from '@/components/TradeForm.vue'

const route = useRoute()
const collectionStore = useCollectionStore()
const tradeStore = useTradeStore()

const collection = computed(() => collectionStore.currentCollection)
const priceChange = computed(() => {
  if (!collection.value || collection.value.previousPrice === 0) return 0
  return ((tradeStore.currentPrice - collection.value.previousPrice) / collection.value.previousPrice) * 100
})

onMounted(async () => {
  const id = route.params.id as string
  await collectionStore.fetchCollection(id)
  if (collection.value) {
    tradeStore.setCurrentPrice(collection.value.price)
  }
  tradeStore.connectWebSocket()
})

onUnmounted(() => {
  tradeStore.disconnectWebSocket()
})
</script>
