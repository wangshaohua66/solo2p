<template>
  <div class="main-layout">
    <aside class="sidebar" :class="{ collapsed: isCollapsed }">
      <div class="sidebar-header">
        <div class="logo">
          <el-icon :size="28" color="#fff"><OfficeBuilding /></el-icon>
          <span v-show="!isCollapsed" class="logo-text">律所管理系统</span>
        </div>
      </div>
      <el-menu
        :default-active="route.path"
        router
        background-color="#1a202c"
        text-color="#a0aec0"
        active-text-color="#4299e1"
        :collapse="isCollapsed"
        :collapse-transition="false"
        class="sidebar-menu"
      >
        <template v-for="item in menuList" :key="item.path">
          <el-menu-item v-if="!item.hidden && (!item.roles || hasRole(item.roles))" :index="item.path">
            <el-icon><component :is="item.icon" /></el-icon>
            <template #title>{{ item.title }}</template>
          </el-menu-item>
        </template>
      </el-menu>
      <div class="sidebar-footer" v-show="!isCollapsed">
        <div class="warning-tip" v-if="warningCount > 0">
          <el-badge :value="warningCount" class="warning-badge">
            <el-icon :size="16"><Warning /></el-icon>
            <span>{{ warningCount }}条时效预警</span>
          </el-badge>
        </div>
      </div>
    </aside>

    <div class="main-wrapper">
      <header class="top-header">
        <div class="header-left">
          <el-icon class="collapse-btn" :size="20" @click="isCollapsed = !isCollapsed">
            <Fold v-if="!isCollapsed" />
            <Expand v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="route.meta.title">{{ route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-badge :value="alertCount" class="alert-badge" :hidden="alertCount === 0">
            <el-button type="primary" link @click="showAlerts = true">
              <el-icon :size="18"><Bell /></el-icon>
            </el-button>
          </el-badge>
          <el-button link @click="goPortal" v-if="userStore.isPartner">
            <el-icon :size="18"><Link /></el-icon>
          </el-button>
          <el-dropdown trigger="click" @command="handleUserCommand">
            <div class="user-info">
              <el-avatar :size="32" :src="userStore.user?.avatar">
                {{ userStore.fullName?.charAt(0) }}
              </el-avatar>
              <span class="user-name">{{ userStore.fullName }}</span>
              <span class="user-role">{{ userStore.user?.role_display }}</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>个人中心
                </el-dropdown-item>
                <el-dropdown-item command="password">
                  <el-icon><Key /></el-icon>修改密码
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <el-drawer v-model="showAlerts" title="预警提醒" size="380px">
      <div class="alerts-list">
        <el-empty v-if="alerts.length === 0" description="暂无预警" />
        <div v-for="a in alerts" :key="a.id" class="alert-item">
          <div class="alert-level" :class="a.level">
            <el-icon><Warning /></el-icon>
          </div>
          <div class="alert-body">
            <p class="alert-msg">{{ a.message }}</p>
            <p class="alert-time">{{ formatTime(a.created_at) }}</p>
          </div>
        </div>
      </div>
    </el-drawer>

    <el-dialog v-model="showPwdDialog" title="修改密码" width="420px">
      <el-form :model="pwdForm" :rules="pwdRules" ref="pwdFormRef" label-width="90px">
        <el-form-item label="原密码" prop="old_password">
          <el-input v-model="pwdForm.old_password" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码" prop="new_password">
          <el-input v-model="pwdForm.new_password" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirm_password">
          <el-input v-model="pwdForm.confirm_password" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPwdDialog = false">取消</el-button>
        <el-button type="primary" @click="handleChangePwd">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  OfficeBuilding, Fold, Expand, Bell, Link, Warning, User, Key, SwitchButton
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { useCaseStore } from '@/stores/case'
import { useEvidenceStore } from '@/stores/evidence'
import dayjs from 'dayjs'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const caseStore = useCaseStore()
const evidenceStore = useEvidenceStore()

const isCollapsed = ref(false)
const showAlerts = ref(false)
const showPwdDialog = ref(false)
const pwdFormRef = ref<FormInstance>()
const pwdForm = ref({ old_password: '', new_password: '', confirm_password: '' })
const pwdRules: FormRules = {
  old_password: [{ required: true, message: '请输入原密码' }],
  new_password: [{ required: true, min: 6, message: '密码至少6位' }],
  confirm_password: [{
    validator: (_r, v, cb) => {
      if (v !== pwdForm.value.new_password) cb(new Error('两次密码不一致'))
      else cb()
    }
  }]
}

const menuList = computed(() => [
  { path: '/dashboard', title: '工作台', icon: 'DataBoard' },
  { path: '/cases', title: '案件管理', icon: 'Document' },
  { path: '/calendar', title: '庭审日程', icon: 'Calendar' },
  { path: '/evidence', title: '证据中心', icon: 'FolderOpened' },
  { path: '/billing', title: '工时计费', icon: 'Money' },
  { path: '/templates', title: '文书模板', icon: 'Tickets' },
  { path: '/clients', title: '客户管理', icon: 'UserFilled' },
  { path: '/contracts', title: '合同管理', icon: 'Notebook' },
  { path: '/users', title: '人员管理', icon: 'Avatar', roles: ['admin', 'partner'] }
])

const warningCount = computed(() => caseStore.warningList.filter((w: any) => (w.days_left ?? 31) <= 30).length)
const alertCount = computed(() => evidenceStore.alerts.filter(a => !a.is_read).length)
const alerts = computed(() => evidenceStore.alerts)

function hasRole(roles: string[]) {
  return roles.includes(userStore.user?.role || '')
}

function formatTime(t: string) {
  return dayjs(t).format('YYYY-MM-DD HH:mm')
}

function handleUserCommand(cmd: string) {
  if (cmd === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' }).then(() => {
      userStore.logout()
    }).catch(() => {})
  } else if (cmd === 'profile') {
    router.push('/profile')
  } else if (cmd === 'password') {
    showPwdDialog.value = true
  }
}

