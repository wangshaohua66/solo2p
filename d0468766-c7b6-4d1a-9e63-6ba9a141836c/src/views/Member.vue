<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import * as ElIcons from '@element-plus/icons-vue'
import SectionPanel from '@/components/SectionPanel.vue'
import StatCard from '@/components/StatCard.vue'
import { memberApi } from '@/api'
import type { Member, MemberLevel } from '@/types'

const loading = ref(true)
const members = ref<Member[]>([])
const search = ref('')
const levelFilter = ref<string>('')
const activeId = ref('')

onMounted(async () => {
  members.value = await memberApi.getMembers()
  loading.value = false
  if (members.value.length) activeId.value = members.value[0].id
})

const filtered = computed(() =>
  members.value.filter(
    (m) =>
      (!search.value || m.name.includes(search.value) || m.phone.includes(search.value)) &&
      (!levelFilter.value || m.level === levelFilter.value)
  )
)
const active = computed(() => members.value.find((m) => m.id === activeId.value))

const stats = computed(() => ({
  total: members.value.length,
  points: members.value.reduce((s, m) => s + m.points, 0),
  balance: members.value.reduce((s, m) => s + m.balance, 0),
  diamond: members.value.filter((m) => m.level === 'diamond').length
}))

const levelMeta: Record<MemberLevel, { text: string; color: string; bg: string; perk: string }> = {
  diamond: { text: '钻石', color: '#60A5FA', bg: 'linear-gradient(135deg,#1e3a5f,#0f1e30)', perk: '免充值订座·生日双倍积分' },
  platinum: { text: '铂金', color: '#E5E7EB', bg: 'linear-gradient(135deg,#374151,#1f2937)', perk: '专享兑换券·每月赠票' },
  gold: { text: '黄金', color: '#E8B547', bg: 'linear-gradient(135deg,#3d2f0a,#1f1705)', perk: '积分9折兑换' },
  silver: { text: '白银', color: '#9CA3AF', bg: 'linear-gradient(135deg,#2d3338,#181c20)', perk: '基础积分累计' }
}

async function grantBirthday(m: Member) {
  await memberApi.addPoints(m.id, 500)
  ElMessage.success(`${m.name} 生日双倍积分 500 已发放`)
  m.points += 500
}
</script>

