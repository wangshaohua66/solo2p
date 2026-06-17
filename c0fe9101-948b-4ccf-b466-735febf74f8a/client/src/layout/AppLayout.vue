<template>
  <div class="app-layout" :class="{ collapsed: userStore.sidebarCollapsed, 'is-mobile': userStore.isMobile }">
    <aside v-show="!userStore.isMobile || showMobileSidebar" class="sidebar" :class="{ 'mobile-sidebar': userStore.isMobile }">
      <div class="logo-area" @click="router.push('/dashboard')">
        <el-icon :size="24" color="#fff"><PawPrint /></el-icon>
        <span v-if="!userStore.sidebarCollapsed" class="logo-text">宠物医疗</span>
      </div>
      <el-scrollbar class="sidebar-scroll">
        <el-menu
          :default-active="activeMenu"
          :collapse="userStore.sidebarCollapsed && !userStore.isMobile"
          :collapse-transition="false"
          router
          background-color="#001529"
          text-color="#b7c3cc"
          active-text-color="#fff"
          class="side-menu"
          @select="() => { if (userStore.isMobile) showMobileSidebar = false }"
        >
          <template v-for="item in menuItems" :key="item.path">
            <el-menu-item v-if="hasRole(item.roles)" :index="item.path">
              <el-icon><component :is="item.icon" /></el-icon>
              <template #title>{{ item.title }}</template>
            </el-menu-item>
          </template>
        </el-menu>
      </el-scrollbar>
    </aside>
    <el-drawer v-if="userStore.isMobile" v-model="showMobileSidebar" size="80%" :with-header="false" class="mobile-drawer" />
    <div class="main-area">
      <header class="header">
        <div class="header-left">
          <el-button text size="large" class="toggle-btn" @click="toggleSidebar">
            <el-icon :size="20">
              <component :is="userStore.isMobile ? (showMobileSidebar ? Close : Menu) : (userStore.sidebarCollapsed ? Expand : Fold)" />
            </el-icon>
          </el-button>
          <el-breadcrumb separator="/" class="desktop-only">
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
          <el-select
            v-if="userStore.isDirector || userStore.isManager"
            v-model="selectedHospitalId"
            placeholder="全部院区"
            class="hospital-select"
            clearable
            size="default"
            @change="onHospitalChange"
          >
            <el-option v-for="h in userStore.hospitals" :key="h.id" :label="h.name" :value="h.id">
              <span>{{ h.name }}</span>
              <el-tag v-if="h.type === 'emergency_24h'" type="danger" effect="dark" size="small" style="margin-left:8px">24H</el-tag>
            </el-option>
          </el-select>
        </div>
        <div class="header-right">
          <el-badge v-if="!userStore.isMobile" :value="userStore.unreadCount" :hidden="!userStore.unreadCount" class="desktop-only">
            <el-button text size="large" @click="notifDrawer = true">
              <el-icon :size="20"><Bell /></el-icon>
            </el-button>
          </el-badge>
          <el-dropdown trigger="click" @command="onUserCommand">
            <div class="user-info">
              <el-avatar :size="34" :style="avatarBg">
                {{ userStore.userInfo?.real_name?.charAt(0) || 'U' }}
              </el-avatar>
              <div v-if="!userStore.isMobile" class="user-meta">
                <div class="name">{{ userStore.userInfo?.real_name }}</div>
                <div class="role">{{ roleLabel }}</div>
              </div>
              <el-icon class="arrow"><CaretBottom /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>个人中心
                </el-dropdown-item>
                <el-dropdown-item command="password">
                  <el-icon><Lock /></el-icon>修改密码
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <main class="content">
        <router-view v-slot="{ Component, route }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </transition>
        </router-view>
      </main>
      <div v-if="userStore.isMobile" class="mobile-tabbar">
        <div
          v-for="item in tabbarItems"
          :key="item.path"
          class="tab-item"
          :class="{ active: route.path.startsWith(item.path) }"
          @click="router.push(item.path)"
        >
          <el-icon :size="22"><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
        </div>
      </div>
    </div>
    <el-drawer v-model="notifDrawer" title="消息通知" size="380px" direction="rtl">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
          <span style="font-weight:600">消息通知 <el-tag type="danger" v-if="userStore.unreadCount" size="small">{{ userStore.unreadCount }}条未读</el-tag></span>
          <el-button link type="primary" :disabled="!userStore.unreadCount" @click="userStore.markAllRead()">全部已读</el-button>
        </div>
      </template>
      <el-empty v-if="!userStore.notifications.length" description="暂无通知" />
      <el-scrollbar v-else>
        <div v-for="n in userStore.notifications" :key="n.id" class="notif-item" :class="{ unread: !n.is_read }" @click="markRead(n)">
          <div class="notif-head">
            <el-tag :type="notifTypeColor(n.type)" effect="light" size="small">{{ notifTypeLabel(n.type) }}</el-tag>
            <span class="time">{{ fromNow(n.created_at) }}</span>
          </div>
          <div class="notif-title">{{ n.title }}</div>
          <div v-if="n.content" class="notif-content">{{ truncate(n.content, 80) }}</div>
        </div>
      </el-scrollbar>
    </el-drawer>
    <el-dialog v-model="passwordDialog" title="修改密码" width="400px">
      <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="88px">
        <el-form-item label="原密码" prop="old"><el-input v-model="pwdForm.old" type="password" show-password /></el-form-item>
        <el-form-item label="新密码" prop="new"><el-input v-model="pwdForm.new" type="password" show-password /></el-form-item>
        <el-form-item label="确认密码" prop="confirm"><el-input v-model="pwdForm.confirm" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialog = false">取消</el-button>
        <el-button type="primary" :loading="pwdLoading" @click="changePassword">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, ElNotification, type FormInstance, type FormRules } from 'element-plus'
