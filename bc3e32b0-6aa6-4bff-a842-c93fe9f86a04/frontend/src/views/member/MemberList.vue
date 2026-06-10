<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { User, MemberTier } from '@/types'
import { ElMessage } from 'element-plus'

const router = useRouter()

const searchKeyword = ref('')
const filterTier = ref<MemberTier | ''>('')
const pageIndex = ref(1)
const pageSize = ref(20)
const total = ref(80)
const loading = ref(false)

const members = ref<User[]>([
  {
    id: 'm1',
    username: '张小明',
    email: 'zhangxiaoming@example.com',
    phone: '13800138001',
    role: 'member',
    memberTier: 'yearly',
    memberExpireDate: '2024-12-31',
    totalSpent: 5680,
    points: 1250,
    createdAt: '2023-06-15T00:00:00Z'
  },
  {
    id: 'm2',
    username: '李雨晴',
    email: 'liyuqing@example.com',
    phone: '13800138002',
    role: 'member',
    memberTier: 'quarterly',
    memberExpireDate: '2024-04-15',
    totalSpent: 2350,
    points: 480,
    createdAt: '2023-11-20T00:00:00Z'
  },
  {
    id: 'm3',
    username: '王大伟',
    email: 'wangdawei@example.com',
    phone: '13800138003',
    role: 'member',
    memberTier: 'monthly',
    memberExpireDate: '2024-02-20',
    totalSpent: 890,
    points: 120,
    createdAt: '2024-01-05T00:00:00Z'
  },
  {
    id: 'm4',
    username: '陈思远',
    email: 'chensiyuan@example.com',
    phone: '13800138004',
    role: 'member',
    memberTier: 'experience',
    totalSpent: 99,
    points: 20,
    createdAt: '2024-01-20T00:00:00Z'
  },
  {
    id: 'm5',
    username: '刘芳芳',
    email: 'liufangfang@example.com',
    phone: '13800138005',
    role: 'member',
    memberTier: 'yearly',
    memberExpireDate: '2024-10-01',
    totalSpent: 8900,
    points: 2100,
    createdAt: '2023-03-10T00:00:00Z'
  }
])

const tierOptions = [
  { value: 'experience', label: '体验卡', color: '#909399' },
  { value: 'monthly', label: '月卡', color: '#409eff' },
  { value: 'quarterly', label: '季卡', color: '#67c23a' },
  { value: 'yearly', label: '年卡', color: '#e6a23c' }
]

const getTierLabel = (tier?: MemberTier) => {
  const map: Record<string, string> = {
    experience: '体验卡',
    monthly: '月卡',
    quarterly: '季卡',
    yearly: '年卡'
  }
  return map[tier || 'experience'] || '体验卡'
}

const getTierColor = (tier?: MemberTier) => {
  const map: Record<string, string> = {
    experience: '#909399',
    monthly: '#409eff',
    quarterly: '#67c23a',
    yearly: '#e6a23c'
  }
  return map[tier || 'experience'] || '#909399'
}

const handleViewMember = (member: User) => {
  router.push(`/members/${member.id}`)
}

const handleAddMember = () => {
  ElMessage.info('添加会员功能开发中...')
}

const handleSearch = () => {
  ElMessage.info('搜索功能开发中...')
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
}

const handlePageChange = (page: number) => {
  pageIndex.value = page
}

onMounted(() => {
})
</script>

<template>
  <div class="member-list-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">会员管理</h2>
        <span class="member-count">共 {{ total }} 名会员</span>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Plus" @click="handleAddMember">
          添加会员
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-left">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索会员姓名、手机号、邮箱..."
          :prefix-icon="Search"
          clearable
          class="search-input"
          @keyup.enter="handleSearch"
        >
          <template #append>
            <el-button :icon="Search" @click="handleSearch" />
          </template>
        </el-input>
        <el-select 
          v-model="filterTier" 
          placeholder="会员等级"
          clearable
          class="tier-select"
        >
          <el-option 
            v-for="tier in tierOptions" 
            :key="tier.value" 
            :label="tier.label" 
            :value="tier.value" 
          />
        </el-select>
      </div>
      <div class="filter-right">
        <el-button :icon="Download">导出</el-button>
      </div>
    </div>

    <div class="member-table-container">
      <el-table 
        :data="members" 
        v-loading="loading"
        stripe
        style="width: 100%"
        @row-click="handleViewMember"
      >
        <el-table-column label="会员" min-width="200">
          <template #default="{ row }">
            <div class="member-cell">
              <el-avatar :size="40">{{ row.username?.charAt(0) }}</el-avatar>
              <div class="member-info">
                <span class="member-name">{{ row.username }}</span>
                <span class="member-phone">{{ row.phone }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="会员等级" width="120">
          <template #default="{ row }">
            <el-tag 
              :style="{ 
                backgroundColor: getTierColor(row.memberTier) + '20', 
                color: getTierColor(row.memberTier),
                border: 'none' 
              }"
            >
              {{ getTierLabel(row.memberTier) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="累计消费" width="120">
          <template #default="{ row }">
            <span class="amount">¥{{ row.totalSpent?.toLocaleString() }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="积分" width="100">
          <template #default="{ row }">
            <span class="points">{{ row.points }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="到期时间" width="140">
          <template #default="{ row }">
            <span v-if="row.memberExpireDate" :class="{ 'expiring': isExpiringSoon(row.memberExpireDate) }">
              {{ row.memberExpireDate }}
            </span>
            <span v-else class="no-expire">-</span>
          </template>
        </el-table-column>
        
        <el-table-column label="注册时间" width="140">
          <template #default="{ row }">
            {{ row.createdAt?.split('T')[0] }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click.stop="handleViewMember(row)">
              查看
            </el-button>
            <el-button type="primary" link size="small" @click.stop>
              编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pageIndex"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script lang="ts">
function isExpiringSoon(date: string): boolean {
  const expireDate = new Date(date)
  const now = new Date()
  const diffDays = Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays <= 14 && diffDays > 0
}

export default {
  methods: {
    isExpiringSoon
  }
}
</script>

<style scoped lang="scss">
.member-list-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: $color-text-primary;
}

.member-count {
  font-size: 14px;
  color: $color-text-secondary;
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-radius: $border-radius-md;
  box-shadow: $shadow-sm;
  flex-wrap: wrap;
  gap: 12px;
}

.filter-left {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.search-input {
  width: 320px;
}

.tier-select {
  width: 140px;
}

.member-table-container {
  background: white;
  border-radius: $border-radius-md;
  box-shadow: $shadow-sm;
  overflow: hidden;
}

.member-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-name {
  font-size: 14px;
  font-weight: 500;
  color: $color-text-primary;
}

.member-phone {
  font-size: 12px;
  color: $color-text-placeholder;
}

.amount {
  font-weight: 600;
  color: $color-primary;
}

.points {
  font-weight: 500;
  color: $color-warning;
}

.expiring {
  color: $color-error;
  font-weight: 500;
}

.no-expire {
  color: $color-text-placeholder;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
}

:deep(.el-table tr) {
  cursor: pointer;
}
</style>
