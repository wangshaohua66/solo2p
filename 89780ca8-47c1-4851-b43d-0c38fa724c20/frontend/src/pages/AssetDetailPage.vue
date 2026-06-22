<template>
  <div>
    <div class="flex items-center gap-4 mb-6">
      <button class="p-2 rounded-lg transition-colors" style="color: var(--text-secondary);" @click="$router.push('/assets')">
        <ArrowLeft :size="20" />
      </button>
      <h1 class="text-2xl font-bold" style="font-family: 'Playfair Display', serif;">Asset Detail</h1>
    </div>

    <div v-if="asset" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <div class="glass-card overflow-hidden mb-6">
          <img :src="asset.image" :alt="asset.name" class="w-full" style="aspect-ratio: 1; object-fit: cover;" />
        </div>
        <div class="flex gap-3">
          <button class="gold-btn flex-1 text-sm" @click="showTransfer = true">
            <span class="flex items-center justify-center gap-2">
              <Send :size="16" /> Transfer
            </span>
          </button>
          <button
            class="flex-1 text-sm py-2 px-4 rounded-lg font-semibold transition-all"
            style="border: 1px solid var(--gold); color: var(--gold);"
            @click="handleExport"
          >
            <span class="flex items-center justify-center gap-2">
              <Download :size="16" /> Export
            </span>
          </button>
        </div>
      </div>

      <div>
        <div class="glass p-5 mb-6">
          <h2 class="text-xl font-bold mb-4" style="font-family: 'Playfair Display', serif; color: var(--gold);">{{ asset.name }}</h2>
          <p class="text-sm mb-4" style="color: var(--text-secondary);">{{ asset.description }}</p>
          <div class="space-y-3">
            <div class="flex justify-between py-2 border-b" style="border-color: var(--border-color);">
              <span class="text-sm" style="color: var(--text-muted);">Token ID</span>
              <span class="text-sm font-mono" style="color: var(--text-primary);">{{ asset.tokenId }}</span>
            </div>
            <div class="flex justify-between py-2 border-b" style="border-color: var(--border-color);">
              <span class="text-sm" style="color: var(--text-muted);">Rarity</span>
              <span
                class="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                :class="`badge-${asset.rarity}`"
              >
                {{ asset.rarity }}
              </span>
            </div>
            <div class="flex justify-between py-2 border-b" style="border-color: var(--border-color);">
              <span class="text-sm" style="color: var(--text-muted);">Creator</span>
              <span class="text-sm" style="color: var(--text-primary);">{{ asset.creator }}</span>
            </div>
            <div class="flex justify-between py-2 border-b" style="border-color: var(--border-color);">
              <span class="text-sm" style="color: var(--text-muted);">Current Value</span>
              <span class="text-sm font-mono font-semibold" style="color: var(--gold);">{{ asset.price.toFixed(2) }} ETH</span>
            </div>
            <div class="flex justify-between py-2 border-b" style="border-color: var(--border-color);">
              <span class="text-sm" style="color: var(--text-muted);">Acquired Price</span>
              <span class="text-sm font-mono" style="color: var(--text-secondary);">{{ asset.acquiredPrice.toFixed(2) }} ETH</span>
            </div>
            <div class="flex justify-between py-2">
              <span class="text-sm" style="color: var(--text-muted);">Acquired Date</span>
              <span class="text-sm" style="color: var(--text-secondary);">{{ asset.acquiredAt }}</span>
            </div>
          </div>
        </div>

        <ProvenanceTimeline :events="provenanceEvents" />
      </div>
    </div>

    <div v-if="showTransfer" class="fixed inset-0 flex items-center justify-center z-50" style="background: rgba(0,0,0,0.6);" @click.self="showTransfer = false">
      <div class="glass-card p-6 w-full max-w-md">
        <h3 class="text-lg font-semibold mb-4" style="font-family: 'Playfair Display', serif;">Transfer Asset</h3>
        <label class="text-xs block mb-1" style="color: var(--text-muted);">Recipient Address</label>
        <input v-model="transferAddress" class="w-full mb-4" placeholder="0x..." />
        <div class="flex gap-3">
          <button class="flex-1 py-2 rounded-lg text-sm" style="border: 1px solid var(--border-color); color: var(--text-secondary);" @click="showTransfer = false">Cancel</button>
          <button class="gold-btn flex-1 text-sm" @click="handleTransfer">Confirm Transfer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, Send, Download } from 'lucide-vue-next'
import { useAssetStore } from '@/stores/asset'
import ProvenanceTimeline from '@/components/ProvenanceTimeline.vue'

const route = useRoute()
const assetStore = useAssetStore()

const showTransfer = ref(false)
const transferAddress = ref('')

const asset = computed(() => assetStore.myAssets.find(a => a.id === route.params.id))

const provenanceEvents = computed(() => [
  { operation: 'Create', description: 'Collection created by ' + (asset.value?.creator || 'Creator'), timestamp: '2024-01-15 10:30', hash: '0xabc123def456...' },
  { operation: 'Mint', description: 'Token minted #' + (asset.value?.tokenId || 'TK-0001'), timestamp: '2024-01-15 10:35', hash: '0x789ghi012jkl...' },
  { operation: 'List', description: 'Listed on marketplace for ' + (asset.value?.acquiredPrice || 0).toFixed(2) + ' ETH', timestamp: '2024-02-01 14:20', hash: '0xmno345pqr678...' },
  { operation: 'Transfer', description: 'Transferred to current owner', timestamp: asset.value?.acquiredAt + ' 09:15' || '2024-02-10 09:15', hash: '0xstu901vwx234...' },
])

async function handleTransfer() {
  if (!asset.value || !transferAddress.value) return
  await assetStore.transferAsset(asset.value.id, transferAddress.value)
  showTransfer.value = false
  transferAddress.value = ''
}

async function handleExport() {
  if (!asset.value) return
  const result = await assetStore.exportAsset(asset.value.id)
  console.log('Exported:', result)
}

onMounted(() => {
  if (assetStore.myAssets.length === 0) assetStore.fetchMyAssets()
})
</script>
