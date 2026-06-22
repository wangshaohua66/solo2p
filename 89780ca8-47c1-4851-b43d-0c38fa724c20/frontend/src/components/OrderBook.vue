<template>
  <div class="glass p-4" style="min-width: 280px;">
    <h3 class="text-sm font-semibold mb-3" style="color: var(--text-secondary);">Order Book</h3>

    <div class="mb-2">
      <div class="flex text-xs mb-1" style="color: var(--text-muted);">
        <span class="flex-1">Price (ETH)</span>
        <span class="flex-1 text-right">Quantity</span>
        <span class="flex-1 text-right">Total</span>
      </div>
    </div>

    <div class="space-y-0.5 mb-3">
      <div
        v-for="(ask, i) in orderBook.asks"
        :key="'a' + i"
        class="relative flex items-center text-xs py-1 px-1 rounded"
        :class="flashAsk[i] ? 'flash-red' : ''"
      >
        <div
          class="absolute right-0 top-0 bottom-0 rounded"
          style="background: rgba(255, 71, 87, 0.1);"
          :style="`width: ${(ask.quantity / maxAskQty) * 100}%;`"
        />
        <span class="flex-1 relative font-mono" style="color: var(--red-down);">{{ ask.price.toFixed(2) }}</span>
        <span class="flex-1 text-right relative font-mono" style="color: var(--text-secondary);">{{ ask.quantity }}</span>
        <span class="flex-1 text-right relative font-mono" style="color: var(--text-muted);">{{ ask.total.toFixed(1) }}</span>
      </div>
    </div>

    <div class="text-center py-2 font-mono text-lg font-bold" style="color: var(--gold);">
      {{ currentPrice.toFixed(2) }}
      <span class="text-xs font-normal" style="color: var(--text-muted);">ETH</span>
    </div>

    <div class="space-y-0.5 mt-3">
      <div
        v-for="(bid, i) in orderBook.bids"
        :key="'b' + i"
        class="relative flex items-center text-xs py-1 px-1 rounded"
        :class="flashBid[i] ? 'flash-green' : ''"
      >
        <div
          class="absolute left-0 top-0 bottom-0 rounded"
          style="background: rgba(0, 212, 170, 0.1);"
          :style="`width: ${(bid.quantity / maxBidQty) * 100}%;`"
        />
        <span class="flex-1 relative font-mono" style="color: var(--green-up);">{{ bid.price.toFixed(2) }}</span>
        <span class="flex-1 text-right relative font-mono" style="color: var(--text-secondary);">{{ bid.quantity }}</span>
        <span class="flex-1 text-right relative font-mono" style="color: var(--text-muted);">{{ bid.total.toFixed(1) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTradeStore } from '@/stores/trade'

const tradeStore = useTradeStore()

const orderBook = computed(() => tradeStore.orderBook)
const currentPrice = computed(() => tradeStore.currentPrice)

const maxAskQty = computed(() => Math.max(...orderBook.value.asks.map(a => a.quantity)))
const maxBidQty = computed(() => Math.max(...orderBook.value.bids.map(b => b.quantity)))

const flashAsk = ref<boolean[]>(new Array(10).fill(false))
const flashBid = ref<boolean[]>(new Array(10).fill(false))

watch(() => orderBook.value.asks[0]?.price, () => {
  flashAsk.value = flashAsk.value.map(() => true)
  setTimeout(() => { flashAsk.value = flashAsk.value.map(() => false) }, 600)
})

watch(() => orderBook.value.bids[0]?.price, () => {
  flashBid.value = flashBid.value.map(() => true)
  setTimeout(() => { flashBid.value = flashBid.value.map(() => false) }, 600)
})
</script>
