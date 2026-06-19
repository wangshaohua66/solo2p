<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import * as ElIcons from '@element-plus/icons-vue'
import SectionPanel from '@/components/SectionPanel.vue'
import SeatMap from '@/components/SeatMap.vue'
import { bookingApi, memberApi } from '@/api'
import type { ScheduleItem, Seat, Hall, Member } from '@/types'

const loading = ref(true)
const schedules = ref<ScheduleItem[]>([])
const members = ref<Member[]>([])
const activeSchedule = ref<ScheduleItem | null>(null)
const seats = ref<Seat[]>([])
const hall = ref<Hall | null>(null)

const selectedMemberId = ref('')
const usePoints = ref(0)
const orderResult = ref<{ orderId: string; totalAmount: number; payAmount: number; discount: number; qrCode: string } | null>(null)
const paying = ref(false)

onMounted(async () => {
  const [sch, ms] = await Promise.all([bookingApi.getOnSaleSchedules(), memberApi.getMembers()])
  schedules.value = sch
  members.value = ms
  loading.value = false
  if (sch.length) await selectSchedule(sch[0])
})

async function selectSchedule(s: ScheduleItem) {
  orderResult.value = null
  const data = await bookingApi.getSeats(s.id)
  seats.value = data.seats
  hall.value = data.hall
  activeSchedule.value = s
}

function onSeatToggle(seat: Seat) {
  const target = seats.value.find((s) => s.id === seat.id)
  if (!target) return
  target.status = target.status === 'selected' ? 'available' : 'selected'
  usePoints.value = 0
  orderResult.value = null
}

const selectedSeats = computed(() => seats.value.filter((s) => s.status === 'selected'))
const totalAmount = computed(() => selectedSeats.value.reduce((sum, s) => sum + s.price, 0))
const maxPoints = computed(() => {
  const m = members.value.find((x) => x.id === selectedMemberId.value)
  if (!m) return 0
  return Math.min(m.points, totalAmount.value * 100 * 0.5)
})
const discount = computed(() => Math.min(usePoints.value / 100, totalAmount.value * 0.5))
const payAmount = computed(() => Math.max(0, totalAmount.value - discount.value))

const qrDots = computed(() => {
  if (!orderResult.value) return []
  const seed = orderResult.value.qrCode.length
  const dots: { x: number; y: number }[] = []
  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 11; c++) {
      if ((r * 7 + c * 3 + seed) % 3 === 0) dots.push({ x: 8 + c * 8, y: 8 + r * 8 })
    }
  }
  return dots
})

async function lockAndPay() {
  if (!selectedSeats.value.length) {
    ElMessage.warning('请先选择座位')
    return
  }
  paying.value = true
  const ids = selectedSeats.value.map((s) => s.id)
  await bookingApi.lockSeats(ids)
  const res = await bookingApi.createOrder({
    scheduleId: activeSchedule.value!.id,
    seatIds: ids,
    memberId: selectedMemberId.value || undefined,
    usePoints: usePoints.value
  })
  orderResult.value = res
  seats.value = seats.value.map((s) => (ids.includes(s.id) ? { ...s, status: 'sold' } : s))
  paying.value = false
  ElMessage.success('出票成功！电子票已生成')
}

const statusTag: Record<string, string> = { on_sale: '在售', sold_out: '售罄', planned: '待售' }
</script>

