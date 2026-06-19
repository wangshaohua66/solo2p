<template>
  <div class="portal-docs">
    <div class="card">
      <div class="filter-bar">
        <el-input v-model="search" placeholder="搜索文书..." style="width:240px" :prefix-icon="Search" clearable />
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:120px">
          <el-option label="草稿" value="draft" />
          <el-option label="已生成" value="generated" />
          <el-option label="已发送" value="sent" />
        </el-select>
      </div>
      <el-table :data="docs" v-loading="loading">
        <el-table-column prop="doc_no" label="文书编号" width="160" />
        <el-table-column prop="doc_title" label="文书名称" min-width="220" show-overflow-tooltip />
        <el-table-column label="关联案件" min-width="200">
          <template #default="{ row }">
            {{ row.case_info?.case_no }} {{ row.case_info?.case_name }}
          </template>
        </el-table-column>
        <el-table-column label="模板类型" width="140" prop="template_display" />
        <el-table-column prop="created_at" label="生成时间" width="160">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="大小" width="90" align="right">
          <template #default="{ row }">{{ formatSize(row.file_size) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'sent' ? 'success' : 'primary'">
              {{ ({ draft: '草稿', generated: '已生成', sent: '已签收' } as any)[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="preview(row)">预览</el-button>
            <el-button type="success" link size="small" @click="download(row)">下载</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { docApi } from '@/api/modules'
import dayjs from 'dayjs'
import type { GeneratedDocument } from '@/types'

const docs = ref<GeneratedDocument[]>([])
const loading = ref(false)
const search = ref('')
const filterStatus = ref('')

const formatTime = (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm')
const formatSize = (n?: number) => {
  if (!n) return '-'
  if (n < 1024) return `${n}B`
  if (n < 1024*1024) return `${(n/1024).toFixed(1)}KB`
  return `${(n/1024/1024).toFixed(2)}MB`
}

async function loadData() {
  loading.value = true
  try {
    const r = await docApi.list({ page_size: 200 }) as any
    docs.value = r.data?.results || []
  } finally { loading.value = false }
}

function preview(row: GeneratedDocument) {
  if (row.file_url) window.open(row.file_url)
  else ElMessage.info('暂无可预览文件')
}
function download(row: GeneratedDocument) {
  if (row.file_url) {
    const a = document.createElement('a')
    a.href = row.file_url
    a.download = row.doc_title
    a.click()
  } else ElMessage.info('暂无可下载文件')
}

onMounted(loadData)
</script>

<style lang="scss" scoped>
.portal-docs {
  .filter-bar { margin-bottom: 16px; }
}
</style>
