<template>
  <div class="p-4 md:p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">用户管理</h1>
      <p class="text-gray-500 mt-1">管理系统用户和权限（仅超管可见）</p>
    </div>

    <el-card class="mb-6">
      <el-form :inline="true" :model="filters" class="flex flex-wrap gap-4">
        <el-form-item label="角色">
          <el-select
            v-model="filters.roleId"
            placeholder="全部角色"
            clearable
            style="width: 150px"
            @change="handleSearch"
          >
            <el-option
              v-for="role in roleList"
              :key="role.id"
              :label="role.name"
              :value="role.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="中心">
          <el-select
            v-model="filters.centerId"
            placeholder="全部中心"
            clearable
            style="width: 150px"
            @change="handleSearch"
          >
            <el-option
              v-for="center in centerList"
              :key="center.id"
              :label="center.name"
              :value="center.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input
            v-model="filters.keyword"
            placeholder="用户名/姓名/邮箱"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="handleReset">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
        <el-form-item class="ml-auto">
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            创建用户
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table
        v-loading="loading"
        :data="userList"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="email" label="邮箱" min-width="180">
          <template #default="{ row }">
            <a :href="`mailto:${row.email}`" class="text-blue-600 hover:underline">
              {{ row.email }}
            </a>
          </template>
        </el-table-column>
        <el-table-column prop="roleName" label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="getRoleType(row.role?.name || row.roleName)" size="small" effect="light">
              {{ row.role?.name || row.roleName }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="centerName" label="中心" width="150">
          <template #default="{ row }">
            {{ row.center?.name || row.centerName || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="budget" label="经费余额" width="120">
          <template #default="{ row }">
            <span class="font-semibold" :class="row.budget > 0 ? 'text-green-600' : 'text-red-600'">
              ¥{{ row.budget.toFixed(2) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="advisor" label="导师" width="120">
          <template #default="{ row }">
            {{ row.advisor?.name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-button type="success" link @click="openAssignRoleDialog(row)">
              分配角色
            </el-button>
            <el-button
              v-if="row.roleName !== 'super_admin'"
              type="danger"
              link
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="createDialogVisible"
      :title="isEdit ? '编辑用户' : '创建用户'"
      width="550px"
      @close="handleDialogClose"
    >
      <el-form
        ref="userFormRef"
        :model="userForm"
        :rules="userRules"
        label-width="100px"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="用户名" prop="username">
              <el-input
                v-model="userForm.username"
                placeholder="请输入用户名"
                :disabled="isEdit"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="userForm.name" placeholder="请输入姓名" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="userForm.email" placeholder="请输入邮箱" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="角色" prop="roleId">
              <el-select v-model="userForm.roleId" placeholder="请选择角色" style="width: 100%">
                <el-option
                  v-for="role in roleList"
                  :key="role.id"
                  :label="role.name"
                  :value="role.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="中心" prop="centerId">
              <el-select v-model="userForm.centerId" placeholder="请选择中心" style="width: 100%">
                <el-option
                  v-for="center in centerList"
                  :key="center.id"
                  :label="center.name"
                  :value="center.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="初始经费" prop="budget">
              <el-input-number
                v-model="userForm.budget"
                :min="0"
                :precision="2"
                :step="100"
                style="width: 100%"
                placeholder="请输入初始经费"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="isEdit ? '新密码' : '密码'" :prop="isEdit ? '' : 'password'">
              <el-input
                v-model="userForm.password"
                type="password"
                :placeholder="isEdit ? '不修改请留空' : '请输入密码'"
                show-password
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              v-if="showAdvisorField"
              label="导师"
              prop="advisorId"
            >
              <el-select
                v-model="userForm.advisorId"
                placeholder="请选择导师"
                clearable
                filterable
                style="width: 100%"
              >
                <el-option
                  v-for="teacher in teacherList"
                  :key="teacher.id"
                  :label="teacher.name"
                  :value="teacher.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确认提交</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="assignRoleDialogVisible"
      title="分配角色"
      width="400px"
    >
      <el-form label-width="80px">
        <el-form-item label="当前用户">
          <el-tag size="large">{{ selectedUser?.name || selectedUser?.username }}</el-tag>
        </el-form-item>
        <el-form-item label="分配角色" prop="newRoleId">
          <el-select
            v-model="newRoleId"
            placeholder="请选择角色"
            style="width: 100%"
          >
            <el-option
              v-for="role in roleList"
              :key="role.id"
              :label="role.name"
              :value="role.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignRoleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAssignRole">确认分配</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import { user as userApi } from '@/api'
import type { User, UserRole } from '@/types'

const loading = ref(false)
const userList = ref<User[]>([])
const roleList = ref<Array<{ id: number; name: UserRole }>>([
  { id: 1, name: 'super_admin' },
  { id: 2, name: 'admin' },
  { id: 3, name: 'operator' },
  { id: 4, name: 'teacher' },
  { id: 5, name: 'student' }
])
const centerList = ref<Array<{ id: number; name: string }>>([])
const teacherList = ref<User[]>([])

const filters = ref({
  roleId: undefined as number | undefined,
  centerId: undefined as number | undefined,
  keyword: undefined as string | undefined
})

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

const createDialogVisible = ref(false)
const isEdit = ref(false)
const editingUserId = ref<number | null>(null)
const userFormRef = ref<FormInstance>()
const userForm = ref({
  username: '',
  name: '',
  email: '',
  roleId: undefined as number | undefined,
  centerId: undefined as number | undefined,
  password: '',
  budget: 0,
  advisorId: undefined as number | undefined
})

const userRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  roleId: [{ required: true, message: '请选择角色', trigger: 'change' }],
  centerId: [{ required: true, message: '请选择中心', trigger: 'change' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const assignRoleDialogVisible = ref(false)
const selectedUser = ref<User | null>(null)
const newRoleId = ref<number | undefined>(undefined)

const showAdvisorField = computed(() => {
  const role = roleList.value.find(r => r.id === userForm.value.roleId)
  return role?.name === 'student'
})

const getRoleType = (roleName: string) => {
  const typeMap: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'primary'> = {
    super_admin: 'danger',
    admin: 'primary',
    operator: 'warning',
    teacher: 'success',
    student: 'info'
  }
  return typeMap[roleName] || 'info'
}

const loadUsers = async () => {
  loading.value = true
  try {
    const response = await userApi.getList({
      ...filters.value,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    })
    userList.value = response.items
    pagination.value.total = response.total
  } finally {
    loading.value = false
  }
}

const loadCenters = async () => {
  centerList.value = [
    { id: 1, name: '计算中心' },
    { id: 2, name: '实验中心' },
    { id: 3, name: '分析中心' },
    { id: 4, name: '测试中心' }
  ]
}

const loadTeachers = async () => {
  try {
    const response = await userApi.getList({ roleId: 4, pageSize: 100 })
    teacherList.value = response.items
  } catch {
    teacherList.value = []
  }
}

const handleSearch = () => {
  pagination.value.page = 1
  loadUsers()
}

const handleReset = () => {
  filters.value = {
    roleId: undefined,
    centerId: undefined,
    keyword: undefined
  }
  pagination.value.page = 1
  loadUsers()
}

const handleSizeChange = (size: number) => {
  pagination.value.pageSize = size
  pagination.value.page = 1
  loadUsers()
}

const handleCurrentChange = (page: number) => {
  pagination.value.page = page
  loadUsers()
}

const openCreateDialog = () => {
  isEdit.value = false
  editingUserId.value = null
  userForm.value = {
    username: '',
    name: '',
    email: '',
    roleId: undefined,
    centerId: undefined,
    password: '',
    budget: 0,
    advisorId: undefined
  }
  createDialogVisible.value = true
}

const openEditDialog = (row: User) => {
  isEdit.value = true
  editingUserId.value = row.id
  userForm.value = {
    username: row.username,
    name: row.name,
    email: row.email,
    roleId: row.roleId,
    centerId: row.centerId,
    password: '',
    budget: row.budget,
    advisorId: row.advisorId
  }
  createDialogVisible.value = true
}

const openAssignRoleDialog = (row: User) => {
  selectedUser.value = row
  newRoleId.value = row.roleId
  assignRoleDialogVisible.value = true
}

const handleDialogClose = () => {
  userFormRef.value?.resetFields()
}

const handleSubmit = async () => {
  if (!userFormRef.value) return
  
  await userFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        if (isEdit.value && editingUserId.value) {
          const updateData: any = {
            name: userForm.value.name,
            email: userForm.value.email,
            roleId: userForm.value.roleId!,
            centerId: userForm.value.centerId!,
            budget: userForm.value.budget,
            advisorId: userForm.value.advisorId
          }
          if (userForm.value.password) {
            updateData.password = userForm.value.password
          }
          await userApi.update(editingUserId.value, updateData)
          ElMessage.success('用户更新成功')
        } else {
          await userApi.create({
            username: userForm.value.username,
            name: userForm.value.name,
            email: userForm.value.email,
            roleId: userForm.value.roleId!,
            centerId: userForm.value.centerId!,
            password: userForm.value.password,
            budget: userForm.value.budget,
            advisorId: userForm.value.advisorId
          })
          ElMessage.success('用户创建成功')
        }
        createDialogVisible.value = false
        loadUsers()
      } catch {
        ElMessage.error(isEdit.value ? '更新失败，请重试' : '创建失败，请重试')
      }
    }
  })
}

const handleAssignRole = async () => {
  if (!selectedUser.value || !newRoleId.value) {
    ElMessage.warning('请选择角色')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `确定将用户 "${selectedUser.value.name}" 的角色分配为 "${roleList.value.find(r => r.id === newRoleId.value)?.name}" 吗？`,
      '分配角色',
      { type: 'warning' }
    )
    await userApi.assignRole(selectedUser.value.id, newRoleId.value)
    ElMessage.success('角色分配成功')
    assignRoleDialogVisible.value = false
    loadUsers()
  } catch {
  }
}

const handleDelete = async (row: User) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 "${row.name}" 吗？此操作不可恢复。`,
      '删除用户',
      { type: 'danger' }
    )
    await userApi.delete(row.id)
    ElMessage.success('用户删除成功')
    loadUsers()
  } catch {
  }
}

watch(
  () => userForm.value.roleId,
  () => {
    if (!showAdvisorField.value) {
      userForm.value.advisorId = undefined
    }
  }
)

onMounted(() => {
  loadUsers()
  loadCenters()
  loadTeachers()
})
</script>
