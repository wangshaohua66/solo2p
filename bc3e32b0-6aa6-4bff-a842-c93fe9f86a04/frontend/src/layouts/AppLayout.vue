<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'
import { ElMessageBox } from 'element-plus'
import Sidebar from '@/components/layout/Sidebar.vue'
import Header from '@/components/layout/Header.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()

const isMobile = ref(false)
const isSidebarCollapsed = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value) {
    isSidebarCollapsed.value = true
  }
}

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    authStore.logout()
    router.push('/login')
  } catch {
  }
}

const pageTitle = computed(() => route.meta.title as string || '')

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  if (authStore.isLoggedIn) {
    notificationStore.fetchUnreadCount()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<template>
  <div class="app-layout">
    <Sidebar 
      :collapsed="isSidebarCollapsed" 
      :is-mobile="isMobile"
      @toggle="toggleSidebar"
    />
    
    <div class="main-container" :class="{ 'sidebar-collapsed': isSidebarCollapsed, 'mobile': isMobile }">
      <Header 
        :title="pageTitle"
        :collapsed="isSidebarCollapsed"
        :is-mobile="isMobile"
        @toggle-sidebar="toggleSidebar"
        @logout="handleLogout"
      />
      
      <main class="main-content">
        <slot></slot>
      </main>
    </div>
    
    <div 
      v-if="isMobile && !isSidebarCollapsed" 
      class="sidebar-overlay"
      @click="toggleSidebar"
    ></div>
  </div>
</template>

<style scoped lang="scss">
.app-layout {
  display: flex;
  min-height: 100vh;
  background-color: $color-bg;
}

.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: $sidebar-width;
  transition: margin-left $transition-normal;

  &.sidebar-collapsed {
    margin-left: $sidebar-width-collapsed;
  }

  &.mobile {
    margin-left: 0;

    &.sidebar-collapsed {
      margin-left: 0;
    }
  }
}

.main-content {
  flex: 1;
  padding: 20px;
  overflow-x: hidden;

  @media (max-width: $breakpoint-mobile) {
    padding: 12px;
  }
}

.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 998;
}
</style>
