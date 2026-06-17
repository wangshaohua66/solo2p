<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Bell, Search, ChevronDown, LogOut, Plus } from 'lucide-vue-next'

const auth = useAuthStore()
const router = useRouter()
const showMenu = ref(false)

function logout() {
  auth.logout()
  router.push('/login')
}

function createWedding() {
  router.push('/weddings/create')
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

    <button class="relative w-9 h-9 rounded-lg hover:bg-white/60 flex items-center justify-center text-wine-600 transition">
      <Bell :size="18" />
      <span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-cream"></span>
    </button>

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
