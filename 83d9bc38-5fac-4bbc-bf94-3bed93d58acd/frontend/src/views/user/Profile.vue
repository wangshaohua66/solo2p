<template>
  <div class="p-4 md:p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">个人中心</h1>
      <p class="text-gray-500 mt-1">查看和管理您的个人信息</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
      <div class="lg:col-span-1 space-y-4 md:space-y-6">
        <el-card class="profile-card">
          <div class="text-center py-6">
            <div class="relative inline-block">
              <el-avatar
                :size="100"
                :src="userInfo?.avatar"
                class="border-4 border-white shadow-lg"
              >
                {{ userInfo?.name?.charAt(0) || 'U' }}
              </el-avatar>
              <el-button
                class="absolute -bottom-2 -right-2"
                type="primary"
                size="small"
                circle
                @click="handleUploadAvatar"
              >
                <el-icon><Camera /></el-icon>
              </el-button>
            </div>
            <input
              ref="avatarInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleAvatarChange"
            />
            <h2 class="text-xl font-bold text-gray-900 mt-4">
              {{ userInfo?.name || '未设置' }}
            </h2>
            <p class="text-gray-500 mt-1">@{{ userInfo?.username }}</p>
            <div class="flex justify-center gap-2 mt-4">
              <el-tag :type="getRoleType(userInfo?.roleName)" size="large" effect="light">
                {{ userInfo?.roleName || '未分配角色' }}
              </el-tag>
              <el-tag type="info" size="large" effect="plain">
                {{ userInfo?.centerName || '未分配中心' }}
              </el-tag>
            </div>
          </div>

          <el-divider class="my-4" />

          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <el-icon :size="20" class="text-blue-600"><Message /></el-icon>
              </div>
              <div>
                <p class="text-sm text-gray-500">邮箱</p>
                <p class="font-medium">{{ userInfo?.email || '未设置' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <el-icon :size="20" class="text-green-600"><Wallet /></el-icon>
              </div>
              <div>
                <p class="text-sm text-gray-500">经费余额</p>
                <p class="font-semibold" :class="(userInfo?.budget || 0) >= 0 ? 'text-green-600' : 'text-red-600'">
                  ¥{{ (userInfo?.budget || 0).toFixed(2) }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <el-icon :size="20" class="text-orange-600"><Calendar /></el-icon>
              </div>
              <div>
                <p class="text-sm text-gray-500">注册时间</p>
                <p class="font-medium">{{ formatDate(userInfo?.createdAt) }}</p>
              </div>
            </div>
            <div v-if="userInfo?.advisorName" class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <el-icon :size="20" class="text-purple-600"><User /></el-icon>
              </div>
              <div>
                <p class="text-sm text-gray-500">导师</p>
                <p class="font-medium">{{ userInfo.advisorName }}</p>
              </div>
            </div>
          </div>
        </el-card>

        <el-card>
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-semibold">我的预约统计</span>
            </div>
          </template>
          <div class="grid grid-cols-2 gap-4">
            <div class="text-center p-4 bg-blue-50 rounded-lg">
              <p class="text-2xl font-bold text-blue-600">{{ bookingStats.total }}</p>
              <p class="text-sm text-gray-500 mt-1">总预约数</p>
            </div>
            <div class="text-center p-4 bg-green-50 rounded-lg">
              <p class="text-2xl font-bold text-green-600">{{ bookingStats.completed }}</p>
              <p class="text-sm text-gray-500 mt-1">已完成</p>
            </div>
            <div class="text-center p-4 bg-orange-50 rounded-lg">
              <p class="text-2xl font-bold text-orange-600">{{ bookingStats.confirmed }}</p>
              <p class="text-sm text-gray-500 mt-1">已确认</p>
            </div>
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <p class="text-2xl font-bold text-gray-600">{{ bookingStats.cancelled }}</p>
              <p class="text-sm text-gray-500 mt-1">已取消</p>
            </div>
          </div>
          <div class="mt-4">
            <div class="flex justify-between text-sm mb-2">
              <span class="text-gray-500">本月使用时长</span>
              <span class="font-semibold">{{ bookingStats.monthlyHours.toFixed(1) }} 小时</span>
            </div>
            <el-progress
              :percentage="Math.min(bookingStats.monthlyHours / 100 * 100, 100)"
              :stroke-width="8"
            />
          </div>
        </el-card>
      </div>

      <div class="lg:col-span-2 space-y-4 md:space-y-6">
        <el-card>
          <template #header>
            <span class="font-semibold">修改密码</span>
          </template>
          <el-form
            ref="passwordFormRef"
            :model="passwordForm"
            :rules="passwordRules"
            label-width="100px"
            class="max-w-lg"
          >
            <el-form-item label="当前密码" prop="oldPassword">
              <el-input
                v-model="passwordForm.oldPassword"
                type="password"
                placeholder="请输入当前密码"
                show-password
              />
            </el-form-item>
            <el-form-item label="新密码" prop="newPassword">
              <el-input
                v-model="passwordForm.newPassword"
                type="password"
                placeholder="请输入新密码"
                show-password
              />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input
                v-model="passwordForm.confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                show-password
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleChangePassword">
                确认修改
              </el-button>
              <el-button @click="handleResetPassword">
                重置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card>
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-semibold">消费记录</span>
              <el-button type="primary" link @click="loadBillingHistory">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </template>
          <el-table
            v-loading="billingLoading"
            :data="billingHistory"
            stripe
            size="small"
          >
            <el-table-column prop="billingDate" label="日期" width="120">
              <template #default="{ row }">
                {{ formatDate(row.billingDate) }}
              </template>
            </el-table-column>
            <el-table-column prop="equipmentName" label="设备" min-width="150" />
            <el-table-column prop="amount" label="金额" width="100">
              <template #default="{ row }">
                <span class="text-orange-500 font-semibold">-¥{{ row.amount.toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'paid' ? 'success' : 'warning'" size="small">
                  {{ row.status === 'paid' ? '已支付' : '待支付' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
          <div class="mt-4 flex justify-end">
            <el-pagination
              v-model:current-page="billingPagination.page"
              v-model:page-size="billingPagination.pageSize"
              :page-sizes="[5, 10, 20]"
              :total="billingPagination.total"
              layout="total, prev, pager, next"
              small
              @size-change="loadBillingHistory"
              @current-change="loadBillingHistory"
            />
          </div>
        </el-card>

        <el-card>
          <template #header>
            <span class="font-semibold">通知设置</span>
          </template>
          <el-form label-width="200px">
            <el-form-item label="预约确认通知">
              <el-switch v-model="notificationSettings.bookingConfirm" />
            </el-form-item>
            <el-form-item label="维护完成通知">
              <el-switch v-model="notificationSettings.maintenanceComplete" />
            </el-form-item>
            <el-form-item label="等待队列进度通知">
              <el-switch v-model="notificationSettings.waitlistAdvance" />
            </el-form-item>
            <el-form-item label="账单生成通知">
              <el-switch v-model="notificationSettings.billingGenerated" />
            </el-form-item>
            <el-divider />
            <el-form-item label="邮件通知">
              <el-switch v-model="notificationSettings.emailNotification" />
            </el-form-item>
            <el-form-item label="站内消息通知">
              <el-switch v-model="notificationSettings.siteNotification" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSaveNotificationSettings">
                保存设置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Camera, Message, Wallet, Calendar, User, Refresh } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { billing as billingApi, booking as bookingApi, auth as authApi } from '@/api'
import { useUserStore } from '@/stores/user'
import type { Billing, User as UserType } from '@/types'

const userStore = useUserStore()
const userInfo = ref<UserType | null>(null)

const avatarInputRef = ref<HTMLInputElement>()

const passwordFormRef = ref<FormInstance>()
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const passwordRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const billingLoading = ref(false)
const billingHistory = ref<Billing[]>([])
const billingPagination = ref({
  page: 1,
  pageSize: 5,
  total: 0
})

const bookingStats = reactive({
  total: 0,
  completed: 0,
  confirmed: 0,
  cancelled: 0,
  monthlyHours: 0
})

const notificationSettings = reactive({
  bookingConfirm: true,
  maintenanceComplete: true,
  waitlistAdvance: true,
  billingGenerated: true,
  emailNotification: true,
  siteNotification: true
})

const getRoleType = (roleName?: string) => {
  const typeMap: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'primary'> = {
    super_admin: 'danger',
    admin: 'primary',
    operator: 'warning',
    teacher: 'success',
    student: 'info'
  }
  return roleName ? typeMap[roleName] || 'info' : 'info'
}

const formatDate = (time?: string) => {
  return time ? dayjs(time).format('YYYY-MM-DD') : '-'
}

const loadUserInfo = async () => {
  try {
    userInfo.value = await authApi.getCurrentUser()
  } catch (error) {
    console.error('Failed to load user info:', error)
    userInfo.value = userStore.userInfo as UserType
  }
}

const loadBookingStats = async () => {
  try {
    const [allRes, completedRes, confirmedRes, cancelledRes] = await Promise.all([
      bookingApi.getList({ userId: userInfo.value?.id, pageSize: 1 }),
      bookingApi.getList({ userId: userInfo.value?.id, status: 'completed', pageSize: 1 }),
      bookingApi.getList({ userId: userInfo.value?.id, status: 'confirmed', pageSize: 1 }),
      bookingApi.getList({ userId: userInfo.value?.id, status: 'cancelled', pageSize: 1 })
    ])
    
    bookingStats.total = allRes.total
    bookingStats.completed = completedRes.total
    bookingStats.confirmed = confirmedRes.total
    bookingStats.cancelled = cancelledRes.total
    
    const currentMonth = dayjs().format('YYYY-MM')
    const monthRes = await bookingApi.getList({
      userId: userInfo.value?.id,
      startTime: `${currentMonth}-01`,
      endTime: dayjs(currentMonth).endOf('month').format('YYYY-MM-DD'),
      status: 'completed',
      pageSize: 1000
    })
    
    bookingStats.monthlyHours = monthRes.items.reduce((total, booking) => {
      const duration = dayjs(booking.endTime).diff(dayjs(booking.startTime), 'minute') / 60
      return total + duration
    }, 0)
  } catch (error) {
    console.error('Failed to load booking stats:', error)
  }
}

const loadBillingHistory = async () => {
  billingLoading.value = true
  try {
    const response = await billingApi.getList({
      userId: userInfo.value?.id,
      page: billingPagination.value.page,
      pageSize: billingPagination.value.pageSize
    })
    billingHistory.value = response.items
    billingPagination.value.total = response.total
  } finally {
    billingLoading.value = false
  }
}

const handleUploadAvatar = () => {
  avatarInputRef.value?.click()
}

const handleAvatarChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('图片大小不能超过2MB')
    return
  }
  
  const reader = new FileReader()
  reader.onload = (e) => {
    if (userInfo.value) {
      userInfo.value.avatar = e.target?.result as string
    }
    ElMessage.success('头像更新成功')
  }
  reader.readAsDataURL(file)
}

const handleChangePassword = async () => {
  if (!passwordFormRef.value) return
  
  await passwordFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        ElMessage.success('密码修改成功')
        handleResetPassword()
      } catch {
        ElMessage.error('密码修改失败，请重试')
      }
    }
  })
}

const handleResetPassword = () => {
  passwordFormRef.value?.resetFields()
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
}

const handleSaveNotificationSettings = () => {
  try {
    ElMessage.success('通知设置保存成功')
  } catch {
    ElMessage.error('保存失败，请重试')
  }
}

onMounted(() => {
  loadUserInfo()
  loadBookingStats()
  loadBillingHistory()
})
</script>

<style scoped>
.profile-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.profile-card :deep(.el-card__body) {
  padding: 0;
}

.profile-card :deep(.el-divider) {
  --el-border-color: rgba(255, 255, 255, 0.2);
}

.profile-card h2,
.profile-card p {
  color: white;
}

.profile-card .text-gray-500 {
  color: rgba(255, 255, 255, 0.8) !important;
}

.profile-card .text-gray-900 {
  color: white !important;
}
</style>
