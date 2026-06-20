<template>
  <div class="cemetery-map-page">
    <div class="page-header">
      <div class="header-top">
        <div class="tabs-wrapper">
          <div
            v-for="area in areas"
            :key="area.id"
            :class="['area-tab', { active: selectedAreaId === area.id }]"
            @click="selectedAreaId = area.id"
          >
            <span class="tab-name">{{ area.name }}</span>
            <span class="tab-code">{{ area.code }}</span>
          </div>
        </div>

        <div class="header-actions">
          <div class="search-box">
            <el-icon class="search-icon"><Search /></el-icon>
            <input
              v-model="searchText"
              type="text"
              class="search-input"
              placeholder="搜索墓位编号/逝者姓名"
            />
          </div>

          <el-select
            v-model="statusFilter"
            class="status-filter"
            placeholder="状态筛选"
            clearable
          >
            <el-option label="全部状态" value="" />
            <el-option label="在售" value="for_sale" />
            <el-option label="已售" value="sold" />
            <el-option label="预留" value="reserved" />
            <el-option label="已安葬" value="occupied" />
            <el-option label="维护中" value="maintenance" />
          </el-select>

          <button
            :class="['mode-btn', { active: selectionMode }]"
            @click="selectionMode = !selectionMode"
          >
            <el-icon><Pointer /></el-icon>
            <span>在线选墓模式</span>
          </button>
        </div>
      </div>

      <div class="stats-overview">
        <div class="stat-card">
          <div class="stat-icon-wrapper for-sale">
            <el-icon><Money /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ currentAreaStats.forSale }}</div>
            <div class="stat-label">在售墓位</div>
          </div>
          <div class="stat-extra">
            ¥{{ formatMoney(currentAreaStats.forSaleRevenue) }}
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper sold">
            <el-icon><Finished /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ currentAreaStats.sold }}</div>
            <div class="stat-label">已售墓位</div>
          </div>
          <div class="stat-extra">
            ¥{{ formatMoney(currentAreaStats.soldRevenue) }}
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper occupied">
            <el-icon><Grave /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ currentAreaStats.occupied }}</div>
            <div class="stat-label">已安葬</div>
          </div>
          <div class="stat-extra">
            安葬率 {{ burialRate }}%
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper total">
            <el-icon><DataLine /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ currentAreaStats.total }}</div>
            <div class="stat-label">区域总数</div>
          </div>
          <div class="stat-extra">
            销售额 ¥{{ formatMoney(currentAreaStats.totalRevenue) }}
          </div>
        </div>

        <div class="stat-card maintenance">
          <div class="stat-icon-wrapper warn">
            <el-icon><Tools /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ currentAreaStats.maintenance }}</div>
            <div class="stat-label">维护中</div>
          </div>
          <div class="stat-extra">
            预留 {{ currentAreaStats.reserved }} 个
          </div>
        </div>
      </div>
    </div>

    <div class="page-body">
      <div class="canvas-section">
        <PlotCanvas
          :plots="filteredPlots"
          :selected-area-id="selectedAreaId"
          :selected-plot-id="selectedPlot?.id || null"
          @select-plot="onSelectPlot"
          @hover-plot="onHoverPlot"
        />
      </div>

      <transition name="slide">
        <PlotInfo
          v-if="infoPanelVisible && selectedPlot"
          :plot="selectedPlot"
          class="info-panel"
          @book="onBookPlot"
          @compare="onComparePlot"
          @view-archive="onViewArchive"
          @schedule-burial="onScheduleBurial"
          @release="onReleasePlot"
          @view-reserve="onViewReserve"
          @finish-maint="onFinishMaint"
          @view-maint="onViewMaint"
        />
      </transition>
    </div>

    <div class="page-footer">
      <div class="legend-bar">
        <div class="legend-title">状态图例：</div>
        <div class="legend-items">
          <div class="legend-item">
            <span class="legend-dot for-sale"></span>
            <span class="legend-label">在售</span>
            <span class="legend-count">{{ currentAreaStats.forSale }}</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot sold"></span>
            <span class="legend-label">已售</span>
            <span class="legend-count">{{ currentAreaStats.sold }}</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot reserved"></span>
            <span class="legend-label">预留</span>
            <span class="legend-count">{{ currentAreaStats.reserved }}</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot occupied"></span>
            <span class="legend-label">已安葬</span>
            <span class="legend-count">{{ currentAreaStats.occupied }}</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot maintenance"></span>
            <span class="legend-label">维护中</span>
            <span class="legend-count">{{ currentAreaStats.maintenance }}</span>
          </div>
        </div>

        <div class="legend-divider"></div>

        <div class="legend-title">墓位类型：</div>
        <div class="legend-items">
          <div class="legend-item">
            <span class="legend-type standard">标准</span>
          </div>
          <div class="legend-item">
            <span class="legend-type double">双穴</span>
          </div>
          <div class="legend-item">
            <span class="legend-type premium">豪华</span>
          </div>
          <div class="legend-item">
            <span class="legend-type family">家族</span>
          </div>
        </div>
      </div>

      <div class="footer-tools">
        <button class="tool-btn" @click="onExport">
          <el-icon><Download /></el-icon>
          <span>导出数据</span>
        </button>
        <button class="tool-btn" @click="onPrint">
          <el-icon><Printer /></el-icon>
          <span>打印图册</span>
        </button>
        <button class="tool-btn" @click="onRefresh">
          <el-icon><Refresh /></el-icon>
          <span>刷新</span>
        </button>
      </div>
    </div>

    <el-dialog
      v-model="bookDialogVisible"
      title="选墓确认 - 预约信息登记"
      width="560px"
      class="book-dialog"
      :close-on-click-modal="false"
    >
      <div v-if="selectedPlot" class="book-content">
        <div class="selected-plot-info">
          <div class="plot-badge">已选墓位</div>
          <div class="selected-no">{{ selectedPlot.plotNo }}</div>
          <div class="selected-detail">
            {{ selectedPlot.areaName }} · {{ plotTypeMap[selectedPlot.type] }} · 第{{ selectedPlot.row }}排{{ selectedPlot.col }}列
          </div>
          <div class="selected-price">
            <span class="label">成交价格</span>
            <span class="amount">¥{{ selectedPlot.price.toLocaleString() }}</span>
          </div>
        </div>

        <el-form :model="bookForm" label-width="90px" class="book-form">
          <el-form-item label="客户姓名" required>
            <el-input v-model="bookForm.customerName" placeholder="请输入客户姓名" />
          </el-form-item>
          <el-form-item label="联系电话" required>
            <el-input v-model="bookForm.customerPhone" placeholder="请输入联系电话" />
          </el-form-item>
          <el-form-item label="与逝者关系">
            <el-select v-model="bookForm.relation" placeholder="请选择" style="width: 100%">
              <el-option label="子女" value="子女" />
              <el-option label="配偶" value="配偶" />
              <el-option label="父母" value="父母" />
              <el-option label="兄弟姐妹" value="兄弟姐妹" />
              <el-option label="其他亲属" value="其他亲属" />
            </el-select>
          </el-form-item>
          <el-form-item label="逝者姓名">
            <el-input v-model="bookForm.remainsName" placeholder="请输入逝者姓名（可选）" />
          </el-form-item>
          <el-form-item label="预约日期">
            <el-date-picker
              v-model="bookForm.appointmentDate"
              type="date"
              placeholder="选择到店日期"
              style="width: 100%"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
          <el-form-item label="备注">
            <el-input
              v-model="bookForm.remark"
              type="textarea"
              :rows="2"
              placeholder="特殊需求或备注"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <button class="dialog-btn cancel" @click="bookDialogVisible = false">取消</button>
        <button class="dialog-btn confirm" @click="onConfirmBooking">
          <el-icon><Check /></el-icon>
          <span>确认预约</span>
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, h } from 'vue'
import {
  Search,
  Pointer,
  Money,
  Finished,
  DataLine,
  Tools,
  Download,
  Printer,
  Refresh,
  Check
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import PlotCanvas from '@/components/cemetery/PlotCanvas.vue'
import PlotInfo from '@/components/cemetery/PlotInfo.vue'
import { mockAreas, mockPlots } from '@/mock/cemetery'
import { plotTypeMap } from '@/utils/status'
import type { CemeteryPlot } from '@/types/cemetery'

const Grave = {
  render() {
    return h(
      'svg',
      { viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
      [
        h('path', {
          d: 'M12 2L4 6V22H20V6L12 2Z',
          stroke: 'currentColor',
          'stroke-width': 2,
          'stroke-linejoin': 'round'
        }),
        h('path', {
          d: 'M12 10V18',
          stroke: 'currentColor',
          'stroke-width': 2,
          'stroke-linecap': 'round'
        }),
        h('path', {
          d: 'M9 13H15',
          stroke: 'currentColor',
          'stroke-width': 2,
          'stroke-linecap': 'round'
        })
      ]
    )
  }
}

const areas = mockAreas
const selectedAreaId = ref(areas[0]?.id || 'A1')
const selectedPlot = ref<CemeteryPlot | null>(null)
const infoPanelVisible = ref(false)
const searchText = ref('')
const statusFilter = ref('')
const selectionMode = ref(false)
const hoveredPlot = ref<CemeteryPlot | null>(null)

const bookDialogVisible = ref(false)
const bookForm = reactive({
  customerName: '',
  customerPhone: '',
  relation: '',
  remainsName: '',
  appointmentDate: '',
  remark: ''
})

const filteredPlots = computed(() => {
  let list: CemeteryPlot[] = mockPlots
  if (searchText.value) {
    const kw = searchText.value.toLowerCase()
    list = list.filter(
      (p: CemeteryPlot) =>
        p.plotNo.toLowerCase().includes(kw) ||
        (p.remainsName && p.remainsName.toLowerCase().includes(kw))
    )
  }
  if (statusFilter.value) {
    list = list.filter((p: CemeteryPlot) => p.status === statusFilter.value)
  }
  return list
})

const currentAreaPlots = computed(() =>
  mockPlots.filter((p: CemeteryPlot) => p.areaId === selectedAreaId.value)
)

const currentAreaStats = computed(() => {
  const list: CemeteryPlot[] = currentAreaPlots.value
  const forSalePlots = list.filter((p: CemeteryPlot) => p.status === 'for_sale')
  const soldPlots = list.filter((p: CemeteryPlot) => p.status === 'sold' || p.status === 'occupied')
  return {
    total: list.length,
    forSale: forSalePlots.length,
    sold: list.filter((p: CemeteryPlot) => p.status === 'sold').length,
    reserved: list.filter((p: CemeteryPlot) => p.status === 'reserved').length,
    occupied: list.filter((p: CemeteryPlot) => p.status === 'occupied').length,
    maintenance: list.filter((p: CemeteryPlot) => p.status === 'maintenance').length,
    forSaleRevenue: forSalePlots.reduce((s: number, p: CemeteryPlot) => s + p.price, 0),
    soldRevenue: soldPlots.reduce((s: number, p: CemeteryPlot) => s + p.price, 0),
    totalRevenue: soldPlots.reduce((s: number, p: CemeteryPlot) => s + p.price, 0)
  }
})

const burialRate = computed(() => {
  const { sold, occupied } = currentAreaStats.value
  const total = sold + occupied
  if (total === 0) return 0
  return Math.round((occupied / total) * 100)
})

function formatMoney(val: number): string {
  if (val >= 10000) {
    return (val / 10000).toFixed(1) + '万'
  }
  return val.toLocaleString()
}

function onSelectPlot(plot: CemeteryPlot | null) {
  selectedPlot.value = plot
  if (plot) {
    infoPanelVisible.value = true
    if (selectionMode.value && plot.status === 'for_sale') {
      bookDialogVisible.value = true
    }
  }
}

function onHoverPlot(plot: CemeteryPlot | null) {
  hoveredPlot.value = plot
}

function onBookPlot(_plot: CemeteryPlot) {
  bookDialogVisible.value = true
}

function onComparePlot(plot: CemeteryPlot) {
  ElMessage.success(`已将 ${plot.plotNo} 加入对比列表`)
}

function onViewArchive(plot: CemeteryPlot) {
  ElMessage.info(`查看墓位 ${plot.plotNo} 的档案`)
}

function onScheduleBurial(plot: CemeteryPlot) {
  ElMessage.info(`安排墓位 ${plot.plotNo} 的安葬日期`)
}

function onReleasePlot(plot: CemeteryPlot) {
  ElMessage.warning(`解除墓位 ${plot.plotNo} 的预留状态`)
}

function onViewReserve(plot: CemeteryPlot) {
  ElMessage.info(`查看墓位 ${plot.plotNo} 的预留信息`)
}

function onFinishMaint(plot: CemeteryPlot) {
  ElMessage.success(`墓位 ${plot.plotNo} 维护完成`)
}

function onViewMaint(plot: CemeteryPlot) {
  ElMessage.info(`查看墓位 ${plot.plotNo} 的维护记录`)
}

function onConfirmBooking() {
  if (!bookForm.customerName || !bookForm.customerPhone) {
    ElMessage.warning('请填写客户姓名和联系电话')
    return
  }
  ElMessage.success(`预约成功！客户：${bookForm.customerName}，墓位：${selectedPlot.value?.plotNo}`)
  bookDialogVisible.value = false
  Object.assign(bookForm, {
    customerName: '',
    customerPhone: '',
    relation: '',
    remainsName: '',
    appointmentDate: '',
    remark: ''
  })
}

function onExport() {
  ElMessage.success('墓位数据导出中...')
}

function onPrint() {
  ElMessage.info('正在生成墓位图册...')
}

function onRefresh() {
  ElMessage.success('数据已刷新')
}
</script>

<style lang="scss" scoped>
.cemetery-map-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1A1A1F;
  gap: 16px;
  padding: 20px;
  overflow: hidden;
}

.page-header {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.tabs-wrapper {
  display: flex;
  gap: 6px;
  padding: 6px;
  background: #24242B;
  border-radius: 10px;
  border: 1px solid #3A3A44;
}

.area-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s ease;
  gap: 2px;

  .tab-name {
    font-size: 14px;
    font-weight: 600;
    color: #B0B0B8;
    transition: color 0.25s ease;
  }

  .tab-code {
    font-size: 10px;
    color: #6B6B74;
    font-family: 'SF Mono', Monaco, monospace;
  }

  &:hover {
    background: rgba(201, 168, 108, 0.08);

    .tab-name {
      color: #FFFFFF;
    }
  }

  &.active {
    background: linear-gradient(135deg, rgba(201, 168, 108, 0.2) 0%, rgba(139, 115, 85, 0.15) 100%);
    border: 1px solid rgba(201, 168, 108, 0.4);
    box-shadow: inset 0 0 20px rgba(201, 168, 108, 0.1);

    .tab-name {
      color: #C9A86C;
      background: linear-gradient(135deg, #D4B87C 0%, #C9A86C 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .tab-code {
      color: rgba(201, 168, 108, 0.7);
    }
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6B6B74;
  width: 16px;
  height: 16px;
  z-index: 1;
}

.search-input {
  width: 240px;
  padding: 8px 12px 8px 36px;
  background: #24242B;
  border: 1px solid #3A3A44;
  border-radius: 8px;
  color: #FFFFFF;
  font-size: 13px;
  outline: none;
  transition: all 0.25s ease;

  &::placeholder {
    color: #6B6B74;
  }

  &:focus {
    border-color: #C9A86C;
    box-shadow: 0 0 0 3px rgba(201, 168, 108, 0.1);
  }
}

.status-filter {
  width: 140px;

  :deep(.el-input__wrapper) {
    background: #24242B;
    border: 1px solid #3A3A44;
    box-shadow: none;
    border-radius: 8px;
    padding: 4px 12px;
  }

  :deep(.el-input__inner) {
    color: #FFFFFF;
    font-size: 13px;
  }
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #24242B;
  border: 1px solid #3A3A44;
  border-radius: 8px;
  color: #B0B0B8;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;

  :deep(.el-icon) {
    width: 15px;
    height: 15px;
  }

  &:hover {
    border-color: rgba(201, 168, 108, 0.5);
    color: #C9A86C;
  }

  &.active {
    background: linear-gradient(135deg, rgba(201, 168, 108, 0.2) 0%, rgba(139, 115, 85, 0.15) 100%);
    border-color: #C9A86C;
    color: #C9A86C;
    box-shadow: 0 0 15px rgba(201, 168, 108, 0.2);
  }
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.stat-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: linear-gradient(135deg, #24242B 0%, #2A2A33 100%);
  border: 1px solid #3A3A44;
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.3s ease;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 3px;
    height: 100%;
    background: linear-gradient(180deg, #C9A86C 0%, #8B7355 100%);
    opacity: 0.5;
  }

  &:hover {
    border-color: rgba(201, 168, 108, 0.35);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(201, 168, 108, 0.1);
  }
}

.stat-icon-wrapper {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;

  :deep(.el-icon),
  :deep(svg) {
    width: 22px;
    height: 22px;
  }

  &.for-sale {
    background: rgba(82, 196, 26, 0.15);
    color: #52C41A;
  }

  &.sold {
    background: rgba(24, 144, 255, 0.15);
    color: #1890FF;
  }

  &.occupied {
    background: rgba(140, 140, 140, 0.15);
    color: #8C8C8C;
  }

  &.total {
    background: rgba(201, 168, 108, 0.15);
    color: #C9A86C;
  }

  &.warn {
    background: rgba(255, 77, 79, 0.15);
    color: #FF4D4F;
  }
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #FFFFFF;
  line-height: 1.2;
  font-family: 'SF Mono', Monaco, monospace;
}

.stat-label {
  font-size: 12px;
  color: #6B6B74;
  margin-top: 2px;
}

.stat-extra {
  font-size: 11px;
  color: #B0B0B8;
  padding: 3px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, monospace;
}

.page-body {
  flex: 1;
  display: flex;
  gap: 0;
  min-height: 0;
  border-radius: 12px;
  overflow: hidden;
}

.canvas-section {
  flex: 1;
  min-width: 0;
  display: flex;
}

.info-panel {
  flex-shrink: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(30px);
  opacity: 0;
}

.page-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: linear-gradient(180deg, #24242B 0%, #1E1E25 100%);
  border: 1px solid #3A3A44;
  border-radius: 10px;
}

.legend-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.legend-title {
  font-size: 12px;
  font-weight: 600;
  color: #C9A86C;
}

.legend-items {
  display: flex;
  align-items: center;
  gap: 14px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;

  &.for-sale {
    background: rgba(82, 196, 26, 0.35);
    border: 1.5px solid #52C41A;
  }
  &.sold {
    background: rgba(24, 144, 255, 0.35);
    border: 1.5px solid #1890FF;
  }
  &.reserved {
    background: rgba(250, 140, 22, 0.35);
    border: 1.5px solid #FA8C16;
  }
  &.occupied {
    background: rgba(140, 140, 140, 0.35);
    border: 1.5px solid #8C8C8C;
  }
  &.maintenance {
    background: rgba(255, 77, 79, 0.35);
    border: 1.5px solid #FF4D4F;
  }
}

.legend-label {
  font-size: 12px;
  color: #B0B0B8;
}

.legend-count {
  font-size: 12px;
  font-weight: 600;
  color: #FFFFFF;
  font-family: 'SF Mono', Monaco, monospace;
  min-width: 18px;
  text-align: right;
}

.legend-divider {
  width: 1px;
  height: 20px;
  background: #3A3A44;
}

.legend-type {
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
  color: #FFFFFF;

  &.standard {
    background: rgba(82, 196, 26, 0.15);
    border: 1px solid rgba(82, 196, 26, 0.4);
    color: #52C41A;
  }
  &.double {
    background: rgba(24, 144, 255, 0.15);
    border: 1px solid rgba(24, 144, 255, 0.4);
    color: #1890FF;
  }
  &.premium {
    background: rgba(201, 168, 108, 0.15);
    border: 1px solid rgba(201, 168, 108, 0.4);
    color: #C9A86C;
  }
  &.family {
    background: rgba(114, 46, 209, 0.15);
    border: 1px solid rgba(114, 46, 209, 0.4);
    color: #9254DE;
  }
}

.footer-tools {
  display: flex;
  gap: 8px;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid #3A3A44;
  border-radius: 7px;
  color: #B0B0B8;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.25s ease;

  :deep(.el-icon) {
    width: 14px;
    height: 14px;
  }

  &:hover {
    background: rgba(201, 168, 108, 0.1);
    border-color: rgba(201, 168, 108, 0.35);
    color: #C9A86C;
  }
}

:deep(.book-dialog) {
  .el-dialog {
    background: #24242B;
    border: 1px solid rgba(201, 168, 108, 0.25);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .el-dialog__header {
    border-bottom: 1px solid rgba(201, 168, 108, 0.15);
    padding: 18px 24px;
    margin-right: 0;
  }

  .el-dialog__title {
    color: #C9A86C;
    font-weight: 600;
    font-size: 16px;
  }

  .el-dialog__body {
    padding: 20px 24px;
  }

  .el-dialog__footer {
    padding: 14px 24px;
    border-top: 1px solid rgba(201, 168, 108, 0.15);
  }
}

.selected-plot-info {
  position: relative;
  padding: 16px;
  margin-bottom: 20px;
  background: linear-gradient(135deg, rgba(201, 168, 108, 0.12) 0%, rgba(139, 115, 85, 0.06) 100%);
  border: 1px solid rgba(201, 168, 108, 0.3);
  border-radius: 10px;
}

.plot-badge {
  position: absolute;
  top: -8px;
  left: 12px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  color: #1A1A1F;
  background: linear-gradient(135deg, #C9A86C 0%, #8B7355 100%);
  border-radius: 4px;
}

.selected-no {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
  background: linear-gradient(135deg, #D4B87C 0%, #C9A86C 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.selected-detail {
  font-size: 12px;
  color: #B0B0B8;
  margin-bottom: 10px;
}

.selected-price {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid rgba(201, 168, 108, 0.15);

  .label {
    font-size: 12px;
    color: #6B6B74;
  }

  .amount {
    font-size: 20px;
    font-weight: 700;
    color: #FA8C16;
    font-family: 'SF Mono', Monaco, monospace;
  }
}

:deep(.book-form) {
  .el-form-item__label {
    color: #B0B0B8;
    font-size: 13px;
  }

  .el-input__wrapper,
  .el-textarea__inner,
  .el-select__wrapper {
    background: #1A1A1F !important;
    border: 1px solid #3A3A44;
    box-shadow: none !important;
    border-radius: 8px;
  }

  .el-input__inner,
  .el-textarea__inner {
    color: #FFFFFF;
    font-size: 13px;
  }

  .el-select__placeholder,
  .el-input__inner::placeholder,
  .el-textarea__inner::placeholder {
    color: #6B6B74;
  }
}

.dialog-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  border: 1px solid transparent;

  :deep(.el-icon) {
    width: 14px;
    height: 14px;
  }

  &.cancel {
    background: transparent;
    border-color: #3A3A44;
    color: #B0B0B8;

    &:hover {
      border-color: #6B6B74;
      color: #FFFFFF;
    }
  }

  &.confirm {
    background: linear-gradient(135deg, #C9A86C 0%, #8B7355 100%);
    color: #1A1A1F;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(201, 168, 108, 0.35);
    }
  }
}
</style>
