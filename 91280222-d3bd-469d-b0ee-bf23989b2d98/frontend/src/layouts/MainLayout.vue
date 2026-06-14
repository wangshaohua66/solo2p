<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import { useReviewStore } from '@/stores/reviewStore'
import ProjectTree from '@/components/ProjectTree.vue'

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()
const authStore = useAuthStore()
const reviewStore = useReviewStore()

const isMobileDrawer = ref(false)

const showSidebar = computed(() => {
  return !themeStore.sidebarCollapsed
})

const breadcrumbs = computed(() => {
  const matched = route.matched.filter((r) => r.meta?.title)
  return matched.map((r) => ({
    title: r.meta?.title as string,
    path: r.path
  }))
})

function handleLogout() {
  ElMessageBox.confirm('确定要退出登录吗？', '退出确认', {
    type: 'warning'
  })
    .then(() => {
      authStore.logout()
      reviewStore.clearAll()
      router.push('/login')
    })
    .catch(() => {})
}

function toggleDrawer() {
  isMobileDrawer.value = !isMobileDrawer.value
}
</script>

<template>
  <div class="main-layout" :class="{ 'sidebar-collapsed': !showSidebar, dark: themeStore.mode === 'dark' }">
    <el-drawer
      v-model="isMobileDrawer"
      direction="ltr"
      size="280px"
      class="mobile-sidebar-drawer"
      :with-header="false"
    >
      <ProjectTree />
    </el-drawer>

    <aside v-show="showSidebar" class="sidebar">
      <div class="logo">
        <el-icon :size="28" color="#1d4ed8"><OfficeBuilding /></el-icon>
        <span class="logo-text">图纸审阅平台</span>
      </div>
      <nav class="nav-menu">
        <router-link to="/dashboard" class="nav-item" :class="{ active: route.path.startsWith('/dashboard') }">
          <el-icon><DataAnalysis /></el-icon>
          <span>进度看板</span>
        </router-link>
        <router-link to="/projects" class="nav-item" :class="{ active: route.path.startsWith('/projects') }">
          <el-icon><FolderOpened /></el-icon>
          <span>项目管理</span>
        </router-link>
      </nav>
      <div class="project-tree-wrapper">
        <ProjectTree />
      </div>
    </aside>

    <div class="main-content">
      <header class="app-header">
        <div class="header-left">
          <el-button class="menu-toggle" text @click="themeStore.toggleSidebar">
            <el-icon :size="20"><Fold v-if="showSidebar" /><Expand v-else /></el-icon>
          </el-button>
          <el-button class="mobile-menu-toggle" text @click="toggleDrawer">
            <el-icon :size="20"><Menu /></el-icon>
          </el-button>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item
              v-for="(item, index) in breadcrumbs"
              :key="index"
              :to="index < breadcrumbs.length - 1 ? item.path : undefined"
            >
              {{ item.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-tooltip :content="themeStore.mode === 'dark' ? '切换浅色模式' : '切换深色模式'">
            <el-button text @click="themeStore.toggleTheme">
              <el-icon :size="18"><Moon v-if="themeStore.mode === 'light'" /><Sunny v-else /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="通知">
            <el-badge :value="3" class="notification-badge">
              <el-button text>
                <el-icon :size="18"><Bell /></el-icon>
              </el-button>
            </el-badge>
          </el-tooltip>
          <el-dropdown trigger="click">
            <div class="user-info">
              <el-avatar :size="32" :src="authStore.user?.avatar">
                {{ authStore.user?.name?.[0] }}
              </el-avatar>
              <div class="user-meta">
                <span class="user-name">{{ authStore.user?.name }}</span>
                <span class="user-role">
                  {{ { project_manager: '项目经理', designer: '设计师', reviewer: '审阅者' }[authStore.user?.role || ''] }}
                </span>
              </div>
              <el-icon><CaretBottom /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="router.push('/profile')">
                  <el-icon><User /></el-icon>
                  个人中心
                </el-dropdown-item>
                <el-dropdown-item divided @click="handleLogout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="content-area">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.main-layout {
  display: flex;
  width: 100%;
  height: 100vh;
  background: $bg-light;
  overflow: hidden;

  .dark & {
    background: $dark-bg-base;
  }

  &.sidebar-collapsed .sidebar {
    width: 0;
    padding: 0;
    overflow: hidden;
  }
}

.sidebar {
  width: $sider-width;
  flex-shrink: 0;
  background: $bg-base;
  border-right: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  transition: width $transition-normal;
  overflow: hidden;

  .dark & {
    background: $dark-bg-light;
    border-right-color: $dark-border-color;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 20px;
    border-bottom: 1px solid $border-color;
    height: $header-height;
    flex-shrink: 0;

    .dark & {
      border-bottom-color: $dark-border-color;
    }

    .logo-text {
      font-size: 16px;
      font-weight: 700;
      white-space: nowrap;
    }
  }

  .nav-menu {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: $radius-md;
      color: $text-secondary;
      font-size: 14px;
      transition: all $transition-fast;

      &:hover {
        background: $bg-hover;
        color: $text-primary;

        .dark & {
          background: $dark-bg-hover;
          color: $dark-text-primary;
        }
      }

      &.active {
        background: rgba(29, 78, 216, 0.1);
        color: $primary-color;
        font-weight: 500;
      }
    }
  }

  .project-tree-wrapper {
    flex: 1;
    overflow: hidden;
    border-top: 1px solid $border-color;

    .dark & {
      border-top-color: $dark-border-color;
    }
  }
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.app-header {
  height: $header-height;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: $bg-base;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;

  .dark & {
    background: $dark-bg-light;
    border-bottom-color: $dark-border-color;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .menu-toggle {
      display: flex;
    }

    .mobile-menu-toggle {
      display: none;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 4px;

    .notification-badge {
      :deep(.el-badge__content) {
        top: 4px;
        right: 4px;
      }
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 12px 4px 6px;
      border-radius: $radius-lg;
      cursor: pointer;
      transition: background $transition-fast;

      &:hover {
        background: $bg-hover;

        .dark & {
          background: $dark-bg-hover;
        }
      }

      .user-meta {
        display: flex;
        flex-direction: column;
        line-height: 1.2;

        .user-name {
          font-size: 13px;
          font-weight: 500;
        }

        .user-role {
          font-size: 11px;
          color: $text-placeholder;
        }
      }
    }
  }
}

.content-area {
  flex: 1;
  overflow: hidden;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity $transition-normal;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .sidebar {
    display: none;
  }

  .app-header {
    padding: 0 12px;

    .header-left {
      .menu-toggle {
        display: none;
      }

      .mobile-menu-toggle {
        display: flex;
      }
    }

    .user-meta {
      display: none !important;
    }
  }
}
</style>
