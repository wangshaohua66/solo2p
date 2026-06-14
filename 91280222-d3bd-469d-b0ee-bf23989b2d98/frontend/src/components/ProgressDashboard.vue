<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/projectStore'
import { projectApi } from '@/api/project'
import dayjs from 'dayjs'

const projectStore = useProjectStore()

const filterProjectId = ref<string>('')
const filterDiscipline = ref<string>('')
const filterDateRange = ref<[string, string] | null>(null)
const reportData = ref<any>(null)
const isLoading = ref(false)

const projects = computed(() => projectStore.projects)

const severityChartData = computed(() => {
  if (!reportData) return []
  return [
    { label: '严重', value: reportData.severityStats?.critical || 0, color: '#ef4444' },
    { label: '高', value: reportData.severityStats?.high || 0, color: '#f59e0b' },
    { label: '中', value: reportData.severityStats?.medium || 0, color: '#3b82f6' },
    { label: '低', value: reportData.severityStats?.low || 0, color: '#10b981' }
  ]
})

const statusChartData = computed(() => {
  if (!reportData) return []
  return [
    { label: '待处理', value: reportData.statusStats?.open || 0, color: '#ef4444' },
    { label: '处理中', value: reportData.statusStats?.in_progress || 0, color: '#f59e0b' },
    { label: '已解决', value: reportData.statusStats?.resolved || 0, color: '#10b981' },
    { label: '已驳回', value: reportData.statusStats?.rejected || 0, color: '#6b7280' }
  ]
})

const maxSeverityValue = computed(() => {
  return Math.max(...severityChartData.value.map((d) => d.value), 1)
})

const maxStatusValue = computed(() => {
  return Math.max(...statusChartData.value.map((d) => d.value), 1)
})

async function loadReport() {
  if (!filterProjectId.value) {
    reportData.value = {
      totalAnnotations: 0,
      totalDocuments: 0,
      totalProjects: projects.value.length,
      completionRate: 0,
      severityStats: { low: 0, medium: 0, high: 0, critical: 0 },
      statusStats: { open: 0, in_progress: 0, resolved: 0, rejected: 0 },
      projects: projects.value.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        progress: p.stats?.completedReviews ? Math.round((p.stats.completedReviews / Math.max((p.stats?.pendingReviews || 0) + p.stats.completedReviews, 1)) * 100) : 0,
        annotations: p.stats?.totalAnnotations || 0,
        resolved: p.stats?.resolvedAnnotations || 0
      }))
    }
    return
  }

  isLoading.value = true
  try {
    const result = await projectApi.getStats(filterProjectId.value)
    reportData.value = (result as any).data || result
  } catch {
    ElMessage.error('加载统计数据失败')
  } finally {
    isLoading.value = false
  }
}