<template>
  <div class="booking-page" v-loading="loading">
    <div class="booking-grid">
      <SectionPanel title="场次列表" subtitle="选择影片场次选座购票" class="sched-col">
        <div class="sched-list">
          <div
            v-for="s in schedules"
            :key="s.id"
            class="sched-item"
            :class="{ active: activeSchedule?.id === s.id }"
            @click="selectSchedule(s)"
          >
            <div class="si-time">
              <strong class="num">{{ s.startTime }}</strong>
              <span>{{ s.endTime }}散场</span>
            </div>
            <div class="si-body">
              <strong>{{ s.movieName }}</strong>
              <div class="si-meta">
                <span>{{ s.cinemaName.split('·')[1] }}</span>
                <span>{{ s.hallName.split(' ').slice(-1)[0] }}</span>
              </div>
            </div>
            <div class="si-right">
              <span class="si-price num">¥{{ s.price }}</span>
              <el-tag size="small" :type="s.status === 'on_sale' ? 'success' : 'info'" effect="dark" round>{{ statusTag[s.status] }}</el-tag>
              <div class="si-fill">
                <span>{{ Math.round((s.seatsSold / s.seatsTotal) * 100) }}% 已售</span>
                <div class="fill-bar"><i :style="{ width: `${(s.seatsSold / s.seatsTotal) * 100}%` }" /></div>
              </div>
            </div>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel v-if="activeSchedule" :title="`座位图 · ${activeSchedule.movieName}`" :subtitle="`${activeSchedule.cinemaName} · ${activeSchedule.hallName} · ${activeSchedule.startTime}场次`" no-padding class="seat-col">
        <div class="screen-info">
          <span>{{ hall?.type }}厅</span>
          <span>共 {{ hall?.capacity }} 座</span>
          <span>清洁间隔 15 分钟</span>
        </div>
        <SeatMap :seats="seats" :hall="hall!" @toggle="onSeatToggle" />
      </SectionPanel>

      <SectionPanel title="订单确认" subtitle="选座 → 锁定 → 支付 → 出票" class="order-col">
        <template v-if="!orderResult">
          <div class="order-movie" v-if="activeSchedule">
            <div class="om-poster" :style="{ background: `linear-gradient(135deg, hsl(${(activeSchedule.movieName.length * 37) % 360} 45% 35%), hsl(${(activeSchedule.movieName.length * 37 + 40) % 360} 50% 22%))` }">
              <span>{{ activeSchedule.movieName[0] }}</span>
            </div>
            <div class="om-info">
              <strong>{{ activeSchedule.movieName }}</strong>
              <span>{{ activeSchedule.startTime }} · {{ activeSchedule.hallName.split(' ').slice(-1)[0] }}</span>
              <span>{{ activeSchedule.date }}</span>
            </div>
          </div>

          <div class="seat-summary">
            <div class="ss-head">已选座位（{{ selectedSeats.length }}）</div>
            <div class="ss-list" v-if="selectedSeats.length">
              <el-tag v-for="s in selectedSeats" :key="s.id" class="seat-tag" effect="dark" round>
                {{ s.row }}排{{ s.col }}座<span class="num">¥{{ s.price }}</span>
              </el-tag>
            </div>
            <div v-else class="ss-empty">点击左侧座位图选择座位</div>
          </div>

          <el-divider />

          <div class="member-row">
            <span>会员卡</span>
            <el-select v-model="selectedMemberId" placeholder="选择会员（可享积分抵扣）" clearable size="small" style="width: 200px">
              <el-option v-for="m in members" :key="m.id" :label="`${m.name}（${m.points}积分）`" :value="m.id" />
            </el-select>
          </div>
          <div class="member-row" v-if="selectedMemberId">
            <span>积分抵扣</span>
            <div class="points-input">
              <el-slider v-model="usePoints" :max="maxPoints" :step="100" show-input :show-input-controls="false" size="small" style="flex: 1" />
              <span class="points-tip">最多抵 ¥{{ (maxPoints / 100).toFixed(0) }}</span>
            </div>
          </div>

          <el-divider />

          <div class="amount-row">
            <span>票款小计</span>
            <span class="num">¥{{ totalAmount.toFixed(2) }}</span>
          </div>
          <div class="amount-row discount" v-if="discount > 0">
            <span>积分抵扣</span>
            <span class="num">-¥{{ discount.toFixed(2) }}</span>
          </div>
          <div class="amount-row total">
            <span>实付金额</span>
            <span class="num gold-text">¥{{ payAmount.toFixed(2) }}</span>
          </div>

          <el-button type="primary" size="large" class="pay-btn" :loading="paying" :icon="(ElIcons as any).Wallet" @click="lockAndPay">
            锁座并支付
          </el-button>
        </template>

        <template v-else>
          <div class="ticket">
            <div class="ticket-top">
              <div class="ticket-notch left" /><div class="ticket-notch right" />
              <div class="tt-icon"><component :is="(ElIcons as any).CircleCheckFilled" /></div>
              <strong class="display">支付成功</strong>
              <span class="num">订单号 {{ orderResult.orderId }}</span>
            </div>
            <div class="ticket-qr">
              <div class="qr-box">
                <svg viewBox="0 0 100 100" width="120" height="120">
                <rect width="100" height="100" fill="#fff" rx="6" />
                <g fill="#0b0b12">
                  <rect v-for="(d, i) in qrDots" :key="i" :x="d.x" :y="d.y" width="6" height="6" />
                </g>
                <rect x="36" y="36" width="28" height="28" fill="#fff" stroke="#0b0b12" stroke-width="2" />
                <text x="50" y="55" text-anchor="middle" fill="#E8B547" font-size="18" font-weight="bold">光</text>
              </svg>
              </div>
              <p class="qr-tip">扫码入场</p>
            </div>
            <div class="ticket-detail">
              <div><span>影片</span><strong>{{ activeSchedule?.movieName }}</strong></div>
              <div><span>场次</span><strong>{{ activeSchedule?.startTime }} · {{ activeSchedule?.hallName.split(' ').slice(-1)[0] }}</strong></div>
              <div><span>座位</span><strong>{{ selectedSeats.map(s => `${s.row}排${s.col}座`).join('、') }}</strong></div>
              <div><span>实付</span><strong class="num gold-text">¥{{ orderResult.payAmount.toFixed(2) }}</strong></div>
            </div>
          </div>
        </template>
      </SectionPanel>
    </div>
  </div>
