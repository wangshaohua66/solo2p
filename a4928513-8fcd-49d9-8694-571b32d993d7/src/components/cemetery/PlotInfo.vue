<template>
  <div class="plot-info-panel">
    <div v-if="!plot" class="empty-state">
      <div class="empty-icon">
        <el-icon><Grid /></el-icon>
      </div>
      <p class="empty-title">请选择墓位</p>
      <p class="empty-desc">点击左侧地图中的墓位查看详情</p>
    </div>

    <template v-else>
      <div class="panel-header">
        <div class="plot-number">{{ plot.plotNo }}</div>
        <StatusTag :status="plot.status" type="plot" />
      </div>

      <div class="info-section">
        <div class="section-title">基本信息</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">所属区域</span>
            <span class="value">{{ plot.areaName }}</span>
          </div>
          <div class="info-item">
            <span class="label">位置</span>
            <span class="value">第{{ plot.row }}排 第{{ plot.col }}列</span>
          </div>
          <div class="info-item">
            <span class="label">墓位类型</span>
            <span class="value">{{ plotTypeMap[plot.type] }}</span>
          </div>
          <div class="info-item" v-if="plot.hasMonument">
            <span class="label">配套碑石</span>
            <span class="value highlight">已配置</span>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="info-section">
        <div class="section-title">价格信息</div>
        <div class="price-block">
          <div class="price-current">
            <span class="currency">¥</span>
            <span class="amount">{{ plot.price.toLocaleString() }}</span>
          </div>
          <div v-if="plot.originalPrice && plot.originalPrice > plot.price" class="price-original">
            <span class="original-amount">¥{{ plot.originalPrice.toLocaleString() }}</span>
            <span class="discount-badge">促销</span>
          </div>
        </div>
        <div v-if="plot.discountInfo" class="discount-info">
          <el-icon><Promotion /></el-icon>
          <span>{{ plot.discountInfo }}</span>
        </div>
      </div>

      <div class="divider"></div>

      <div v-if="plot.status === 'sold' || plot.status === 'occupied'" class="info-section">
        <div class="section-title">
          <el-icon><User /></el-icon>
          <span>业主信息</span>
        </div>
        <div class="info-grid">
          <div class="info-item" v-if="plot.remainsName">
            <span class="label">逝者姓名</span>
            <span class="value name">{{ plot.remainsName }}</span>
          </div>
          <div class="info-item" v-if="plot.ownerName">
            <span class="label">业主姓名</span>
            <span class="value">{{ plot.ownerName }}</span>
          </div>
          <div class="info-item" v-if="plot.ownerPhone">
            <span class="label">联系电话</span>
            <span class="value mono">{{ plot.ownerPhone }}</span>
          </div>
          <div class="info-item" v-if="plot.contractNo">
            <span class="label">合同编号</span>
            <span class="value mono">{{ plot.contractNo }}</span>
          </div>
          <div class="info-item" v-if="plot.burialDate">
            <span class="label">安葬日期</span>
            <span class="value">{{ plot.burialDate }}</span>
          </div>
          <div class="info-item" v-if="plot.maintainExpireDate">
            <span class="label">管理费到期</span>
            <span class="value" :class="{ warn: isExpiringSoon }">{{ plot.maintainExpireDate }}</span>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="info-section">
        <div class="section-title">
          <el-icon><Location /></el-icon>
          <span>位置预览</span>
        </div>
        <div class="mini-map">
          <div class="mini-grid">
            <div
              v-for="row in 6"
              :key="row"
              class="mini-row"
            >
              <div
                v-for="col in 10"
                :key="col"
                :class="[
                  'mini-cell',
                  {
                    active: row === (plot.row % 6 || 6) && col === (plot.col % 10 || 10),
                    highlighted: Math.abs(row - (plot.row % 6 || 6)) <= 1 && Math.abs(col - (plot.col % 10 || 10)) <= 1
                  }
                ]"
              ></div>
            </div>
          </div>
          <div class="mini-label">区域：{{ plot.areaName }}</div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="info-section">
        <div class="section-title">
          <el-icon><Clock /></el-icon>
          <span>状态变更记录</span>
        </div>
        <div class="timeline">
          <div
            v-for="(record, idx) in timelineRecords"
            :key="idx"
            :class="['timeline-item', { active: idx === timelineRecords.length - 1 }]"
          >
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-status">{{ record.status }}</span>
                <span class="timeline-time">{{ record.time }}</span>
              </div>
              <div class="timeline-operator">{{ record.operator }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel-actions">
        <template v-if="plot.status === 'for_sale'">
          <button class="btn btn-primary" @click="$emit('book', plot)">
            <el-icon><Calendar /></el-icon>
            <span>立即预约</span>
          </button>
          <button class="btn btn-secondary" @click="$emit('compare', plot)">
            <el-icon><Histogram /></el-icon>
            <span>加入对比</span>
          </button>
        </template>
        <template v-else-if="plot.status === 'sold' || plot.status === 'occupied'">
          <button class="btn btn-primary" @click="$emit('view-archive', plot)">
            <el-icon><Document /></el-icon>
            <span>查看档案</span>
          </button>
          <button v-if="plot.status === 'sold'" class="btn btn-secondary" @click="$emit('schedule-burial', plot)">
            <el-icon><Calendar /></el-icon>
            <span>安排安葬</span>
          </button>
        </template>
        <template v-else-if="plot.status === 'reserved'">
          <button class="btn btn-primary" @click="$emit('release', plot)">
            <el-icon><Unlock /></el-icon>
            <span>解除预留</span>
          </button>
          <button class="btn btn-secondary" @click="$emit('view-reserve', plot)">
            <el-icon><View /></el-icon>
            <span>查看预留</span>
          </button>
        </template>
        <template v-else-if="plot.status === 'maintenance'">
          <button class="btn btn-primary" @click="$emit('finish-maint', plot)">
            <el-icon><CircleCheck /></el-icon>
            <span>完成维护</span>
          </button>
          <button class="btn btn-secondary" @click="$emit('view-maint', plot)">
            <el-icon><Tools /></el-icon>
            <span>维护记录</span>
          </button>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Grid,
  User,
  Location,
  Clock,
  Calendar,
  Histogram,
  Document,
  Unlock,
  View,
  CircleCheck,
  Tools,
  Promotion
} from '@element-plus/icons-vue'
import StatusTag from '@/components/common/StatusTag.vue'
import { plotTypeMap, plotStatusMap } from '@/utils/status'
import type { CemeteryPlot } from '@/types/cemetery'
import { dayjs } from '@/utils/date'

