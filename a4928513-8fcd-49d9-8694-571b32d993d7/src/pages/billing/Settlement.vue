<template>
  <div class="settlement-page">
    <div class="search-bar panel">
      <div class="search-row">
        <div class="search-item search-keyword">
          <el-input
            v-model="searchForm.keyword"
            placeholder="账单号 / 逝者姓名 / 家属电话"
            clearable
            :prefix-icon="Search"
            class="w-full"
            @keyup.enter="handleSearch"
          />
        </div>
        <div class="search-item">
          <el-date-picker
            v-model="searchForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            class="w-full"
          />
        </div>
        <div class="search-item">
          <el-select
            v-model="searchForm.status"
            placeholder="状态筛选"
            clearable
            class="w-full"
          >
            <el-option label="全部" value="" />
            <el-option label="待支付" value="unpaid" />
            <el-option label="部分支付" value="partial" />
            <el-option label="已支付" value="paid" />
            <el-option label="已退款" value="refunded" />
          </el-select>
        </div>
        <div class="search-item search-actions">
          <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
          <el-button type="primary" :icon="Plus" class="new-btn" @click="handleNewBill">新建结算</el-button>
        </div>
      </div>
    </div>

    <div class="stats-row">
      <StatCard title="本月营收" :value="formatMoney(dashboardStats.monthlyRevenue)" icon="Money" :trend="8.6" />
      <StatCard title="未收款" :value="formatMoney(dashboardStats.unpaidAmount)" icon="Warning" :trend="-3.2" />
      <StatCard title="惠民补贴总额" :value="formatMoney(dashboardStats.subsidyTotal)" icon="Present" :trend="5.8" />
      <StatCard title="电子发票开具数" :value="dashboardStats.invoiceCount" icon="Document" :trend="12.4" />
    </div>

    <div class="main-content">
      <div class="left-panel panel">
        <div class="panel-header">
          <h3 class="panel-title">
            <el-icon><List /></el-icon>
            账单列表
          </h3>
          <span class="panel-badge">{{ filteredBills.length }}</span>
        </div>
        <div class="panel-body no-padding">
          <el-table
            ref="billTableRef"
            :data="filteredBills"
            class="bill-table"
            border
            row-key="id"
            highlight-current-row
            :expand-row-keys="expandedRows"
            @current-change="handleRowSelect"
            @expand-change="handleExpandChange"
          >
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="expand-content">
                  <div class="expand-title">服务项目明细</div>
                  <el-table :data="row.items" size="small" class="nested-table">
                    <el-table-column prop="code" label="编码" width="90" />
                    <el-table-column prop="name" label="项目名称" min-width="180">
                      <template #default="{ row: item }">
                        <div class="item-name-cell">
                          <span>{{ item.name }}</span>
                          <el-tag
                            v-if="item.isGovernmentPrice"
                            type="success"
                            size="small"
                            effect="plain"
                            class="tag-gov"
                          >政府定价</el-tag>
                          <el-tag
                            v-if="item.isMandatory"
                            type="danger"
                            size="small"
                            effect="plain"
                            class="tag-mandatory"
                          >必选</el-tag>
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column prop="unit" label="单位" width="70" align="center" />
                    <el-table-column prop="price" label="单价" width="100" align="right">
                      <template #default="{ row: item }">
                        <span class="money-text">¥{{ item.price.toLocaleString() }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="quantity" label="数量" width="70" align="center" />
                    <el-table-column label="折扣" width="80" align="center">
                      <template #default="{ row: item }">
                        <span v-if="item.discountRate < 1" class="discount-text">
                          {{ (item.discountRate * 10).toFixed(1) }}折
                        </span>
                        <span v-else class="text-muted">-</span>
                      </template>
                    </el-table-column>
                    <el-table-column label="补贴" width="100" align="right">
                      <template #default="{ row: item }">
                        <span v-if="item.subsidyAmount" class="subsidy-text">
                          -¥{{ item.subsidyAmount.toLocaleString() }}
                        </span>
                        <span v-else class="text-muted">-</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="finalPrice" label="小计" width="110" align="right">
                      <template #default="{ row: item }">
                        <span class="money-text fw6">¥{{ item.finalPrice.toLocaleString() }}</span>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="billNo" label="账单号" width="180">
              <template #default="{ row }">
                <span class="bill-no">{{ row.billNo }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="remainsName" label="逝者" width="100" />
            <el-table-column prop="customerName" label="家属" width="110" />
            <el-table-column label="服务项数" width="90" align="center">
              <template #default="{ row }">{{ row.items.length }}</template>
            </el-table-column>
            <el-table-column prop="subtotal" label="金额小计" width="110" align="right">
              <template #default="{ row }">
                <span class="money-text">¥{{ row.subtotal.toLocaleString() }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="subsidyTotal" label="补贴" width="100" align="right">
              <template #default="{ row }">
                <span v-if="row.subsidyTotal" class="subsidy-text">-¥{{ row.subsidyTotal.toLocaleString() }}</span>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="discountTotal" label="折扣" width="100" align="right">
              <template #default="{ row }">
                <span v-if="row.discountTotal" class="discount-text">-¥{{ row.discountTotal.toLocaleString() }}</span>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="totalAmount" label="应收金额" width="110" align="right">
              <template #default="{ row }">
                <span class="money-text fw6 gold-text">¥{{ row.totalAmount.toLocaleString() }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="paidAmount" label="已付" width="100" align="right">
              <template #default="{ row }">
                <span class="paid-text">¥{{ row.paidAmount.toLocaleString() }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <StatusTag :status="row.status" type="bill" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click.stop="handleViewDetail(row)">详情</el-button>
                <el-button
                  v-if="row.status !== 'paid' && row.status !== 'refunded'"
                  type="primary"
                  link
                  size="small"
                  @click.stop="handlePay(row)"
                >支付</el-button>
                <el-button
                  v-if="row.status === 'paid' && row.invoiceType === 'none'"
                  type="primary"
                  link
                  size="small"
                  @click.stop="handleInvoice(row)"
                >开发票</el-button>
                <el-button type="primary" link size="small" @click.stop="handlePrint(row)">打印</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div class="table-pagination">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :page-sizes="[10, 20, 50]"
            :total="filteredBills.length"
            layout="total, sizes, prev, pager, next, jumper"
            background
          />
        </div>
      </div>

      <div class="right-panel detail-panel">
        <div v-if="selectedBill" class="detail-inner">
          <div class="detail-header">
            <div class="detail-title-row">
              <h3 class="detail-title">
                <el-icon><Tickets /></el-icon>
                账单 {{ selectedBill.billNo }}
              </h3>
              <StatusTag :status="selectedBill.status" type="bill" />
            </div>
            <div class="detail-meta">
              <span>创建时间：{{ selectedBill.createTime }}</span>
              <span>经办人：{{ selectedBill.operatorName }}</span>
            </div>
            <div class="detail-people">
              <div class="people-item">
                <span class="people-label">逝者</span>
                <span class="people-value">{{ selectedBill.remainsName }}</span>
              </div>
              <div class="people-item">
                <span class="people-label">家属</span>
                <span class="people-value">{{ selectedBill.customerName }}</span>
              </div>
              <div class="people-item">
                <span class="people-label">电话</span>
                <span class="people-value">{{ selectedBill.customerPhone }}</span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="section-title">
              <el-icon><Goods /></el-icon>
              服务项目清单
            </div>
            <el-table :data="selectedBill.items" size="small" border class="items-table">
              <el-table-column prop="name" label="项目名称" min-width="150">
                <template #default="{ row }">
                  <div class="item-name-cell">
                    <span>{{ row.name }}</span>
                    <el-tag
                      v-if="row.isGovernmentPrice"
                      type="success"
                      size="small"
                      effect="plain"
                    >定价</el-tag>
                    <el-tag
                      v-if="row.isMandatory"
                      type="danger"
                      size="small"
                      effect="plain"
                    >必选</el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="price" label="单价" width="80" align="right">
                <template #default="{ row }">¥{{ row.price }}</template>
              </el-table-column>
              <el-table-column prop="quantity" label="数量" width="60" align="center" />
              <el-table-column label="折扣" width="70" align="center">
                <template #default="{ row }">
                  <span v-if="row.discountRate < 1">{{ (row.discountRate * 10).toFixed(0) }}折</span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="补贴" width="80" align="right">
                <template #default="{ row }">
                  <span v-if="row.subsidyAmount" class="subsidy-text">-¥{{ row.subsidyAmount }}</span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column prop="finalPrice" label="小计" width="80" align="right">
                <template #default="{ row }">
                  <span class="fw6">¥{{ row.finalPrice }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div class="detail-section">
            <div class="section-title">
              <el-icon><Coin /></el-icon>
              结算汇总
            </div>
            <div class="summary-grid">
              <div class="summary-row">
                <span class="summary-label">金额小计</span>
                <span class="summary-value">¥{{ selectedBill.subtotal.toLocaleString() }}</span>
              </div>
              <div class="summary-row highlight-green">
                <span class="summary-label">补贴合计</span>
                <span class="summary-value">-¥{{ selectedBill.subsidyTotal.toLocaleString() }}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">折扣合计</span>
                <span class="summary-value discount-text">-¥{{ selectedBill.discountTotal.toLocaleString() }}</span>
              </div>
              <div class="summary-divider"></div>
              <div class="summary-row total-row">
                <span class="summary-label">应收金额</span>
                <span class="summary-value gold-text fw7">¥{{ selectedBill.totalAmount.toLocaleString() }}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">已付金额</span>
                <span class="summary-value paid-text">¥{{ selectedBill.paidAmount.toLocaleString() }}</span>
              </div>
              <div class="summary-row unpaid-row">
                <span class="summary-label">未付金额</span>
                <span class="summary-value unpaid-text fw7">¥{{ selectedBill.unpaidAmount.toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="section-title">
              <el-icon><Present /></el-icon>
              惠民补贴政策匹配
            </div>
            <div class="subsidy-list">
              <div
                v-for="policy in subsidyPolicies"
                :key="policy.id"
                class="subsidy-item"
                :class="{ checked: checkedSubsidies.includes(policy.id) }"
                @click="toggleSubsidy(policy)"
              >
                <el-checkbox
                  :model-value="checkedSubsidies.includes(policy.id)"
                  @change="toggleSubsidy(policy)"
                />
                <div class="subsidy-info">
                  <div class="subsidy-name">{{ policy.name }}</div>
                  <div class="subsidy-desc">{{ policy.conditions }}</div>
                </div>
                <div class="subsidy-amount">
                  <span v-if="policy.amount">¥{{ policy.amount.toLocaleString() }}</span>
                  <span v-else-if="policy.percent">{{ (policy.percent * 100).toFixed(0) }}%</span>
                </div>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="section-title">
              <el-icon><Wallet /></el-icon>
              支付方式
            </div>
            <el-radio-group v-model="payForm.method" class="pay-method-group">
              <el-radio value="cash" border>现金</el-radio>
              <el-radio value="wechat" border>微信</el-radio>
              <el-radio value="alipay" border>支付宝</el-radio>
              <el-radio value="bank" border>银行卡</el-radio>
              <el-radio value="mixed" border>混合支付</el-radio>
            </el-radio-group>

            <div v-if="payForm.method === 'mixed'" class="mixed-pay-form">
              <div v-for="(item, idx) in payForm.mixedItems" :key="idx" class="mixed-pay-row">
                <el-select v-model="item.method" class="mixed-method">
                  <el-option label="现金" value="cash" />
                  <el-option label="微信" value="wechat" />
                  <el-option label="支付宝" value="alipay" />
                  <el-option label="银行卡" value="bank" />
                </el-select>
                <el-input-number
                  v-model="item.amount"
                  :min="0"
                  :precision="2"
                  :step="100"
                  class="mixed-amount"
                />
                <el-button
                  v-if="payForm.mixedItems.length > 1"
                  type="danger"
                  link
                  :icon="Delete"
                  @click="removeMixedItem(idx)"
                />
              </div>
              <el-button type="primary" link :icon="Plus" class="add-mixed-btn" @click="addMixedItem">
                添加拆分方式
              </el-button>
              <div class="mixed-tip">
                已分配：<span :class="mixedTotal === selectedBill.unpaidAmount ? 'ok' : 'warn'">¥{{ mixedTotal.toLocaleString() }}</span>
                / 应付：¥{{ selectedBill.unpaidAmount.toLocaleString() }}
              </div>
            </div>
          </div>

          <div class="detail-footer">
            <el-button type="primary" class="pay-btn" size="large" :disabled="selectedBill.unpaidAmount <= 0" @click="openPayDialog">
              <el-icon><CreditCard /></el-icon>
              立即支付
            </el-button>
            <el-button size="large" @click="handleSave">
              <el-icon><Download /></el-icon>
              保存
            </el-button>
            <el-button size="large" @click="handleSendList">
              <el-icon><Message /></el-icon>
              发送电子清单
            </el-button>
          </div>
        </div>

        <div v-else class="empty-detail">
          <el-empty description="请从左侧选择账单查看详情">
            <template #image>
              <div class="empty-icon">
                <el-icon><Tickets /></el-icon>
              </div>
            </template>
          </el-empty>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="payDialogVisible"
      title="在线支付"
      width="460px"
      :close-on-click-modal="false"
      class="pay-dialog"
    >
      <div v-if="payStep === 1" class="pay-step-1">
        <div class="pay-amount-box">
          <div class="pay-label">应付金额</div>
          <div class="pay-amount">¥{{ (selectedBill?.unpaidAmount || 0).toLocaleString() }}</div>
        </div>
        <div class="pay-method-show">
          <div v-if="payForm.method === 'wechat'" class="qr-box">
            <div class="qr-icon wechat"><el-icon><ChatDotRound /></el-icon></div>
            <div class="qr-title">微信扫码支付</div>
            <div class="qr-placeholder">
              <div class="qr-grid">
                <div v-for="i in 100" :key="i" class="qr-cell" :class="{ filled: (i * 7) % 3 !== 0 }"></div>
              </div>
            </div>
            <div class="qr-tip">请使用微信扫一扫，完成支付</div>
          </div>
          <div v-else-if="payForm.method === 'alipay'" class="qr-box">
            <div class="qr-icon alipay"><el-icon><Aim /></el-icon></div>
            <div class="qr-title">支付宝扫码支付</div>
            <div class="qr-placeholder">
              <div class="qr-grid">
                <div v-for="i in 100" :key="i" class="qr-cell" :class="{ filled: (i * 5) % 2 === 0 }"></div>
              </div>
            </div>
            <div class="qr-tip">请使用支付宝扫一扫，完成支付</div>
          </div>
          <div v-else-if="payForm.method === 'bank'" class="card-box">
            <div class="card-icon"><el-icon><CreditCard /></el-icon></div>
            <div class="card-title">请刷卡或插入银行卡</div>
            <div class="card-steps">
              <div class="card-step"><span class="step-num">1</span>将银行卡插入POS机</div>
              <div class="card-step"><span class="step-num">2</span>输入密码并确认</div>
              <div class="card-step"><span class="step-num">3</span>等待支付完成</div>
            </div>
          </div>
          <div v-else class="cash-box">
            <div class="cash-icon"><el-icon><Money /></el-icon></div>
            <div class="cash-title">现金支付</div>
            <div class="cash-form">
              <el-form-item label="应收金额" label-width="90px">
                <span class="cash-amount">¥{{ (selectedBill?.unpaidAmount || 0).toLocaleString() }}</span>
              </el-form-item>
              <el-form-item label="实收金额" label-width="90px">
                <el-input-number v-model="cashReceived" :min="0" :precision="2" size="large" />
              </el-form-item>
              <el-form-item label="找零" label-width="90px">
                <span class="cash-change" :class="{ negative: cashChange < 0 }">
                  ¥{{ cashChange.toLocaleString() }}
                </span>
              </el-form-item>
            </div>
          </div>
        </div>
      </div>

      <div v-if="payStep === 2" class="pay-step-2">
        <div class="pay-success">
          <div class="success-icon"><el-icon><CircleCheckFilled /></el-icon></div>
          <div class="success-title">支付成功</div>
          <div class="success-amount">
            已支付 <span class="fw7 gold-text">¥{{ (selectedBill?.unpaidAmount || 0).toLocaleString() }}</span>
          </div>
          <div class="invoice-link-box">
            <el-icon><Document /></el-icon>
            <div class="invoice-info">
              <div class="invoice-label">电子发票</div>
              <a class="invoice-link" href="javascript:;" @click="handleViewInvoice">
                点击查看发票 / 下载PDF
              </a>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="pay-dialog-footer">
          <template v-if="payStep === 1">
            <el-button @click="payDialogVisible = false">取消</el-button>
            <el-button type="primary" class="confirm-pay-btn" @click="confirmPay">
              <el-icon><Check /></el-icon>
              确认支付完成
            </el-button>
          </template>
          <template v-else>
            <el-button type="primary" @click="payDialogVisible = false">完成</el-button>
          </template>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import {
  Search,
  Refresh,
  Plus,
  List,
  Tickets,
  Goods,
  Coin,
  Present,
  Wallet,
  Delete,
  CreditCard,
  Download,
  Message,
  Check,
  CircleCheckFilled,
  Document,
  ChatDotRound,
  Aim,
  Money,
  Warning
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import StatCard from '@/components/common/StatCard.vue'
import StatusTag from '@/components/common/StatusTag.vue'
import { mockBills, mockSubsidyPolicies } from '@/mock/billing'
import type { Bill, SubsidyPolicy, PaymentMethod } from '@/types/billing'

const searchForm = reactive({
  keyword: '',
  dateRange: [] as string[],
  status: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 10
})

const expandedRows = ref<string[]>([])
const selectedBill = ref<Bill | null>(null)
const checkedSubsidies = ref<string[]>([])

const payForm = reactive({
  method: 'wechat' as PaymentMethod,
  mixedItems: [
    { method: 'wechat' as PaymentMethod, amount: 0 },
    { method: 'cash' as PaymentMethod, amount: 0 }
  ]
})

const cashReceived = ref(0)

const payDialogVisible = ref(false)
const payStep = ref(1)

const subsidyPolicies = mockSubsidyPolicies

const dashboardStats = computed(() => {
  const bills = mockBills
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthBills = bills.filter((b) => b.createTime.startsWith(thisMonth.replace('-', '年') + '月') || b.createTime.slice(0, 7).replace('-', '-') === thisMonth)

  return {
    monthlyRevenue: bills.filter((b) => b.status === 'paid').reduce((s, b) => s + b.paidAmount, 0),
    unpaidAmount: bills.reduce((s, b) => s + b.unpaidAmount, 0),
    subsidyTotal: bills.reduce((s, b) => s + b.subsidyTotal, 0),
    invoiceCount: bills.filter((b) => b.invoiceType === 'electronic' && b.invoiceUrl).length
  }
})

const filteredBills = computed(() => {
  return mockBills.filter((bill) => {
    if (searchForm.keyword) {
      const kw = searchForm.keyword.toLowerCase()
      const matchNo = bill.billNo.toLowerCase().includes(kw)
      const matchName = bill.remainsName.includes(searchForm.keyword)
      const matchPhone = bill.customerPhone.includes(searchForm.keyword)
      if (!matchNo && !matchName && !matchPhone) return false
    }
    if (searchForm.status && bill.status !== searchForm.status) return false
    return true
  })
})

const mixedTotal = computed(() =>
  payForm.mixedItems.reduce((s, i) => s + (Number(i.amount) || 0), 0)
)

const cashChange = computed(() =>
  Number(cashReceived.value) - (selectedBill.value?.unpaidAmount || 0)
)

function formatMoney(amount: number): string {
  if (amount >= 10000) {
    return `¥${(amount / 10000).toFixed(2)}万`
  }
  return `¥${amount.toLocaleString('zh-CN')}`
}

function handleSearch() {
  pagination.page = 1
  ElMessage.success('搜索条件已应用')
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.dateRange = []
  searchForm.status = ''
  pagination.page = 1
}

function handleNewBill() {
  ElMessage.info('新建结算功能开发中...')
}

function handleRowSelect(row: Bill) {
  selectedBill.value = row
  checkedSubsidies.value = row.subsidyProofs?.map((p) => {
    const policy = subsidyPolicies.find((s) => s.type === p.type)
    return policy?.id || ''
  }).filter(Boolean) || []
  payForm.method = 'wechat'
  payForm.mixedItems = [
    { method: 'wechat', amount: Math.ceil((row.unpaidAmount || 0) / 2) },
    { method: 'cash', amount: Math.floor((row.unpaidAmount || 0) / 2) }
  ]
  cashReceived.value = row.unpaidAmount || 0
}

function handleExpandChange(row: Bill, expandedRowsData: any[]) {
  expandedRows.value = expandedRowsData.map((r: Bill) => r.id)
}

function handleViewDetail(row: Bill) {
  selectedBill.value = row
  ElMessage.info(`查看账单 ${row.billNo} 详情`)
}

function handlePay(row: Bill) {
  selectedBill.value = row
  payStep.value = 1
  payDialogVisible.value = true
}

function handleInvoice(row: Bill) {
  ElMessageBox.prompt('请输入发票抬头', '开具电子发票', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPlaceholder: '个人 / 公司名称'
  }).then(({ value }) => {
    ElMessage.success(`已为账单 ${row.billNo} 开具电子发票，抬头：${value}`)
    row.invoiceType = 'electronic'
    row.invoiceTitle = value
    row.invoiceNo = `INV${Date.now()}`
    row.invoiceUrl = `/invoices/${row.invoiceNo}.pdf`
  }).catch(() => {})
}

function handlePrint(row: Bill) {
  ElMessage.info(`打印账单 ${row.billNo} ...`)
}

function toggleSubsidy(policy: SubsidyPolicy) {
  const idx = checkedSubsidies.value.indexOf(policy.id)
  if (idx >= 0) {
    checkedSubsidies.value.splice(idx, 1)
  } else {
    checkedSubsidies.value.push(policy.id)
  }
}

function addMixedItem() {
  payForm.mixedItems.push({ method: 'cash', amount: 0 })
}

function removeMixedItem(idx: number) {
  payForm.mixedItems.splice(idx, 1)
}

function openPayDialog() {
  if (!selectedBill.value) return
  payStep.value = 1
  payDialogVisible.value = true
}

function confirmPay() {
  if (payForm.method === 'mixed' && Math.abs(mixedTotal.value - (selectedBill.value?.unpaidAmount || 0)) > 0.01) {
    ElMessage.warning('混合支付分配金额与应付金额不一致')
    return
  }
  if (payForm.method === 'cash' && cashChange.value < 0) {
    ElMessage.warning('实收金额不足')
    return
  }
  payStep.value = 2
  if (selectedBill.value) {
    selectedBill.value.paidAmount = selectedBill.value.totalAmount
    selectedBill.value.unpaidAmount = 0
    selectedBill.value.status = 'paid'
  }
}

function handleViewInvoice() {
  ElMessage.success('正在打开电子发票...')
}

function handleSave() {
  ElMessage.success('账单已保存')
}

function handleSendList() {
  ElMessageBox.confirm(
    `确定要将电子清单发送给家属 ${selectedBill.value?.customerName} (${selectedBill.value?.customerPhone}) 吗？`,
    '发送电子清单',
    { confirmButtonText: '发送', cancelButtonText: '取消', type: 'info' }
  ).then(() => {
    ElMessage.success('电子清单已通过短信发送给家属')
  }).catch(() => {})
}

onMounted(() => {
  if (mockBills.length > 0) {
    handleRowSelect(mockBills[0])
  }
})
</script>

<style lang="scss" scoped>
.settlement-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}

.search-bar {
  .search-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
  }

  .search-item {
    flex: 1;
    min-width: 200px;

    &.search-keyword {
      flex: 2;
      min-width: 280px;
    }

    &.search-actions {
      flex: 0 0 auto;
      display: flex;
      gap: 8px;

      .new-btn {
        margin-left: 8px;
      }
    }
  }
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;

  @media (max-width: 1400px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.main-content {
  display: grid;
  grid-template-columns: 60% 40%;
  gap: 16px;

  @media (max-width: 1400px) {
    grid-template-columns: 1fr;
  }
}

.panel {
  background: $color-funeral-card;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid $color-funeral-border;
  background: rgba(255, 255, 255, 0.02);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: $color-funeral-text-primary;
  margin: 0;

  :deep(.el-icon) {
    width: 18px;
    height: 18px;
    color: $color-funeral-gold;
  }
}

.panel-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 11px;
  background: linear-gradient(135deg, $color-funeral-gold 0%, $color-funeral-gold-dark 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.panel-body {
  padding: 16px 20px;

  &.no-padding {
    padding: 0;
  }
}

.left-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bill-table {
  :deep(.el-table__body tr.current-row > td.el-table__cell) {
    background-color: rgba($color-funeral-gold, 0.12) !important;
  }
}

.expand-content {
  padding: 12px 24px;
  background: rgba($color-funeral-deepest, 0.6);

  .expand-title {
    font-size: 13px;
    font-weight: 600;
    color: $color-funeral-gold;
    margin-bottom: 10px;
  }
}

.nested-table {
  :deep(.el-table__header th) {
    background: $color-funeral-dark !important;
  }
}

.item-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.tag-gov {
  --el-tag-bg-color: rgba(82, 196, 26, 0.15) !important;
  --el-tag-text-color: #52C41A !important;
  --el-tag-border-color: rgba(82, 196, 26, 0.4) !important;
}

.tag-mandatory {
  --el-tag-bg-color: rgba(255, 77, 79, 0.12) !important;
  --el-tag-text-color: #FF4D4F !important;
  --el-tag-border-color: rgba(255, 77, 79, 0.4) !important;
}

.money-text {
  font-family: 'SF Mono', Monaco, monospace;
  color: $color-funeral-text-primary;
}

.gold-text {
  color: $color-funeral-gold;
}

.fw6 { font-weight: 600; }
.fw7 { font-weight: 700; }

.text-muted {
  color: $color-funeral-text-muted;
}

.bill-no {
  font-family: 'SF Mono', Monaco, monospace;
  font-weight: 600;
  color: $color-funeral-gold;
}

.subsidy-text {
  color: $color-status-success;
  font-weight: 600;
}

.discount-text {
  color: #13C2C2;
}

.paid-text {
  color: $color-status-success;
  font-weight: 600;
}

.table-pagination {
  padding: 12px 20px;
  border-top: 1px solid $color-funeral-border;
  display: flex;
  justify-content: flex-end;
}

.detail-panel {
  background: $color-funeral-card;
  border: 2px solid transparent;
  border-image: linear-gradient(135deg, rgba($color-funeral-gold, 0.8), rgba($color-funeral-gold-dark, 0.6), rgba($color-funeral-gold, 0.8)) 1;
  border-radius: $radius-md;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .detail-inner {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: calc(100vh - 320px);
    overflow-y: auto;
    @include scrollbar-custom;
  }
}

.detail-header {
  padding: 20px;
  border-bottom: 1px solid $color-funeral-border;
  background: linear-gradient(135deg, rgba($color-funeral-gold, 0.08) 0%, transparent 60%);
}

.detail-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.detail-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 17px;
  font-weight: 700;

  :deep(.el-icon) {
    color: $color-funeral-gold;
    width: 20px;
    height: 20px;
  }
}

.detail-meta {
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: $color-funeral-text-muted;
  margin-bottom: 12px;
}

.detail-people {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.people-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.people-label {
  font-size: 12px;
  color: $color-funeral-text-muted;
}

.people-value {
  font-size: 14px;
  font-weight: 600;
  color: $color-funeral-text-primary;
}

.detail-section {
  padding: 16px 20px;
  border-bottom: 1px solid rgba($color-funeral-border, 0.6);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: $color-funeral-gold;
  margin-bottom: 12px;

  :deep(.el-icon) {
    width: 16px;
    height: 16px;
  }
}

.items-table {
  :deep(.el-table__header th) {
    background: $color-funeral-deepest !important;
  }

  :deep(.el-table td),
  :deep(.el-table th.is-leaf) {
    border-bottom: 1px solid $color-funeral-border;
  }
}

.summary-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;

  &.highlight-green .summary-value {
    color: $color-status-success;
    font-weight: 600;
  }

  &.total-row {
    padding-top: 10px;
    border-top: 1px dashed $color-funeral-border;
  }

  &.unpaid-row {
    background: rgba($color-status-error, 0.08);
    margin: 0 -8px;
    padding: 10px 8px;
    border-radius: $radius-sm;
  }
}

.summary-label {
  font-size: 13px;
  color: $color-funeral-text-secondary;
}

.summary-value {
  font-size: 14px;
  font-weight: 600;
  color: $color-funeral-text-primary;
  font-family: 'SF Mono', Monaco, monospace;
}

.unpaid-text {
  color: $color-status-error;
  font-size: 18px;
}

.summary-divider {
  height: 1px;
  background: $color-funeral-border;
  margin: 4px 0;
}

.subsidy-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subsidy-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all 0.2s;

  &:hover,
  &.checked {
    border-color: $color-funeral-gold;
    background: rgba($color-funeral-gold, 0.06);
  }
}

.subsidy-info {
  flex: 1;
}

.subsidy-name {
  font-size: 13px;
  font-weight: 600;
  color: $color-funeral-text-primary;
  margin-bottom: 2px;
}

.subsidy-desc {
  font-size: 12px;
  color: $color-funeral-text-muted;
}

.subsidy-amount {
  font-size: 15px;
  font-weight: 700;
  color: $color-status-success;
  font-family: 'SF Mono', Monaco, monospace;
}

.pay-method-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  :deep(.el-radio) {
    margin: 0;
    --el-radio-checked-border-color: $color-funeral-gold;
    --el-radio-checked-fill-color: $color-funeral-gold;
    --el-radio-input-focus-border-color: $color-funeral-gold;
  }

  :deep(.el-radio.is-bordered.is-checked) {
    border-color: $color-funeral-gold;
    background: rgba($color-funeral-gold, 0.1);
    color: $color-funeral-gold;
  }
}

.mixed-pay-form {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed $color-funeral-border;
}

.mixed-pay-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.mixed-method {
  width: 120px;
}

.mixed-amount {
  flex: 1;
}

.add-mixed-btn {
  margin: 4px 0 8px;
}

.mixed-tip {
  font-size: 12px;
  color: $color-funeral-text-muted;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: $radius-sm;

  .ok {
    color: $color-status-success;
    font-weight: 600;
  }

  .warn {
    color: $color-status-warning;
    font-weight: 600;
  }
}

.detail-footer {
  padding: 16px 20px;
  display: flex;
  gap: 10px;
  border-top: 1px solid $color-funeral-border;
  margin-top: auto;

  .pay-btn {
    flex: 1;
    background: linear-gradient(135deg, $color-funeral-gold-light 0%, $color-funeral-gold 50%, $color-funeral-gold-dark 100%);
    border: none;
    font-weight: 700;
    color: #1A1A1F;

    &:hover {
      box-shadow: $shadow-gold-glow;
      transform: translateY(-1px);
    }

    &:disabled {
      background: $color-funeral-border;
      color: $color-funeral-text-muted;
      box-shadow: none;
      transform: none;
    }
  }
}

.empty-detail {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  .empty-icon {
    width: 120px;
    height: 120px;
    margin: 0 auto 16px;
    border-radius: 50%;
    background: rgba($color-funeral-gold, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;

    :deep(.el-icon) {
      width: 60px;
      height: 60px;
      color: rgba($color-funeral-gold, 0.5);
    }
  }
}

.pay-dialog {
  :deep(.el-dialog__body) {
    padding: 20px 24px !important;
  }
}

.pay-amount-box {
  text-align: center;
  padding: 16px 0 20px;
  border-bottom: 1px solid $color-funeral-border;
  margin-bottom: 20px;
}

.pay-label {
  font-size: 13px;
  color: $color-funeral-text-secondary;
  margin-bottom: 8px;
}

.pay-amount {
  font-size: 36px;
  font-weight: 700;
  background: linear-gradient(135deg, $color-funeral-gold-light, $color-funeral-gold);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-family: 'SF Mono', Monaco, monospace;
}

.qr-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
}

.qr-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;

  :deep(.el-icon) {
    width: 28px;
    height: 28px;
    color: #fff;
  }

  &.wechat {
    background: #07C160;
  }

  &.alipay {
    background: #1677FF;
  }
}

.qr-title {
  font-size: 14px;
  font-weight: 600;
  color: $color-funeral-text-primary;
  margin-bottom: 16px;
}

.qr-placeholder {
  width: 200px;
  height: 200px;
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 12px;
}

.qr-grid {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 1px;
}

.qr-cell {
  background: transparent;

  &.filled {
    background: #1A1A1F;
    border-radius: 1px;
  }
}

.qr-tip {
  font-size: 12px;
  color: $color-funeral-text-muted;
}

.card-box,
.cash-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
}

.card-icon,
.cash-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: linear-gradient(135deg, $color-funeral-gold, $color-funeral-gold-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;

  :deep(.el-icon) {
    width: 28px;
    height: 28px;
    color: #1A1A1F;
  }
}

.card-title,
.cash-title {
  font-size: 14px;
  font-weight: 600;
  color: $color-funeral-text-primary;
  margin-bottom: 16px;
}

.card-steps {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: $radius-sm;
  font-size: 13px;
  color: $color-funeral-text-secondary;
}

.step-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, $color-funeral-gold, $color-funeral-gold-dark);
  color: #1A1A1F;
  font-weight: 700;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cash-form {
  width: 100%;

  :deep(.el-form-item) {
    margin-bottom: 14px;
  }
}

.cash-amount {
  font-size: 18px;
  font-weight: 700;
  color: $color-funeral-gold;
  font-family: 'SF Mono', Monaco, monospace;
}

.cash-change {
  font-size: 18px;
  font-weight: 700;
  font-family: 'SF Mono', Monaco, monospace;
  color: $color-status-success;

  &.negative {
    color: $color-status-error;
  }
}

.pay-success {
  padding: 20px 0;
  text-align: center;
}

.success-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: rgba($color-status-success, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;

  :deep(.el-icon) {
    width: 48px;
    height: 48px;
    color: $color-status-success;
  }
}

.success-title {
  font-size: 22px;
  font-weight: 700;
  color: $color-status-success;
  margin-bottom: 10px;
}

.success-amount {
  font-size: 14px;
  color: $color-funeral-text-secondary;
  margin-bottom: 24px;
}

.invoice-link-box {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  background: rgba($color-funeral-gold, 0.08);
  border: 1px solid rgba($color-funeral-gold, 0.3);
  border-radius: $radius-md;
  text-align: left;

  :deep(.el-icon) {
    width: 36px;
    height: 36px;
    color: $color-funeral-gold;
    flex-shrink: 0;
  }
}

.invoice-info {
  flex: 1;
}

.invoice-label {
  font-size: 12px;
  color: $color-funeral-text-muted;
  margin-bottom: 4px;
}

.invoice-link {
  font-size: 14px;
  font-weight: 600;
  color: $color-funeral-gold;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.pay-dialog-footer {
  .confirm-pay-btn {
    background: linear-gradient(135deg, $color-funeral-gold-light, $color-funeral-gold);
    border: none;
    color: #1A1A1F;
    font-weight: 700;

    &:hover {
      box-shadow: $shadow-gold-glow;
    }
  }
}
</style>