<template>
  <div class="member-page" v-loading="loading">
    <div class="stat-row">
      <StatCard label="会员总数" :value="stats.total" unit="人" icon="User" accent="gold" />
      <StatCard label="积分池余额" :value="stats.points" unit="分" icon="Medal" accent="info" />
      <StatCard label="储值余额" :value="stats.balance" prefix="¥" unit="元" icon="Wallet" accent="success" />
      <StatCard label="钻石会员" :value="stats.diamond" unit="人" icon="StarFilled" accent="crimson" />
    </div>

    <div class="member-grid">
      <SectionPanel title="会员档案" subtitle="跨店积分通兑通刷" no-padding class="list-col">
        <template #action>
          <el-input v-model="search" placeholder="搜索姓名/手机" :prefix-icon="(ElIcons as any).Search" size="small" style="width: 180px" clearable />
          <el-select v-model="levelFilter" placeholder="等级" size="small" clearable style="width: 110px">
            <el-option label="钻石" value="diamond" /><el-option label="铂金" value="platinum" /><el-option label="黄金" value="gold" /><el-option label="白银" value="silver" />
          </el-select>
        </template>
        <div class="member-list">
          <div
            v-for="m in filtered"
            :key="m.id"
            class="member-item"
            :class="{ active: m.id === activeId }"
            @click="activeId = m.id"
          >
            <div class="mi-avatar" :style="{ background: levelMeta[m.level].bg, color: levelMeta[m.level].color }">
              {{ m.name[0] }}
            </div>
            <div class="mi-body">
              <div class="mi-name">
                <strong>{{ m.name }}</strong>
                <span class="mi-level" :style="{ color: levelMeta[m.level].color, background: levelMeta[m.level].bg }">{{ levelMeta[m.level].text }}</span>
              </div>
              <span class="mi-phone">{{ m.phone }}</span>
              <div class="mi-points">
                <span><i class="num">{{ m.points }}</i> 积分</span>
                <span>储值 <i class="num">¥{{ m.balance }}</i></span>
              </div>
            </div>
          </div>
        </div>
      </SectionPanel>

      <div class="detail-col" v-if="active">
        <div class="vip-card" :style="{ background: levelMeta[active.level].bg }">
          <div class="vc-glow" />
          <div class="vc-top">
            <div class="vc-brand">
              <span class="display">光影</span>
              <span>VIP 会员卡</span>
            </div>
            <div class="vc-level" :style="{ color: levelMeta[active.level].color }">{{ levelMeta[active.level].text }}</div>
          </div>
          <div class="vc-chip" :style="{ borderColor: levelMeta[active.level].color }">
            <component :is="(ElIcons as any).Cpu" />
          </div>
          <div class="vc-num">{{ active.id }}</div>
          <div class="vc-foot">
            <div>
              <span>持卡人</span>
              <strong>{{ active.name }}</strong>
            </div>
            <div>
              <span>归属影院</span>
              <strong>{{ active.homeCinema.split('·')[1] }}</strong>
            </div>
          </div>
        </div>

        <SectionPanel title="积分与权益" subtitle="全院线15家影院通兑通刷">
          <div class="points-row">
            <div class="point-box gold">
              <component :is="(ElIcons as any).Medal" />
              <strong class="num">{{ active.points }}</strong>
              <span>可用积分</span>
            </div>
            <div class="point-box">
              <component :is="(ElIcons as any).Wallet" />
              <strong class="num">¥{{ active.balance }}</strong>
              <span>储值余额</span>
            </div>
            <div class="point-box">
              <component :is="(ElIcons as any).Money" />
              <strong class="num">¥{{ active.totalSpent.toLocaleString() }}</strong>
              <span>累计消费</span>
            </div>
          </div>
          <div class="perk-box">
            <component :is="(ElIcons as any).MagicStick" />
            <div>
              <strong>{{ levelMeta[active.level].text }}会员专属权益</strong>
              <span>{{ levelMeta[active.level].perk }} · 全院线通兑</span>
            </div>
            <el-button size="small" type="primary" round @click="grantBirthday(active)">发放生日权益</el-button>
          </div>
        </SectionPanel>

        <SectionPanel title="优惠券包" subtitle="跨店通用券与专属券">
          <div class="coupon-list">
            <div v-for="c in active.coupons" :key="c.id" class="coupon-item">
              <div class="cp-left" :class="c.type">
                <strong class="num">{{ c.type === 'discount' ? `${c.value}折` : c.type === 'cash' ? `¥${c.value}` : '兑' }}</strong>
              </div>
              <div class="cp-right">
                <strong>{{ c.name }}</strong>
                <span>有效期至 {{ c.expireDate }}</span>
              </div>
              <el-button size="small" :disabled="c.used" round>{{ c.used ? '已使用' : '使用' }}</el-button>
            </div>
            <div v-if="!active.coupons.length" class="empty-tip">暂无优惠券</div>
          </div>
        </SectionPanel>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.member-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}
.member-grid {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 18px;
  align-items: start;
}
.member-list {
  display: flex;
  flex-direction: column;
  max-height: 580px;
  overflow-y: auto;
  @include scrollbar-dark;
}
.member-item {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--c-border);
  cursor: pointer;
  transition: background 0.2s ease;
  &:hover {
    background: rgba(232, 181, 71, 0.04);
  }
  &.active {
    background: $gold-soft;
    border-left: 3px solid $gold;
    padding-left: 13px;
  }
}
.mi-avatar {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  flex-shrink: 0;
}
.mi-body {
  flex: 1;
  min-width: 0;
}
.mi-name {
  display: flex;
  align-items: center;
  gap: 8px;
  strong {
    font-size: 14px;
    color: var(--c-text-primary);
  }
}
.mi-level {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}
.mi-phone {
  font-size: 11px;
  color: var(--c-text-tertiary);
}
.mi-points {
  display: flex;
  gap: 14px;
  font-size: 11px;
  color: var(--c-text-secondary);
  margin-top: 3px;
  i {
    color: $gold;
    font-weight: 600;
  }
}

