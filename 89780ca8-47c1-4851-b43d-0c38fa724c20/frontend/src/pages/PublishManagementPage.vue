<template>
  <div>
    <div class="flex items-center gap-4 mb-6">
      <button class="p-2 rounded-lg transition-colors" style="color: var(--text-secondary);" @click="$router.push('/creator')">
        <ArrowLeft :size="20" />
      </button>
      <h1 class="text-2xl font-bold" style="font-family: 'Playfair Display', serif;">Publish Management</h1>
    </div>

    <div class="glass overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-color);">
            <th class="text-left px-4 py-3 text-xs font-medium" style="color: var(--text-muted);">Name</th>
            <th class="text-left px-4 py-3 text-xs font-medium" style="color: var(--text-muted);">Rarity</th>
            <th class="text-left px-4 py-3 text-xs font-medium" style="color: var(--text-muted);">Count</th>
            <th class="text-left px-4 py-3 text-xs font-medium" style="color: var(--text-muted);">Status</th>
            <th class="text-left px-4 py-3 text-xs font-medium" style="color: var(--text-muted);">Date</th>
            <th class="text-right px-4 py-3 text-xs font-medium" style="color: var(--text-muted);">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="col in creatorStore.myCollections"
            :key="col.id"
            class="transition-colors"
            style="border-bottom: 1px solid var(--border-color);"
          >
            <td class="px-4 py-3 font-medium" style="color: var(--text-primary);">{{ col.name }}</td>
            <td class="px-4 py-3">
              <span
                class="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                :class="`badge-${col.rarity}`"
              >
                {{ col.rarity }}
              </span>
            </td>
            <td class="px-4 py-3 font-mono" style="color: var(--text-secondary);">{{ col.count }}</td>
            <td class="px-4 py-3">
              <span
                class="px-2 py-0.5 rounded-full text-xs font-semibold"
                :style="statusStyle(col.status)"
              >
                {{ col.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-xs" style="color: var(--text-muted);">{{ col.submittedAt }}</td>
            <td class="px-4 py-3 text-right">
              <div class="flex gap-2 justify-end">
                <button
                  v-if="col.status === 'pending'"
                  class="px-2 py-1 text-xs rounded"
                  style="color: var(--gold); border: 1px solid var(--gold);"
                >
                  Edit
                </button>
                <button
                  v-if="col.status === 'pending' || col.status === 'reviewing'"
                  class="px-2 py-1 text-xs rounded"
                  style="color: var(--red-down); border: 1px solid var(--red-down);"
                >
                  Withdraw
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { useCreatorStore } from '@/stores/creator'

const creatorStore = useCreatorStore()

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
