<template>
  <el-container class="layout-container">
    <el-header class="layout-header">
      <div class="header-left">
        <el-button
          v-if="isMobile"
          class="menu-toggle"
          :icon="Fold"
          text
          @click="isSidebarCollapsed = !isSidebarCollapsed"
        />
        <div class="logo">
          <el-icon :size="28" color="#409EFF"><Building /></el-icon>
          <span class="logo-text">演艺集团</span>
        </div>
        <el-tabs
          v-model="activeVenueTab"
          class="venue-tabs"
          @tab-change="handleVenueTabChange"
        >
          <el-tab-pane
            v-for="venue in performanceVenues"
            :key="'p-' + venue.ID"
            :name="String(venue.ID)"
            :label="venue.Name"
          />
          <el-tab-pane
            v-if="rehearsalVenues.length > 0"
            name="rehearsal"
            label="排练厅"
          />
        </el-tabs>
      </div>

      <div class="header-center">
        <span class="page-title">{{ currentPageTitle }}</span>
      </div>

      <div class="header-right">
        <el-popover
          placement="bottom-end"
          :width="320"
          trigger="click"
          popper-class="notification-popover"
        >
          <template #reference>
            <el-badge :value="notificationStore.unreadCount" :hidden="notificationStore.unreadCount === 0" class="notification-badge">
              <el-button :icon="Bell" circle text />
            </el-badge>
          </template>
          <div class="notification-header">
            <span>通知消息</span>
            <el-button v-if="notificationStore.unreadCount > 0" link type="primary" size="small" @click="handleMarkAllRead">
              全部已读
            </el-button>
          </div>
          <el-scrollbar max-height="320px">
            <div v-if="notificationStore.notifications.length === 0" class="notification-empty">
              暂无消息
            </div>
            <div
              v-for="n in notificationStore.notifications"
              :key="n.ID"
              class="notification-item"
              :class="{ unread: !n.IsRead }"
              @click="handleNotificationClick(n)"
            >
              <div class="notification-title">{{ n.Title }}</div>
              <div class="notification-content">{{ n.Content }}</div>
              <div class="notification-time">{{ formatTime(n.CreatedAt) }}</div>
            </div>
          </el-scrollbar>
        </el-popover>

        <el-dropdown trigger="click" @command="handleUserCommand">
          <div class="user-info">
            <el-avatar :size="36" class="user-avatar">
              {{ userStore.userName?.charAt(0) || 'U' }}
            </el-avatar>
            <span class="user-name">{{ userStore.userName }}</span>
            <el-icon><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">
                <el-icon><User /></el-icon>个人信息
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
    </el-header>

    <el-container class="layout-body">
      <el-aside
        v-show="!isMobile || !isSidebarCollapsed"
        class="layout-aside"
        :class="{ collapsed: isSidebarCollapsed && isMobile }"
      >
        <el-menu
          :default-active="activeMenu"
          router
          class="side-menu"
          background-color="#001529"
          text-color="#b8c7ce"
          active-text-color="#ffffff"
          :collapse="isSidebarCollapsed && !isMobile"
          :collapse-transition="false"
        >
          <template v-for="route in menuRoutes" :key="route.path">
            <el-menu-item :index="'/' + route.path">
              <el-icon><component :is="route.meta.icon" /></el-icon>
              <template #title>{{ route.meta.title }}</template>
            </el-menu-item>
          </template>
        </el-menu>
      </el-aside>

      <el-main class="layout-main">
        <router-view v-slot="{ Component }">
          <transition name="fade-transform" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>

        <el-drawer
          v-model="drawerVisible"
          title="档期详情"
          direction="rtl"
          size="420px"
        >
          <div v-if="selectedBooking" class="booking-detail">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="档期标题">{{ selectedBooking.Title }}</el-descriptions-item>
              <el-descriptions-item label="场馆">
                {{ bookingStore.venues.find(v => v.ID === selectedBooking.VenueID)?.Name || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="开始时间">{{ selectedBooking.StartTime }}</el-descriptions-item>
              <el-descriptions-item label="结束时间">{{ selectedBooking.EndTime }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="bookingStatusType(selectedBooking.Status)">
                  {{ bookingStatusText(selectedBooking.Status) }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="类型">{{ bookingTypeText(selectedBooking.Type) }}</el-descriptions-item>
              <el-descriptions-item label="备注">{{ selectedBooking.Remarks || '-' }}</el-descriptions-item>
              <el-descriptions-item label="描述">{{ selectedBooking.Description || '-' }}</el-descriptions-item>
            </el-descriptions>
          </div>
          <div v-else class="booking-detail-empty">请选择一个档期查看详情</div>
        </el-drawer>
      </el-main>
    </el-container>

    <el-footer class="layout-footer">
      <div class="footer-stats">
        <div class="stat-item">
          <el-icon color="#409EFF"><OfficeBuilding /></el-icon>
          <span class="stat-label">场馆利用率</span>
          <el-progress
            :percentage="avgVenueUtilization"
            :stroke-width="10"
            :show-text="true"
            :width="100"
          />
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <el-icon color="#67C23A"><SetUp /></el-icon>
          <span class="stat-label">设备空闲率</span>
          <el-progress
            :percentage="bookingStore.stats?.equipmentIdleRate || 0"
            :stroke-width="10"
            status="success"
            :width="100"
          />
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <el-icon color="#E6A23C"><Tickets /></el-icon>
          <span class="stat-label">档期总数</span>
          <span class="stat-value">{{ bookingStore.stats?.monthlyBookings || 0 }}</span>
        </div>
      </div>
    </el-footer>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Fold,
  Bell,
  ArrowDown,
  User,
  Lock,
  SwitchButton,
  Building,
  OfficeBuilding,
  SetUp,
  Tickets,
  Calendar,
  Clock,
  Document,
  Money,
  DataAnalysis
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'
import { useBookingStore } from '@/stores/booking'
import { useNotificationStore } from '@/stores/notification'
import type { Booking, BookingStatus, BookingType, Notification } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const bookingStore = useBookingStore()
const notificationStore = useNotificationStore()

const isMobile = ref(false)
const isSidebarCollapsed = ref(false)
const activeVenueTab = ref('')
const drawerVisible = ref(false)
const selectedBooking = ref<Booking | null>(null)

const menuRoutes = computed(() => {
  const routes = router.options.routes.find(r => r.path === '/')?.children || []
  return routes.filter(r => {
    if (r.meta?.roles) {
      return userStore.hasRole(r.meta.roles as any)
    }
    return true
  })
})

const activeMenu = computed(() => route.path)

const currentPageTitle = computed(() => (route.meta.title as string) || '')

const performanceVenues = computed(() => bookingStore.performanceVenues)
const rehearsalVenues = computed(() => bookingStore.rehearsalVenues)

const avgVenueUtilization = computed(() => {
  const list = bookingStore.stats?.venueUtilization || []
  if (list.length === 0) return 0
  const sum = list.reduce((acc, item) => acc + item.rate, 0)
  return Math.round(sum / list.length)
})

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value) isSidebarCollapsed.value = true
}

const handleVenueTabChange = (name: string) => {
  if (name === 'rehearsal') {
    bookingStore.selectedVenueIds = rehearsalVenues.value.map(v => v.ID)
  } else {
    const id = Number(name)
    bookingStore.selectedVenueIds = [id]
  }
  bookingStore.fetchBookings()
}

const handleMarkAllRead = async () => {
  await notificationStore.markAllRead()
  ElMessage.success('已全部标记为已读')
}

const handleNotificationClick = async (n: Notification) => {
  if (!n.IsRead) {
    await notificationStore.markRead(n.ID)
  }
}

const handleUserCommand = (command: string) => {
  switch (command) {
    case 'profile':
      ElMessage.info('个人信息功能开发中')
      break
    case 'password':
      ElMessage.info('修改密码功能开发中')
      break
    case 'logout':
      ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => {
          userStore.logout()
          router.push('/login')
        })
        .catch(() => {})
      break
  }
}

const bookingStatusType = (status: BookingStatus) => {
  const map: Record<BookingStatus, string> = {
    pending: 'warning',
    confirmed: 'success',
    conflict: 'danger',
    maintenance: 'info',
    cancelled: 'info'
  }
  return map[status] as any
}

const bookingStatusText = (status: BookingStatus) => {
  const map: Record<BookingStatus, string> = {
    pending: '待确认',
    confirmed: '已确认',
    conflict: '冲突',
    maintenance: '维护',
    cancelled: '已取消'
  }
  return map[status]
}

const bookingTypeText = (type: BookingType) => {
  const map: Record<BookingType, string> = {
    performance: '演出',
    rehearsal: '排练',
    maintenance: '维护'
  }
  return map[type]
}

const formatTime = (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm')

onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', checkMobile)

  await userStore.fetchUser()
  await bookingStore.fetchVenues()
  await bookingStore.fetchBookings()
  await bookingStore.fetchStats()
  await notificationStore.fetchNotifications()

  if (performanceVenues.value.length > 0) {
    activeVenueTab.value = String(performanceVenues.value[0].ID)
  } else if (rehearsalVenues.value.length > 0) {
    activeVenueTab.value = 'rehearsal'
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
})

defineExpose({
  showBookingDetail: (booking: Booking) => {
    selectedBooking.value = booking
    drawerVisible.value = true
  }
})
</script>

<style lang="scss" scoped>
.layout-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  padding: 0 16px;
  height: 60px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  z-index: 10;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;

    .menu-toggle {
      padding: 4px;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;

      .logo-text {
        font-size: 18px;
        font-weight: 600;
        color: #303133;
      }
    }

    .venue-tabs {
      :deep(.el-tabs__header) {
        margin: 0;
        border: none;
      }
      :deep(.el-tabs__nav-wrap::after) {
        height: 0;
      }
      :deep(.el-tabs__item) {
        height: 60px;
        line-height: 60px;
        font-size: 14px;
      }
    }
  }

  .header-center {
    flex: 1;
    text-align: center;

    .page-title {
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    justify-content: flex-end;

    .notification-badge {
      :deep(.el-badge__content) {
        top: 4px;
        right: 4px;
      }
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;

      &:hover {
        background: #f5f7fa;
      }

      .user-avatar {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        font-weight: 600;
      }

      .user-name {
        font-size: 14px;
        color: #303133;
      }
    }
  }
}

