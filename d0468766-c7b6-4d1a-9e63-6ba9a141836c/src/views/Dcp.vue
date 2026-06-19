<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import * as ElIcons from '@element-plus/icons-vue'
import SectionPanel from '@/components/SectionPanel.vue'
import StatCard from '@/components/StatCard.vue'
import { dcpApi } from '@/api'
import type { DcpCopy } from '@/types'

const loading = ref(true)
const list = ref<DcpCopy[]>([])
const activeId = ref('')

onMounted(async () => {
  list.value = await dcpApi.getList()
  loading.value = false
  if (list.value.length) activeId.value = list.value[0].id
})

const active = computed(() => list.value.find((d) => d.id === activeId.value))

const stats = computed(() => ({
  total: list.value.length,
  inTransit: list.value.filter((d) => d.status === 'in_transit').length,
  warning: list.value.filter((d) => d.daysToPremiere <= 2 && d.status !== 'in_stock' && d.status !== 'screening').length,
  screening: list.value.filter((d) => d.status === 'screening').length
}))

const statusMeta: Record<string, { text: string; color: string; bg: string }> = {
  in_stock: { text: '已入库', color: '#4ADE80', bg: 'rgba(74,222,128,0.12)' },
  in_transit: { text: '在途', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
  screening: { text: '放映中', color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
  returned: { text: '已归还', color: '#a0a3b1', bg: 'rgba(160,163,177,0.12)' }
}

const actionIcon: Record<string, string> = { 调出: 'Upload', 在途: 'Van', 签收: 'Download', 归还: 'RefreshLeft' }

async function approve(id: string) {
  await dcpApi.approve(id)
  ElMessage.success('调拨申请已审批通过')
}
</script>

<template>
  <div class="dcp-page" v-loading="loading">
    <div class="stat-row">
      <StatCard label="拷贝总数" :value="stats.total" unit="份" icon="Box" accent="gold" />
      <StatCard label="在途运输" :value="stats.inTransit" unit="份" icon="Van" accent="crimson" />
      <StatCard label="首映预警" :value="stats.warning" unit="份" icon="WarnTriangleFilled" accent="crimson" />
      <StatCard label="放映中" :value="stats.screening" unit="份" icon="Film" accent="info" />
    </div>

    <div class="dcp-grid">
      <SectionPanel title="DCP 拷贝列表" subtitle="点击查看流转时间线与首映倒计时" no-padding class="list-col">
        <div class="dcp-list">
          <div
            v-for="d in list"
            :key="d.id"
            class="dcp-item"
            :class="{ active: d.id === activeId }"
            @click="activeId = d.id"
          >
            <div class="di-status" :style="{ background: statusMeta[d.status].bg, color: statusMeta[d.status].color }">
              {{ statusMeta[d.status].text }}
            </div>
            <div class="di-body">
              <strong>{{ d.movieName }}</strong>
              <div class="di-meta">
                <span><component :is="(ElIcons as any).Location" />{{ d.cinemaName.split('·')[1] }}</span>
                <span>{{ d.size }}</span>
              </div>
              <div class="di-premiere" :class="{ urgent: d.daysToPremiere <= 2 && d.status === 'in_transit' }">
                <component :is="(ElIcons as any).Clock" />
                首映日 {{ d.premiereDate }}
                <strong v-if="d.daysToPremiere > 0">剩 {{ d.daysToPremiere }} 天</strong>
                <strong v-else>今日首映</strong>
              </div>
            </div>
          </div>
        </div>
      </SectionPanel>

      <div class="detail-col" v-if="active">
        <SectionPanel :title="`《${active.movieName}》数字拷贝`" :subtitle="`${active.cinemaName} · ${active.size} · 编号 ${active.id}`">
          <div class="detail-status">
            <div class="ds-main" :style="{ background: statusMeta[active.status].bg, color: statusMeta[active.status].color, borderColor: statusMeta[active.status].color }">
              <component :is="(ElIcons as any)[active.status === 'in_transit' ? 'Van' : active.status === 'screening' ? 'Film' : active.status === 'in_stock' ? 'CircleCheck' : 'Finished']" />
              <div>
                <strong>{{ statusMeta[active.status].text }}</strong>
                <span>{{ active.location }}</span>
              </div>
            </div>
            <div class="ds-countdown" v-if="active.daysToPremiere > 0">
              <span>距首映</span>
              <strong class="num gold-text">{{ active.daysToPremiere }}</strong>
              <span>天</span>
            </div>
          </div>

          <el-alert
            v-if="active.daysToPremiere <= 2 && active.status === 'in_transit'"
            title="首映日预警"
            :description="`拷贝仍在途未签收，距首映仅剩 ${active.daysToPremiere} 天，请加急跟踪物流！`"
            type="error"
            show-icon
            :closable="false"
            class="warn-alert"
          />
        </SectionPanel>

        <SectionPanel title="流转时间线" subtitle="拷贝在各影院间的借调记录" class="timeline-panel">
          <div class="timeline">
            <div v-for="(r, i) in active.borrowHistory" :key="r.id" class="tl-item">
              <div class="tl-dot" :class="{ last: i === active.borrowHistory.length - 1 }">
                <component :is="(ElIcons as any)[actionIcon[r.action] || 'Operation']" />
              </div>
              <div class="tl-content">
                <div class="tl-head">
                  <strong>{{ r.action }}</strong>
                  <span class="num">{{ r.time }}</span>
                </div>
                <p>{{ r.fromCinema }} → {{ r.toCinema }}</p>
                <span class="tl-operator">操作人：{{ r.operator }}</span>
              </div>
            </div>
          </div>
          <div class="approve-bar">
            <el-button type="primary" :icon="(ElIcons as any).Check" @click="approve(active.id)">审批调拨</el-button>
            <el-button :icon="(ElIcons as any).Position">跟踪物流</el-button>
            <el-button :icon="(ElIcons as any).Document">查看调度单</el-button>
          </div>
        </SectionPanel>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dcp-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}
.dcp-grid {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 18px;
  align-items: start;
}
.dcp-list {
  display: flex;
  flex-direction: column;
  max-height: 620px;
  overflow-y: auto;
  @include scrollbar-dark;
}
.dcp-item {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
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
.di-status {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
  writing-mode: vertical-rl;
  letter-spacing: 2px;
}
.di-body {
  flex: 1;
  min-width: 0;
  strong {
    font-size: 14px;
    color: var(--c-text-primary);
  }
}
.di-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--c-text-tertiary);
  margin: 4px 0;
  span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
}
.di-premiere {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--c-text-secondary);
  strong {
    color: $gold;
    margin-left: auto;
    font-family: var(--font-num);
  }
  &.urgent {
    color: $crimson-bright;
    strong {
      color: $crimson-bright;
      animation: pulse-gold 1.5s infinite;
    }
  }
}

