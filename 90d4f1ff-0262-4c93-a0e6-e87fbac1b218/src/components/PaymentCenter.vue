<template>
  <div class="payment-center-wrapper">
    <div class="page-container">
      <div class="content-layout">
        <div class="main-content">
          <div class="card mb-4">
            <div class="card-title">
              <el-icon><Wallet /></el-icon>
              待支付订单
            </div>
            <el-table
              v-loading="billingStore.loading"
              :data="pendingOrders"
              stripe
              @selection-change="handleSelectionChange"
              style="width: 100%"
            >
              <el-table-column type="selection" width="50" />
              <el-table-column prop="orderNo" label="订单号" width="200" />
              <el-table-column label="类型" width="100">
                <template #default="{ row }">
                  <el-tag size="small" :type="orderTypeTag(row.type)">
                    {{ orderTypeLabel(row.type) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="relatedId" label="关联单号" width="140" />
              <el-table-column label="金额" width="120">
                <template #default="{ row }">
                  <span class="amount-text">¥{{ row.amount.toFixed(2) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="orderStatusTag(row.status)" effect="light" size="small">
                    {{ orderStatusLabel(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="createdAt" label="创建时间" width="170">
                <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="120" fixed="right">
                <template #default="{ row }">
                  <el-button type="primary" size="small" link @click="paySingleOrder(row)">
                    立即支付
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-if="pendingOrders.length === 0" description="暂无待支付订单" />
          </div>

          <div v-if="selectedOrders.length > 0 || currentCalculation" class="card mb-4">
            <div class="card-title">
              <el-icon><Coin /></el-icon>
              费用明细
            </div>
            <div v-if="currentCalculation" class="calculation-detail">
              <el-descriptions :column="2" border size="default">
                <el-descriptions-item label="基础金额">¥{{ currentCalculation.baseAmount.toFixed(2) }}</el-descriptions-item>
                <el-descriptions-item label="停车费用">¥{{ currentCalculation.parkingAmount.toFixed(2) }}</el-descriptions-item>
                <el-descriptions-item label="充电费用">¥{{ currentCalculation.chargingAmount.toFixed(2) }}</el-descriptions-item>
                <el-descriptions-item label="会员折扣">-¥{{ currentCalculation.memberDiscount.toFixed(2) }}</el-descriptions-item>
                <el-descriptions-item label="每日封顶" v-if="currentCalculation.dailyCapApplied">
                  <el-tag type="warning" effect="dark">已启用</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="应付金额">
                  <span class="total-amount">¥{{ currentCalculation.totalAmount.toFixed(2) }}</span>
                </el-descriptions-item>
              </el-descriptions>
              <el-collapse class="mt-4">
                <el-collapse-item title="查看详细规则">
                  <div class="rule-detail" v-for="(d, i) in currentCalculation.details" :key="i">
                    <span>{{ d.description }}</span>
                    <span :class="d.amount < 0 ? 'discount' : 'normal'">
                      {{ d.amount < 0 ? '-' : '+' }}¥{{ Math.abs(d.amount).toFixed(2) }}
                    </span>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
            <div v-else class="selected-summary">
              已选择 <strong>{{ selectedOrders.length }}</strong> 笔订单，
              合计金额：<span class="total-amount">¥{{ selectedTotal.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <div class="payment-sidebar">
          <div class="payment-card card">
            <div class="card-title">
              <el-icon><CreditCard /></el-icon>
              支付结算
            </div>

            <div class="account-balance">
              <div class="balance-label">账户余额</div>
              <div class="balance-amount">¥{{ authStore.user?.balance?.toFixed(2) || '0.00' }}</div>
            </div>

            <div class="pay-amount">
              <div class="pay-label">支付金额</div>
              <div class="pay-amount-value">¥{{ finalAmount.toFixed(2) }}</div>
            </div>

            <div class="divider-title">选择支付方式</div>
            <div class="payment-methods">
              <div
                v-for="method in paymentMethods"
                :key="method.value"
                class="method-item"
                :class="{ active: selectedMethod === method.value, disabled: method.disabled }"
                @click="!method.disabled && (selectedMethod = method.value)"
              >
                <el-icon class="method-icon" :style="{ color: method.color }">
                  <component :is="method.icon" />
                </el-icon>
                <div class="method-info">
                  <div class="method-name">{{ method.label }}</div>
                  <div class="method-desc">{{ method.desc }}</div>
                </div>
                <el-radio :model-value="selectedMethod" :label="method.value" :disabled="method.disabled" />
              </div>
            </div>

            <div class="coupon-row">
              <el-input placeholder="请输入优惠码" v-model="couponCode" size="default">
                <template #append>
                  <el-button @click="applyCoupon">使用</el-button>
                </template>
              </el-input>
            </div>

            <div class="agreement-row">
              <el-checkbox v-model="agreeTerms">
                我已阅读并同意<a href="javascript:;">《支付服务协议》</a>
              </el-checkbox>
            </div>

            <el-button
              class="pay-button"
              type="primary"
              size="large"
              :disabled="!canPay"
              :loading="paying"
              @click="handlePay"
            >
              <template v-if="paying">
                <el-icon class="is-loading"><Loading /></el-icon>
                支付处理中...
              </template>
              <template v-else>
                立即支付 ¥{{ finalAmount.toFixed(2) }}
              </template>
            </el-button>

            <div class="secure-info">
              <el-icon><Lock /></el-icon>
              <span>SSL加密传输，保障您的支付安全</span>
            </div>
          </div>

          <div class="card mt-4">
            <div class="card-title">
              <el-icon><Document /></el-icon>
              开票申请
            </div>
            <el-alert
              title="支付完成后可在订单详情中申请电子发票"
              type="info"
              :closable="false"
              show-icon
            />
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="payDialogVisible" title="扫码支付" width="380px" align-center>
      <div class="qr-dialog">
        <div class="qr-tip">请使用{{ selectedMethodLabel }}扫一扫完成支付</div>
        <div class="qr-box">
          <div class="qr-placeholder">
            <el-icon :size="64" color="#409eff"><CreditCard /></el-icon>
            <p>支付二维码</p>
            <p class="qr-amount">¥{{ finalAmount.toFixed(2) }}</p>
          </div>
        </div>
        <div class="qr-countdown">
          <el-progress
            type="circle"
            :percentage="qrCountdownPercent"
            :stroke-width="4"
            :width="60"
          />
          <span>二维码将在 <strong>{{ qrCountdown }}</strong> 秒后失效</span>
        </div>
        <el-button class="refresh-qr" text @click="refreshQrCode">
          <el-icon><Refresh /></el-icon>刷新二维码
        </el-button>
      </div>
    </el-dialog>

    <div class="payment-footer">
      <div class="footer-content">
        <div class="footer-info">
          <span class="footer-label">合计：</span>
          <span class="footer-amount">¥{{ finalAmount.toFixed(2) }}</span>
        </div>
        <el-button
          class="footer-pay-btn"
          type="primary"
          size="large"
          :disabled="!canPay"
          :loading="paying"
          @click="handlePay"
        >
          <template v-if="paying">
            <el-icon class="is-loading spin-icon"><Loading /></el-icon>
            支付处理中...
          </template>
          <template v-else>
            立即支付
          </template>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Wallet, Coin, CreditCard, Lock, Document, Loading, Refresh,
  ChatDotRound, Money, Avatar
} from '@element-plus/icons-vue'
import { useBillingStore } from '@/stores/billing'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils'
import type { PaymentOrder, PaymentMethod, BillingCalculation } from '@/types'

const billingStore = useBillingStore()
const authStore = useAuthStore()

const selectedOrders = ref<PaymentOrder[]>([])
const selectedMethod = ref<PaymentMethod>('WeChat')
const couponCode = ref('')
const agreeTerms = ref(false)
const paying = ref(false)
const payDialogVisible = ref(false)
const qrCountdown = ref(180)
const currentCalculation = ref<BillingCalculation | null>(null)
let qrTimer: ReturnType<typeof setInterval> | null = null

const pendingOrders = computed(() =>
  billingStore.orders.items.filter(o => o.status === 'Pending')
)

const selectedTotal = computed(() =>
  selectedOrders.value.reduce((sum, o) => sum + o.amount, 0)
)

const finalAmount = computed(() => {
  if (currentCalculation.value) return currentCalculation.value.totalAmount
  return selectedTotal.value
})

const canPay = computed(() =>
  (selectedOrders.value.length > 0 || currentCalculation.value) &&
  finalAmount.value > 0 &&
  agreeTerms.value &&
  !paying.value
)

interface PaymentMethodOption {
  value: PaymentMethod
  label: string
  desc: string
  icon: any
  color: string
  disabled?: boolean
}

const paymentMethods: PaymentMethodOption[] = [
  { value: 'WeChat', label: '微信支付', desc: '推荐使用', icon: ChatDotRound, color: '#07C160' },
  { value: 'Alipay', label: '支付宝', desc: '支付宝快捷支付', icon: Money, color: '#1677FF' },
  {
    value: 'Balance',
    label: '余额支付',
    desc: `可用余额 ¥${authStore.user?.balance?.toFixed(2) || '0.00'}`,
    icon: Avatar,
    color: '#F59E0B',
    disabled: (authStore.user?.balance || 0) < finalAmount.value
  }
]

const selectedMethodLabel = computed(() =>
  paymentMethods.find(m => m.value === selectedMethod.value)?.label || ''
)

const qrCountdownPercent = computed(() => Math.round((qrCountdown.value / 180) * 100))

const orderTypeLabel = (t: string) => ({ Parking: '停车', Charging: '充电', Reservation: '预约' }[t] || t)
const orderTypeTag = (t: string) => ({ Parking: 'primary', Charging: 'success', Reservation: 'warning' }[t] || 'info') as 'primary' | 'success' | 'warning' | 'info'

const orderStatusLabel = (s: string) => ({
  Pending: '待支付', Paid: '已支付', Refunding: '退款中', Refunded: '已退款', Cancelled: '已取消'
}[s] || s)

const orderStatusTag = (s: string) => ({
  Pending: 'warning', Paid: 'success', Refunding: 'primary', Refunded: 'info', Cancelled: 'danger'
}[s] || 'info') as 'warning' | 'success' | 'primary' | 'info' | 'danger'

const handleSelectionChange = (rows: PaymentOrder[]) => {
  selectedOrders.value = rows
}

const paySingleOrder = (order: PaymentOrder) => {
  selectedOrders.value = [order]
  payDialogVisible.value = true
  startQrCountdown()
}

const handlePay = async () => {
  if (!canPay.value) return

  if (selectedMethod.value === 'Balance') {
    await ElMessageBox.confirm(
      `确认使用余额支付 ¥${finalAmount.value.toFixed(2)}？`,
      '余额支付',
      { type: 'warning' }
    )
  }

  paying.value = true
  try {
    if (selectedOrders.value.length > 0) {
      await Promise.all(
        selectedOrders.value.map(o =>
          billingStore.payOrder(o.id, selectedMethod.value)
        )
      )
    }
    ElMessage.success('支付成功')
    payDialogVisible.value = false
    selectedOrders.value = []
    currentCalculation.value = null
    await billingStore.fetchOrders({ pageIndex: 1, pageSize: 50, status: 'Pending' })
  } catch (e: any) {
    ElMessage.error(e.message || '支付失败')
  } finally {
    paying.value = false
    stopQrCountdown()
  }
}

const startQrCountdown = () => {
  qrCountdown.value = 180
  stopQrCountdown()
  qrTimer = setInterval(() => {
    qrCountdown.value--
    if (qrCountdown.value <= 0) {
      stopQrCountdown()
    }
  }, 1000)
}

const stopQrCountdown = () => {
  if (qrTimer) {
    clearInterval(qrTimer)
    qrTimer = null
  }
}

const refreshQrCode = () => {
  startQrCountdown()
  ElMessage.success('二维码已刷新')
}

const applyCoupon = () => {
  if (!couponCode.value) {
    ElMessage.warning('请输入优惠码')
    return
  }
  ElMessage.success('优惠码验证成功')
}

onMounted(async () => {
  await billingStore.fetchOrders({ pageIndex: 1, pageSize: 50, status: 'Pending' })
})
</script>

<style lang="scss" scoped>
.payment-center-wrapper { width: 100%; padding-bottom: 80px; }
.mb-4 { margin-bottom: 16px; }
.mt-4 { margin-top: 16px; }

.content-layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 16px;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
}

.amount-text {
  color: var(--danger-color);
  font-weight: 600;
}

.total-amount {
  color: var(--danger-color);
  font-size: 20px;
  font-weight: 700;
}

.selected-summary {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  text-align: center;
}

.calculation-detail {
  .rule-detail {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px dashed #ebeef5;

    &:last-child { border-bottom: none; }

    .discount { color: var(--success-color); }
    .normal { color: var(--danger-color); }
  }
}

.payment-sidebar {
  position: sticky;
  top: 16px;
  align-self: flex-start;
}

.payment-card {
  position: sticky;
  top: 0;
}

.account-balance {
  text-align: center;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: #fff;
  margin-bottom: 16px;

  .balance-label { font-size: 12px; opacity: 0.9; }
  .balance-amount { font-size: 28px; font-weight: 700; margin-top: 4px; }
}

.pay-amount {
  text-align: center;
  padding: 12px;
  background: #fef0f0;
  border-radius: 6px;
  margin-bottom: 16px;

  .pay-label { font-size: 12px; color: #909399; }
  .pay-amount-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--danger-color);
    margin-top: 4px;
  }
}

.divider-title {
  font-size: 13px;
  color: #606266;
  margin-bottom: 10px;
}

.payment-methods {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.method-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1.5px solid #ebeef5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(.disabled) { border-color: #b3d8ff; }

  &.active {
    border-color: var(--primary-color);
    background: #ecf5ff;
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .method-icon { font-size: 28px; }

  .method-info {
    flex: 1;

    .method-name { font-size: 14px; font-weight: 600; color: #303133; }
    .method-desc { font-size: 12px; color: #909399; margin-top: 2px; }
  }
}

.coupon-row { margin-bottom: 12px; }

.agreement-row {
  font-size: 12px;
  color: #606266;
  margin-bottom: 16px;

  a { color: var(--primary-color); text-decoration: none; }
}

.pay-button {
  width: 100%;
  height: 46px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #f56c6c 0%, #e6a23c 100%);
  border: none;
  display: none;

  &:hover { opacity: 0.9; }

  &:disabled {
    background: #dcdfe6;
    cursor: not-allowed;
  }
}

.secure-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 12px;
  color: #909399;
}

.qr-dialog {
  text-align: center;

  .qr-tip {
    font-size: 14px;
    color: #606266;
    margin-bottom: 16px;
  }

  .qr-box {
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }

  .qr-placeholder {
    width: 200px;
    height: 200px;
    border: 1px dashed #dcdfe6;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #fafafa;

    p { margin: 0; color: #606266; }

    .qr-amount {
      font-size: 22px;
      font-weight: 700;
      color: var(--danger-color);
    }
  }

  .qr-countdown {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #909399;
    font-size: 13px;

    strong { color: var(--danger-color); }
  }

  .refresh-qr {
    margin-top: 12px;
    color: var(--primary-color);
  }
}

.payment-footer {
  position: fixed;
  left: 0;
  bottom: 0;
  right: 0;
  background: #fff;
  border-top: 1px solid #ebeef5;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.08);
  z-index: 100;
  padding: 12px 20px;

  .footer-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 1400px;
    margin: 0 auto;
  }

  .footer-info {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .footer-label {
    font-size: 14px;
    color: #606266;
  }

  .footer-amount {
    font-size: 24px;
    font-weight: 700;
    color: var(--danger-color);
  }

  .footer-pay-btn {
    min-width: 160px;
    height: 44px;
    font-size: 16px;
    font-weight: 600;
    background: linear-gradient(135deg, #f56c6c 0%, #e6a23c 100%);
    border: none;
    border-radius: 22px;
    transition: all 0.3s;

    &:hover:not(:disabled) {
      opacity: 0.9;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(245, 108, 108, 0.35);
    }

    &:disabled {
      background: #dcdfe6;
      cursor: not-allowed;
      color: #fff;
    }

    .spin-icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  }

  @media (max-width: 768px) {
    padding: 10px 16px;

    .footer-amount {
      font-size: 20px;
    }

    .footer-pay-btn {
      min-width: 120px;
      height: 40px;
      font-size: 14px;
    }
  }
}
</style>
