<template>
  <div>
    <h1 class="text-3xl font-bold mb-6" style="font-family: 'Playfair Display', serif;">Risk Management</h1>

    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <select v-model="filterSeverity" class="px-3 py-2 text-xs">
        <option value="all">All Severity</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select v-model="filterType" class="px-3 py-2 text-xs">
        <option value="all">All Types</option>
        <option value="wash_trading">Wash Trading</option>
        <option value="price_manipulation">Price Manipulation</option>
        <option value="suspicious_volume">Suspicious Volume</option>
        <option value="fake_listing">Fake Listing</option>
      </select>
      <select v-model="filterStatus" class="px-3 py-2 text-xs">
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="resolved">Resolved</option>
      </select>
    </div>

    <div class="space-y-4 mb-8">
      <RiskAlertCard
        v-for="alert in filteredAlerts"
        :key="alert.id"
        :alert="alert"
        @resolve="handleResolve"
        @freeze="handleFreeze"
      />
    </div>

    <div class="glass p-5">
      <h3 class="text-base font-semibold mb-4" style="font-family: 'Playfair Display', serif; color: var(--text-primary);">Account Management</h3>
      <div class="space-y-3">
        <div
          v-for="account in accounts"
          :key="account.address"
          class="flex items-center justify-between p-3 rounded-lg"
          style="background: rgba(10, 14, 39, 0.6);"
        >
          <div>
            <p class="text-sm font-mono" style="color: var(--text-primary);">{{ account.address }}</p>
            <p class="text-xs" style="color: var(--text-muted);">{{ account.name }} · {{ account.alerts }} alerts</p>
          </div>
          <div class="flex items-center gap-2">
            <span
              class="px-2 py-0.5 rounded-full text-xs font-semibold"
              :style="account.frozen
                ? 'background: rgba(255, 71, 87, 0.2); color: #ff4757;'
                : 'background: rgba(0, 212, 170, 0.2); color: #00d4aa;'"
            >
              {{ account.frozen ? 'Frozen' : 'Active' }}
            </span>
            <button
              class="px-3 py-1 text-xs rounded transition-colors"
              :style="account.frozen
                ? 'border: 1px solid var(--green-up); color: var(--green-up);'
                : 'border: 1px solid var(--red-down); color: var(--red-down);'"
              @click="account.frozen = !account.frozen"
            >
              {{ account.frozen ? 'Unfreeze' : 'Freeze' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import RiskAlertCard from '@/components/RiskAlertCard.vue'
import type { RiskAlert } from '@/components/RiskAlertCard.vue'

const filterSeverity = ref('all')
const filterType = ref('all')
const filterStatus = ref('all')

const alerts = ref<RiskAlert[]>([
  { id: 'ra1', severity: 'high', type: 'wash_trading', detail: 'Detected circular trading pattern between addresses 0x7a2b... and 0x3f1c... with 12 transactions in 2 hours', timestamp: '2024-06-18 14:32', status: 'active' },
  { id: 'ra2', severity: 'high', type: 'price_manipulation', detail: 'Cosmic Phoenix price spiked 340% within 5 minutes with no news catalyst. Suspected wash trading to inflate floor price.', timestamp: '2024-06-18 11:20', status: 'active' },
  { id: 'ra3', severity: 'medium', type: 'suspicious_volume', detail: 'Neon Dragon trading volume increased 850% above 7-day average. 78% of volume from 3 wallets.', timestamp: '2024-06-17 09:45', status: 'active' },
  { id: 'ra4', severity: 'medium', type: 'fake_listing', detail: 'Multiple listings for Crystal Golem at 0.01 ETH detected — likely phishing attempt to lure buyers.', timestamp: '2024-06-17 16:10', status: 'resolved' },
  { id: 'ra5', severity: 'low', type: 'suspicious_volume', detail: 'Aqua Sprite volume spike of 200% — monitoring for continued pattern.', timestamp: '2024-06-16 22:30', status: 'active' },
  { id: 'ra6', severity: 'low', type: 'wash_trading', detail: 'Minor self-trading detected on Forest Spirit — flagged for observation.', timestamp: '2024-06-16 08:15', status: 'resolved' },
])

const filteredAlerts = computed(() => {
  return alerts.value.filter(a => {
    if (filterSeverity.value !== 'all' && a.severity !== filterSeverity.value) return false
    if (filterType.value !== 'all' && a.type !== filterType.value) return false
    if (filterStatus.value !== 'all' && a.status !== filterStatus.value) return false
    return true
  })
})

const accounts = ref([
  { address: '0x7a2b8c9d4e5f6a1b2c3d4e5f6a7b8c9d0e1f2a3b', name: 'SuspectAlpha', frozen: false, alerts: 5 },
  { address: '0x3f1c5d8a9b2e4f6a7c8d9e0f1a2b3c4d5e6f7a8b', name: 'WashTrader42', frozen: true, alerts: 12 },
  { address: '0x9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d', name: 'VolumeBot', frozen: false, alerts: 3 },
])

function handleResolve(id: string) {
  const alert = alerts.value.find(a => a.id === id)
  if (alert) alert.status = 'resolved'
}

function handleFreeze(id: string) {
  console.log('Freeze account associated with alert:', id)
}
</script>