async function exportReport() {
  if (!filterProjectId.value) {
    ElMessage.warning('请先选择项目')
    return
  }
  try {
    const blob = await projectApi.exportReport(filterProjectId.value, {
      discipline: filterDiscipline.value || undefined,
      startDate: filterDateRange.value?.[0],
      endDate: filterDateRange.value?.[1]
    })
    const url = URL.createObjectURL(blob as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `审阅报告_${dayjs().format('YYYYMMDD')}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('报告导出成功')
  } catch {
    ElMessage.error('导出失败')
  }
}

watch(filterProjectId, loadReport)

onMounted(async () => {
  if (projects.value.length === 0) {
    await projectStore.fetchProjects()
  }
  loadReport()
})
</script>

<template>
  <div class="progress-dashboard">
    <div class="dashboard-header">
      <h2 class="title">审阅进度看板</h2>
      <div class="filter-bar">
        <el-select v-model="filterProjectId" placeholder="选择项目" clearable style="width: 200px">
          <el-option
            v-for="p in projects"
            :key="p.id"
            :label="p.name"
            :value="p.id"
          />
        </el-select>
        <el-select v-model="filterDiscipline" placeholder="专业筛选" clearable style="width: 140px">
          <el-option label="建筑" value="architecture" />
          <el-option label="结构" value="structure" />
          <el-option label="机电" value="mechanical" />
          <el-option label="给排水" value="plumbing" />
        </el-select>
        <el-date-picker
          v-model="filterDateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 260px"
        />
        <el-button type="primary" :icon="Refresh" :loading="isLoading" @click="loadReport">
          刷新
        </el-button>
        <el-button :icon="Download" @click="exportReport">
          导出报告
        </el-button>
      </div>
    </div>

    <div class="stats-cards">
      <div class="stat-card">
        <div class="card-icon" style="background: rgba(29,78,216,0.1); color: #1d4ed8">
          <el-icon :size="28"><FolderOpened /></el-icon>
        </div>
        <div class="card-content">
          <div class="card-value">{{ reportData?.totalProjects || 0 }}</div>
          <div class="card-label">项目总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="card-icon" style="background: rgba(6,182,212,0.1); color: #06b6d4">
          <el-icon :size="28"><Document /></el-icon>
        </div>
        <div class="card-content">
          <div class="card-value">{{ reportData?.totalDocuments || 0 }}</div>
          <div class="card-label">图纸总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="card-icon" style="background: rgba(245,158,11,0.1); color: #f59e0b">
          <el-icon :size="28"><ChatDotRound /></el-icon>
        </div>
        <div class="card-content">
          <div class="card-value">{{ reportData?.totalAnnotations || 0 }}</div>
          <div class="card-label">批注总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="card-icon" style="background: rgba(16,185,129,0.1); color: #10b981">
          <el-icon :size="28"><CircleCheckFilled /></el-icon>
        </div>
        <div class="card-content">
          <div class="card-value">{{ reportData?.completionRate || 0 }}%</div>
          <div class="card-label">审阅完成率</div>
        </div>
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-card">
        <div class="chart-header">
          <h3>问题严重程度分布</h3>
        </div>
        <div class="chart-body">
          <div class="bar-chart">
            <div
              v-for="item in severityChartData"
              :key="item.label"
              class="bar-item"
            >
              <div class="bar-label">
                <span class="dot" :style="{ background: item.color }"></span>
                {{ item.label }}
              </div>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  :style="{
                    width: `${(item.value / maxSeverityValue) * 100}%`,
                    background: item.color
                  }"
                ></div>
              </div>
              <div class="bar-value">{{ item.value }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <h3>问题状态分布</h3>
        </div>
        <div class="chart-body">
          <div class="bar-chart">
            <div
              v-for="item in statusChartData"
              :key="item.label"
              class="bar-item"
            >
              <div class="bar-label">
                <span class="dot" :style="{ background: item.color }"></span>
                {{ item.label }}
              </div>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  :style="{
                    width: `${(item.value / maxStatusValue) * 100}%`,
                    background: item.color
                  }"
                ></div>
              </div>
              <div class="bar-value">{{ item.value }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="project-table-card">
      <div class="chart-header">
        <h3>项目进度明细</h3>
      </div>
      <el-table :data="reportData?.projects || []" v-loading="isLoading" stripe>
        <el-table-column prop="name" label="项目名称" min-width="200">
          <template #default="{ row }">
            <span class="text-ellipsis" :title="row.name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small">
              {{ { planning: '规划中', in_progress: '进行中', reviewing: '审阅中', completed: '已完成', archived: '已归档' }[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审阅进度" width="220">
          <template #default="{ row }">
            <el-progress :percentage="row.progress || 0" :stroke-width="8" />
          </template>
        </el-table-column>
        <el-table-column label="批注数" prop="annotations" width="100" align="center" />
        <el-table-column label="已解决" prop="resolved" width="100" align="center" />
        <el-table-column label="解决率" width="120" align="center">
          <template #default="{ row }">
            <span :style="{ color: (row.annotations ? (row.resolved / row.annotations) * 100 : 0) >= 80 ? '#10b981' : '#ef4444' }">
              {{ row.annotations ? Math.round((row.resolved / row.annotations) * 100) : 0 }}%
            </span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.progress-dashboard {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dashboard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;

  .title {
    font-size: 22px;
    font-weight: 600;
    margin: 0;
  }

  .filter-bar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.stat-card {
  background: $bg-base;
  border-radius: $radius-lg;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: $shadow-sm;
  transition: transform $transition-fast, box-shadow $transition-fast;

  .dark & {
    background: $dark-bg-light;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: $shadow-md;
  }

  .card-icon {
    width: 56px;
    height: 56px;
    border-radius: $radius-md;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-content {
    flex: 1;

    .card-value {
      font-size: 28px;
      font-weight: 700;
      line-height: 1.2;
    }

    .card-label {
      font-size: 13px;
      color: $text-secondary;
      margin-top: 4px;
    }
  }
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 16px;
}

.chart-card,
.project-table-card {
  background: $bg-base;
  border-radius: $radius-lg;
  padding: 20px;
  box-shadow: $shadow-sm;

  .dark & {
    background: $dark-bg-light;
  }
}

.chart-header {
  margin-bottom: 16px;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.bar-item {
  display: flex;
  align-items: center;
  gap: 12px;

  .bar-label {
    width: 60px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
  }

  .bar-track {
    flex: 1;
    height: 12px;
    background: $bg-light;
    border-radius: 6px;
    overflow: hidden;

    .dark & {
      background: $dark-bg-base;
    }
  }

  .bar-fill {
    height: 100%;
    border-radius: 6px;
    transition: width $transition-normal;
  }

  .bar-value {
    width: 40px;
    text-align: right;
    font-weight: 600;
    font-size: 14px;
  }
}
</style>
