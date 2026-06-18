<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Monitor, Calendar, User, TrendCharts, SetUp, Document, Fold, Expand } from '@element-plus/icons-vue'
import { useDispatchStore } from '@/stores/dispatch'

const route = useRoute()
const router = useRouter()
const dispatchStore = useDispatchStore()

const isCollapsed = ref(false)
const currentTime = ref('')
const onlineTerminals = ref(12)

const menuItems = [
  { index: '/', icon: Monitor, label: '调度看板' },
  { index: '/schedule', icon: Calendar, label: '排班编辑' },
  { index: '/driver-schedule', icon: User, label: '司机排班' },
  { index: '/ridership', icon: TrendCharts, label: '客流分析' },
  { index: '/maintenance', icon: SetUp, label: '维保管理' },
  { index: '/daily-report', icon: Document, label: '运营日报' },
]

const activeMenu = computed(() => route.path)

function handleResize() {
  isCollapsed.value = window.innerWidth < 1366
}

function updateTime() {
  const now = new Date()
  currentTime.value = now.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
  updateTime()
  timer = setInterval(updateTime, 1000)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  clearInterval(timer)
})
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden">
    <aside
      class="flex flex-col transition-all duration-300 shrink-0"
      :class="isCollapsed ? 'w-[64px]' : 'w-[220px]'"
      style="background: #1B2A4A"
    >
      <div class="flex items-center h-14 px-4 shrink-0" :class="isCollapsed ? 'justify-center' : 'gap-3'">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style="background: #FF6B35">
          巴
        </div>
        <span v-if="!isCollapsed" class="text-white text-sm font-semibold truncate">公交智能调度</span>
      </div>

      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapsed"
        :collapse-transition="false"
        background-color="#1B2A4A"
        text-color="#94A3B8"
        active-text-color="#FFFFFF"
        class="flex-1 border-none !py-2"
        @select="(index: string) => router.push(index)"
      >
        <el-menu-item v-for="item in menuItems" :key="item.index" :index="item.index">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.label }}</template>
        </el-menu-item>
      </el-menu>

      <div class="shrink-0 p-2 border-t" style="border-color: #2D3F5E">
        <button
          class="w-full h-9 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          @click="isCollapsed = !isCollapsed"
        >
          <el-icon :size="18"><component :is="isCollapsed ? Expand : Fold" /></el-icon>
        </button>
      </div>
    </aside>

    <div class="flex flex-col flex-1 overflow-hidden">
      <header class="h-14 flex items-center justify-between px-6 bg-white border-b shrink-0" style="border-color: var(--color-border)">
        <h1 class="text-base font-semibold" style="color: var(--color-primary)">
          {{ (route.meta.title as string) || '公交智能排班与运营调度系统' }}
        </h1>
        <div class="flex items-center gap-6 text-sm" style="color: var(--color-text-secondary)">
          <span class="font-num">{{ currentTime }}</span>
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
            在线终端 {{ onlineTerminals }}
          </span>
          <el-badge :value="dispatchStore.alertCount" :max="99" :hidden="dispatchStore.alertCount === 0">
            <el-icon :size="18" class="cursor-pointer" style="color: var(--color-text-secondary)"><SetUp /></el-icon>
          </el-badge>
        </div>
      </header>

      <main class="flex-1 overflow-auto p-4" style="background: var(--color-bg)">
        <router-view />
      </main>
    </div>
  </div>
</template>
