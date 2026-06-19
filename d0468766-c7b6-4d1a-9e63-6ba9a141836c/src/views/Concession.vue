<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import * as ElIcons from '@element-plus/icons-vue'
import SectionPanel from '@/components/SectionPanel.vue'
import StatCard from '@/components/StatCard.vue'
import BaseChart from '@/components/BaseChart.vue'
import { concessionApi } from '@/api'
import type { ConcessionSku, StockDoc } from '@/types'

const loading = ref(true)
const skus = ref<ConcessionSku[]>([])
const docs = ref<StockDoc[]>([])
const activeTab = ref('inventory')
const cinemaFilter = ref('')
const categoryFilter = ref('')
const newDocVisible = ref(false)
const newDoc = ref({ type: 'inbound' as StockDoc['type'], skuName: '', quantity: 0 })

onMounted(async () => {
  const [s, d] = await Promise.all([concessionApi.getSkus(), concessionApi.getDocs()])
  skus.value = s
  docs.value = d
  loading.value = false
})

const stats = computed(() => {
  const low = skus.value.filter((s) => s.status === 'low').length
  const out = skus.value.filter((s) => s.status === 'out').length
  const over = skus.value.filter((s) => s.status === 'overstock').length
  const monthProfit = skus.value.reduce((sum, s) => sum + (s.salePrice - s.costPrice) * s.monthSales, 0)
  return { total: skus.value.length, low, out, over, monthProfit }
})

const filteredSkus = computed(() =>
  skus.value.filter(
    (s) =>
      (!cinemaFilter.value || s.cinemaId === cinemaFilter.value) &&
      (!categoryFilter.value || s.category === categoryFilter.value)
  )
)

const cinemas = computed(() => [...new Set(skus.value.map((s) => ({ id: s.cinemaId, name: s.cinemaName })))])
const categories = computed(() => [...new Set(skus.value.map((s) => s.category))])

const statusMeta: Record<string, { text: string; color: string }> = {
  healthy: { text: '健康', color: '#4ADE80' },
  low: { text: '低库存', color: '#FBBF24' },
  out: { text: '断货', color: '#EF4444' },
  overstock: { text: '积压', color: '#FB923C' }
}

