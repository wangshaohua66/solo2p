<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  User,
  Search as SearchIcon,
  Plus,
  Edit,
  Delete,
  Refresh,
  Setting
} from '@element-plus/icons-vue'

interface SystemUser {
  id: string
  username: string
  name: string
  email: string
  role: 'declarant' | 'reviewer' | 'admin'
  enterpriseName?: string
  status: 'active' | 'disabled'
  createdAt: string
  lastLoginAt: string
}

const keyword = ref('')
const filterRole = ref('')
const filterStatus = ref('')
const userFormVisible = ref(false)
const editingUser = ref<SystemUser | null>(null)
const userForm = reactive({
  username: '',
  name: '',
  email: '',
  role: 'declarant' as const,
  enterpriseName: '',
  status: 'active' as const
})

const users: SystemUser[] = reactive([
  {
    id: '1',
    username: 'declarant001',
    name: '张申报员',
    email: 'zhang@company.com',
    role: 'declarant',
    enterpriseName: '杭州跨境贸易有限公司',
    status: 'active',
    createdAt: '2023-06-01 10:00:00',
    lastLoginAt: '2024-01-15 09:30:00'
  },
  {
    id: '2',
    username: 'declarant002',
    name: '李小明',
    email: 'li@company.com',
    role: 'declarant',
    enterpriseName: '宁波速卖通贸易有限公司',
    status: 'active',
    createdAt: '2023-07-15 14:00:00',
    lastLoginAt: '2024-01-14 16:45:00'
  },
  {
    id: '3',
    username: 'reviewer001',
    name: '王审核员',
    email: 'wang@service.gov.cn',
    role: 'reviewer',
    status: 'active',
    createdAt: '2023-05-20 09:00:00',
    lastLoginAt: '2024-01-15 08:50:00'
  },
  {
    id: '4',
    username: 'reviewer002',
    name: '赵审核',
    email: 'zhao@service.gov.cn',
    role: 'reviewer',
    status: 'active',
    createdAt: '2023-08-10 10:30:00',
    lastLoginAt: '2024-01-13 11:20:00'
  },
  {
    id: '5',
    username: 'admin001',
    name: '孙管理员',
    email: 'sun@service.gov.cn',
    role: 'admin',
    status: 'active',
    createdAt: '2023-01-01 00:00:00',
    lastLoginAt: '2024-01-15 07:00:00'
  },
  {
    id: '6',
    username: 'declarant003',
    name: '周测试',
    email: 'zhou@test.com',
    role: 'declarant',
    enterpriseName: '测试公司',
    status: 'disabled',
    createdAt: '2023-10-01 10:00:00',
    lastLoginAt: '2023-12-20 14:00:00'
  }
])

const roleOptions = [
  { label: '全部角色', value: '' },
  { label: '企业申报员', value: 'declarant' },
  { label: '运营审核员', value: 'reviewer' },
  { label: '中心管理员', value: 'admin' }
]

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '正常', value: 'active' },
  { label: '禁用', value: 'disabled' }
]

const stats = computed(() => ({
  total: users.length,
  declarant: users.filter(u => u.role === 'declarant').length,
  reviewer: users.filter(u => u.role === 'reviewer').length,
  admin: users.filter(u => u.role === 'admin').length
}))

const filteredUsers = computed(() => {
  return users.filter(u => {
    if (filterRole.value && u.role !== filterRole.value) return false
    if (filterStatus.value && u.status !== filterStatus.value) return false
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      if (!u.username.toLowerCase().includes(kw)
        && !u.name.toLowerCase().includes(kw)
        && !u.email.toLowerCase().includes(kw)) return false
    }
    return true
  })
})

function getRoleName(role: string) {
  const map: Record<string, string> = {
    declarant: '企业申报员',
    reviewer: '运营审核员',
    admin: '中心管理员'
  }
  return map[role] || role
}

function getRoleTagType(role: string) {
  return role === 'admin' ? 'danger' : role === 'reviewer' ? 'warning' : 'primary'
}

function openAddUser() {
  editingUser.value = null
  userForm.username = ''
  userForm.name = ''
  userForm.email = ''
  userForm.role = 'declarant'
  userForm.enterpriseName = ''
  userForm.status = 'active'
  userFormVisible.value = true
}

function openEditUser(user: SystemUser) {
  editingUser.value = user
  userForm.username = user.username
  userForm.name = user.name
  userForm.email = user.email
  userForm.role = user.role
  userForm.enterpriseName = user.enterpriseName || ''
  userForm.status = user.status
  userFormVisible.value = true
}

function saveUser() {
  if (!userForm.username || !userForm.name || !userForm.email) {
    ElMessage.warning('请填写完整信息')
    return
  }

  if (editingUser.value) {
    Object.assign(editingUser.value, { ...userForm })
    ElMessage.success('用户信息已更新')
  } else {
    const newUser: SystemUser = {
      id: `u${Date.now()}`,
      ...userForm,
      createdAt: new Date().toLocaleString('zh-CN'),
      lastLoginAt: '-'
    }
    users.unshift(newUser)
    ElMessage.success('用户创建成功')
  }
  userFormVisible.value = false
}

