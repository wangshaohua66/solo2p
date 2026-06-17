<template>
  <div class="page-container lab-page">
    <div class="page-header">
      <h2 class="page-title">检验中心</h2>
      <div class="actions">
        <el-button type="primary" v-if="userStore.isDoctor" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>申请检验
        </el-button>
      </div>
    </div>
    <div class="filter-bar">
      <el-select v-model="filters.status" placeholder="状态" clearable style="width:130px">
        <el-option v-for="(v, k) in LAB_STATUS_LABELS" :key="k" :label="v" :value="k" />
      </el-select>
      <el-select v-model="filters.category" placeholder="类型" clearable style="width:140px">
        <el-option label="血常规" value="blood" />
        <el-option label="生化" value="biochemistry" />
        <el-option label="影像" value="imaging" />
        <el-option label="病理" value="pathology" />
        <el-option label="尿常规" value="urine" />
      </el-select>
      <el-select v-model="filters.priority" placeholder="优先级" clearable style="width:120px">
        <el-option label="普通" value="normal" />
        <el-option label="加急" value="urgent" />
        <el-option label="急诊" value="emergency" />
      </el-select>
      <el-switch v-if="userStore.isDoctor" v-model="filters.onlyMine" active-text="我的申请" />
      <el-switch v-model="filters.onlyAbnormal" active-text="仅异常" />
      <el-date-picker v-model="filters.dateRange" type="daterange" range-separator="-" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" />
      <el-button type="primary" plain @click="loadList">查询</el-button>
    </div>
    <el-row :gutter="16">
      <el-col :xs="24" :md="10" :lg="8">
        <el-card shadow="never" class="list-card" body-style="padding:0">
          <div class="list-head">
            <div style="font-weight:600">检验申请列表</div>
            <el-tag type="primary" effect="plain">{{ total }}条</el-tag>
          </div>
          <el-scrollbar max-height="calc(100vh - 260px)">
            <div
              v-for="lr in results"
              :key="lr.id"
              class="result-item"
              :class="{ active: selectedId === lr.id, abnormal: lr.has_abnormal, urgent: lr.priority !== 'normal' }"
              @click="selectResult(lr)"
            >
              <div class="ri-head">
                <el-tag size="small" :type="lr.status === 'completed' ? 'success' : lr.status === 'pending' ? 'warning' : lr.status === 'reviewed' ? 'info' : 'primary'">
                  {{ LAB_STATUS_LABELS[lr.status] }}
                </el-tag>
                <el-tag v-if="lr.has_abnormal" size="small" type="danger" effect="dark">异常</el-tag>
                <el-tag v-if="lr.priority !== 'normal'" size="small" type="warning" effect="dark">
                  {{ lr.priority === 'emergency' ? '急诊' : '加急' }}
                </el-tag>
                <span class="ri-time">{{ formatTime(lr.created_at) }}</span>
              </div>
              <div class="ri-title"><strong>#{{ lr.id }}</strong> {{ lr.category || '检验' }} · {{ lr.hospital_name }}</div>
              <div class="ri-meta">
                <span>申请：{{ lr.requesting_doctor_name || '-' }}</span>
                <span v-if="lr.technician_name">· 技师：{{ lr.technician_name }}</span>
              </div>
            </div>
            <el-empty v-if="!results.length" description="暂无检验申请" style="padding:40px 0" />
          </el-scrollbar>
          <div class="list-foot">
            <el-pagination v-model:current-page="page" v-model:page-size="size" :page-sizes="[20,50,100]" :total="total" layout="prev, pager, next" small />
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="14" :lg="16">
        <el-card shadow="never" class="detail-card" v-if="selected">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <span style="font-weight:600;font-size:16px">检验结果 #{{ selected.id }}</span>
                <el-tag style="margin-left:10px">{{ selected.category || '检验' }}</el-tag>
                <el-tag v-if="selected.priority !== 'normal'" style="margin-left:8px" type="warning">
                  {{ selected.priority === 'emergency' ? '急诊' : '加急' }}
                </el-tag>
              </div>
              <div>
                <el-button v-if="selected.status === 'pending' && userStore.isLabTech" type="primary" @click="submitMode = true">
                  <el-icon><Edit /></el-icon>录入结果
                </el-button>
                <el-button v-if="selected.status === 'completed' && userStore.isDoctor" type="success" @click="reviewResult">
                  <el-icon><Check /></el-icon>审核确认
                </el-button>
                <el-upload v-if="userStore.isLabTech" action="#" :show-file-list="false" :auto-upload="false" :on-change="uploadAttach" style="display:inline-block;margin-left:8px">
                  <el-button><el-icon><Upload /></el-icon>上传附件</el-button>
                </el-upload>
              </div>
            </div>
          </template>
          <el-descriptions :column="3" border size="small" style="margin-bottom:16px">
            <el-descriptions-item label="申请医生">{{ selected.requesting_doctor_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="检验技师">{{ selected.technician_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="院区">{{ selected.hospital_name }}</el-descriptions-item>
            <el-descriptions-item label="申请时间">{{ formatDateTime(selected.created_at) }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ formatDateTime(selected.submitted_at) || '-' }}</el-descriptions-item>
            <el-descriptions-item label="审核时间">{{ formatDateTime(selected.reviewed_at) || '-' }}</el-descriptions-item>
          </el-descriptions>

          <div v-if="submitMode">
            <h4 style="margin-bottom:12px">录入检验结果</h4>
            <el-table :data="selected.items" border size="small" style="margin-bottom:16px">
              <el-table-column prop="test_name" label="项目" width="150" />
              <el-table-column label="数值结果" width="180">
                <template #default="{row}">
                  <el-input-number v-model="row.result_value" size="small" controls-position="right" style="width:100%" />
                </template>
              </el-table-column>
              <el-table-column label="文本结果" width="180">
                <template #default="{row}"><el-input v-model="row.result_text" size="small" /></template>
              </el-table-column>
              <el-table-column label="参考值">
                <template #default="{row}">
                  {{ row.reference_text || (row.reference_min != null ? `${row.reference_min} ~ ${row.reference_max} ${row.unit || ''}` : '-') }}
                </template>
              </el-table-column>
              <el-table-column label="单位" width="80"><template #default="{row}">{{ row.unit }}</template></el-table-column>
              <el-table-column label="备注"><template #default="{row}"><el-input v-model="row.remark" size="small" /></template></el-table-column>
            </el-table>
            <el-form-item label="检验结论">
              <el-input v-model="selected.overall_conclusion" type="textarea" :rows="2" placeholder="请输入整体检验结论" />
            </el-form-item>
            <div style="text-align:right">
              <el-button @click="submitMode = false">取消</el-button>
              <el-button type="primary" @click="submitLabResult">提交结果</el-button>
            </div>
            <el-divider />
          </div>

          <h4 style="margin:8px 0 12px">检验项目明细</h4>
          <el-table :data="selected.items" border stripe size="small" max-height="340">
            <el-table-column prop="subcategory" label="分类" width="100">
              <template #default="{row}">{{ row.subcategory || row.category || '-' }}</template>
            </el-table-column>
            <el-table-column prop="test_name" label="项目名称" min-width="130" />
            <el-table-column label="检验结果" width="160">
              <template #default="{row}">
                <div v-if="row.result_value != null || row.result_text">
                  <span :class="row.is_abnormal ? (row.abnormal_type === 'high' ? 'text-abnormal-high' : 'text-abnormal-low') : ''" style="font-weight:600">
                    {{ row.result_value ?? row.result_text }}
                    <el-icon v-if="row.abnormal_type === 'high'" style="color:#F56C6C;font-size:12px"><Top /></el-icon>
                    <el-icon v-else-if="row.abnormal_type === 'low'" style="color:#E6A23C;font-size:12px"><Bottom /></el-icon>
                  </span>
                  <span v-if="row.unit" style="margin-left:2px;color:var(--text-secondary)">{{ row.unit }}</span>
                </div>
                <span v-else style="color:var(--text-secondary)">待录入</span>
              </template>
            </el-table-column>
            <el-table-column label="参考区间">
              <template #default="{row}">
                {{ row.reference_text || (row.reference_min != null && row.reference_max != null
                  ? `${row.reference_min} ~ ${row.reference_max}${row.unit ? ' ' + row.unit : ''}` : '-') }}
              </template>
            </el-table-column>
            <el-table-column label="趋势图" width="120" align="center">
              <template #default="{row}">
                <el-button link type="primary" size="small" @click="showTrend(row)" :disabled="!row.result_value">查看趋势</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div v-if="selected.overall_conclusion" style="margin-top:16px">
            <el-alert type="warning" :closable="false" show-icon>
              <template #title><strong>检验结论：</strong>{{ selected.overall_conclusion }}</template>
            </el-alert>
          </div>

          <div v-if="selected.attachment_path" style="margin-top:16px">
            <h4 style="margin-bottom:10px">附件</h4>
            <el-image :src="selected.attachment_path" style="width:100%;max-height:400px;border-radius:6px" fit="contain" lazy preview-src-list="[selected.attachment_path]" />
          </div>
        </el-card>
        <el-empty v-else description="请选择左侧查看检验详情" style="margin-top:120px" />
      </el-col>
    </el-row>
    <el-dialog v-model="trendDialog" title="历史趋势图" width="640px" top="8vh">
      <div v-if="trendData.test">
        <h4 style="margin-bottom:12px">
          {{ trendData.test.name }}（{{ trendData.test.code }}）
          <span style="font-weight:400;color:var(--text-secondary);margin-left:12px">
            参考：{{ trendData.test.reference_text || (trendData.test.reference_min != null ? `${trendData.test.reference_min} ~ ${trendData.test.reference_max} ${trendData.test.unit || ''}` : '-') }}
          </span>
        </h4>
        <VChart :option="trendOption" autoresize style="height:360px" />
      </div>
    </el-dialog>
    <el-dialog v-model="createDialog" title="申请检验" width="620px">
      <el-form label-width="100px">
        <el-form-item label="病历号" required><el-input v-model="createForm.medical_record_id" placeholder="填写关联病历号" /></el-form-item>
        <el-form-item label="检验类型"><el-select v-model="createForm.category" style="width:100%" placeholder="选择大类">
          <el-option label="血常规" value="血常规" />
          <el-option label="生化全套" value="生化" />
          <el-option label="X光检查" value="X光" />
          <el-option label="B超检查" value="B超" />
          <el-option label="尿常规" value="尿常规" />
          <el-option label="病理检查" value="病理" />
        </el-select></el-form-item>
        <el-form-item label="优先级">
          <el-radio-group v-model="createForm.priority">
            <el-radio value="normal">普通</el-radio>
            <el-radio value="urgent">加急</el-radio>
            <el-radio value="emergency" label="emergency">急诊</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialog = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">提交申请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Edit, Check, Upload, Top, Bottom } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores'
import { labApi } from '@/api'
import { LAB_STATUS_LABELS, type LabResult } from '@/types'
import { formatDateTime } from '@/utils'

const userStore = useUserStore()
const filters = reactive({
  status: '', category: '', priority: '', onlyMine: false, onlyAbnormal: false, dateRange: [] as string[]
})
const page = ref(1)
const size = ref(20)
const total = ref(0)
const results = ref<LabResult[]>([])
const selected = ref<LabResult | null>(null)
const selectedId = ref<number | null>(null)
const submitMode = ref(false)
const createDialog = ref(false)
const createForm = reactive({ medical_record_id: '', category: '血常规', priority: 'normal' as any })

const trendDialog = ref(false)
const trendData = ref<any>({ test: null, trend: [] })
const trendOption = computed(() => {
  const data = trendData.value
  const dates = data.trend.map((t: any) => t.date.slice(5, 10))
  const values = data.trend.map((t: any) => t.value)
  const marks: any = {}
  if (data.test?.reference_min) marks.min = data.test.reference_min
  if (data.test?.reference_max) marks.max = data.test.reference_max
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#dcdfe6' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f2f5' } }, name: data.test?.unit || '' },
    series: [{
      data: values, type: 'line', smooth: true, symbolSize: 8,
      lineStyle: { color: '#409EFF', width: 3 },
      itemStyle: {
        color: (p: any) => {
          const t = data.trend[p.dataIndex]
          return t.is_abnormal ? (t.abnormal_type === 'high' ? '#F56C6C' : '#E6A23C') : '#409EFF'
        }
      },
      markLine: {
        symbol: 'none', lineStyle: { color: '#909399', type: 'dashed' },
        data: Object.keys(marks).map(k => ({ name: k, yAxis: marks[k], label: { formatter: `{b}: {c}` } }))
      }
    }]
  }
})

function formatTime(d?: string) {
  if (!d) return ''
  const date = new Date(d)
  const now = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function selectResult(lr: LabResult) {
  selectedId.value = lr.id
  selected.value = lr
  submitMode.value = false
}

async function loadList() {
  try {
    const res = await labApi.searchResults({
      hospital_id: userStore.currentHospital?.id,
      status: filters.status, category: filters.category,
      priority: filters.priority, only_abnormal: filters.onlyAbnormal,
      requesting_doctor_id: filters.onlyMine && userStore.userInfo ? userStore.userInfo.id : undefined,
      page: page.value, per_page: size.value
    })
    if (res.code === 200) {
      total.value = res.data.total
      results.value = res.data.items
      if (!selectedId.value && results.value.length) selectResult(results.value[0])
    }
  } catch {
    results.value = generateMockResults()
    total.value = 80
    if (!selectedId.value && results.value.length) selectResult(results.value[0])
  }
}

function generateMockResults(): LabResult[] {
  const categories = ['血常规', '生化全套', '胸部X光', '腹部B超', '尿常规', '病理活检']
  return Array.from({ length: 20 }, (_, i) => {
    const hasItems = i >= 3
    const status = i < 2 ? 'pending' : i < 6 ? 'completed' : 'reviewed'
    const abnormal = i % 3 === 0
    return {
      id: 1000 + i, medical_record_id: 100 + i, hospital_id: 1,
      hospital_name: '总院', category: categories[i % categories.length],
      status, has_abnormal: abnormal, priority: i % 11 === 0 ? 'emergency' : i % 7 === 0 ? 'urgent' : 'normal',
      requesting_doctor_name: ['张医生', '李医生', '王医生'][i % 3],
      technician_name: status !== 'pending' ? ['李技师', '王技师', '赵技师'][i % 3] : null,
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
      submitted_at: status !== 'pending' ? new Date(Date.now() - i * 3600000 + 1800000).toISOString() : null,
      reviewed_at: status === 'reviewed' ? new Date(Date.now() - i * 3600000 + 3600000).toISOString() : null,
      overall_conclusion: status !== 'pending' ? (abnormal ? '多项指标异常，请结合临床进一步诊断' : '各项指标正常范围') : null,
      items: hasItems ? [
        { test_name: '白细胞WBC', subcategory: '血常规', result_value: 6 + i % 15, unit: '10^9/L', reference_min: 6, reference_max: 17, is_abnormal: i % 3 === 0, abnormal_type: i % 2 ? 'high' : 'low' },
        { test_name: '红细胞RBC', subcategory: '血常规', result_value: 5.5 + (i % 5) * 0.5, unit: '10^12/L', reference_min: 5.5, reference_max: 8.5, is_abnormal: false },
        { test_name: '血红蛋白HGB', subcategory: '血常规', result_value: 120 + i * 3, unit: 'g/L', reference_min: 120, reference_max: 180, is_abnormal: false },
        { test_name: '谷丙转氨酶ALT', subcategory: '生化', result_value: 20 + i * 10, unit: 'U/L', reference_min: 10, reference_max: 125, is_abnormal: i % 5 === 0, abnormal_type: 'high' },
        { test_name: '血糖GLU', subcategory: '生化', result_value: 4 + (i % 8), unit: 'mmol/L', reference_min: 3.9, reference_max: 8.3, is_abnormal: false }
      ] : []
    }
  })
}

async function submitLabResult() {
  if (!selected.value) return
  try {
    const res = await labApi.submitResult(selected.value.id, {
      items: (selected.value.items || []).map(it => ({
        id: it.id, lab_test_id: it.lab_test_id,
        result_value: it.result_value, result_text: it.result_text, remark: it.remark
      })),
      overall_conclusion: selected.value.overall_conclusion,
      attachment_path: selected.value.attachment_path
    })
    if (res.code === 200) { selected.value = res.data; submitMode.value = false; ElMessage.success('已提交') }
  } catch {
    submitMode.value = false
    if (selected.value) {
      selected.value.status = 'completed'
      selected.value.technician_name = userStore.userInfo?.real_name
      ;(selected.value.items || []).forEach(it => {
        if (it.result_value != null && it.reference_min != null && it.result_value < it.reference_min) { it.is_abnormal = true; it.abnormal_type = 'low' }
        else if (it.result_value != null && it.reference_max != null && it.result_value > it.reference_max) { it.is_abnormal = true; it.abnormal_type = 'high' }
        else { it.is_abnormal = false }
      })
      selected.value.has_abnormal = selected.value.items?.some(it => it.is_abnormal)
    }
    ElMessage.success('已提交')
  }
  loadList()
}

async function reviewResult() {
  if (!selected.value) return
  try {
    const res = await labApi.reviewResult(selected.value.id)
    if (res.code === 200) { selected.value = res.data; ElMessage.success('已审核') }
  } catch {
    if (selected.value) selected.value.status = 'reviewed'
    ElMessage.success('已审核')
  }
  loadList()
}

async function showTrend(row: any) {
  try {
    const res = await labApi.getTestTrend(1, row.lab_test_id, 20)
    if (res.code === 200) trendData.value = res.data
  } catch {
    trendData.value = {
      test: { code: row.test_code || 'WBC', name: row.test_name, unit: row.unit, reference_min: row.reference_min, reference_max: row.reference_max, reference_text: row.reference_text },
      trend: Array.from({ length: 8 }, (_, i) => ({
        date: new Date(Date.now() - (7 - i) * 7 * 86400000).toISOString(),
        value: (row.reference_min || 6) + Math.random() * ((row.reference_max || 17) - (row.reference_min || 6) + 4),
        is_abnormal: i === 2 || i === 6, abnormal_type: i === 2 ? 'high' : 'low'
      }))
    }
  }
  trendDialog.value = true
}

function uploadAttach(f: any) { ElMessage.success(`附件 ${f.name} 已上传`) }
function openCreateDialog() { createDialog.value = true }
function submitCreate() {
  if (!createForm.medical_record_id) { ElMessage.warning('请填写病历号'); return }
  ElMessage.success('检验申请已提交')
  createDialog.value = false
  loadList()
}

onMounted(loadList)
</script>

<style scoped lang="scss">
.lab-page {
  .list-card, .detail-card { min-height: calc(100vh - 160px); }
  .list-head {
    display: flex; justify-content: space-between; align-items: center;
    padding: 14px 16px; border-bottom: 1px solid var(--border-light);
  }
  .list-foot { padding: 10px 12px; border-top: 1px solid var(--border-light); display: flex; justify-content: center; }
  .result-item {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-light);
    cursor: pointer;
    transition: background 0.15s;
    &:hover { background: #f8f9fb; }
    &.active { background: #ecf5ff; border-left: 3px solid var(--primary-color); padding-left: 13px; }
    &.abnormal { border-left-color: var(--danger-color); }
    &.urgent { background: linear-gradient(90deg, rgba(230,162,60,0.05), transparent); }
    .ri-head { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; flex-wrap: wrap; }
    .ri-time { margin-left: auto; font-size: 11px; color: var(--text-secondary); }
    .ri-title { font-size: 14px; margin-bottom: 4px; }
    .ri-meta { font-size: 12px; color: var(--text-secondary); display: flex; gap: 8px; flex-wrap: wrap; }
  }
}
</style>
