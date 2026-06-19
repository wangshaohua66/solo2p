<template>
  <div class="user-manage">
    <div class="page-header">
      <h2 class="page-title">人员管理</h2>
      <el-button type="primary" @click="showForm = true">
        <el-icon><Plus /></el-icon> 新增人员
      </el-button>
    </div>
    <div class="card">
      <div class="filter-bar">
        <el-select v-model="filterRole" placeholder="角色" clearable style="width:130px" @change="loadData">
          <el-option label="管理员" value="admin" />
          <el-option label="合伙人" value="partner" />
          <el-option label="执业律师" value="lawyer" />
          <el-option label="律师助理" value="assistant" />
        </el-select>
        <el-select v-model="filterDept" placeholder="部门" clearable style="width:160px" @change="loadData">
          <el-option v-for="d in depts" :key="d" :label="d" :value="d" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:110px" @change="loadData">
          <el-option label="在职" value="true" />
          <el-option label="离职" value="false" />
        </el-select>
      </div>
      <el-table :data="users" v-loading="loading">
        <el-table-column label="姓名" width="180" fixed="left">
          <template #default="{ row }">
            <div style="display:flex;align-items:center;gap:10px">
              <el-avatar :size="34" :style="{ background: roleBg(row.role), color: '#fff' }">
                {{ row.full_name?.charAt(0) }}
              </el-avatar>
              <div>
                <div style="font-weight:500;color:#2d3748">
                  {{ row.full_name }}
                  <el-tag v-if="row.role === 'partner'" size="small" type="warning" effect="dark" style="margin-left:6px">合伙人</el-tag>
                  <el-tag v-else-if="row.role === 'admin'" size="small" type="danger" effect="dark" style="margin-left:6px">管理</el-tag>
                </div>
                <div style="color:#718096;font-size:12px">工号：{{ row.employee_no }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="账号" width="130" />
        <el-table-column prop="phone" label="联系电话" width="140" />
        <el-table-column prop="email" label="邮箱" width="200" show-overflow-tooltip />
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="roleTag(row.role)">{{ row.role_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="部门/专业" width="180">
          <template #default="{ row }">
            {{ row.department || '-' }} / {{ row.specialty || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="执业证号" width="180" prop="license_no" show-overflow-tooltip />
        <el-table-column label="小时费率" width="110" align="right">
          <template #default="{ row }">
            <template v-if="row.hourly_rate">¥{{ row.hourly_rate }}/h</template>
            <span v-else style="color:#a0aec0">-</span>
          </template>
        </el-table-column>
        <el-table-column label="入职日期" width="120" prop="hire_date" />
        <el-table-column label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-icon :color="row.is_active ? '#38a169' : '#e53e3e'">
              <CircleCheck v-if="row.is_active" /><CircleClose v-else />
            </el-icon>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small">编辑</el-button>
            <el-button link size="small" @click="resetPwd(row)">重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { userApi } from '@/api/modules'
import type { User } from '@/types'

const users = ref<User[]>([])
const loading = ref(false)
const showForm = ref(false)
const filterRole = ref('')
const filterDept = ref('')
const filterStatus = ref('')
const depts = ['民商法律部', '刑事法律部', '行政法律部', '非诉业务部', '劳动法律部', '知识产权部', '婚姻家事部']

function roleBg(r: string) {
  return ({ admin: '#e53e3e', partner: '#d69e2e', lawyer: '#4299e1', assistant: '#718096', client: '#38a169' } as any)[r] || '#718096'
}
function roleTag(r: string) {
  return ({ admin: 'danger', partner: 'warning', lawyer: 'primary', assistant: 'info', client: 'success' } as any)[r] || ''
}

async function loadData() {
  loading.value = true
  try {
    const params: any = { page_size: 200 }
    if (filterRole.value) params.role = filterRole.value
    if (filterDept.value) params.department = filterDept.value
    if (filterStatus.value !== '') params.is_active = filterStatus.value === 'true'
    const r = await userApi.list(params) as any
    users.value = r.data?.results || []
  } finally { loading.value = false }
}

async function resetPwd(row: User) {
  await ElMessageBox.confirm(`确定重置 ${row.full_name} 的密码吗？重置后将恢复为默认密码 Law@2024`, '重置密码', {
    confirmButtonText: '确定重置', cancelButtonText: '取消', type: 'warning'
  }).catch(() => {})
  try {
    await userApi.resetPassword(row.id, { new_password: 'Law@2024' })
    ElMessage.success('密码已重置为 Law@2024')
  } catch (e: any) { ElMessage.error(e.message) }
}

onMounted(loadData)
</script>

<style lang="scss" scoped>
.user-manage { }
</style>
