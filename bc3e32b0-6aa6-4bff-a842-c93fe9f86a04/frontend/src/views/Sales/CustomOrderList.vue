<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { CustomOrder, OrderStatus } from '@/types'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

const activeTab = ref<'all' | 'pending' | 'in_progress' | 'completed'>('all')
const searchKeyword = ref('')

const orders = ref<CustomOrder[]>([
  {
    id: 'co1',
    title: '定制结婚纪念对杯',
    description: '一对定制陶瓷对杯，刻有新人名字和日期，风格简约优雅。',
    clientName: '张先生',
    clientContact: '138****8001',
    budget: 800,
    assignedTo: 'ins-1',
    assignedToName: '李老师',
    status: 'in_progress',
    quoteAmount: 680,
    createdAt: '2024-01-20T00:00:00Z',
    deadline: '2024-02-14'
  },
  {
    id: 'co2',
    title: '企业礼品定制 - 茶盏套装',
    description: '公司年会礼品，需定制logo，共50套茶盏套装。',
    clientName: '王经理',
    clientContact: '139****8002',
    budget: 15000,
    status: 'quoted',
    quoteAmount: 12500,
    createdAt: '2024-01-18T00:00:00Z'
  },
  {
    id: 'co3',
    title: '家居装饰花瓶',
    description: '客厅装饰用大花瓶，高度约40cm，风格现代简约。',
    clientName: '刘女士',
    clientContact: '137****8003',
    budget: 500,
    status: 'pending',
    createdAt: '2024-01-22T00:00:00Z'
  },
  {
    id: 'co4',
    title: '紫砂茶壶定制',
    description: '手工紫砂茶壶，刻有诗词，送礼用。',
    clientName: '陈先生',
    clientContact: '136****8004',
    assignedTo: 'ins-2',
    assignedToName: '王老师',
    status: 'completed',
    quoteAmount: 1200,
    createdAt: '2024-01-05T00:00:00Z'
  }
])

const filteredOrders = computed(() => {
  return orders.value.filter(order => {
    if (activeTab.value !== 'all' && order.status !== activeTab.value) {
      if (activeTab.value === 'in_progress' && order.status !== 'in_progress') {
        if (order.status === 'quoted' || order.status === 'accepted') return true
        return false
      }
      return false
    }
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase()
      return order.title.toLowerCase().includes(kw) || 
             order.clientName.toLowerCase().includes(kw)
    }
    return true
  })
})

const getStatusLabel = (status: OrderStatus) => {
  const map: Record<string, string> = {
    pending: '待报价',
    quoted: '已报价',
    accepted: '已确认',
    in_progress: '制作中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
}

const getStatusColor = (status: OrderStatus) => {
  const map: Record<string, string> = {
    pending: '#e6a23c',
    quoted: '#409eff',
    accepted: '#67c23a',
    in_progress: '#c85a32',
    completed: '#67c23a',
    cancelled: '#909399'
  }
  return map[status] || '#999'
}

const handleQuote = (order: CustomOrder) => {
  ElMessage.info('报价功能开发中...')
}

const handleAccept = (order: CustomOrder) => {
  ElMessage.success('已确认订单，开始制作')
}

const handleComplete = (order: CustomOrder) => {
  ElMessage.success('订单已完成')
}

const handleDetail = (order: CustomOrder) => {
  ElMessage.info('查看订单详情')
}

onMounted(() => {
})
</script>

<template>
  <div class="custom-order-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">定制委托</h2>
        <el-tabs v-model="activeTab" class="header-tabs">
          <el-tab-pane label="全部" name="all" />
          <el-tab-pane label="待处理" name="pending" />
          <el-tab-pane label="进行中" name="in_progress" />
          <el-tab-pane label="已完成" name="completed" />
        </el-tabs>
      </div>
      <div class="header-right">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索订单..."
          :prefix-icon="Search"
          clearable
          class="search-input"
        />
      </div>
    </div>

    <div class="order-list">
      <div 
        v-for="order in filteredOrders" 
        :key="order.id"
        class="order-card"
        @click="handleDetail(order)"
      >
        <div class="order-header">
          <h3 class="order-title">{{ order.title }}</h3>
          <el-tag 
            :style="{ 
              backgroundColor: getStatusColor(order.status) + '20', 
              color: getStatusColor(order.status),
              border: 'none' 
            }"
          >
            {{ getStatusLabel(order.status) }}
          </el-tag>
        </div>
        
        <p class="order-desc">{{ order.description }}</p>
        
        <div class="order-meta">
          <div class="meta-item">
            <el-icon><User /></el-icon>
            <span>{{ order.clientName }}</span>
          </div>
          <div class="meta-item">
            <el-icon><Phone /></el-icon>
            <span>{{ order.clientContact }}</span>
          </div>
          <div v-if="order.budget" class="meta-item">
            <el-icon><Wallet /></el-icon>
            <span>预算 ¥{{ order.budget }}</span>
          </div>
          <div v-if="order.quoteAmount" class="meta-item price">
            <el-icon><Money /></el-icon>
            <span>报价 ¥{{ order.quoteAmount }}</span>
          </div>
        </div>
        
        <div class="order-footer">
          <div class="footer-info">
            <span v-if="order.assignedToName">陶艺师：{{ order.assignedToName }}</span>
            <span v-if="order.deadline">截止：{{ order.deadline }}</span>
          </div>
          <div class="order-actions" @click.stop>
            <el-button v-if="order.status === 'pending'" size="small" type="primary" @click="handleQuote(order)">
              报价
            </el-button>
            <el-button v-if="order.status === 'quoted'" size="small" type="success" @click="handleAccept(order)">
              确认订单
            </el-button>
            <el-button v-if="order.status === 'in_progress' || order.status === 'accepted'" size="small" type="success" @click="handleComplete(order)">
              完成
            </el-button>
            <el-button size="small">详情</el-button>
          </div>
        </div>
      </div>
    </div>

    <el-empty v-if="filteredOrders.length === 0" description="暂无订单" />
  </div>
</template>

<style scoped lang="scss">
.custom-order-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: $color-text-primary;
}

.header-tabs {
  :deep(.el-tabs__item) {
    font-size: 14px;
  }
  :deep(.el-tabs__header) {
    margin: 0;
  }
}

.search-input {
  width: 220px;
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.order-card {
  background: white;
  border-radius: $border-radius-md;
  padding: 20px;
  box-shadow: $shadow-sm;
  cursor: pointer;
  transition: all $transition-normal;

  &:hover {
    box-shadow: $shadow-md;
  }
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
  gap: 12px;
}

.order-title {
  font-size: 16px;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0;
}

.order-desc {
  font-size: 14px;
  color: $color-text-secondary;
  line-height: 1.6;
  margin: 0 0 16px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.order-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: $color-text-secondary;

  &.price {
    color: $color-primary;
    font-weight: 600;
  }
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid $color-border;
  flex-wrap: wrap;
  gap: 12px;
}

.footer-info {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: $color-text-placeholder;
}

.order-actions {
  display: flex;
  gap: 8px;
}
</style>
