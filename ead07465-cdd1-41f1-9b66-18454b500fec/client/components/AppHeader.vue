<template>
  <header class="h-14 flex items-center justify-between px-4 bg-secondary border-b border-color z-50 select-none">
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-md bg-accent-primary flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
          </svg>
        </div>
        <div>
          <div class="text-lg font-semibold text-primary">水务管网调度指挥系统</div>
          <div class="text-xs text-muted">Water Network Dispatch System</div>
        </div>
      </div>

      <nav class="hidden md:flex items-center gap-1 ml-8">
        <NuxtLink to="/" class="nav-link" exact-active-class="nav-active">
          <span>监控看板</span>
        </NuxtLink>
        <NuxtLink to="/leak" class="nav-link" active-class="nav-active">
          <span>漏损事件</span>
          <span v-if="activeLeakCount > 0" class="badge-danger ml-1 badge">{{ activeLeakCount }}</span>
        </NuxtLink>
        <NuxtLink to="/repair" class="nav-link" active-class="nav-active">
          <span>工单调度</span>
        </NuxtLink>
        <NuxtLink to="/inspection" class="nav-link" active-class="nav-active">
          <span>巡检管理</span>
        </NuxtLink>
      </nav>
    </div>

    <div class="flex items-center gap-3">
      <div class="hidden md:flex items-center gap-2 text-xs">
        <span
          class="w-2 h-2 rounded-full"
          :class="[
            dispatch.hubConnection?.state === 'Connected' ? 'bg-success pulse-dot' :
            dispatch.hubConnection?.state === 'Connecting' || dispatch.hubConnection?.state === 'Reconnecting' ? 'bg-warning pulse-dot' :
            'bg-danger'
          ]"
        ></span>
        <span
          :class="[
            dispatch.hubConnection?.state === 'Connected' ? 'text-success' :
            dispatch.hubConnection?.state === 'Connecting' || dispatch.hubConnection?.state === 'Reconnecting' ? 'text-warning' :
            'text-danger'
          ]"
        >
          {{ connectionLabel }}
        </span>
        <span v-if="dispatch.useMockFallback" class="text-muted text-[10px] ml-1">(模拟)</span>
      </div>

      <div class="relative cursor-pointer" @click="showAlerts = !showAlerts">
        <div class="w-9 h-9 rounded-md bg-tertiary flex items-center justify-center hover:bg-hover transition">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span v-if="dispatch.activeAlarmCount > 0" class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger text-white text-xs flex items-center justify-center font-medium">
            {{ dispatch.activeAlarmCount > 99 ? '99+' : dispatch.activeAlarmCount }}
          </span>
        </div>
      </div>

      <button class="w-9 h-9 rounded-md bg-tertiary flex items-center justify-center hover:bg-hover transition" @click="dispatch.toggleMapStyle()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/>
          <path d="M8 2v16M16 6v16"/>
        </svg>
      </button>

      <div class="flex items-center gap-2 pl-2 border-l border-color">
        <div class="w-8 h-8 rounded-full bg-accent-primary flex items-center justify-center text-sm font-medium text-white">
          {{ dispatch.currentUser?.displayName?.charAt(0) || 'U' }}
        </div>
        <div class="hidden md:block">
          <div class="text-sm font-medium text-primary">{{ dispatch.currentUser?.displayName }}</div>
          <div class="text-xs text-muted">{{ roleLabel }}</div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useDispatchStore } from '~/stores/dispatch'
import { getRoleLabel } from '~/utils/api'

const dispatch = useDispatchStore()
const showAlerts = ref(false)

const activeLeakCount = computed(() =>
  dispatch.leakEvents.filter(e => e.status === 'Detected' || e.status === 'Confirmed').length
)

const roleLabel = computed(() => dispatch.currentUser ? getRoleLabel(dispatch.currentUser.role) : '')

const connectionLabel = computed(() => {
  if (!dispatch.hubConnection) return dispatch.connected ? '实时连接' : '未连接'
  switch (dispatch.hubConnection.state) {
    case 'Connected': return '实时连接'
    case 'Connecting': return '连接中...'
    case 'Reconnecting': return '重连中...'
    case 'Disconnected': return '已断开'
    default: return '未知状态'
  }
})
</script>

<style scoped>
.nav-link {
  @apply px-3 py-1.5 rounded-md text-sm text-secondary hover:text-primary hover:bg-hover transition;
}
.nav-active {
  @apply bg-accent-primary/15 text-accent-secondary;
}
</style>
