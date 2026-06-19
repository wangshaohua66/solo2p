<template>
  <div class="portal-home">
    <div class="stat-row">
      <el-row :gutter="16">
        <el-col :span="6"><div class="stat-card blue">
          <div class="st-label">进行中案件</div>
          <div class="st-value">{{ stat.active || 0 }}</div>
          <el-icon class="st-icon"><Document /></el-icon>
        </div></el-col>
        <el-col :span="6"><div class="stat-card green">
          <div class="st-label">本月庭审</div>
          <div class="st-value">{{ stat.trials || 0 }}</div>
          <el-icon class="st-icon"><Calendar /></el-icon>
        </div></el-col>
        <el-col :span="6"><div class="stat-card purple">
          <div class="st-label">已生成文书</div>
          <div class="st-value">{{ stat.docs || 0 }}</div>
          <el-icon class="st-icon"><Tickets /></el-icon>
        </div></el-col>
        <el-col :span="6"><div class="stat-card orange">
          <div class="st-label">待支付金额</div>
          <div class="st-value">¥{{ (stat.unpaid || 0).toLocaleString() }}</div>
          <el-icon class="st-icon"><Money /></el-icon>
        </div></el-col>
      </el-row>
    </div>
    <el-row :gutter="16" style="margin-top:20px">
      <el-col :span="14">
        <div class="card">
          <div class="card-head">
            <h3>最新案件进展</h3>
            <el-button link type="primary" @click="$router.push('/portal/cases')">查看全部</el-button>
          </div>
          <el-table :data="recentCases" size="small" v-loading="loading">
            <el-table-column prop="case_no" label="案号" width="140" />
            <el-table-column prop="case_name" label="案件名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="status_display" label="状态" width="100">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ row.status_display }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="最后进展" width="160">
              <template #default="{ row }">
                {{ row.progress_logs?.length ? formatTime(row.progress_logs[row.progress_logs.length-1].created_at) : '-' }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="viewCase(row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
      <el-col :span="10">
        <div class="card">
          <div class="card-head"><h3>即将开庭</h3></div>
          <div class="trial-list" v-loading="loading">
            <div v-if="!trials.length" class="empty">暂无近期庭审</div>
            <div class="trial-item" v-for="t in trials" :key="t.id" @click="viewTrial(t)">
              <div class="t-date">
                <div class="day">{{ formatDay(t.start_time) }}</div>
                <div class="month">{{ formatMonth(t.start_time) }}</div>
              </div>
              <div class="t-info">
                <div class="t-name">{{ t.case_info?.case_name || '-' }}</div>
                <div class="t-meta">
                  <el-tag size="small" effect="plain">{{ t.trial_type_display }}</el-tag>
                  <span style="color:#718096;margin-left:8px">{{ formatTime(t.start_time) }} </span>
                  <span style="color:#718096;margin-left:8px">· {{ t.location || '-' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <div class="card-head"><h3>费用明细</h3></div>
          <el-table :data="billing" size="small" v-loading="loading">
            <el-table-column prop="period" label="期间" width="110" />
            <el-table-column label="明细" prop="description" />
            <el-table-column label="金额" width="100" align="right">
              <template #default="{ row }">¥{{ (row.amount || 0).toLocaleString() }}</template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag size="small" :type="row.paid ? 'success' : 'danger'">{{ row.paid ? '已付' : '未付' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Document, Calendar, Tickets, Money } from '@element-plus/icons-vue'
import { caseApi, trialApi, settlementApi } from '@/api/modules'
import dayjs from 'dayjs'

const stat = reactive({ active: 0, trials: 0, docs: 0, unpaid: 0 })
const recentCases = ref<any[]>([])
const trials = ref<any[]>([])
const billing = ref<any[]>([])
const loading = ref(false)

const formatTime = (t: string) => dayjs(t).format('MM-DD HH:mm')
const formatDay = (t: string) => dayjs(t).format('DD')
const formatMonth = (t: string) => dayjs(t).format('MM月')

function viewCase(row: any) { window.alert('案件详情页面：' + row.case_no) }
function viewTrial(t: any) { window.alert('庭审详情：' + t.case_info?.case_name) }

onMounted(async () => {
  loading.value = true
  try {
    const [cases, trialsRes, settlementsRes] = await Promise.all([
      caseApi.list({ page_size: 10 }) as Promise<any>,
      trialApi.list({ upcoming: true, page_size: 20 }) as Promise<any>,
      settlementApi.list({ page_size: 50 }) as Promise<any>,
    ])
    recentCases.value = cases.data?.results || []
    trials.value = trialsRes.data?.results || []
    stat.active = recentCases.value.filter((c: any) => !['closed', 'closing'].includes(c.status)).length
    stat.trials = trials.value.length
    const settlements = settlementsRes.data?.results || []
    stat.docs = settlements.length
    stat.unpaid = settlements.reduce((s: number, sm: any) => s + (sm.unpaid_amount || 0), 0)
    billing.value = settlements.map((sm: any) => ({
      period: dayjs(sm.created_at || sm.issue_date).format('YYYY-MM'),
      description: `${sm.settlement_no} - ${sm.case_info?.case_name || sm.client_info?.client_name || '律师费结算'}`,
      amount: sm.settlement_amount || 0,
      paid: (sm.paid_amount || 0) >= (sm.settlement_amount || 0) && (sm.settlement_amount || 0) > 0,
      unpaid_amount: sm.unpaid_amount || 0,
      paid_amount: sm.paid_amount || 0,
    }))
  } finally { loading.value = false }
})
</script>

<style lang="scss" scoped>
.portal-home {
  .stat-row .stat-card {
    position: relative;
    border-radius: 10px;
    padding: 20px 22px;
    color: #fff;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    .st-label { opacity: 0.9; font-size: 13px; }
    .st-value { font-size: 26px; font-weight: 700; margin-top: 8px; }
    .st-icon { position: absolute; right: 16px; top: 16px; font-size: 38px; opacity: 0.25; }
    &.blue { background: linear-gradient(135deg, #4299e1, #2b6cb0); }
    &.green { background: linear-gradient(135deg, #48bb78, #2f855a); }
    &.purple { background: linear-gradient(135deg, #9f7aea, #6b46c1); }
    &.orange { background: linear-gradient(135deg, #f6ad55, #dd6b20); }
  }
  .card {
    background: #fff;
    border-radius: 10px;
    padding: 18px 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .card-head {
    display: flex; justify-content: space-between; align-items: center;
    padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid #edf2f7;
    h3 { margin: 0; font-size: 15px; color: #2d3748; }
  }
  .trial-list {
    .trial-item {
      display: flex;
      gap: 14px;
      padding: 12px 0;
      border-bottom: 1px dashed #edf2f7;
      cursor: pointer;
      transition: background 0.2s;
      border-radius: 6px;
      padding-left: 8px;
      padding-right: 8px;
      &:hover { background: #f7fafc; }
      &:last-child { border-bottom: none; }
      .t-date {
        width: 56px;
        text-align: center;
        border-radius: 8px;
        background: #ebf8ff;
        padding: 8px 4px;
        flex-shrink: 0;
        .day { font-size: 22px; font-weight: 700; color: #2b6cb0; line-height: 1; }
        .month { color: #4299e1; font-size: 11px; margin-top: 4px; }
      }
      .t-info { flex: 1; min-width: 0; }
      .t-name { font-size: 14px; color: #2d3748; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .t-meta { margin-top: 6px; font-size: 12px; display: flex; align-items: center; flex-wrap: wrap; }
    }
    .empty { padding: 24px; color: #a0aec0; text-align: center; font-size: 13px; }
  }
}
</style>
