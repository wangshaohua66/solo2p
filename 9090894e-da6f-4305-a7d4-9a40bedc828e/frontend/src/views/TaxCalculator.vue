<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Calculator,
  Plus,
  Delete,
  Download,
  Refresh,
  TrendCharts,
  Document,
  Sort,
  RefreshRight
} from '@element-plus/icons-vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import type { TaxCalcItem, TaxCalcResult } from '@/types'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent])

const currencyOptions = [
  { label: '美元 USD', value: 'USD', rate: 7.25 },
  { label: '欧元 EUR', value: 'EUR', rate: 7.85 },
  { label: '人民币 CNY', value: 'CNY', rate: 1 },
  { label: '英镑 GBP', value: 'GBP', rate: 9.2 },
  { label: '日元 JPY', value: 'JPY', rate: 0.048 }
]

const hsCodeRateMap: Record<string, { rate: number; policy: string; name: string }> = {
  '85171210': { rate: 0.13, policy: '财税〔2024〕1号', name: '蓝牙耳机' },
  '85176290': { rate: 0.13, policy: '财税〔2024〕1号', name: '智能手表' },
  '85258013': { rate: 0.13, policy: '财税〔2024〕1号', name: '网络摄像头' },
  '85044099': { rate: 0.13, policy: '财税〔2024〕1号', name: '无线充电器' },
  '61091000': { rate: 0.13, policy: '财税〔2024〕3号', name: '棉质T恤' },
  '94052000': { rate: 0.13, policy: '财税〔2024〕1号', name: 'LED台灯' },
  '95030031': { rate: 0.15, policy: '财税〔2024〕2号', name: '益智积木玩具' },
  '33041000': { rate: 0.13, policy: '财税〔2024〕1号', name: '口红化妆品' },
  '85287222': { rate: 0.13, policy: '财税〔2024〕1号', name: '液晶显示器' },
  '64029929': { rate: 0.13, policy: '财税〔2024〕1号', name: '运动鞋' }
}

const policyVersions = [
  { value: '2024V1', label: '2024年第1版 (2024-01-01)', desc: '2024年1月起执行，电子产品13%，玩具15%' },
  { value: '2023V3', label: '2023年第3版 (2023-09-01)', desc: '部分纺织品退税率调整' },
  { value: '2023V1', label: '2023年第1版 (2023-01-01)', desc: '2023年基础退税率版本' }
]

const selectedPolicyVersion = ref('2024V1')
const compareVersion = ref('2023V1')
const showCompare = ref(false)
const calculating = ref(false)
const hsInput = ref('')

const calcItems = ref<TaxCalcItem[]>([
  { productName: '蓝牙耳机', hsCode: '85171210', quantity: 500, unitPrice: 25, currency: 'USD', exchangeRate: 7.25 },
  { productName: '棉质T恤', hsCode: '61091000', quantity: 1000, unitPrice: 5, currency: 'USD', exchangeRate: 7.25 },
  { productName: '益智积木玩具', hsCode: '95030031', quantity: 300, unitPrice: 15, currency: 'USD', exchangeRate: 7.25 }
])

const calcResults = ref<TaxCalcResult[]>([])

function addItem() {
  calcItems.value.push({
    productName: '',
    hsCode: '',
    quantity: 1,
    unitPrice: 0,
    currency: 'USD',
    exchangeRate: 7.25
  })
}

function removeItem(idx: number) {
  if (calcItems.value.length <= 1) {
    ElMessage.warning('至少保留一条商品记录')
    return
  }
  calcItems.value.splice(idx, 1)
  calcResults.value.splice(idx, 1)
}

function onCurrencyChange(idx: number, currency: string) {
  const cur = currencyOptions.find(c => c.value === currency)
  if (cur) {
    calcItems.value[idx].exchangeRate = cur.rate
  }
}

function onHSCodeChange(idx: number, code: string) {
  const info = hsCodeRateMap[code]
  if (info && !calcItems.value[idx].productName) {
    calcItems.value[idx].productName = info.name
  }
}

function clearAll() {
  calcItems.value = [{ productName: '', hsCode: '', quantity: 1, unitPrice: 0, currency: 'USD', exchangeRate: 7.25 }]
  calcResults.value = []
  ElMessage.info('已清空')
}