.detail-col {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.vip-card {
  position: relative;
  border-radius: $radius-lg;
  padding: 24px 28px;
  border: 1px solid $gold-line;
  overflow: hidden;
  min-height: 180px;
  @include film-grain;
  box-shadow: $shadow-card;
}
.vc-glow {
  position: absolute;
  top: -50%;
  right: -10%;
  width: 60%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.08), transparent 60%);
}
.vc-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.vc-brand {
  display: flex;
  flex-direction: column;
  span:first-child {
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.05em;
  }
  span:last-child {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    letter-spacing: 0.15em;
  }
}
.vc-level {
  font-size: 22px;
  font-weight: 700;
  font-family: var(--font-display);
  letter-spacing: 0.1em;
}
.vc-chip {
  position: absolute;
  top: 80px;
  right: 28px;
  width: 36px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
.vc-num {
  font-family: var(--font-num);
  font-size: 18px;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.2em;
  margin-top: 18px;
}
.vc-foot {
  display: flex;
  gap: 40px;
  margin-top: 14px;
  div {
    display: flex;
    flex-direction: column;
    span {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.5);
    }
    strong {
      font-size: 14px;
      color: #fff;
    }
  }
}

.points-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}
.point-box {
  text-align: center;
  padding: 18px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--c-border);
  svg {
    font-size: 22px;
    color: var(--c-text-tertiary);
    margin-bottom: 8px;
  }
  strong {
    display: block;
    font-size: 24px;
    color: var(--c-text-primary);
  }
  span {
    font-size: 12px;
    color: var(--c-text-tertiary);
  }
  &.gold {
    background: $gold-soft;
    border-color: $gold-line;
    svg,
    strong {
      color: $gold;
    }
  }
}
.perk-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  background: linear-gradient(90deg, rgba(232, 181, 71, 0.1), transparent);
  border: 1px solid $gold-line;
  svg {
    font-size: 22px;
    color: $gold;
  }
  div {
    flex: 1;
    strong {
      display: block;
      font-size: 13px;
      color: var(--c-text-primary);
    }
    span {
      font-size: 11px;
      color: var(--c-text-tertiary);
    }
  }
}

.coupon-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.coupon-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--c-border);
}
.cp-left {
  width: 72px;
  height: 56px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(232, 181, 71, 0.25), rgba(232, 181, 71, 0.08));
  border: 1px dashed $gold-line;
  strong {
    font-size: 18px;
    color: $gold;
  }
  &.cash {
    background: linear-gradient(135deg, rgba(200, 54, 79, 0.25), rgba(200, 54, 79, 0.08));
    border-color: rgba(200, 54, 79, 0.4);
    strong {
      color: $crimson-bright;
    }
  }
  &.discount {
    background: linear-gradient(135deg, rgba(74, 222, 128, 0.2), rgba(74, 222, 128, 0.06));
    border-color: rgba(74, 222, 128, 0.4);
    strong {
      color: $success;
    }
  }
}
.cp-right {
  flex: 1;
  strong {
    font-size: 13px;
    color: var(--c-text-primary);
  }
  span {
    display: block;
    font-size: 11px;
    color: var(--c-text-tertiary);
    margin-top: 3px;
  }
}
.empty-tip {
  text-align: center;
  color: var(--c-text-tertiary);
  padding: 20px;
  font-size: 13px;
}
</style>