const profitChart = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { top: 20, right: 20, bottom: 30, left: 45 },
  xAxis: { type: 'category', data: [...new Set(skus.value.map((s) => s.category))], axisLabel: { color: '#a0a3b1' }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
  yAxis: { type: 'value', axisLabel: { color: '#a0a3b1' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
  series: [
    {
      type: 'bar',
      data: [...new Set(skus.value.map((s) => s.category))].map((cat) => {
        const items = skus.value.filter((s) => s.category === cat)
        return Math.round(items.reduce((sum, s) => sum + (s.salePrice - s.costPrice) * s.monthSales, 0))
      }),
      barWidth: 30,
      itemStyle: { borderRadius: [6, 6, 0, 0], color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#F0C75E' }, { offset: 1, color: '#b8881f' }] } }
    }
  ]
}))

const docTypeMeta: Record<string, { text: string; color: string; icon: string }> = {
  inbound: { text: '入库', color: '#4ADE80', icon: 'Download' },
  outbound: { text: '出库', color: '#FBBF24', icon: 'Upload' },
  check: { text: '盘点', color: '#60A5FA', icon: 'DocumentChecked' }
}

async function submitDoc() {
  if (!newDoc.value.skuName || !newDoc.value.quantity) {
    ElMessage.warning('请填写完整单据信息')
    return
  }
  await concessionApi.submitDoc(newDoc.value)
  ElMessage.success('单据已提交，待审核')
  newDocVisible.value = false
  newDoc.value = { type: 'inbound', skuName: '', quantity: 0 }
}
</script>

<template>
  <div class="concession-page" v-loading="loading">
    <div class="stat-row">
      <StatCard label="SKU总数" :value="stats.total" unit="项" icon="Goods" accent="gold" />
      <StatCard label="断货预警" :value="stats.out" unit="项" icon="CircleCloseFilled" accent="crimson" />
      <StatCard label="低库存" :value="stats.low" unit="项" icon="WarnTriangleFilled" accent="crimson" />
      <StatCard label="月度毛利" :value="stats.monthProfit" prefix="¥" unit="元" icon="Money" accent="success" />
    </div>

    <el-tabs v-model="activeTab" class="con-tabs">
      <el-tab-pane label="库存看板" name="inventory">
        <div class="filter-bar">
          <el-select v-model="cinemaFilter" placeholder="全部影院" clearable size="small" style="width: 180px">
            <el-option v-for="c in cinemas" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
          <el-select v-model="categoryFilter" placeholder="全部品类" clearable size="small" style="width: 140px">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </div>

        <SectionPanel title="品类毛利分析" subtitle="本月各品类毛利贡献（元）">
          <BaseChart :option="profitChart" height="240px" />
        </SectionPanel>

        <div class="sku-grid">
          <div v-for="s in filteredSkus" :key="s.id" class="sku-card" :class="s.status">
            <div class="sku-head">
              <div class="sku-icon">{{ s.name[0] }}</div>
              <span class="sku-status" :style="{ color: statusMeta[s.status].color, borderColor: statusMeta[s.status].color }">{{ statusMeta[s.status].text }}</span>
            </div>
            <strong>{{ s.name }}</strong>
            <div class="sku-cinema">{{ s.cinemaName.split('·')[1] }} · {{ s.category }}</div>
            <div class="stock-bar">
              <div class="sb-track">
                <i :style="{ width: `${Math.min((s.stock / s.capacity) * 100, 100)}%`, background: statusMeta[s.status].color }" />
              </div>
              <span class="num">{{ s.stock }}/{{ s.capacity }}{{ s.unit }}</span>
            </div>
            <div class="sku-foot">
              <div><span>售价</span><strong class="num">¥{{ s.salePrice }}</strong></div>
              <div><span>今日</span><strong class="num">{{ s.todaySales }}{{ s.unit }}</strong></div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="单据管理" name="docs">
        <SectionPanel title="进销存单据" subtitle="入库 / 出库 / 盘点单据流" no-padding>
          <template #action>
            <el-button type="primary" size="small" :icon="(ElIcons as any).Plus" @click="newDocVisible = true">新建单据</el-button>
          </template>
          <el-table :data="docs" style="width: 100%">
            <el-table-column label="单据类型" width="110">
              <template #default="{ row }">
                <span class="doc-type" :style="{ color: docTypeMeta[row.type].color, background: docTypeMeta[row.type].color + '1a' }">
                  <component :is="(ElIcons as any)[docTypeMeta[row.type].icon]" />{{ docTypeMeta[row.type].text }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="cinemaName" label="影院" min-width="160" />
            <el-table-column prop="skuName" label="商品" min-width="140" />
            <el-table-column label="数量" width="100">
              <template #default="{ row }"><span class="num">{{ row.quantity }}{{ row.quantity > 0 ? '' : '' }}</span></template>
            </el-table-column>
            <el-table-column label="金额" width="110">
              <template #default="{ row }"><span class="num" v-if="row.amount">¥{{ row.amount }}</span><span v-else>—</span></template>
            </el-table-column>
            <el-table-column prop="operator" label="操作人" width="100" />
            <el-table-column prop="time" label="时间" width="160" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="row.status === '已入库' ? 'success' : row.status === '已审' ? '' : 'warning'" effect="dark" round>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </SectionPanel>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="newDocVisible" title="新建进销存单据" width="440px">
      <el-form label-width="80px">
        <el-form-item label="单据类型">
          <el-radio-group v-model="newDoc.type">
            <el-radio-button value="inbound">入库</el-radio-button>
            <el-radio-button value="outbound">出库</el-radio-button>
            <el-radio-button value="check">盘点</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="商品名称">
          <el-input v-model="newDoc.skuName" placeholder="如：大桶爆米花" />
        </el-form-item>
        <el-form-item label="数量">
          <el-input-number v-model="newDoc.quantity" :min="-999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newDocVisible = false">取消</el-button>
        <el-button type="primary" @click="submitDoc">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.concession-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}
.con-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 16px;
  }
}
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.sku-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
  margin-top: 16px;
}
.sku-card {
  @include card-base;
  padding: 16px;
  transition: transform 0.2s ease;
  &:hover {
    transform: translateY(-2px);
  }
  &.out {
    border-color: rgba(239, 68, 68, 0.4);
  }
  &.low {
    border-color: rgba(251, 191, 36, 0.4);
  }
  &.overstock {
    border-color: rgba(251, 146, 60, 0.4);
  }
}
.sku-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.sku-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: $grad-gold;
  color: #1a1305;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
}
.sku-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid;
  font-weight: 600;
}
.sku-card strong {
  font-size: 14px;
  color: var(--c-text-primary);
}
.sku-cinema {
  font-size: 11px;
  color: var(--c-text-tertiary);
  margin: 3px 0 10px;
}
.stock-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  .sb-track {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 3px;
    overflow: hidden;
    i {
      display: block;
      height: 100%;
      border-radius: 3px;
      transition: width 0.5s ease;
    }
  }
  .num {
    font-size: 11px;
    color: var(--c-text-secondary);
    white-space: nowrap;
  }
}
.sku-foot {
  display: flex;
  justify-content: space-between;
  div {
    display: flex;
    flex-direction: column;
    span {
      font-size: 10px;
      color: var(--c-text-tertiary);
    }
    strong {
      font-size: 13px;
      color: $gold;
    }
  }
}
.doc-type {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}
</style>