</template>

<style scoped lang="scss">
.booking-page {
  min-height: 100%;
}
.booking-grid {
  display: grid;
  grid-template-columns: 320px 1fr 320px;
  gap: 18px;
  align-items: start;
}

.sched-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 600px;
  overflow-y: auto;
  @include scrollbar-dark;
}
.sched-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--c-border);
  cursor: pointer;
  transition: all 0.2s ease;
  &:hover {
    border-color: $gold-line;
    background: $gold-soft;
  }
  &.active {
    border-color: $gold;
    background: $gold-soft;
    box-shadow: $shadow-gold;
  }
}
.si-time {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  strong {
    font-size: 18px;
    color: $gold;
  }
  span {
    font-size: 10px;
    color: var(--c-text-tertiary);
  }
}
.si-body {
  flex: 1;
  min-width: 0;
  strong {
    font-size: 13px;
    color: var(--c-text-primary);
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
.si-meta {
  display: flex;
  flex-direction: column;
  font-size: 11px;
  color: var(--c-text-tertiary);
  margin-top: 4px;
}
.si-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  .si-price {
    font-size: 16px;
    color: $gold;
    font-weight: 600;
  }
}
.si-fill {
  font-size: 10px;
  color: var(--c-text-tertiary);
  text-align: right;
  .fill-bar {
    width: 60px;
    height: 3px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 2px;
    i {
      display: block;
      height: 100%;
      background: $grad-gold;
    }
  }
}

.screen-info {
  display: flex;
  gap: 20px;
  padding: 12px 22px;
  border-bottom: 1px solid var(--c-border);
  font-size: 12px;
  color: var(--c-text-secondary);
  span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    &::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: $gold;
    }
  }
}

.order-col {
  position: sticky;
  top: 0;
}
.order-movie {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  .om-poster {
    width: 50px;
    height: 68px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.85);
    font-family: var(--font-display);
  }
  .om-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    strong {
      font-size: 15px;
      color: var(--c-text-primary);
    }
    span {
      font-size: 12px;
      color: var(--c-text-tertiary);
    }
  }
}
.seat-summary {
  .ss-head {
    font-size: 12px;
    color: var(--c-text-secondary);
    margin-bottom: 10px;
  }
  .ss-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .seat-tag {
    :deep(span) {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .num {
      color: $gold;
      font-weight: 600;
      margin-left: 4px;
    }
  }
  .ss-empty {
    font-size: 12px;
    color: var(--c-text-tertiary);
    padding: 10px 0;
  }
}
.member-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--c-text-secondary);
}
.points-input {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  max-width: 240px;
}
.points-tip {
  font-size: 11px;
  color: $gold;
  white-space: nowrap;
}
.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
  color: var(--c-text-secondary);
  .num {
    color: var(--c-text-primary);
    font-weight: 600;
  }
  &.discount .num {
    color: $success;
  }
  &.total {
    font-size: 16px;
    padding-top: 12px;
    border-top: 1px dashed var(--c-border);
    margin-top: 6px;
    .num {
      font-size: 24px;
    }
  }
}
.pay-btn {
  width: 100%;
  margin-top: 16px;
  height: 46px;
  font-size: 15px;
}

.ticket {
  text-align: center;
}
.ticket-top {
  position: relative;
  padding: 16px 0;
  border-bottom: 1px dashed var(--c-border);
  .tt-icon {
    font-size: 42px;
    color: $success;
    margin-bottom: 8px;
  }
  strong {
    display: block;
    font-size: 18px;
    color: var(--c-text-primary);
  }
  span {
    font-size: 12px;
    color: var(--c-text-tertiary);
  }
  .ticket-notch {
    position: absolute;
    top: 50%;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: $bg-card;
    transform: translateY(-50%);
    &.left {
      left: -22px;
    }
    &.right {
      right: -22px;
    }
  }
}
.ticket-qr {
  padding: 20px 0;
  .qr-box {
    display: inline-block;
    padding: 10px;
    background: #fff;
    border-radius: 10px;
    box-shadow: $shadow-gold;
  }
  .qr-tip {
    font-size: 12px;
    color: $gold;
    margin-top: 8px;
    letter-spacing: 0.1em;
  }
}
.ticket-detail {
  text-align: left;
  div {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--c-border);
    font-size: 13px;
    &:last-child {
      border-bottom: none;
    }
    span {
      color: var(--c-text-tertiary);
    }
    strong {
      color: var(--c-text-primary);
    }
  }
}
</style>