async function doCalculate() {
  const valid = calcItems.value.filter(i => i.hsCode && i.quantity > 0 && i.unitPrice > 0)
  if (valid.length === 0) {
    ElMessage.warning('请填写有效的商品信息')
    return
  }
  calculating.value = true
  await new Promise(r => setTimeout(r, 600))
  calcResults.value = valid.map(item => {
    const info = hsCodeRateMap[item.hsCode] || { rate: 0.13, policy: '财税〔2024〕1号' }
    const fx = item.exchangeRate || 7.25
    const foreignAmount = item.quantity * item.unitPrice
    const taxBasis = foreignAmount * fx
    return {
      hsCode: item.hsCode,
      productName: item.productName || hsCodeRateMap[item.hsCode]?.name || '未命名商品',
      refundRate: info.rate,
      taxBasis: Number(taxBasis.toFixed(2)),
      refundAmount: Number((taxBasis * info.rate).toFixed(2)),
      policyNo: info.policy,
      effectiveDate: '2024-01-01'
    }
  })
  calculating.value = false
  ElMessage.success('计算完成')
}

const totalTaxBasis = computed(() =>
  calcResults.value.reduce((s, r) => s + r.taxBasis, 0)
)

const totalRefund = computed(() =>
  calcResults.value.reduce((s, r) => s + r.refundAmount, 0)
)

const avgRefundRate = computed(() => {
  if (totalTaxBasis.value === 0) return 0
  return (totalRefund.value / totalTaxBasis.value * 100).toFixed(2)
})

