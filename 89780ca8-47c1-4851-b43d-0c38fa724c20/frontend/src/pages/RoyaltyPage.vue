<template>
  <div>
    <div class="flex items-center gap-4 mb-6">
      <button class="p-2 rounded-lg transition-colors" style="color: var(--text-secondary);" @click="$router.push('/creator')">
        <ArrowLeft :size="20" />
      </button>
      <h1 class="text-2xl font-bold" style="font-family: 'Playfair Display', serif;">Royalty Earnings</h1>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div class="glass-card p-5">
        <p class="text-xs mb-1" style="color: var(--text-muted);">Pending Earnings</p>
        <p class="text-2xl font-bold font-mono" style="color: var(--gold);">{{ pendingAmount.toFixed(2) }} ETH</p>
        <p class="text-xs mt-1" style="color: var(--text-muted);">~${{ (pendingAmount * 3500).toLocaleString() }} USD</p>
      </div>
      <div class="glass-card p-5">
        <p class="text-xs mb-1" style="color: var(--text-muted);">Settled Earnings</p>
        <p class="text-2xl font-bold font-mono" style="color: var(--green-up);">{{ settledAmount.toFixed(2) }} ETH</p>
        <p class="text-xs mt-1" style="color: var(--text-muted);">~${{ (settledAmount * 3500).toLocaleString() }} USD</p>
      </div>
    </div>

    <div class="glass p-5 mb-6">
      <h3 class="text-sm font-semibold mb-4" style="color: var(--text-secondary);">Monthly Earnings Trend</h3>
      <div class="flex items-end gap-2 h-40">
        <div
          v-for="(bar, i) in monthlyBars"
          :key="i"
          class="flex-1 rounded-t transition-all"
          :style="`height: ${bar.height}%; background: linear-gradient(180deg, var(--gold), var(--gold-dark));`"
          :title="`${bar.month}: ${bar.value} ETH`"
        />
      </div>
      <div class="flex gap-2 mt-2">
        <span
          v-for="(bar, i) in monthlyBars"
          :key="i"
          class="flex-1 text-center text-xs"
          style="color: var(--text-muted);"
        >
          {{ bar.month }}
        </span>
      </div>
    </div>

    <div class="glass overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3" style="border-bottom: 1px solid var(--border-color);">
        <h3 class="text-sm font-semibold" style="color: var(--text-secondary);">Settlement History</h3>
        <button class="gold-btn text-xs px-3 py-1">Export CSV</button>
      </div>
      <table class="w-full text-sm">
        <thead>
          <tr>
            <th class="text-left px-4 py-2 text-xs font-medium" style="color: var(--text-muted);">Collection</th>
            <th class="text-left px-4 py-2 text-xs font-medium" style="color: var(--text-muted);">Amount</th>
            <th class="text-left px-4 py-2 text-xs font-medium" style="color: var(--text-muted);">Status</th>
            <th class="text-left px-4 py-2 text-xs font-medium" style="color: var(--text-muted);">Date</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in creatorStore.royaltyEarnings"
            :key="r.id"
            style="border-bottom: 1px solid var(--border-color);"
          >
            <td class="px-4 py-3" style="color: var(--text-primary);">{{ r.collectionName }}</td>
            <td class="px-4 py-3 font-mono" style="color: var(--gold);">{{ r.amount.toFixed(2) }} ETH</td>
            <td class="px-4 py-3">
              <span
                class="px-2 py-0.5 rounded-full text-xs font-semibold"
                :style="r.status === 'settled'
                  ? 'background: rgba(0, 212, 170, 0.2); color: #00d4aa;'
                  : 'background: rgba(243, 156, 18, 0.2); color: #f39c12;'"
              >
                {{ r.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-xs" style="color: var(--text-muted);">{{ r.date }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { useCreatorStore } from '@/stores/creator'

const creatorStore = useCreatorStore()

const pendingAmount = computed(() => creatorStore.royaltyEarnings.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0))
const settledAmount = computed(() => creatorStore.royaltyEarnings.filter(r => r.status === 'settled').reduce((s, r) => s + r.amount, 0))

const monthlyBars = [
  { month: 'Jan', value: 1.2, height: 30 },
  { month: 'Feb', value: 1.8, height: 45 },
  { month: 'Mar', value: 2.1, height: 52 },
  { month: 'Apr', value: 1.5, height: 38 },
  { month: 'May', value: 2.8, height: 70 },
  { month: 'Jun', value: 4.2, height: 100 },
]

onMounted(() => {
  creatorStore.fetchRoyaltyEarnings()
})
</script>
