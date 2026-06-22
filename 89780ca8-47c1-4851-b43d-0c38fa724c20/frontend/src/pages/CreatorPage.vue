<template>
  <div>
    <h1 class="text-3xl font-bold mb-6" style="font-family: 'Playfair Display', serif;">Creator Studio</h1>

    <div class="flex gap-3 mb-6">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="px-4 py-2 text-sm rounded-lg transition-all"
        :style="activeTab === tab.key
          ? 'background: rgba(212, 168, 83, 0.15); color: var(--gold); border: 1px solid var(--gold);'
          : 'border: 1px solid var(--border-color); color: var(--text-muted);'"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="activeTab === 'overview'" class="fade-in-up">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="glass-card p-5">
          <p class="text-xs mb-1" style="color: var(--text-muted);">Total Collections</p>
          <p class="text-2xl font-bold font-mono" style="color: var(--gold);">4</p>
        </div>
        <div class="glass-card p-5">
          <p class="text-xs mb-1" style="color: var(--text-muted);">Total Minted</p>
          <p class="text-2xl font-bold font-mono" style="color: var(--gold);">1,800</p>
        </div>
        <div class="glass-card p-5">
          <p class="text-xs mb-1" style="color: var(--text-muted);">Total Earnings</p>
          <p class="text-2xl font-bold font-mono" style="color: var(--gold);">8.22 ETH</p>
        </div>
      </div>

      <div class="glass p-5">
        <h3 class="text-base font-semibold mb-4" style="color: var(--text-primary);">Quick Actions</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <router-link
            to="/creator/publish"
            class="glass-card p-4 text-center transition-all hover:shadow-lg"
            style="border: 1px dashed var(--gold);"
          >
            <Plus :size="24" class="mx-auto mb-2" style="color: var(--gold);" />
            <p class="text-sm font-medium" style="color: var(--gold);">Publish New Collection</p>
          </router-link>
          <router-link
            to="/creator/management"
            class="glass-card p-4 text-center transition-all hover:shadow-lg"
          >
            <FileText :size="24" class="mx-auto mb-2" style="color: var(--text-secondary);" />
            <p class="text-sm font-medium" style="color: var(--text-secondary);">Manage Collections</p>
          </router-link>
          <router-link
            to="/creator/royalty"
            class="glass-card p-4 text-center transition-all hover:shadow-lg"
          >
            <Coins :size="24" class="mx-auto mb-2" style="color: var(--text-secondary);" />
            <p class="text-sm font-medium" style="color: var(--text-secondary);">View Royalties</p>
          </router-link>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'collections'" class="fade-in-up">
      <div v-if="creatorStore.myCollections.length > 0" class="space-y-3">
        <div
          v-for="col in creatorStore.myCollections"
          :key="col.id"
          class="glass p-4 flex items-center justify-between"
        >
          <div>
            <h4 class="text-sm font-semibold" style="color: var(--text-primary);">{{ col.name }}</h4>
            <p class="text-xs" style="color: var(--text-muted);">{{ col.rarity }} · {{ col.count }} items · {{ col.submittedAt }}</p>
          </div>
          <span
            class="px-2 py-0.5 rounded-full text-xs font-semibold"
            :style="statusStyle(col.status)"
          >
            {{ col.status }}
          </span>
        </div>
      </div>
      <div v-else class="text-center py-16">
        <p class="text-sm" style="color: var(--text-muted);">No collections yet</p>
      </div>
    </div>

    <div v-else class="fade-in-up text-center py-16">
      <router-link to="/creator/publish" class="gold-btn text-sm inline-block">
        Publish New Collection
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, FileText, Coins } from 'lucide-vue-next'
import { useCreatorStore } from '@/stores/creator'

const creatorStore = useCreatorStore()
const activeTab = ref('overview')

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'collections', label: 'My Collections' },
  { key: 'actions', label: 'Quick Actions' },
]

function statusStyle(status: string) {
  switch (status) {
    case 'pending': return 'background: rgba(243, 156, 18, 0.2); color: #f39c12;'
    case 'reviewing': return 'background: rgba(59, 130, 246, 0.2); color: #3b82f6;'
    case 'approved': return 'background: rgba(0, 212, 170, 0.2); color: #00d4aa;'
    case 'rejected': return 'background: rgba(255, 71, 87, 0.2); color: #ff4757;'
    default: return ''
  }
}

onMounted(() => {
  creatorStore.fetchMyCollections()
})
</script>