.layout-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.layout-aside {
  width: 200px;
  background: #001529;
  overflow-y: auto;
  transition: width 0.2s;

  &.collapsed {
    width: 0;
  }

  :deep(.el-menu) {
    border-right: none;
  }

  :deep(.el-menu-item) {
    height: 50px;
    line-height: 50px;
  }

  :deep(.el-menu-item:hover) {
    background-color: rgba(255, 255, 255, 0.06) !important;
  }

  :deep(.el-menu-item.is-active) {
    background-color: #409EFF !important;
  }
}

.layout-main {
  flex: 1;
  padding: 16px;
  background: #f5f7fa;
  overflow-y: auto;
  position: relative;
}

.layout-footer {
  height: 60px;
  background: #fff;
  border-top: 1px solid #e4e7ed;
  padding: 0 24px;
  display: flex;
  align-items: center;
  flex-shrink: 0;

  .footer-stats {
    display: flex;
    align-items: center;
    gap: 24px;
    width: 100%;
    max-width: 700px;
    margin: 0 auto;

    .stat-item {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;

      .stat-label {
        font-size: 13px;
        color: #606266;
        min-width: 72px;
      }

      .stat-value {
        font-size: 20px;
        font-weight: 600;
        color: #E6A23C;
      }
    }

    .stat-divider {
      width: 1px;
      height: 32px;
      background: #e4e7ed;
    }
  }
}