.detail-col {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.detail-status {
  display: flex;
  align-items: center;
  gap: 20px;
}
.ds-main {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 22px;
  border-radius: 12px;
  border: 1px solid;
  flex: 1;
  font-size: 28px;
  strong {
    display: block;
    font-size: 16px;
  }
  span {
    font-size: 12px;
    opacity: 0.8;
  }
}
.ds-countdown {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 24px;
  border-radius: 12px;
  background: $gold-soft;
  border: 1px solid $gold-line;
  span {
    font-size: 11px;
    color: var(--c-text-secondary);
  }
  strong {
    font-size: 36px;
    line-height: 1;
  }
}
.warn-alert {
  margin-top: 16px;
}

.timeline {
  position: relative;
  padding-left: 8px;
  &::before {
    content: '';
    position: absolute;
    left: 23px;
    top: 12px;
    bottom: 12px;
    width: 2px;
    background: linear-gradient(180deg, $gold, transparent);
  }
}
.tl-item {
  display: flex;
  gap: 16px;
  padding-bottom: 24px;
  position: relative;
}
.tl-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: $gold-soft;
  border: 2px solid $gold;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $gold;
  font-size: 14px;
  flex-shrink: 0;
  z-index: 1;
  &.last {
    background: $gold;
    color: #1a1305;
    box-shadow: $shadow-gold;
  }
}
.tl-content {
  flex: 1;
  padding-top: 2px;
}
.tl-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  strong {
    font-size: 14px;
    color: var(--c-text-primary);
  }
  .num {
    font-size: 12px;
    color: var(--c-text-tertiary);
  }
}
.tl-content p {
  font-size: 12px;
  color: var(--c-text-secondary);
  margin: 4px 0;
}
.tl-operator {
  font-size: 11px;
  color: var(--c-text-tertiary);
}
.approve-bar {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--c-border);
}
</style>
