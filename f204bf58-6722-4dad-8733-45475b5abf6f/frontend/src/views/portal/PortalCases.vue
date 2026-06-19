<template>
  <div class="portal-cases">
    <div class="card">
      <div class="filter-bar">
        <el-input v-model="search" placeholder="搜索案件名称/编号..." style="width:260px" :prefix-icon="Search" clearable @change="loadData" />
        <el-select v-model="filterStatus" placeholder="案件状态" clearable style="width:140px" @change="loadData">
          <el-option v-for="s in statusOpts" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </div>
      <el-table :data="cases" v-loading="loading">
        <el-table-column prop="case_no" label="案件编号" width="150" />
        <el-table-column prop="case_name" label="案件名称" min-width="220" show-overflow-tooltip />
        <el-table-column prop="case_type_display" label="类型" width="100" />
        <el-table-column label="主办律师" width="110">
          <template #default="{ row }">{{ row.lead_lawyer_info?.full_name || '-' }}</template>
        </el-table-column>
        <el-table-column label="诉讼时效" width="120">
          <template #default="{ row }">
            <span v-if="row.limit_date" :style="{ color: (row.days_left || 0) < 15 ? '#e53e3e' : '' }">
              {{ row.limit_date }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status_display" label="当前状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.status_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-drawer v-model="detailOpen" :title="cur?.case_name" size="720px">
      <div v-if="cur" class="case-detail">
        <el-descriptions :column="2" size="small" border style="margin-bottom:16px">
          <el-descriptions-item label="案件编号">{{ cur.case_no }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ cur.case_type_display }}</el-descriptions-item>
          <el-descriptions-item label="受理日期">{{ cur.accept_date }}</el-descriptions-item>
          <el-descriptions-item label="诉讼时效">{{ cur.limit_date || '-' }}</el-descriptions-item>
          <el-descriptions-item label="受理法院">{{ cur.court || '-' }}</el-descriptions-item>
          <el-descriptions-item label="承办法官">{{ cur.judge ? cur.judge + ' ' + (cur.judge_phone || '') : '-' }}</el-descriptions-item>
          <el-descriptions-item label="主办律师" :span="2">{{ cur.lead_lawyer_info?.full_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="案由" :span="2">{{ cur.cause }}</el-descriptions-item>
          <el-descriptions-item label="案情摘要" :span="2">{{ cur.case_summary || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin:0 0 12px;color:#2d3748;font-size:14px">案件进展</h4>
        <el-timeline>
          <el-timeline-item
            v-for="(p, i) in [...cur.progress_logs || []].reverse()"
            :key="p.id"
            :timestamp="formatTime(p.created_at)"
            :type="(['update','approve','reject'][i%3] || 'primary') as any"
            placement="top"
          >
            <div>
              <el-tag size="small" :type="p.operation_type === 'approve' ? 'success' : p.operation_type === 'reject' ? 'danger' : 'primary'">
                {{ p.operation_type_display }}
              </el-tag>
              <b style="margin-left:8px">{{ p.to_status_display }}</b>
              <span style="color:#718096;font-size:12px;margin-left:8px">{{ p.operator_info?.full_name }}</span>
              <p style="margin:6px 0 0;color:#4a5568;font-size:13px">{{ p.description || '无描述' }}</p>
            </div>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-if="!cur.progress_logs?.length" description="暂无进展" :image-size="60" />

        <h4 style="margin:24px 0 12px;color:#2d3748;font-size:14px">上传证据材料</h4>
        <el-upload
          action="/api/evidences/batch-upload/"
          :data="{ case: cur.id }"
          :headers="uploadHeaders"
          multiple
          :limit="10"
          :on-success="onUpload"
          :on-error="onUploadErr"
        >
          <el-button type="primary">
            <el-icon><UploadFilled /></el-icon> 点击上传
          </el-button>
          <template #tip>
            <div style="color:#a0aec0;font-size:12px;margin-top:6px">支持PDF、图片、Word等格式，单文件最大100MB</div>
          </template>
        </el-upload>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Search, UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { caseApi } from '@/api/modules'
import { useUserStore } from '@/stores/user'
import dayjs from 'dayjs'
import type { Case } from '@/types'

const userStore = useUserStore()
const cases = ref<Case[]>([])
const loading = ref(false)
const search = ref('')
const filterStatus = ref('')
const detailOpen = ref(false)
const cur = ref<Case | null>(null)
const statusOpts = [
  { label: '咨询登记', value: 'consulting' },
  { label: '利益冲突审查', value: 'conflict_check' },
  { label: '正式立案', value: 'filing' },
  { label: '已分配', value: 'assigned' },
  { label: '办理中', value: 'handling' },
  { label: '庭审阶段', value: 'trial' },
  { label: '执行阶段', value: 'execution' },
  { label: '结案归档', value: 'closing' },
  { label: '已结案', value: 'closed' },
]
const uploadHeaders = computed(() => ({ Authorization: `Bearer ${userStore.accessToken}` }))

const formatTime = (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm')

async function loadData() {
  loading.value = true
  try {
    const params: any = { page_size: 100 }
    if (search.value) params.search = search.value
    if (filterStatus.value) params.status = filterStatus.value
    const r = await caseApi.list(params) as any
    cases.value = r.data?.results || []
  } finally { loading.value = false }
}

function openDetail(row: Case) {
  cur.value = row
  detailOpen.value = true
}

function onUpload() { ElMessage.success('上传成功，已通知律师') }
function onUploadErr() { ElMessage.error('上传失败') }

onMounted(loadData)
</script>

<style lang="scss" scoped>
.portal-cases {
  .filter-bar { margin-bottom: 16px; }
}
</style>
