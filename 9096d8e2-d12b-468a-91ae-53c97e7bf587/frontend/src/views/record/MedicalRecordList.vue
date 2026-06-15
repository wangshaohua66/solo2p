<template>
  <div class="record-list">
    <div class="page-header">
      <h2>急救病历管理</h2>
      <div class="header-actions">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD HH:mm:ss"
        />
        <el-input
          v-model="searchKeyword"
          placeholder="搜索患者姓名/病历号"
          style="width: 200px"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="statusFilter" placeholder="状态" style="width: 120px" clearable>
          <el-option label="全部" :value="null" />
          <el-option label="待锁定" value="unlocked" />
          <el-option label="已锁定" value="locked" />
        </el-select>
        <el-button type="primary" @click="loadRecords">
          <el-icon><Refresh /></el-icon>
          查询
        </el-button>
      </div>
    </div>

    <div class="page-content">
      <el-card class="stats-card">
        <el-row :gutter="20">
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-label">总病历数</div>
              <div class="stat-value total">{{ total }}</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-label">待锁定</div>
              <div class="stat-value pending">{{ pendingCount }}</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-label">已锁定</div>
              <div class="stat-value locked">{{ lockedCount }}</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-label">待质控</div>
              <div class="stat-value review">{{ pendingReviewCount }}</div>
            </div>
          </el-col>
        </el-row>
      </el-card>

      <el-card class="table-card">
        <el-table :data="records" v-loading="loading">
          <el-table-column prop="recordNo" label="病历号" width="140" />
          <el-table-column prop="eventNo" label="事件号" width="140" />
          <el-table-column prop="patientName" label="患者姓名" width="100" />
          <el-table-column label="性别" width="60">
            <template #default="{ row }">
              {{ row.gender === 'MALE' ? '男' : '女' }}
            </template>
          </el-table-column>
          <el-table-column prop="age" label="年龄" width="60" />
          <el-table-column prop="preliminaryDiagnosis" label="初步诊断" min-width="150" show-overflow-tooltip />
          <el-table-column prop="createdBy" label="录入医生" width="100" />
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.isLocked ? 'success' : 'warning'" size="small">
                {{ row.isLocked ? '已锁定' : '待锁定' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" width="160" />
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" link @click="editRecord(row)">
                编辑
              </el-button>
              <el-button type="success" size="small" link :disabled="row.isLocked" @click="viewRecord(row)">
                查看
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="size"
            :page-sizes="[10, 20, 50, 100]"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="loadRecords"
            @current-change="loadRecords"
          />
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getRecordsByDateRange } from '@/api/medicalRecord'
import type { MedicalRecordSummary, PageResponse } from '@/types/medicalRecord'
import { Search, Refresh } from '@element-plus/icons-vue'

const router = useRouter()

const loading = ref(false)
const records = ref<MedicalRecordSummary[]>([])
const total = ref(0)
const pendingCount = ref(0)
const lockedCount = ref(0)
const pendingReviewCount = ref(0)
const searchKeyword = ref('')
const statusFilter = ref<string | null>(null)
const dateRange = ref<string[]>([])
const page = ref(1)
const size = ref(20)

async function loadRecords() {
  loading.value = true
  try {
    const startDate = dateRange.value[0] || '2024-01-01 00:00:00'
    const endDate = dateRange.value[1] || new Date().toISOString().replace('T', ' ').substring(0, 19)
    const result: PageResponse<MedicalRecordSummary> = await getRecordsByDateRange(
      startDate, endDate, page.value - 1, size.value
    )
    records.value = result.content
    total.value = result.totalElements
    pendingCount.value = records.value.filter(r => !r.isLocked).length
    lockedCount.value = records.value.filter(r => r.isLocked).length
    pendingReviewCount.value = Math.floor(total.value * 0.1)
  } catch (error) {
    console.error('Failed to load records:', error)
  } finally {
    loading.value = false
  }
}

function editRecord(record: MedicalRecordSummary) {
  router.push(`/record/${record.id}`)
}

function viewRecord(record: MedicalRecordSummary) {
  router.push(`/record/${record.id}?view=true`)
}

onMounted(() => {
  loadRecords()
})
</script>

<style scoped lang="scss">
.record-list {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #111827;
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }
}

.stats-card {
  margin-bottom: 20px;

  .stat-item {
    text-align: center;
    padding: 12px 0;

    .stat-label {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;

      &.total { color: #3b82f6; }
      &.pending { color: #f59e0b; }
      &.locked { color: #10b981; }
      &.review { color: #8b5cf6; }
    }
  }
}

.table-card {
  .pagination {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