function toggleStatus(user: SystemUser) {
  const action = user.status === 'active' ? '禁用' : '启用'
  ElMessageBox.confirm(`确定要${action}用户「${user.name}」吗？`, '操作确认', {
    type: 'warning'
  }).then(() => {
    user.status = user.status === 'active' ? 'disabled' : 'active'
    ElMessage.success(`已${action}用户`)
  }).catch(() => {})
}

function deleteUser(user: SystemUser) {
  ElMessageBox.confirm(`确定要删除用户「${user.name}」吗？此操作不可恢复。`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    confirmButtonClass: 'el-button--danger'
  }).then(() => {
    const idx = users.findIndex(u => u.id === user.id)
    if (idx > -1) users.splice(idx, 1)
    ElMessage.success('用户已删除')
  }).catch(() => {})
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">
        <el-icon style="margin-right: 8px"><User /></el-icon>
        用户管理
      </div>
      <div style="display: flex; gap: 10px">
        <el-button type="primary" :icon="Plus" @click="openAddUser">
          新增用户
        </el-button>
        <el-button :icon="Refresh">刷新</el-button>
      </div>
    </div>

    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="6">
        <div class="card stat-mini">
          <div class="stat-num" style="color: #1e6fff">{{ stats.total }}</div>
          <div class="stat-name">用户总数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="card stat-mini">
          <div class="stat-num" style="color: #409eff">{{ stats.declarant }}</div>
          <div class="stat-name">企业申报员</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="card stat-mini">
          <div class="stat-num" style="color: #e6a23c">{{ stats.reviewer }}</div>
          <div class="stat-name">运营审核员</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="card stat-mini">
          <div class="stat-num" style="color: #f56c6c">{{ stats.admin }}</div>
          <div class="stat-name">中心管理员</div>
        </div>
      </el-col>
    </el-row>

    <div class="card">
      <el-form :inline="true" style="margin-bottom: 12px">
        <el-form-item label="关键词">
          <el-input
            v-model="keyword"
            placeholder="用户名/姓名/邮箱"
            clearable
            style="width: 240px"
            :prefix-icon="SearchIcon"
          />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="filterRole" placeholder="全部" clearable style="width: 150px">
            <el-option v-for="o in roleOptions.filter(o => o.value)" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterStatus" placeholder="全部" clearable style="width: 120px">
            <el-option v-for="o in statusOptions.filter(o => o.value)" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary">查询</el-button>
          <el-button @click="keyword=''; filterRole=''; filterStatus=''">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="filteredUsers" border stripe>
        <el-table-column prop="username" label="用户名" width="140" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="getRoleTagType(row.role)" size="small">
              {{ getRoleName(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="180" />
        <el-table-column prop="enterpriseName" label="所属企业" min-width="180">
          <template #default="{ row }">{{ row.enterpriseName || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastLoginAt" label="最后登录" width="170" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditUser(row)">
              <el-icon style="margin-right: 2px"><Edit /></el-icon>编辑
            </el-button>
            <el-button
              link
              :type="row.status === 'active' ? 'warning' : 'success'"
              @click="toggleStatus(row)"
            >
              {{ row.status === 'active' ? '禁用' : '启用' }}
            </el-button>
            <el-button link type="danger" @click="deleteUser(row)">
              <el-icon style="margin-right: 2px"><Delete /></el-icon>删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="userFormVisible" :title="editingUser ? '编辑用户' : '新增用户'" width="560px">
      <el-form label-width="100px">
        <el-form-item label="用户名" required>
          <el-input v-model="userForm.username" placeholder="请输入登录用户名" />
        </el-form-item>
        <el-form-item label="姓名" required>
          <el-input v-model="userForm.name" placeholder="请输入真实姓名" />
        </el-form-item>
        <el-form-item label="邮箱" required>
          <el-input v-model="userForm.email" placeholder="请输入邮箱地址" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="userForm.role" style="width: 100%">
            <el-option
              v-for="o in roleOptions.filter(o => o.value)"
              :key="o.value"
              :label="o.label"
              :value="o.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="所属企业" v-if="userForm.role === 'declarant'">
          <el-input v-model="userForm.enterpriseName" placeholder="请输入企业名称" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="userForm.status">
            <el-radio value="active">正常</el-radio>
            <el-radio value="disabled">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userFormVisible = false">取消</el-button>
        <el-button type="primary" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  padding: 20px;
  height: 100%;
  overflow: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .page-title {
    font-size: $font-size-xl;
    font-weight: 600;
    display: flex;
    align-items: center;
  }
}

.stat-mini {
  padding: 20px;
  text-align: center;

  .stat-num {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 6px;
  }

  .stat-name {
    font-size: 13px;
    color: $text-secondary;
  }
}
</style>
