<template>
  <div>
    <h1 class="text-3xl font-bold mb-6" style="font-family: 'Playfair Display', serif;">Statistics Dashboard</h1>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <StatsCard :icon="TrendingUp" label="Daily Trades" :value="statsStore.todayStats.trades" :trend="statsStore.todayStats.tradesChange" />
      <StatsCard :icon="BarChart3" label="Volume (ETH)" :value="statsStore.todayStats.volume" :trend="statsStore.todayStats.volumeChange" />
      <StatsCard :icon="Users" label="Active Users" :value="statsStore.todayStats.users" :trend="statsStore.todayStats.usersChange" />
      <StatsCard :icon="Layers" label="Collections" :value="statsStore.todayStats.collections" :trend="statsStore.todayStats.collectionsChange" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div class="glass p-5">
        <h3 class="text-sm font-semibold mb-4" style="color: var(--text-secondary);">Weekly Trends</h3>
        <div class="flex items-end gap-3 h-48">
          <div
            v-for="(day, i) in statsStore.dailyStats"
            :key="i"
            class="flex-1 flex flex-col items-center"
          >
            <div
              class="w-full rounded-t transition-all"
              :style="`height: ${(day.trades / maxTrades) * 160}px; background: linear-gradient(180deg, var(--gold), var(--gold-dark));`"
            />
            <span class="text-xs mt-2" style="color: var(--text-muted);">{{ day.date.slice(5) }}</span>
          </div>
        </div>
      </div>

      <div class="glass p-5">
        <h3 class="text-sm font-semibold mb-4" style="color: var(--text-secondary);">Hot Collections Ranking</h3>
        <div class="space-y-3">
          <div
            v-for="item in statsStore.hotRanking.slice(0, 5)"
            :key="item.rank"
            class="flex items-center gap-3"
          >
            <span class="w-6 text-center font-mono text-sm font-bold" :style="`color: ${item.rank <= 3 ? 'var(--gold)' : 'var(--text-muted)'};`">{{ item.rank }}</span>
            <div class="flex-1">
              <p class="text-sm font-medium" style="color: var(--text-primary);">{{ item.name }}</p>
              <p class="text-xs font-mono" style="color: var(--text-muted);">{{ item.volume.toLocaleString() }} ETH</p>
            </div>
            <span
              class="text-xs font-mono font-medium"
              :style="`color: ${item.change >= 0 ? 'var(--green-up)' : 'var(--red-down)'};`"
            >
              {{ item.change >= 0 ? '+' : '' }}{{ item.change }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="glass p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold" style="color: var(--text-secondary);">Creator Earnings Ranking</h3>
        <div class="flex gap-2">
          <input
            v-model="statsStore.dateRange.start"
            type="date"
            class="text-xs"
          />
          <span class="text-xs self-center" style="color: var(--text-muted);">to</span>
          <input
            v-model="statsStore.dateRange.end"
            type="date"
            class="text-xs"
          />
        </div>
      </div>
      <table class="w-full text-sm">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-color);">
            <th class="text-left px-3 py-2 text-xs font-medium" style="color: var(--text-muted);">Rank</th>
            <th class="text-left px-3 py-2 text-xs font-medium" style="color: var(--text-muted);">Creator</th>
            <th class="text-left px-3 py-2 text-xs font-medium" style="color: var(--text-muted);">Earnings</th>
            <th class="text-left px-3 py-2 text-xs font-medium" style="color: var(--text-muted);">Collections</th>
            <th class="text-left px-3 py-2 text-xs font-medium" style="color: var(--text-muted);">Followers</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in statsStore.creatorRanking"
            :key="c.rank"
            style="border-bottom: 1px solid var(--border-color);"
          >
            <td class="px-3 py-3 font-mono font-bold" :style="`color: ${c.rank <= 3 ? 'var(--gold)' : 'var(--text-muted)'};`">{{ c.rank }}</td>
            <td class="px-3 py-3 font-medium" style="color: var(--text-primary);">{{ c.name }}</td>
            <td class="px-3 py-3 font-mono" style="color: var(--gold);">{{ c.earnings.toLocaleString() }} ETH</td>
            <td class="px-3 py-3" style="color: var(--text-secondary);">{{ c.collections }}</td>
            <td class="px-3 py-3" style="color: var(--text-secondary);">{{ c.followers.toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { TrendingUp, BarChart3, Users, Layers } from 'lucide-vue-next'
import { useStatisticsStore } from '@/stores/statistics'
import StatsCard from '@/components/StatsCard.vue'

const statsStore = useStatisticsStore()

const maxTrades = computed(() => Math.max(...statsStore.dailyStats.map(d => d.trades)))

onMounted(() => {
  if (statsStore.dailyStats.length === 0) statsStore.fetchStats()
})
</script>
