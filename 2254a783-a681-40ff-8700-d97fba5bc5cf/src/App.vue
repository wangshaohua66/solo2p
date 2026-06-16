<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVesselStore } from '@/stores/vessel'
import { USER_ROLE_LABELS } from '@/types'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const vesselStore = useVesselStore()

const collapsed = ref(false)
const currentDate = ref(new Date())
const selectedDate = ref(new Date())

const navItems = computed(() => {
  const routes = router.options.routes.filter(r => r.meta && r.meta.title)
  return routes.map(r => {
    const hasAccess = !r.meta?.roles || (r.meta.roles as string[]).includes(vesselStore.currentUser.role)
    return {
      path: r.path,
      title: r.meta?.title as string,
      icon: r.meta?.icon as string,
      visible: hasAccess
    }
  }).filter(r => r.visible)
})

const roleBadgeClass = computed(() => {
  const role = vesselStore.currentUser.role
  switch (role) {
    case 'director': return 'bg-port-warning text-white'
    case 'dispatcher': return 'bg-port-accent text-white'
    case 'pilot': return 'bg-port-success text-white'
    case 'agent': return 'bg-purple-600 text-white'
    default: return 'bg-gray-600 text-white'
  }
})

function onDateChange(val: Date) {
  if (val) {
    selectedDate.value = val
  }
}

function navigateTo(path: string) {
  if (route.path !== path) {
    router.push(path)
  }
}

onMounted(() => {
  setInterval(() => {
    currentDate.value = new Date()
  }, 1000)
})
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-port-bg">
    <aside
      :class="[
        'flex flex-col border-r border-port-panel transition-all duration-300 bg-gradient-to-b from-port-card to-port-bg',
        collapsed ? 'w-16' : 'w-56'
      ]"
    >
      <div class="h-16 flex items-center justify-center border-b border-port-panel px-4">
        <template v-if="!collapsed">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-port-accent to-port-success flex items-center justify-center">
              <el-icon :size="20" class="text-white"><Ship /></el-icon>
            </div>
            <span class="text-port-text font-bold text-sm whitespace-nowrap">港口调度系统</span>
          </div>
        </template>
        <template v-else>
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-port-accent to-port-success flex items-center justify-center">
            <el-icon :size="18" class="text-white"><Ship /></el-icon>
          </div>
        </template>
      </div>

      <div class="p-3 border-b border-port-panel">
        <el-select
          :model-value="vesselStore.selectedPortId"
          @update:model-value="vesselStore.setSelectedPort($event)"
          :placeholder="collapsed ? '' : '选择港口'"
          size="small"
          class="w-full"
        >
          <el-option
            v-for="port in vesselStore.ports"
            :key="port.id"
            :label="port.name"
            :value="port.id"
          />
        </el-select>
      </div>

      <nav class="flex-1 py-3 overflow-y-auto">
        <div
          v-for="item in navItems"
          :key="item.path"
          :class="[
            'flex items-center gap-3 mx-2 my-1 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200',
            route.path === item.path
              ? 'bg-port-accent/20 text-port-accent border-l-2 border-port-accent'
              : 'text-port-text-muted hover:bg-port-panel/50 hover:text-port-text border-l-2 border-transparent'
          ]"
          @click="navigateTo(item.path)"
        >
          <el-icon :size="18"><component :is="item.icon" /></el-icon>
          <span v-if="!collapsed" class="text-sm font-medium">{{ item.title }}</span>
        </div>
      </nav>

      <div class="p-3 border-t border-port-panel">
        <div v-if="!collapsed" class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-gradient-to-br from-port-accent to-purple-600 flex items-center justify-center">
            <span class="text-white text-sm font-bold">{{ vesselStore.currentUser.name.charAt(0) }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-port-text text-sm font-medium truncate">{{ vesselStore.currentUser.name }}</div>
            <span :class="['text-xs px-2 py-0.5 rounded', roleBadgeClass]">
              {{ USER_ROLE_LABELS[vesselStore.currentUser.role] }}
            </span>
          </div>
        </div>
        <div v-else class="flex justify-center">
          <div class="w-9 h-9 rounded-full bg-gradient-to-br from-port-accent to-purple-600 flex items-center justify-center">
            <span class="text-white text-sm font-bold">{{ vesselStore.currentUser.name.charAt(0) }}</span>
          </div>
        </div>
      </div>
    </aside>

    <div class="flex-1 flex flex-col overflow-hidden">
      <header class="h-16 flex items-center justify-between px-6 border-b border-port-panel bg-port-card/50 backdrop-blur-sm">
        <div class="flex items-center gap-4">
          <h1 class="text-port-text text-lg font-semibold">{{ route.meta.title }}</h1>
          <div class="h-6 w-px bg-port-panel" />
          <span class="text-port-text-muted text-sm">
            {{ dayjs(currentDate).format('YYYY年MM月DD日 dddd HH:mm:ss') }}
          </span>
        </div>

        <div class="flex items-center gap-4">
          <el-date-picker
            v-model="selectedDate"
            type="date"
            placeholder="选择日期"
            size="default"
            :teleported="false"
            @change="onDateChange"
          />

          <el-button-group>
            <el-button
              size="default"
              :type="route.path === '/dashboard' ? 'primary' : 'default'"
              @click="navigateTo('/dashboard')"
            >
              <el-icon class="mr-1"><Monitor /></el-icon>看板
            </el-button>
            <el-button
              size="default"
              :type="route.path === '/schedule' ? 'primary' : 'default'"
              @click="navigateTo('/schedule')"
            >
              <el-icon class="mr-1"><Calendar /></el-icon>排程
            </el-button>
            <el-button
              size="default"
              :type="route.path === '/vessel' ? 'primary' : 'default'"
              @click="navigateTo('/vessel')"
            >
              <el-icon class="mr-1"><Ship /></el-icon>船舶
            </el-button>
          </el-button-group>

          <div class="flex items-center gap-2 ml-4">
            <el-badge :value="vesselStore.anchorageCount" class="mr-2" :max="99">
              <div class="w-8 h-8 rounded-full bg-port-warning/20 flex items-center justify-center cursor-pointer hover:bg-port-warning/30 transition">
                <el-icon class="text-port-warning" :size="16"><Anchor /></el-icon>
              </div>
            </el-badge>
            <el-badge :value="vesselStore.inPortCount" class="mr-2" type="success" :max="99">
              <div class="w-8 h-8 rounded-full bg-port-success/20 flex items-center justify-center cursor-pointer hover:bg-port-success/30 transition">
                <el-icon class="text-port-success" :size="16"><Finished /></el-icon>
              </div>
            </el-badge>
            <el-badge :value="vesselStore.inTransitCount" type="info" :max="99">
              <div class="w-8 h-8 rounded-full bg-port-accent/20 flex items-center justify-center cursor-pointer hover:bg-port-accent/30 transition">
                <el-icon class="text-port-accent" :size="16"><Van /></el-icon>
              </div>
            </el-badge>
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-hidden p-4">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>
