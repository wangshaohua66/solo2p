<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotifications } from '@/composables/useNotifications'
import { Bell, Search, ChevronDown, LogOut, Plus, CheckCheck, FileText } from 'lucide-vue-next'
import type { Notification } from '@/types'

const auth = useAuthStore()
const router = useRouter()
const showMenu = ref(false)
const showNotif = ref(false)
const { notifications, unreadCount, markRead, markAllRead } = useNotifications()

function logout() {
  auth.logout()
  router.push('/login')
}

function createWedding() {
  router.push('/weddings/create')
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return min + '分钟前'
  const hr = Math.floor(min / 60)
  if (hr < 24) return hr + '小时前'
  return Math.floor(hr / 24) + '天前'
}

function typeColor(n: Notification): string {
  switch (n.type) {
    case 'WARN': return 'text-amber-500'
    case 'ERROR': return 'text-rose-500'
    case 'SUCCESS': return 'text-emerald-500'
    default: return 'text-wine-400'
  }
}

function handleClick(n: Notification) {
  if (!n.readFlag) markRead(n.id)
  if (n.bizType === 'contract' && n.bizId) {
    router.push(`/contracts/${n.bizId}/sign`)
    showNotif.value = false
  }
}
</script>

<template>
  <header class="sticky top-0 z-30 flex items-center gap-3 px-4 lg:px-8 h-16 bg-cream/80 backdrop-blur-md border-b border-wine-100">
    <div class="flex-1 flex items-center gap-3">
      <div class="relative max-w-md w-full hidden sm:block">
        <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-wine-300" />
        <input class="field-input pl-9 h-9 bg-white/70" placeholder="搜索婚礼、新人、合同…" />
      </div>
    </div>

    <button class="btn-primary h-9 px-3 text-sm" @click="createWedding">
      <Plus :size="16" /> <span class="hidden sm:inline">创建婚礼</span>
    </button>

    <div class="relative">
      <button class="relative w-9 h-9 rounded-lg hover:bg-white/60 flex items-center justify-center text-wine-600 transition" @click="showNotif = !showNotif">
        <Bell :size="18" />
        <span v-if="unreadCount > 0" class="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center font-medium ring-2 ring-cream">
          {{ unreadCount > 99 ? '99+' : unreadCount }}
        </span>
      </button>
      <transition name="fade">
        <div v-if="showNotif" class="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto card shadow-lift z-50" @click.stop>
          <div class="flex items-center justify-between px-4 py-3 border-b border-wine-100 sticky top-0 bg-white rounded-t-2xl">
            <p class="text-sm font-medium text-wine-800">通知</p>
            <button v-if="unreadCount > 0" class="text-xs text-wine-400 hover:text-wine-700 flex items-center gap-1" @click="markAllRead()">
              <CheckCheck :size="13" /> 全部已读
            </button>
          </div>
          <div v-if="notifications.length === 0" class="px-4 py-8 text-center text-sm text-wine-300">
            暂无通知
          </div>
          <div v-else>
            <button
              v-for="n in notifications.slice(0, 20)"
              :key="n.id"
              class="w-full flex gap-3 px-4 py-3 border-b border-wine-50 text-left hover:bg-wine-50/40 transition"
              :class="!n.readFlag ? 'bg-gold-50/30' : ''"
              @click="handleClick(n)"
            >
              <FileText :size="16" :class="typeColor(n)" class="mt-0.5 shrink-0" />
              <div class="min-w-0 flex-1">
                <p class="text-sm text-wine-800 font-medium truncate">{{ n.title }}</p>
                <p class="text-xs text-wine-400 mt-0.5 line-clamp-2">{{ n.content }}</p>
                <p class="text-[10px] text-wine-300 mt-1">{{ timeAgo(n.createdAt) }}</p>
              </div>
              <span v-if="!n.readFlag" class="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0"></span>
            </button>
          </div>
        </div>
      </transition>
    </div>

    <div class="relative">
      <button class="flex items-center gap-2 pl-1 pr-2 h-9 rounded-lg hover:bg-white/60 transition" @click="showMenu = !showMenu">
        <div class="w-7 h-7 rounded-full bg-wine-grad text-white text-xs flex items-center justify-center font-medium">
          {{ auth.user?.name?.charAt(0) || '锦' }}
        </div>
        <div class="hidden sm:block text-left">
          <p class="text-xs font-medium text-wine-800 leading-none">{{ auth.user?.name }}</p>
          <p class="text-[10px] text-wine-400 mt-0.5">{{ auth.roleLabel }}</p>
        </div>
        <ChevronDown :size="14" class="text-wine-400" />
      </button>
      <transition name="fade">
        <div v-if="showMenu" class="absolute right-0 mt-2 w-44 card p-1.5 shadow-lift z-50" @click="showMenu = false">
          <button class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-wine-700 hover:bg-wine-50 transition" @click="logout">
            <LogOut :size="15" /> 退出登录
          </button>
        </div>
      </transition>
    </div>
  </header>
</template>
