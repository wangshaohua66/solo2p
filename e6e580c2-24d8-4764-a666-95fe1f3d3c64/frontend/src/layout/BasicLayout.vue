<template>
  <el-container class="layout-container">
    <el-aside :width="isCollapse ? '64px' : '220px'" class="sidebar">
      <div class="logo">
        <el-icon size="28" color="#409eff"><ShoppingCart /></el-icon>
        <span v-show="!isCollapse" class="logo-text">生鲜社区团购</span>
      </div>
      <el-scrollbar>
        <el-menu
          :default-active="activeMenu"
          :collapse="isCollapse"
          :collapse-transition="false"
          background-color="#001529"
          text-color="#ffffffa6"
          active-text-color="#ffffff"
          router
        >
          <el-menu-item index="/dashboard">
            <el-icon><Odometer /></el-icon>
            <span>数据看板</span>
          </el-menu-item>

          <el-sub-menu index="product-group">
            <template #title>
              <el-icon><Goods /></el-icon>
              <span>商品管理</span>
            </template>
            <el-menu-item index="/product">商品列表</el-menu-item>
          </el-sub-menu>

          <el-menu-item index="/order">
            <el-icon><List /></el-icon>
            <span>订单管理</span>
          </el-menu-item>

          <el-menu-item index="/delivery">
            <el-icon><Van /></el-icon>
            <span>配送调度</span>
          </el-menu-item>

          <el-menu-item index="/settlement">
            <el-icon><Money /></el-icon>
            <span>结算中心</span>
          </el-menu-item>

          <el-menu-item index="/data-analysis">
            <el-icon><TrendCharts /></el-icon>
            <span>数据分析</span>
          </el-menu-item>

          <el-sub-menu index="base-group">
            <template #title>
              <el-icon><Setting /></el-icon>
              <span>基础管理</span>
            </template>
            <el-menu-item index="/community">小区管理</el-menu-item>
            <el-menu-item index="/supplier">供应商管理</el-menu-item>
            <el-menu-item index="/user">用户管理</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-scrollbar>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="toggleCollapse" size="20">
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-tooltip content="主题切换" placement="bottom">
            <el-switch
              v-model="isDark"
              :active-action-icon="Moon"
              :inactive-action-icon="Sunny"
              @change="toggleTheme"
              style="--el-switch-on-color: #2c2c2c"
            />
          </el-tooltip>
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="32" src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png" />
              <span class="username">管理员</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                <el-dropdown-item command="settings">系统设置</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, markRaw } from 'vue'
import { useRoute } from 'vue-router'
import { Moon, Sunny } from '@element-plus/icons-vue'

const route = useRoute()
const isCollapse = ref(false)
const isDark = ref(false)

const activeMenu = computed(() => route.path)
const currentTitle = computed(() => (route.meta?.title as string) || '')

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
}

const toggleTheme = (val: boolean) => {
  const html = document.documentElement
  if (val) {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

const handleCommand = (command: string) => {
  console.log('command:', command)
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.sidebar {
  background-color: #001529;
  transition: width 0.3s;
  overflow: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-bottom: 1px solid #ffffff1a;
}

.logo-text {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
  padding: 0 20px;
  height: 60px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  cursor: pointer;
  color: var(--text-regular);
  transition: color 0.3s;
}

.collapse-btn:hover {
  color: var(--primary-color);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.username {
  font-size: 14px;
  color: var(--text-primary);
}

.main-content {
  background-color: var(--bg-color);
  padding: 20px;
  overflow-y: auto;
}

:deep(.el-menu) {
  border-right: none;
}

:deep(.el-menu-item.is-active) {
  background-color: var(--sidebar-active) !important;
}
</style>
