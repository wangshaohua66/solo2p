<template>
  <div class="glass p-4">
    <div class="flex mb-4 rounded-lg overflow-hidden" style="background: rgba(10, 14, 39, 0.6);">
      <button
        class="flex-1 py-2 text-sm font-medium transition-all"
        :style="side === 'buy'
          ? 'background: rgba(0, 212, 170, 0.15); color: var(--green-up); border-bottom: 2px solid var(--green-up);'
          : 'color: var(--text-muted);'"
        @click="side = 'buy'"
      >
        Buy
      </button>
      <button
        class="flex-1 py-2 text-sm font-medium transition-all"
        :style="side === 'sell'
          ? 'background: rgba(255, 71, 87, 0.15); color: var(--red-down); border-bottom: 2px solid var(--red-down);'
          : 'color: var(--text-muted);'"
        @click="side = 'sell'"
      >
        Sell
      </button>
    </div>

    <div class="flex gap-2 mb-4">
      <button
        class="flex-1 py-1.5 text-xs rounded transition-colors"
        :style="orderType === 'limit'
          ? 'background: rgba(212, 168, 83, 0.15); color: var(--gold);'
          : 'color: var(--text-muted); border: 1px solid var(--border-color);'"
        @click="orderType = 'limit'"
      >
        Limit
      </button>
      <button
        class="flex-1 py-1.5 text-xs rounded transition-colors"
        :style="orderType === 'market'
          ? 'background: rgba(212, 168, 83, 0.15); color: var(--gold);'
          : 'color: var(--text-muted); border: 1px solid var(--border-color);'"
        @click="orderType = 'market'"
      >
        Market
      </button>
    </div>

    <div v-if="orderType === 'limit'" class="mb-3">
      <label class="text-xs block mb-1" style="color: var(--text-muted);">Price (ETH)</label>
      <input
        v-model.number="price"
        type="number"
        step="0.01"
        class="w-full font-mono"
        placeholder="0.00"
      />
    </div>

    <div class="mb-3">
      <label class="text-xs block mb-1" style="color: var(--text-muted);">Quantity</label>
      <input
        v-model.number="quantity"
        type="number"
        step="0.1"
        min="0.1"
        class="w-full font-mono"
        placeholder="0.0"
      />
      <input
        v-model.number="quantity"
        type="range"
        min="0.1"
        max="10"
        step="0.1"
        class="w-full mt-2"
        style="accent-color: var(--gold);"
      />
    </div>

    <div class="flex justify-between text-xs mb-4 py-2 px-3 rounded" style="background: rgba(10, 14, 39, 0.6);">
      <span style="color: var(--text-muted);">Total Estimate</span>
      <span class="font-mono font-semibold" style="color: var(--gold);">
        {{ totalEstimate.toFixed(4) }} ETH
      </span>
    </div>

    <button
      class="w-full py-3 rounded-lg font-semibold text-sm transition-all"
      :style="side === 'buy'
        ? 'background: linear-gradient(135deg, #00d4aa, #00b894); color: white; box-shadow: 0 4px 15px rgba(0, 212, 170, 0.3);'
        : 'background: linear-gradient(135deg, #ff4757, #ff6b81); color: white; box-shadow: 0 4px 15px rgba(255, 71, 87, 0.3);'"
      :disabled="tradeStore.loading"
      @click="handleSubmit"
    >
      {{ tradeStore.loading ? 'Processing...' : (side === 'buy' ? 'Buy Now' : 'Sell Now') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTradeStore } from '@/stores/trade'

const tradeStore = useTradeStore()

const side = ref<'buy' | 'sell'>('buy')
const orderType = ref<'limit' | 'market'>('limit')
const price = ref(tradeStore.currentPrice)
const quantity = ref(1)

const totalEstimate = computed(() => {
  const p = orderType.value === 'market' ? tradeStore.currentPrice : price.value
  return p * quantity.value
})

async function handleSubmit() {
  await tradeStore.placeOrder(side.value, orderType.value, price.value, quantity.value)
}
</script>