import {
  Menu, Fold, Expand, Close, Bell, User, Lock, SwitchButton, CaretBottom,
  DataBoard, Document, HomeFilled, Microscope, Medicine, Calendar, TrendCharts, PawPrint
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores'
import { authApi } from '@/api'
import { ROLE_LABELS, NOTIF_TYPE_LABELS, type NotifType } from '@/types'
import { fromNow, truncate } from '@/utils'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const showMobileSidebar = ref(false)
const notifDrawer = ref(false)
const passwordDialog = ref(false)
const pwdLoading = ref(false)
const pwdFormRef = ref<FormInstance>()
const selectedHospitalId = ref<number | null>(userStore.currentHospital?.id || null)
const pwdForm = reactive({ old: '', new: '', confirm: '' })

const menuItems = [
  { path: '/dashboard', title: '工作台', icon: DataBoard, roles: ['doctor', 'lab_tech', 'pharmacist', 'nurse', 'manager', 'director'] },
  { path: '/medical', title: '病历管理', icon: Document, roles: ['doctor', 'nurse', 'manager', 'director'] },
  { path: '/hospitalization', title: '住院管理', icon: HomeFilled, roles: ['doctor', 'nurse', 'manager', 'director'] },
  { path: '/lab', title: '检验中心', icon: Microscope, roles: ['doctor', 'lab_tech', 'nurse', 'manager', 'director'] },
  { path: '/pharmacy', title: '药房管理', icon: Medicine, roles: ['doctor', 'pharmacist', 'manager', 'director'] },
  { path: '/schedule', title: '排班调度', icon: Calendar, roles: ['doctor', 'lab_tech', 'pharmacist', 'nurse', 'manager', 'director'] },
  { path: '/report', title: '经营报表', icon: TrendCharts, roles: ['manager', 'director'] }
]

const tabbarItems = computed(() => menuItems.filter(m => hasRole(m.roles)))

function hasRole(roles: string[]) {
  return roles.includes(userStore.userInfo?.role || '')
}

function notifTypeLabel(t: string) { return NOTIF_TYPE_LABELS[t as NotifType] || t }
function notifTypeColor(t: string) {
  const map: Record<string, any> = { lab_result: 'danger', prescription: 'warning', schedule: 'info', emergency: 'danger', system: '' }
  return map[t] || ''
}

const avatarColors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#8B5CF6']
const avatarBg = computed(() => ({ background: avatarColors[(userStore.userInfo?.id || 0) % avatarColors.length] }))
const roleLabel = computed(() => ROLE_LABELS[userStore.userInfo?.role as keyof typeof ROLE_LABELS] || '')

const activeMenu = computed(() => {
  const path = route.path
  if (path.startsWith('/medical')) return '/medical'
  if (path.startsWith('/pets')) return '/medical'
  return path
})
const currentTitle = computed(() => route.meta?.title as string || '')

watch(() => route.path, () => window.scrollTo(0, 0))
watch(selectedHospitalId, (id) => userStore.setCurrentHospital(id ? userStore.hospitals.find(h => h.id === id) || null : null))

function onHospitalChange(id: number | null) {
  userStore.setCurrentHospital(id ? userStore.hospitals.find(h => h.id === id) || null : null)
}

function toggleSidebar() {
  if (userStore.isMobile) {
    showMobileSidebar.value = !showMobileSidebar.value
  } else {
    userStore.toggleSidebar()
  }
}

async function markRead(n: any) {
  await userStore.markNotificationRead(n.id)
}

const pwdRules: FormRules = {
  old: [{ required: true, message: '请输入原密码' }],
  new: [{ required: true, message: '请输入新密码' }, { min: 6, message: '至少6位' }],
  confirm: [
    { required: true, message: '请确认密码' },
    { validator: (_r, v, cb) => { v === pwdForm.new ? cb() : cb(new Error('两次密码不一致')) } }
  ]
}

async function changePassword() {
  if (!pwdFormRef.value) return
  await pwdFormRef.value.validate(async (valid) => {
    if (!valid) return
    pwdLoading.value = true
    try {
      const res = await authApi.changePassword(pwdForm.old, pwdForm.new)
      if (res.code === 200) {
        ElMessage.success('修改成功')
        passwordDialog.value = false
        pwdForm.old = pwdForm.new = pwdForm.confirm = ''
      }
    } finally { pwdLoading.value = false }
  })
}

function onUserCommand(cmd: string) {
  if (cmd === 'profile') ElMessage.info('个人中心功能建设中')
  else if (cmd === 'password') passwordDialog.value = true
  else if (cmd === 'logout') {
    ElMessageBox.confirm('确定退出登录吗？', '提示', { type: 'warning' }).then(async () => {
      await userStore.logout()
      router.replace('/login')
    }).catch(() => {})
  }
}

const resizeHandler = () => {
  userStore.updateIsMobile(window.innerWidth < 768)
  if (window.innerWidth >= 768) showMobileSidebar.value = false
}

let notifTimer: number | undefined
onMounted(() => {
  resizeHandler()
  window.addEventListener('resize', resizeHandler)
  if (userStore.isLoggedIn && userStore.hospitals.length === 0) userStore.loadHospitals()
  if (userStore.unreadCount > 0) {
    ElNotification({ title: '新消息', message: `您有${userStore.unreadCount}条未读通知`, type: 'warning' })
  }
  notifTimer = window.setInterval(() => { if (userStore.isLoggedIn) userStore.loadNotifications() }, 60000)
})
onUnmounted(() => {
  window.removeEventListener('resize', resizeHandler)
  if (notifTimer) clearInterval(notifTimer)
})
</script>

<style scoped lang="scss">
.app-layout {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: var(--sidebar-width);
  background: #001529;
  flex-shrink: 0;
  transition: width 0.3s;
  display: flex;
  flex-direction: column;
  &.mobile-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 998;
  }
  .collapsed & { width: var(--sidebar-width-collapsed); }
  .logo-area {
    height: var(--header-height);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 20px;
    color: #fff;
    cursor: pointer;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 2px;
    .logo-text { white-space: nowrap; }
  }
  .sidebar-scroll { flex: 1; }
  .side-menu {
    border-right: none;
    :deep(.el-menu-item) { height: 48px; line-height: 48px; }
    :deep(.el-menu-item.is-active) {
      background: linear-gradient(90deg, rgba(64,158,255,0.2), transparent);
      &::before {
        content: '';
        position: absolute;
        left: 0; top: 0; bottom: 0;
        width: 3px;
        background: #409EFF;
      }
    }
  }
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.header {
  height: var(--header-height);
  background: #fff;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
  z-index: 10;
  .header-left, .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .toggle-btn { padding: 8px; }
  .hospital-select { min-width: 220px; max-width: 280px; }
  .user-info {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 8px;
    transition: background 0.2s;
    &:hover { background: var(--bg-color); }
    .user-meta {
      line-height: 1.2;
      .name { font-size: 14px; font-weight: 500; color: var(--text-primary); }
      .role { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
    }
    .arrow { color: var(--text-secondary); font-size: 12px; }
  }
}

.content {
  flex: 1;
  overflow: auto;
  background: var(--bg-color);
  padding-bottom: var(--footer-height);
  @include respond-to(mobile) { padding-bottom: 70px; }
}

.mobile-tabbar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 60px;
  background: #fff;
  border-top: 1px solid var(--border-light);
  display: none;
  z-index: 100;
  @include respond-to(mobile) { display: grid; grid-template-columns: repeat(5, 1fr); }
  .tab-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--text-secondary);
    font-size: 11px;
    cursor: pointer;
    &.active { color: var(--primary-color); }
  }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.notif-item {
  padding: 14px;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
  transition: background 0.2s;
  &:hover { background: var(--bg-color); }
  &.unread { background: rgba(64,158,255,0.04); }
  .notif-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .time { font-size: 12px; color: var(--text-secondary); }
  .notif-title { font-size: 14px; font-weight: 500; color: var(--text-primary); margin-bottom: 4px; }
  .notif-content { font-size: 13px; color: var(--text-regular); line-height: 1.5; }
}
</style>