const trendChartOption = computed(() => ({
  title: {
    text: '退税率趋势（近12个月）',
    left: 'center',
    textStyle: { fontSize: 14, fontWeight: 500 }
  },
  tooltip: {
    trigger: 'axis',
    valueFormatter: (v: number) => `${(v * 100).toFixed(1)}%`
  },
  legend: { data: ['蓝牙耳机', '棉质T恤', '益智积木'], bottom: 0 },
  grid: { left: 50, right: 20, top: 60, bottom: 40 },
  xAxis: {
    type: 'category',
    data: ['7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月', '4月', '5月', '6月']
  },
  yAxis: {
    type: 'value',
    axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(0)}%` },
    min: 0.1,
    max: 0.2
  },
  series: [
    {
      name: '蓝牙耳机',
      type: 'line',
      smooth: true,
      data: [0.13, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13],
      itemStyle: { color: '#1e6fff' },
      lineStyle: { width: 2 }
    },
    {
      name: '棉质T恤',
      type: 'line',
      smooth: true,
      data: [0.11, 0.11, 0.12, 0.12, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13],
      itemStyle: { color: '#52c41a' },
      lineStyle: { width: 2 }
    },
    {
      name: '益智积木',
      type: 'line',
      smooth: true,
      data: [0.13, 0.13, 0.13, 0.13, 0.14, 0.14, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15],
      itemStyle: { color: '#faad14' },
      lineStyle: { width: 2 }
    }
  ]
}))

const amountChartOption = computed(() => ({
  title: {
    text: '退税金额构成',
    left: 'center',
    textStyle: { fontSize: 14, fontWeight: 500 }
  },
  tooltip: {
    trigger: 'item',
    valueFormatter: (v: number) => `¥${v.toLocaleString()}`
  },
  legend: { bottom: 0 },
  series: [{
    type: 'pie',
    radius: ['40%', '70%'],
    center: ['50%', '50%'],
    avoidLabelOverlap: true,
    itemStyle: {
      borderRadius: 4,
      borderColor: '#fff',
      borderWidth: 2
    },
    label: {
      formatter: '{b}\n¥{c}'
    },
    data: calcResults.value.length > 0
      ? calcResults.value.map(r => ({ name: r.productName, value: r.refundAmount }))
      : []
  }]
}))

const comparisonData = computed(() => {
  const rateByVersion: Record<string, Record<string, number>> = {
    '2024V1': { '85171210': 0.13, '61091000': 0.13, '95030031': 0.15, '85176290': 0.13 },
    '2023V3': { '85171210': 0.13, '61091000': 0.12, '95030031': 0.13, '85176290': 0.13 },
    '2023V1': { '85171210': 0.13, '61091000': 0.11, '95030031': 0.13, '85176290': 0.13 }
  }
  const codes = ['85171210', '61091000', '95030031', '85176290']
  const names: Record<string, string> = {
    '85171210': '蓝牙耳机',
    '61091000': '棉质T恤',
    '95030031': '益智积木玩具',
    '85176290': '智能手表'
  }
  return codes.map(code => ({
    code,
    name: names[code],
    v1Rate: rateByVersion[selectedPolicyVersion.value]?.[code] || 0.13,
    v2Rate: rateByVersion[compareVersion.value]?.[code] || 0.13
  })).map(r => ({
    ...r,
    diff: (r.v1Rate - r.v2Rate) * 100
  }))
})

onMounted(() => {
  doCalculate()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">出口退税计算器</div>
      <div style="display: flex; gap: 10px;">
        <el-button :icon="Refresh" @click="clearAll">清空</el-button>
        <el-button :icon="Download">导出结果</el-button>
        <el-button type="primary" :icon="Calculator" :loading="calculating" @click="doCalculate">
          计算退税
        </el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="24">
        <div class="card summary-card">
          <el-row :gutter="16">
            <el-col :span="6">
              <div class="stat-item">
                <div class="stat-label">商品种类</div>
                <div class="stat-value">{{ calcResults.length }} <span class="stat-unit">种</span></div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-item">
                <div class="stat-label">计税依据（FOB价）</div>
                <div class="stat-value">¥{{ totalTaxBasis.toLocaleString() }}</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-item highlight">
                <div class="stat-label">预计退税总额</div>
                <div class="stat-value big">¥{{ totalRefund.toLocaleString() }}</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-item">
                <div class="stat-label">综合退税率</div>
                <div class="stat-value">{{ avgRefundRate }}<span class="stat-unit">%</span></div>
              </div>
            </el-col>
          </el-row>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="14">
        <div class="card">
          <div class="section-title">
            <span><el-icon style="margin-right: 6px"><Sort /></el-icon>商品明细</span>
            <div style="display: flex; align-items: center; gap: 12px">
              <el-select v-model="selectedPolicyVersion" size="small" style="width: 260px">
                <el-option
                  v-for="p in policyVersions"
                  :key="p.value"
                  :label="p.label"
                  :value="p.value"
                />
              </el-select>
              <el-button link type="primary" size="small" @click="showCompare = !showCompare">
                <el-icon style="margin-right: 4px"><TrendCharts /></el-icon>
                {{ showCompare ? '收起对比' : '政策版本对比' }}
              </el-button>
            </div>
          </div>

          <el-table :data="calcItems" border size="default">
            <el-table-column label="序号" type="index" width="55" align="center" />
            <el-table-column label="商品名称" min-width="140">
              <template #default="{ row }">
                <el-input v-model="row.productName" placeholder="请输入" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="HS编码" width="140">
              <template #default="{ row, $index }">
                <el-autocomplete
                  v-model="row.hsCode"
                  :fetch-suggestions="(qs: string, cb: any) => cb(
                    Object.entries(hsCodeRateMap)
                      .filter(([k, v]) => k.includes(qs) || v.name.includes(qs))
                      .map(([k, v]) => ({ value: k, label: `${k} ${v.name}` }))
                  )"
                  placeholder="请输入HS编码"
                  size="small"
                  @select="(v: any) => onHSCodeChange($index, v.value)"
                />
              </template>
            </el-table-column>
            <el-table-column label="数量" width="90">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.quantity"
                  :min="1"
                  :controls="false"
                  size="small"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="单价(外币)" width="110">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.unitPrice"
                  :min="0"
                  :precision="2"
                  :controls="false"
                  size="small"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="币种" width="100">
              <template #default="{ row, $index }">
                <el-select v-model="row.currency" size="small" @change="(v: string) => onCurrencyChange($index, v)">
                  <el-option v-for="c in currencyOptions" :key="c.value" :label="c.label" :value="c.value" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="汇率" width="90">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.exchangeRate"
                  :precision="4"
                  :controls="false"
                  size="small"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="60" align="center" fixed="right">
              <template #default="{ $index }">
                <el-button link type="danger" :icon="Delete" size="small" @click="removeItem($index)" />
              </template>
            </el-table-column>
          </el-table>

          <div class="add-row-btn">
            <el-button type="dashed" style="width: 100%" :icon="Plus" @click="addItem">
              添加商品行
            </el-button>
          </div>

          <el-collapse-transition>
            <div v-show="showCompare" style="margin-top: 20px">
              <div style="margin-bottom: 12px; display: flex; gap: 12px; align-items: center">
                <span class="section-label">对比版本：</span>
                <el-select v-model="compareVersion" size="small" style="width: 260px">
                  <el-option
                    v-for="p in policyVersions.filter(x => x.value !== selectedPolicyVersion)"
                    :key="p.value"
                    :label="p.label"
                    :value="p.value"
                  />
                </el-select>
                <el-button type="primary" size="small" link>
                  <el-icon style="margin-right: 4px"><Document /></el-icon>查看政策原文
                </el-button>
              </div>
              <el-table :data="comparisonData" size="small" border>
                <el-table-column prop="code" label="HS编码" width="120" />
                <el-table-column prop="name" label="商品名称" />
                <el-table-column :label="`${policyVersions.find(p=>p.value===selectedPolicyVersion)?.label.slice(0,8)}`" width="140" align="right">
                  <template #default="{ row }">
                    <el-tag type="success" size="small">{{ (row.v1Rate * 100).toFixed(0) }}%</el-tag>
                  </template>
                </el-table-column>
                <el-table-column :label="`${policyVersions.find(p=>p.value===compareVersion)?.label.slice(0,8)}`" width="140" align="right">
                  <template #default="{ row }">
                    <el-tag type="info" size="small">{{ (row.v2Rate * 100).toFixed(0) }}%</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="差异" width="120" align="center">
                  <template #default="{ row }">
                    <span
                      :style="{
                        color: row.diff > 0 ? '#52c41a' : row.diff < 0 ? '#ff4d4f' : '#909399',
                        fontWeight: 600
                      }"
                    >
                      {{ row.diff > 0 ? '+' : '' }}{{ row.diff.toFixed(0) }}%
                    </span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-collapse-transition>
        </div>
      </el-col>

      <el-col :span="10">
        <div class="card" style="height: calc(100% - 16px); min-height: 400px">
          <div class="section-title">
            <span><el-icon style="margin-right: 6px"><RefreshRight /></el-icon>计算结果</span>
          </div>
          <el-table :data="calcResults" border size="small" stripe>
            <el-table-column prop="productName" label="商品" min-width="110" show-overflow-tooltip />
            <el-table-column prop="hsCode" label="HS编码" width="100" />
            <el-table-column label="退税率" width="80" align="right">
              <template #default="{ row }">
                <el-tag type="warning" size="small">{{ (row.refundRate * 100).toFixed(0) }}%</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="计税依据" width="110" align="right">
              <template #default="{ row }">¥{{ row.taxBasis.toLocaleString() }}</template>
            </el-table-column>
            <el-table-column label="退税金额" width="110" align="right">
              <template #default="{ row }">
                <span style="color: #52c41a; font-weight: 600">¥{{ row.refundAmount.toLocaleString() }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="policyNo" label="适用政策" width="110" show-overflow-tooltip />
          </el-table>

          <div v-if="calcResults.length > 0" style="margin-top: 20px">
            <v-chart class="chart-sm" :option="amountChartOption" autoresize />
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="24">
        <div class="card">
          <v-chart class="chart" :option="trendChartOption" autoresize />
        </div>
      </el-col>
    </el-row>
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
  }
}

.summary-card {
  .stat-item {
    padding: 16px;
    background-color: $bg-color;
    border-radius: $border-radius-md;
    text-align: center;

    .stat-label {
      font-size: $font-size-sm;
      color: $text-secondary;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: $text-primary;

      &.big {
        color: $primary-color;
        font-size: 28px;
      }

      .stat-unit {
        font-size: $font-size-sm;
        font-weight: 400;
        color: $text-secondary;
        margin-left: 2px;
      }
    }

    &.highlight {
      background: linear-gradient(135deg, rgba(30, 111, 255, 0.08), rgba(30, 111, 255, 0.02));
    }
  }
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid $border-light;
}

.section-label {
  font-weight: 500;
  color: $text-regular;
  font-size: $font-size-sm;
}

.add-row-btn {
  margin-top: 12px;
}

.chart {
  height: 320px;
}

.chart-sm {
  height: 260px;
}
</style>
