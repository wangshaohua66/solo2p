<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Calendar, ClipboardList, LogOut, Sparkles } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

function logout() {
  auth.logout()
  router.push('/supplier-login')
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-cream">
    <header class="bg-wine-grad text-white sticky top-0 z-30">
      <div class="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-gold-grad flex items-center justify-center">
            <Sparkles :size="18" class="text-wine-800" />
          </div>
          <div>
            <p class="font-display text-xl font-semibold leading-none">锦时 · 供应商</p>
            <p class="text-[10px] text-gold-200 mt-1">{{ auth.user?.name }} · 服务档期与接单</p>
          </div>
        </div>
        <button class="text-white/70 hover:text-white transition text-sm flex items-center gap-1" @click="logout">
          <LogOut :size="16" /> 退出
        </button>
      </div>
    </header>

    <nav class="max-w-3xl mx-auto w-full px-4 flex gap-2 -mt-3 relative z-10">
      <button
        v-for="tab in [{ name: 'portal-dashboard', label: '档期总览', icon: Calendar }, { name: 'portal-orders', label: '我的接单', icon: ClipboardList }]"
        :key="tab.name"
        @click="router.push({ name: tab.name })"
        class="flex items-center gap-1.5 px-4 h-10 rounded-[10px] text-sm transition"
        :class="route.name === tab.name ? 'bg-white text-wine-700 shadow-soft font-medium' : 'bg-white/60 text-wine-400 hover:text-wine-700'"
      >
        <component :is="tab.icon" :size="15" /> {{ tab.label }}
      </button>
    </nav>

    <main class="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
      <RouterView />
    </main>
  </div>
</template>