.booking-detail {
  :deep(.el-descriptions__label) {
    width: 90px;
  }
}

.booking-detail-empty {
  text-align: center;
  color: #909399;
  padding: 60px 0;
  font-size: 14px;
}

:deep(.notification-popover) {
  padding: 0;

  .notification-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #ebeef5;
    font-weight: 600;
    font-size: 14px;
  }

  .notification-empty {
    padding: 40px;
    text-align: center;
    color: #909399;
    font-size: 14px;
  }

  .notification-item {
    padding: 12px 16px;
    border-bottom: 1px solid #f2f6fc;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: #f5f7fa;
    }

    &.unread {
      background: #ecf5ff;

      .notification-title {
        font-weight: 600;
      }
    }

    .notification-title {
      font-size: 14px;
      color: #303133;
      margin-bottom: 4px;
    }

    .notification-content {
      font-size: 12px;
      color: #606266;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .notification-time {
      font-size: 11px;
      color: #909399;
    }
  }
}

.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.3s;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

@media (max-width: 768px) {
  .layout-header {
    padding: 0 8px;

    .header-left {
      .logo-text {
        display: none;
      }

      .venue-tabs {
        :deep(.el-tabs__item) {
          padding: 0 10px;
          font-size: 12px;
        }
      }
    }

    .header-center {
      display: none;
    }

    .header-right {
      .user-name {
        display: none;
      }
    }
  }

  .layout-footer {
    padding: 0 8px;

    .footer-stats {
      gap: 8px;

      .stat-item {
        gap: 6px;

        .stat-label {
          min-width: auto;
          font-size: 11px;
        }

        .stat-value {
          font-size: 16px;
        }
      }
    }
  }
}
</style>