async function handleChangePwd() {
  if (!pwdFormRef.value) return
  await pwdFormRef.value.validate()
  try {
    await userStore.changePassword(pwdForm.value as any)
    ElMessage.success('密码修改成功')
    showPwdDialog.value = false
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

function goPortal() {
  window.open('/portal', '_blank')
}

onMounted(async () => {
  try {
    await Promise.all([
      caseStore.fetchWarnings(),
      evidenceStore.fetchAlerts({ is_read: 'false' })
    ])
  } catch (e) {}
})
</script>

<style lang="scss" scoped>
.main-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
.sidebar {
  width: 240px;
  background: #1a202c;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  flex-shrink: 0;
  &.collapsed { width: 64px; }
  .sidebar-header {
    height: 60px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #fff;
    }
    .logo-text {
      font-size: 16px;
      font-weight: 600;
      white-space: nowrap;
    }
  }
  .sidebar-menu {
    flex: 1;
    border: none !important;
    :deep(.el-menu-item) {
      height: 48px;
      line-height: 48px;
      &.is-active {
        background: rgba(66, 153, 225, 0.15) !important;
        border-right: 3px solid #4299e1;
      }
      &:hover {
        background: rgba(255, 255, 255, 0.05) !important;
      }
    }
  }
  .sidebar-footer {
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    .warning-tip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: rgba(214, 158, 46, 0.1);
      border-radius: 6px;
      color: #d69e2e;
      font-size: 12px;
    }
    .warning-badge {
      :deep(.el-badge__content) { background: #d69e2e; }
    }
  }
}
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #f7fafc;
}
.top-header {
  height: 60px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
  .header-left {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .collapse-btn {
    cursor: pointer;
    color: #4a5568;
    &:hover { color: #1e3a5f; }
  }
  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .user-info {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
    &:hover { background: #f7fafc; }
    .user-name {
      font-size: 14px;
      color: #2d3748;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .user-role {
      font-size: 12px;
      color: #a0aec0;
      background: #edf2f7;
      padding: 2px 6px;
      border-radius: 4px;
    }
  }
}
.main-content {
  flex: 1;
  overflow: auto;
  padding: 20px;
}
.alerts-list {
  .alert-item {
    display: flex;
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid #edf2f7;
    .alert-level {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: #fff;
      &.info { background: #3182ce; }
      &.warning { background: #d69e2e; }
      &.danger { background: #e53e3e; }
      &.critical { background: #c53030; animation: pulse-danger 1.5s infinite; }
    }
    .alert-body {
      flex: 1;
      .alert-msg { font-size: 13px; color: #2d3748; margin-bottom: 4px; }
      .alert-time { font-size: 12px; color: #a0aec0; }
    }
  }
}
@keyframes pulse-danger { 50% { opacity: 0.6; } }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
