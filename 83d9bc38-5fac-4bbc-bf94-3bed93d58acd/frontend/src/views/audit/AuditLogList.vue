<template>
  <div class="p-4 md:p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">日志审计</h1>
      <p class="text-gray-500 mt-1">查看和审计系统操作日志（仅超管可见）</p>
    </div>

    <el-card class="mb-6">
      <el-form :inline="true" :model="filters" class="flex flex-wrap gap-4">
        <el-form-item label="用户">
          <el-select
            v-model="filters.userId"
            placeholder="全部用户"
            clearable
            filterable
            style="width: 180px"
            @change="handleSearch"
          >
            <el-option
              v-for="user in userList"
              :key="user.id"
              :label="user.name"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="表名">
          <el-select
            v-model="filters.tableName"
            placeholder="全部表"
            clearable
            filterable
            style="width: 180px"
            @change="handleSearch"
          >
            <el-option
              v-for="table in tableList"
              :key="table"
              :label="table"
              :value="table"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select
            v-model="filters.action"
            placeholder="全部操作"
            clearable
            style="width: 150px"
            @change="handleSearch"
          >
            <el-option label="创建" value="create" />
            <el-option label="更新" value="update" />
            <el-option label="删除" value="delete" />
            <el-option label="查询" value="read" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 280px"
            @change="handleDateChange"
          />
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
          <el-button type="warning" @click="handleExport">
            <el-icon><Download /></el-icon>
            导出
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table
        v-loading="loading"
        :data="auditLogList"
        stripe
        style="width: 100%"
        :row-key="(row: AuditLog) => row.id"
        :expand-row-keys="expandedRowKeys"
        @expand-change="handleExpandChange"
      >
        <el-table-column type="expand" width="50">
          <template #default="{ row }">
            <div class="detail-container p-4">
              <el-tabs v-model="activeDetailTab" type="card">
                <el-tab-pane label="字段差异" name="diff">
                  <div v-if="row.fieldDiffs && row.fieldDiffs.length > 0">
                    <el-table :data="row.fieldDiffs" border stripe size="small">
                      <el-table-column prop="field" label="字段名" width="200" />
                      <el-table-column label="修改前" min-width="200">
                        <template #default="{ row: diff }">
                          <span class="old-value">
                            {{ formatValue(diff.oldValue) }}
                          </span>
                        </template>
                      </el-table-column>
                      <el-table-column label="修改后" min-width="200">
                        <template #default="{ row: diff }">
                          <span class="new-value">
                            {{ formatValue(diff.newValue) }}
                          </span>
                        </template>
                      </el-table-column>
                    </el-table>
                  </div>
                  <div v-else class="text-center py-8 text-gray-500">
                    无字段差异数据
                  </div>
                </el-tab-pane>
                <el-tab-pane label="原始数据" name="raw">
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <h4 class="font-semibold mb-2 text-gray-700">修改前 (oldValue)</h4>
                      <pre class="bg-gray-100 p-3 rounded text-sm overflow-x-auto">{{ JSON.stringify(row.oldValue, null, 2) }}</pre>
                    </div>
                    <div>
                      <h4 class="font-semibold mb-2 text-gray-700">修改后 (newValue)</h4>
                      <pre class="bg-gray-100 p-3 rounded text-sm overflow-x-auto">{{ JSON.stringify(row.newValue, null, 2) }}</pre>
                    </div>
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="userName" label="操作人" width="120">
          <template #default="{ row }">
            {{ row.user?.name || row.userName }}
          </template>
        </el-table-column>
        <el-table-column prop="action" label="操作类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getActionType(row.action)" size="small" effect="light">
              {{ getActionText(row.action) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="tableName" label="表名" width="150">
          <template #default="{ row }">
            <el-tag type="info" size="small" effect="plain">
              {{ row.tableName }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="recordId" label="记录ID" width="100">
          <template #default="{ row }">
            {{ row.recordId || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="ipAddress" label="IP地址" width="150">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">
              {{ row.ipAddress }}
            </el-tag>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Download } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { audit as auditApi, user as userApi } from '@/api'
import type { AuditLog, FieldDiff, User } from '@/types'

const loading = ref(false)
const auditLogList = ref<(AuditLog & { fieldDiffs?: FieldDiff[] })[]>([])
const userList = ref<User[]>([])
const tableList = ref<string[]>(['users', 'equipment', 'bookings', 'billings', 'maintenance', 'roles', 'centers'])
const dateRange = ref<string[]>([])
const expandedRowKeys = ref<number[]>([])
const activeDetailTab = ref('diff')

const filters = ref({
  userId: undefined as number | undefined,
  tableName: undefined as string | undefined,
  action: undefined as string | undefined,
  startDate: undefined as string | undefined,
  endDate: undefined as string | undefined
})

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

const getActionType = (action: string) => {
  const typeMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    create: 'success',
    update: 'warning',
    delete: 'danger',
    read: 'info'
  }
  return typeMap[action] || 'info'
}

const getActionText = (action: string) => {
  const textMap: Record<string, string> = {
    create: '创建',
    update: '更新',
    delete: '删除',
    read: '查询'
  }
  return textMap[action] || action
}

const formatDateTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const formatValue = (value: any) => {
  if (value === null || value === undefined) {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

const loadAuditLogs = async () => {
  loading.value = true
  try {
    const response = await auditApi.getLogs({
      ...filters.value,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    })
    auditLogList.value = response.items
    pagination.value.total = response.total
  } finally {
    loading.value = false
  }
}

const loadLogDetail = async (id: number) => {
  try {
    const detail = await auditApi.getLogDetail(id)
    const index = auditLogList.value.findIndex(log => log.id === id)
    if (index !== -1) {
      auditLogList.value[index] = detail
    }
  } catch (error) {
    console.error('Failed to load log detail:', error)
  }
}

const loadUsers = async () => {
  const response = await userApi.getList({ pageSize: 100 })
  userList.value = response.items
}

const handleSearch = () => {
  pagination.value.page = 1
  loadAuditLogs()
}

const handleReset = () => {
  filters.value = {
    userId: undefined,
    tableName: undefined,
    action: undefined,
    startDate: undefined,
    endDate: undefined
  }
  dateRange.value = []
  pagination.value.page = 1
  loadAuditLogs()
}

const handleDateChange = (val: string[]) => {
  if (val && val.length === 2) {
    filters.value.startDate = val[0]
    filters.value.endDate = val[1]
  } else {
    filters.value.startDate = undefined
    filters.value.endDate = undefined
  }
}

const handleExpandChange = async (row: AuditLog, expandedRows: AuditLog[]) => {
  const isExpanded = expandedRows.some(r => r.id === row.id)
  if (isExpanded && !row.fieldDiffs) {
    await loadLogDetail(row.id)
  }
}

const handleSizeChange = (size: number) => {
  pagination.value.pageSize = size
  pagination.value.page = 1
  loadAuditLogs()
}

const handleCurrentChange = (page: number) => {
  pagination.value.page = page
  loadAuditLogs()
}

const handleExport = async () => {
  try {
    const params = new URLSearchParams()
    if (filters.value.userId) params.append('userId', String(filters.value.userId))
    if (filters.value.tableName) params.append('tableName', filters.value.tableName)
    if (filters.value.action) params.append('action', filters.value.action)
    if (filters.value.startDate) params.append('startDate', filters.value.startDate)
    if (filters.value.endDate) params.append('endDate', filters.value.endDate)
    
    const url = `/api/audit/logs/export?${params.toString()}`
    const link = document.createElement('a')
    link.href = url
    link.download = `审计日志_${dayjs().format('YYYYMMDDHHmmss')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败，请重试')
  }
}

onMounted(() => {
  loadAuditLogs()
  loadUsers()
})
</script>

<style scoped>
.detail-container {
  background-color: #fafafa;
  border-radius: 8px;
}

.old-value {
  color: #f56c6c;
  text-decoration: line-through;
  background-color: #fef0f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.new-value {
  color: #67c23a;
  background-color: #f0f9eb;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

pre {
  max-height: 400px;
  overflow-y: auto;
}
</style>