const props = defineProps<{
  plot: CemeteryPlot | null
}>()

defineEmits<{
  (e: 'book', plot: CemeteryPlot): void
  (e: 'compare', plot: CemeteryPlot): void
  (e: 'view-archive', plot: CemeteryPlot): void
  (e: 'schedule-burial', plot: CemeteryPlot): void
  (e: 'release', plot: CemeteryPlot): void
  (e: 'view-reserve', plot: CemeteryPlot): void
  (e: 'finish-maint', plot: CemeteryPlot): void
  (e: 'view-maint', plot: CemeteryPlot): void
}>()

const isExpiringSoon = computed(() => {
  if (!props.plot?.maintainExpireDate) return false
  const expire = dayjs(props.plot.maintainExpireDate)
  return expire.diff(dayjs(), 'month') <= 6
})

const timelineRecords = computed(() => {
  if (!props.plot) return []
  const records: { status: string; time: string; operator: string }[] = []

  records.push({
    status: '创建墓位',
    time: dayjs().subtract(365 + Math.random() * 365, 'day').format('YYYY-MM-DD HH:mm'),
    operator: '系统初始化'
  })

  if (props.plot.status !== 'for_sale') {
    records.push({
      status: plotStatusMap[props.plot.status]?.label || '状态变更',
      time: props.plot.burialDate || dayjs().subtract(30 + Math.random() * 180, 'day').format('YYYY-MM-DD HH:mm'),
      operator: props.plot.ownerName || '管理员'
    })
  }

  if (props.plot.status === 'occupied' && props.plot.burialDate) {
    records.push({
      status: '完成安葬',
      time: props.plot.burialDate,
      operator: '安葬服务组'
    })
  }

  return records
})
</script>

<style lang="scss" scoped>
.plot-info-panel {
  width: 320px;
  min-width: 320px;
  height: 100%;
  background: linear-gradient(180deg, #24242B 0%, #1E1E25 100%);
  border-left: 2px solid #3A3A44;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.2);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

.empty-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(201, 168, 108, 0.1) 0%, rgba(201, 168, 108, 0.05) 100%);
  border: 2px dashed rgba(201, 168, 108, 0.3);
  color: #C9A86C;
  opacity: 0.6;

  :deep(.el-icon) {
    width: 40px;
    height: 40px;
  }
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #FFFFFF;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 13px;
  color: #6B6B74;
  text-align: center;
  line-height: 1.6;
}

