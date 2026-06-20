<template>
  <div v-loading="store.loading" class="remains-detail-page">
    <template v-if="remains">
      <div class="detail-header">
        <div class="header-left">
          <el-button text @click="router.back()">
            <el-icon><ArrowLeft /></el-icon>
            返回列表
          </el-button>
          <div class="header-title">
            <div class="title-row">
              <h2 class="deceased-name">{{ remains.name }}</h2>
              <StatusTag :status="remains.currentStatus" type="remains" />
            </div>
            <div class="code-row">
              <el-icon><Document /></el-icon>
              <span class="label">档案编号：</span>
              <span class="code">{{ remains.code }}</span>
              <span class="sep">|</span>
              <el-icon><OfficeBuilding /></el-icon>
              <span class="label">归属：</span>
              <span>{{ remains.funeralHomeName }}</span>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <el-button type="primary">
            <el-icon><Calendar /></el-icon>
            预约告别
          </el-button>
          <el-button type="warning">
            <el-icon><Flame /></el-icon>
            火化安排
          </el-button>
          <el-button type="success">
            <el-icon><Money /></el-icon>
            费用结算
          </el-button>
          <el-button>
            <el-icon><Download /></el-icon>
            导出
          </el-button>
        </div>
      </div>

      <div class="detail-content">
        <div class="content-left">
          <div class="timeline-panel">
            <div class="panel-title">
              <el-icon><Timer /></el-icon>
              状态流转时间线
            </div>
            <StatusTimeline
              :history="remains.statusHistory"
              :current="remains.currentStatus"
            />
          </div>
        </div>

        <div class="content-right">
          <el-tabs v-model="activeTab" class="detail-tabs">
            <el-tab-pane label="基本信息" name="basic">
              <div class="tab-section">
                <div class="section-title">
                  <el-icon><User /></el-icon>
                  逝者基本信息
                </div>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="item-label">姓名</span>
                    <span class="item-value">{{ remains.name }}</span>
                  </div>
                  <div class="info-item">
                    <span class="item-label">性别</span>
                    <span class="item-value">{{ remains.gender === 'male' ? '男' : '女' }}</span>
                  </div>
                  <div class="info-item">
                    <span class="item-label">年龄</span>
                    <span class="item-value">{{ remains.age }} 岁</span>
                  </div>
                  <div class="info-item">
                    <span class="item-label">身份证号</span>
                    <span class="item-value monospace">{{ remains.idNumber }}</span>
                  </div>
                  <div class="info-item wide">
                    <span class="item-label">死亡原因</span>
                    <span class="item-value">{{ remains.causeOfDeath }}</span>
                  </div>
                  <div class="info-item wide">
                    <span class="item-label">接运地址</span>
                    <span class="item-value">{{ remains.pickupAddress }}</span>
                  </div>
                  <div class="info-item">
                    <span class="item-label">死亡时间</span>
                    <span class="item-value">{{ remains.deathTime }}</span>
                  </div>
                  <div class="info-item">
                    <span class="item-label">到馆时间</span>
                    <span class="item-value">{{ remains.arriveTime || '-' }}</span>
                  </div>
                </div>
              </div>

              <div class="tab-section">
                <div class="section-title">
                  <el-icon><Avatar /></el-icon>
                  家属信息
                </div>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="item-label">家属姓名</span>
                    <span class="item-value">{{ remains.family.name }}</span>
                  </div>
                  <div class="info-item">
                    <span class="item-label">与逝者关系</span>
                    <span class="item-value">{{ remains.family.relation }}</span>
                  </div>
                  <div class="info-item wide">
                    <span class="item-label">联系电话</span>
                    <span class="item-value monospace">{{ remains.family.phone }}</span>
                  </div>
                </div>
              </div>

              <div class="tab-section">
                <div class="section-title">
                  <el-icon><House /></el-icon>
                  馆内信息
                </div>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="item-label">所属殡仪馆</span>
                    <span class="item-value">{{ remains.funeralHomeName }}</span>
                  </div>
                  <div class="info-item" v-if="remains.location">
                    <span class="item-label">当前位置</span>
                    <span class="item-value">
                      {{ remains.location.building }} / {{ remains.location.room }}
                      <span v-if="remains.location.shelfNo"> ({{ remains.location.shelfNo }})</span>
                    </span>
                  </div>
                  <div class="info-item" v-if="remains.cremationNo">
                    <span class="item-label">火化编号</span>
                    <span class="item-value monospace">{{ remains.cremationNo }}</span>
                  </div>
                  <div class="info-item" v-if="remains.urnNo">
                    <span class="item-label">骨灰盒编号</span>
                    <span class="item-value monospace">{{ remains.urnNo }}</span>
                  </div>
                  <div class="info-item">
                    <span class="item-label">登记时间</span>
                    <span class="item-value">{{ remains.createTime }}</span>
                  </div>
                  <div class="info-item">
                    <span class="item-label">操作员ID</span>
                    <span class="item-value monospace">{{ remains.operatorId }}</span>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="关联服务" name="services">
              <div class="tab-section">
                <div class="section-header">
                  <div class="section-title">
                    <el-icon><Service /></el-icon>
                    服务项目清单
                  </div>
                  <el-button size="small" type="primary">
                    <el-icon><Plus /></el-icon>
                    添加服务
                  </el-button>
                </div>
                <el-table
                  :data="mockServices"
                  style="width: 100%"
                  class="services-table"
                >
                  <el-table-column prop="code" label="服务编号" width="120">
                    <template #default="{ row }">
                      <span class="monospace">{{ row.code }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="name" label="服务名称" min-width="180" />
                  <el-table-column prop="category" label="服务类别" width="120">
                    <template #default="{ row }">
                      {{ getServiceCategoryLabel(row.category) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="unit" label="单位" width="80" />
                  <el-table-column prop="price" label="单价" width="100" align="right">
                    <template #default="{ row }">
                      ¥{{ row.price.toFixed(2) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="quantity" label="数量" width="80" align="center" />
                  <el-table-column prop="finalPrice" label="实付金额" width="120" align="right">
                    <template #default="{ row }">
                      <span class="amount-highlight">¥{{ row.finalPrice.toFixed(2) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="100" align="center" fixed="right">
                    <template #default>
                      <el-button size="small" text type="danger">移除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </el-tab-pane>

            <el-tab-pane label="费用明细" name="billing">
              <div class="tab-section">
                <div class="section-title">
                  <el-icon><Money /></el-icon>
                  费用汇总
                </div>
                <div class="billing-summary">
                  <div class="summary-row">
                    <span class="summary-label">服务小计</span>
                    <span class="summary-value">¥{{ billingSummary.subtotal.toFixed(2) }}</span>
                  </div>
                  <div class="summary-row">
                    <span class="summary-label">优惠减免</span>
                    <span class="summary-value discount">-¥{{ billingSummary.discountTotal.toFixed(2) }}</span>
                  </div>
                  <div class="summary-row">
                    <span class="summary-label">政府补贴</span>
                    <span class="summary-value subsidy">-¥{{ billingSummary.subsidyTotal.toFixed(2) }}</span>
                  </div>
                  <div class="summary-divider"></div>
                  <div class="summary-row total">
                    <span class="summary-label">应付总金额</span>
                    <span class="summary-value">¥{{ billingSummary.totalAmount.toFixed(2) }}</span>
                  </div>
                  <div class="summary-row">
                    <span class="summary-label">已支付</span>
                    <span class="summary-value paid">¥{{ billingSummary.paidAmount.toFixed(2) }}</span>
                  </div>
                  <div class="summary-row unpaid">
                    <span class="summary-label">待支付</span>
                    <span class="summary-value">¥{{ billingSummary.unpaidAmount.toFixed(2) }}</span>
                  </div>
                </div>
                <div class="billing-actions">
                  <StatusTag status="unpaid" type="bill" text="待支付" />
                  <el-button type="success" size="large">
                    <el-icon><CreditCard /></el-icon>
                    去结算
                  </el-button>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="操作日志" name="logs">
              <div class="tab-section">
                <div class="section-title">
                  <el-icon><Tickets /></el-icon>
                  操作记录
                </div>
                <div class="operation-logs">
                  <div
                    v-for="(log, idx) in operationLogs"
                    :key="idx"
                    class="log-item"
                  >
                    <div class="log-dot-wrapper">
                      <div class="log-dot"></div>
                      <div v-if="idx < operationLogs.length - 1" class="log-line"></div>
                    </div>
                    <div class="log-content">
                      <div class="log-header">
                        <span class="log-action" :class="log.type">{{ log.action }}</span>
                        <span class="log-operator">{{ log.operator }}</span>
                      </div>
                      <div class="log-detail">{{ log.detail }}</div>
                      <div class="log-meta">
                        <span class="log-time">
                          <el-icon><Clock /></el-icon>
                          {{ log.time }}
                        </span>
                        <span class="log-ip">{{ log.ip }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
    </template>

    <el-empty v-else description="档案信息加载失败，请返回列表重试" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Document,
  OfficeBuilding,
  Calendar,
  Flame,
  Money,
  Download,
  Timer,
  User,
  Avatar,
  House,
  Service,
  Plus,
  CreditCard,
  Tickets,
  Clock
} from '@element-plus/icons-vue'
import { useRemainsStore } from '@/stores/remains'
import { serviceCategoryMap } from '@/utils/status'
import type { Remains, ServiceItem, ServiceCategory } from '@/types/remains'
import type { ServiceCategory as BillingServiceCategory } from '@/types/billing'
import StatusTimeline from '@/components/remains/StatusTimeline.vue'
import StatusTag from '@/components/common/StatusTag.vue'

const route = useRoute()
const router = useRouter()
const store = useRemainsStore()

const activeTab = ref('basic')
const remains = ref<Remains | null>(null)

const mockServices = ref<ServiceItem[]>([
  {
    id: 'S001',
    code: 'FW20260001',
    name: '标准灵车接运服务',
    category: 'transport' as BillingServiceCategory,
    unit: '次',
    price: 1200,
    quantity: 1,
    discountRate: 1,
    finalPrice: 1200,
    isMandatory: true,
    isGovernmentPrice: true
  },
  {
    id: 'S002',
    code: 'FW20260002',
    name: '3日冷藏存放',
    category: 'refrigeration' as BillingServiceCategory,
    unit: '天',
    price: 150,
    quantity: 3,
    discountRate: 1,
    finalPrice: 450,
    isMandatory: false,
    isGovernmentPrice: true
  },
  {
    id: 'S003',
    code: 'FW20260003',
    name: '专业整容化妆服务',
    category: 'cosmetic' as BillingServiceCategory,
    unit: '次',
    price: 2800,
    quantity: 1,
    discountRate: 0.95,
    finalPrice: 2660,
    isMandatory: false,
    isGovernmentPrice: false
  },
  {
    id: 'S004',
    code: 'FW20260004',
    name: '追思厅告别仪式(中)',
    category: 'farewell' as BillingServiceCategory,
    unit: '场',
    price: 5800,
    quantity: 1,
    discountRate: 1,
    finalPrice: 5800,
    subsidyType: 'government_basic',
    subsidyAmount: 580,
    isMandatory: false,
    isGovernmentPrice: false
  },
  {
    id: 'S005',
    code: 'FW20260005',
    name: '豪华型火化炉',
    category: 'cremation' as BillingServiceCategory,
    unit: '次',
    price: 3200,
    quantity: 1,
    discountRate: 1,
    finalPrice: 3200,
    isMandatory: true,
    isGovernmentPrice: true
  }
])

const billingSummary = computed(() => {
  const subtotal = mockServices.value.reduce((sum, s) => sum + s.price * s.quantity, 0)
  const discountTotal = mockServices.value.reduce(
    (sum, s) => sum + s.price * s.quantity * (1 - s.discountRate),
    0
  )
  const subsidyTotal = mockServices.value.reduce((sum, s) => sum + (s.subsidyAmount || 0), 0)
  const totalAmount = subtotal - discountTotal - subsidyTotal
  const paidAmount = 8000
  const unpaidAmount = totalAmount - paidAmount
  return { subtotal, discountTotal, subsidyTotal, totalAmount, paidAmount, unpaidAmount }
})

const operationLogs = ref([
  {
    type: 'create',
    action: '创建档案',
    operator: '殡仪员张三',
    detail: '创建逝者遗体档案，完成初始信息录入',
    time: '2026-06-20 08:15:32',
    ip: '192.168.1.101'
  },
  {
    type: 'update',
    action: '更新状态',
    operator: '调度员A',
    detail: '状态变更：待接运 → 接运中，分配车辆沪A-8888领',
    time: '2026-06-20 08:45:12',
    ip: '192.168.1.201'
  },
  {
    type: 'update',
    action: '更新状态',
    operator: '驾驶员李卫东',
    detail: '状态变更：接运中 → 已到馆，安全送达',
    time: '2026-06-20 09:20:45',
    ip: '192.168.1.102'
  },
  {
    type: 'service',
    action: '添加服务',
    operator: '殡仪员张三',
    detail: '添加服务项目：专业整容化妆服务 (FW20260003)',
    time: '2026-06-20 09:35:20',
    ip: '192.168.1.101'
  },
  {
    type: 'service',
    action: '添加服务',
    operator: '礼仪师王建国',
    detail: '添加服务项目：追思厅告别仪式(中) (FW20260004)，预约06-22 10:00',
    time: '2026-06-20 10:05:18',
    ip: '192.168.1.103'
  },
  {
    type: 'payment',
    action: '费用支付',
    operator: '财务李四',
    detail: '家属支付部分费用 ¥8,000 (微信支付)',
    time: '2026-06-20 14:30:00',
    ip: '192.168.1.200'
  },
  {
    type: 'update',
    action: '更新状态',
    operator: '防腐师王五',
    detail: '状态变更：已到馆 → 冷藏中，存入冷藏楼A-冷藏间1-A-05',
    time: '2026-06-20 09:25:10',
    ip: '192.168.1.104'
  }
])

function getServiceCategoryLabel(category: BillingServiceCategory): string {
  return serviceCategoryMap[category] || category
}

onMounted(async () => {
  const id = route.params.id as string
  if (id) {
    remains.value = await store.fetchDetail(id)
  }
})
</script>

<style lang="scss" scoped>
.remains-detail-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: $color-funeral-card;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-title {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.deceased-name {
  font-size: 24px;
  font-weight: 700;
  color: $color-funeral-text-primary;
  margin: 0;
  letter-spacing: 1.5px;
}

.code-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: $color-funeral-text-secondary;

  :deep(.el-icon) {
    width: 14px;
    height: 14px;
    color: $color-funeral-gold;
  }

  .label {
    color: $color-funeral-text-muted;
  }

  .code {
    color: $color-funeral-gold;
    font-weight: 600;
    font-family: 'SF Mono', Monaco, monospace;
  }

  .sep {
    color: $color-funeral-border;
    margin: 0 6px;
  }
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;

  :deep(.el-button) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
}

.detail-content {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 16px;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
}

.content-left,
.content-right {
  min-width: 0;
}

.timeline-panel {
  background: $color-funeral-card;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  padding: 20px;
  height: fit-content;
  position: sticky;
  top: 16px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: $color-funeral-text-primary;
  padding-bottom: 16px;
  margin-bottom: 8px;
  border-bottom: 1px solid $color-funeral-border;

  :deep(.el-icon) {
    width: 18px;
    height: 18px;
    color: $color-funeral-gold;
  }
}

.detail-tabs {
  background: $color-funeral-card;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  padding: 4px 24px 24px;

  :deep(.el-tabs__nav-wrap::after) {
    background-color: $color-funeral-border;
  }

  :deep(.el-tabs__item) {
    color: $color-funeral-text-secondary;
    font-size: 14px;

    &.is-active {
      color: $color-funeral-gold;
    }

    &:hover {
      color: $color-funeral-gold-light;
    }
  }

  :deep(.el-tabs__active-bar) {
    background: linear-gradient(90deg, $color-funeral-gold 0%, $color-funeral-gold-light 100%);
  }
}

.tab-section {
  margin-top: 16px;

  & + & {
    margin-top: 28px;
  }
}

.section-title,
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 600;
  color: $color-funeral-text-primary;
  padding-bottom: 12px;
  margin-bottom: 16px;
  border-bottom: 1px solid $color-funeral-border;

  > :first-child {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :deep(.el-icon) {
    width: 16px;
    height: 16px;
    color: $color-funeral-gold;
  }
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 24px;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: $radius-sm;
  border: 1px solid rgba($color-funeral-border, 0.5);

  &.wide {
    grid-column: span 2;
  }
}

.item-label {
  min-width: 90px;
  font-size: 13px;
  color: $color-funeral-text-muted;
  flex-shrink: 0;
}

.item-value {
  flex: 1;
  font-size: 13px;
  color: $color-funeral-text-secondary;
  word-break: break-all;

  &.monospace {
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 12px;
    color: $color-funeral-gold;
  }
}

.services-table {
  :deep(.el-table) {
    --el-table-bg-color: transparent;
    --el-table-tr-bg-color: transparent;
    --el-table-header-bg-color: rgba($color-funeral-gold, 0.06);
    --el-table-border-color: $color-funeral-border;
    --el-table-text-color: $color-funeral-text-secondary;
    --el-table-header-text-color: $color-funeral-text-primary;
    --el-table-row-hover-bg-color: rgba($color-funeral-gold, 0.04);
  }

  .monospace {
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 12px;
    color: $color-funeral-gold;
  }

  .amount-highlight {
    color: $color-funeral-gold;
    font-weight: 600;
  }
}

.billing-summary {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 480px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;

  .summary-label {
    color: $color-funeral-text-secondary;
  }

  .summary-value {
    color: $color-funeral-text-primary;
    font-weight: 500;

    &.discount {
      color: $color-status-success;
    }

    &.subsidy {
      color: $color-status-info;
    }

    &.paid {
      color: $color-status-success;
    }
  }

  &.total {
    font-size: 16px;

    .summary-label {
      color: $color-funeral-text-primary;
      font-weight: 600;
    }

    .summary-value {
      font-size: 22px;
      font-weight: 700;
      background: linear-gradient(135deg, $color-funeral-gold-light 0%, $color-funeral-gold 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  }

  &.unpaid {
    padding: 10px 12px;
    background: rgba($color-status-error, 0.08);
    border: 1px solid rgba($color-status-error, 0.2);
    border-radius: $radius-sm;
    margin-top: 4px;

    .summary-label {
      color: $color-status-error;
      font-weight: 600;
    }

    .summary-value {
      color: $color-status-error;
      font-weight: 700;
    }
  }
}

.summary-divider {
  height: 1px;
  background: $color-funeral-border;
  margin: 6px 0;
}

.billing-actions {
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.operation-logs {
  display: flex;
  flex-direction: column;
}

.log-item {
  display: flex;
  gap: 14px;
}

.log-dot-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;
}

.log-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: $color-funeral-gold;
  flex-shrink: 0;
  margin-top: 6px;
}

.log-line {
  width: 1px;
  flex: 1;
  min-height: 24px;
  background: $color-funeral-border;
  margin: 4px 0;
}

.log-content {
  flex: 1;
  padding-bottom: 20px;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.log-action {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: $radius-sm;
  font-size: 12px;
  font-weight: 600;

  &.create {
    background: rgba(24, 144, 255, 0.12);
    color: #1890FF;
  }

  &.update {
    background: rgba($color-funeral-gold, 0.12);
    color: $color-funeral-gold;
  }

  &.service {
    background: rgba(114, 46, 209, 0.12);
    color: #722ED1;
  }

  &.payment {
    background: rgba(82, 196, 26, 0.12);
    color: #52C41A;
  }
}

.log-operator {
  font-size: 13px;
  color: $color-funeral-text-primary;
  font-weight: 500;
}

.log-detail {
  font-size: 13px;
  color: $color-funeral-text-secondary;
  margin-bottom: 6px;
  line-height: 1.6;
}

.log-meta {
  display: flex;
  gap: 16px;
  font-size: 11px;
  color: $color-funeral-text-muted;
  font-family: 'SF Mono', Monaco, monospace;
}

.log-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;

  :deep(.el-icon) {
    width: 12px;
    height: 12px;
  }
}
</style>