.panel-header {
  padding: 20px 24px;
  background: linear-gradient(135deg, rgba(201, 168, 108, 0.1) 0%, transparent 100%);
  border-bottom: 1px solid rgba(201, 168, 108, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.plot-number {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 1px;
  background: linear-gradient(135deg, #D4B87C 0%, #C9A86C 50%, #8B7355 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.info-section {
  padding: 16px 24px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #C9A86C;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(201, 168, 108, 0.1);

  :deep(.el-icon) {
    width: 14px;
    height: 14px;
  }
}

.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(201, 168, 108, 0.15) 50%, transparent 100%);
  margin: 0 24px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;

  .label {
    font-size: 12px;
    color: #6B6B74;
    flex-shrink: 0;
    padding-top: 1px;
  }

  .value {
    font-size: 13px;
    color: #FFFFFF;
    text-align: right;
    font-weight: 500;
    word-break: break-all;

    &.name {
      color: #C9A86C;
      font-weight: 600;
    }

    &.mono {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
    }

    &.highlight {
      color: #52C41A;
    }

    &.warn {
      color: #FA8C16;
    }
  }
}

.price-block {
  margin-bottom: 8px;
}

.price-current {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 4px;

  .currency {
    font-size: 16px;
    font-weight: 600;
    color: #FA8C16;
  }

  .amount {
    font-size: 28px;
    font-weight: 700;
    color: #FA8C16;
    font-family: 'SF Mono', Monaco, monospace;
    letter-spacing: -0.5px;
  }
}

.price-original {
  display: flex;
  align-items: center;
  gap: 8px;

  .original-amount {
    font-size: 13px;
    color: #6B6B74;
    text-decoration: line-through;
    font-family: 'SF Mono', Monaco, monospace;
  }

  .discount-badge {
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    color: #FFFFFF;
    background: linear-gradient(135deg, #FF4D4F 0%, #CF1322 100%);
    border-radius: 3px;
  }
}

.discount-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(250, 140, 22, 0.1);
  border: 1px solid rgba(250, 140, 22, 0.2);
  border-radius: 6px;
  font-size: 12px;
  color: #FA8C16;

  :deep(.el-icon) {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
}

.mini-map {
  padding: 12px;
  background: rgba(201, 168, 108, 0.05);
  border: 1px solid rgba(201, 168, 108, 0.15);
  border-radius: 8px;
}

.mini-grid {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 10px;
}

.mini-row {
  display: flex;
  gap: 3px;
  justify-content: center;
}

.mini-cell {
  width: 18px;
  height: 22px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  transition: all 0.2s ease;

  &.highlighted {
    background: rgba(201, 168, 108, 0.1);
    border-color: rgba(201, 168, 108, 0.25);
  }

  &.active {
    background: linear-gradient(135deg, #C9A86C 0%, #8B7355 100%);
    border-color: #D4B87C;
    box-shadow: 0 0 10px rgba(201, 168, 108, 0.5);
  }
}

.mini-label {
  text-align: center;
  font-size: 11px;
  color: #6B6B74;
}

.timeline {
  padding-left: 4px;
}

.timeline-item {
  position: relative;
  padding-left: 20px;
  padding-bottom: 14px;

  &:last-child {
    padding-bottom: 0;

    .timeline-dot::after {
      display: none;
    }
  }

  &.active .timeline-dot {
    background: #C9A86C;
    border-color: #C9A86C;
    box-shadow: 0 0 0 3px rgba(201, 168, 108, 0.2);
  }

  &.active .timeline-status {
    color: #C9A86C;
    font-weight: 600;
  }
}

.timeline-dot {
  position: absolute;
  left: 0;
  top: 3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: transparent;
  border: 2px solid #3A3A44;
  z-index: 1;

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 100%;
    width: 2px;
    height: calc(100% + 16px);
    background: #3A3A44;
    transform: translateX(-50%);
    margin-top: 2px;
  }
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.timeline-status {
  font-size: 12px;
  color: #B0B0B8;
}

.timeline-time {
  font-size: 11px;
  color: #6B6B74;
  font-family: 'SF Mono', Monaco, monospace;
}

.timeline-operator {
  font-size: 11px;
  color: #6B6B74;
}

.panel-actions {
  margin-top: auto;
  padding: 16px 24px 20px;
  display: flex;
  gap: 10px;
  border-top: 1px solid rgba(201, 168, 108, 0.15);
  background: rgba(0, 0, 0, 0.15);
}

.btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  border: 1px solid transparent;

  :deep(.el-icon) {
    width: 15px;
    height: 15px;
  }

  &.btn-primary {
    background: linear-gradient(135deg, #C9A86C 0%, #8B7355 100%);
    color: #1A1A1F;
    border-color: transparent;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(201, 168, 108, 0.35);
    }
  }

  &.btn-secondary {
    background: rgba(201, 168, 108, 0.08);
    color: #C9A86C;
    border-color: rgba(201, 168, 108, 0.3);

    &:hover {
      background: rgba(201, 168, 108, 0.15);
      border-color: #C9A86C;
    }
  }

  &:active {
    transform: translateY(0);
  }
}
</style>
