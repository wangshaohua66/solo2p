<template>
  <div class="page-container pet-history-page">
    <div class="pet-profile-card">
      <div class="profile-header" @click="router.back()">
        <el-button text><el-icon><ArrowLeft /></el-icon> 返回</el-button>
      </div>
      <div class="profile-body" v-if="petInfo">
        <el-avatar :size="80" style="background:linear-gradient(135deg,#409EFF,#67C23A);font-size:32px">
          {{ petInfo.name.charAt(0) }}
        </el-avatar>
        <div class="pet-info">
          <h2>{{ petInfo.name }} <el-tag size="small" :type="petInfo.species === '犬' ? 'primary' : 'warning'">{{ petInfo.species }}</el-tag></h2>
          <div class="meta-line">
            <span>{{ petInfo.breed || '未知品种' }}</span>
            <el-divider direction="vertical" />
            <span>{{ getGenderLabel(petInfo.gender) }}</span>
            <el-divider direction="vertical" />
            <span>{{ petInfo.birth_date ? formatAge(petInfo.birth_date) : '年龄未知' }}</span>
            <el-divider direction="vertical" />
            <span>{{ petInfo.weight ? petInfo.weight + 'kg' : '体重未知' }}</span>
            <el-divider v-if="petInfo.is_neutered" direction="vertical" />
            <el-tag v-if="petInfo.is_neutered" type="success" size="small" effect="plain">已绝育</el-tag>
          </div>
          <div class="meta-line" style="margin-top:8px;color:var(--text-secondary);font-size:13px">
            <el-icon><User /></el-icon> {{ petInfo.owner_name }} · {{ petInfo.owner_phone }}
          </div>
          <div v-if="petInfo.allergy_history" class="allergy-box">
            <el-tag type="danger" effect="light"><el-icon><Warning /></el-icon> 过敏史：{{ petInfo.allergy_history }}</el-tag>
          </div>
        </div>
        <div class="stats-grid">
          <div class="stat"><div class="num">{{ history?.total_visits || 0 }}</div><div class="lbl">总就诊</div></div>
          <div class="stat"><div class="num">{{ history?.hospitals_visited || 0 }}</div><div class="lbl">就诊院区</div></div>
          <div class="stat"><div class="num" style="color:var(--primary-color)">跨院互通</div><div class="lbl">电子病历</div></div>
        </div>
      </div>
      <div v-if="petInfo" class="profile-actions">
        <el-button type="primary" v-if="userStore.isDoctor" @click="goNewRecord">
          <el-icon><Plus /></el-icon>新建就诊
        </el-button>
        <el-button @click="goHospitalize" v-if="userStore.isDoctor || userStore.isNurse">
          <el-icon><HomeFilled /></el-icon>安排住院
        </el-button>
        <el-button @click="printInfo">
          <el-icon><Printer /></el-icon>打印档案
        </el-button>
      </div>
      <el-card v-if="petInfo?.remark" shadow="never" class="remark-card">
        <template #header><span style="font-weight:600">备注</span></template>
        <div style="color:var(--text-regular);white-space:pre-wrap">{{ petInfo.remark }}</div>
      </el-card>
    </div>
    <el-card shadow="never" class="timeline-card" v-loading="loading">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:600">就诊时间线</span>
          <el-button type="primary" size="small" v-if="userStore.isDoctor" @click="goNewRecord">
            <el-icon><Plus /></el-icon>新建就诊
          </el-button>
        </div>
      </template>
      <div v-if="history?.timeline?.length" class="timeline-wrap">
        <el-timeline>
          <el-timeline-item
            v-for="t in history.timeline"
            :key="t.record_id"
            :timestamp="formatDateTime(t.date)"
            placement="top"
            :color="t.visit_type === 'emergency' ? '#F56C6C' : t.visit_type === 'referral' ? '#E6A23C' : '#409EFF'"
          >
            <div class="timeline-card" @click="goRecord(t.record_id)">
              <div class="tl-head">
                <el-tag :type="t.visit_type === 'emergency' ? 'danger' : t.visit_type === 'referral' ? 'warning' : undefined" size="small">
                  {{ VISIT_TYPE_LABELS[t.visit_type as keyof typeof VISIT_TYPE_LABELS] }}
                </el-tag>
                <el-tag size="small" :type="t.status === 'completed' ? 'success' : t.status === 'referred' ? 'warning' : 'primary'" effect="plain">
                  {{ t.status === 'in_progress' ? '进行中' : t.status === 'completed' ? '已完成' : '已转诊' }}
                </el-tag>
                <span class="hospital"><el-icon><OfficeBuilding /></el-icon> {{ t.hospital }}</span>
                <span class="doctor">· {{ t.doctor }}（{{ t.department }}）</span>
              </div>
              <div class="tl-body">
                <div class="tl-row"><strong>主诉：</strong><span>{{ t.chief_complaint || '无' }}</span></div>
                <div class="tl-row" v-if="t.diagnosis"><strong style="color:var(--primary-color)">诊断：</strong><span>{{ t.diagnosis }}</span></div>
                <div class="tl-row" v-if="t.treatment_plan"><strong>治疗：</strong><span>{{ t.treatment_plan }}</span></div>
              </div>
              <div class="tl-tags">
                <el-tag v-if="t.has_prescription" type="warning" effect="plain" size="small"><el-icon><Goods /></el-icon> 处方</el-tag>
                <el-tag v-if="t.has_lab" type="danger" effect="plain" size="small"><el-icon><DataAnalysis /></el-icon> 检验</el-tag>
                <el-tag v-if="t.has_attachment" type="info" effect="plain" size="small"><el-icon><Paperclip /></el-icon> 附件</el-tag>
                <el-tag v-if="t.has_hospitalization" type="success" effect="plain" size="small"><el-icon><HomeFilled /></el-icon> 住院</el-tag>
              </div>
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>
      <el-empty v-else description="暂无就诊记录" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft, Warning, User, OfficeBuilding, Goods, DataAnalysis, Paperclip, Plus, HomeFilled, Printer
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores'
import { medicalApi } from '@/api'
import { VISIT_TYPE_LABELS, type Pet } from '@/types'
import { formatDateTime, getGenderLabel } from '@/utils'
import dayjs from 'dayjs'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const petId = Number(route.params.petId)
const petInfo = ref<Pet | null>(null)
const history = ref<any>(null)
const loading = ref(false)

function formatAge(birth: string) {
  const years = dayjs().diff(birth, 'year')
  if (years >= 1) return `${years}岁`
  const months = dayjs().diff(birth, 'month')
  return `${months}月龄`
}

function goRecord(id: number) {
  router.push(`/medical/${id}`)
}

function goNewRecord() {
  router.push({ path: '/medical', query: { pet: petId } })
}

function goHospitalize() {
  router.push({ path: '/hospitalization', query: { pet: petId } })
}

function printInfo() {
  window.print()
}

async function loadData() {
  loading.value = true
  try {
    const res = await medicalApi.getPetHistory(petId)
    if (res.code === 200) {
      petInfo.value = res.data.pet
      history.value = res.data
    }
  } catch (e) {
    petInfo.value = null
    history.value = null
    ElMessage.error('加载宠物档案失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped lang="scss">
.pet-profile-card {
  @include card-style;
  padding: 20px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #fff 0%, #f0f9ff 100%);
  .profile-body {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .pet-info { flex: 1; min-width: 280px; h2 { margin: 4px 0 12px; } }
  .meta-line {
    display: flex;
    align-items: center;
    color: var(--text-regular);
    font-size: 14px;
    flex-wrap: wrap;
    gap: 4px;
  }
  .allergy-box { margin-top: 12px; }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    min-width: 300px;
    .stat {
      text-align: center;
      padding: 16px;
      background: #fff;
      border-radius: var(--radius-base);
      .num { font-size: 22px; font-weight: 700; color: var(--primary-color); }
      .lbl { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
    }
  }
  .profile-actions {
    display: flex;
    gap: 8px;
    padding-top: 16px;
    margin-top: 16px;
    border-top: 1px solid var(--border-light);
    flex-wrap: wrap;
  }
  .remark-card {
    margin-top: 16px;
  }
  @include respond-to(mobile) {
    .stats-grid { min-width: auto; width: 100%; }
  }
}
.timeline-card {
  margin-bottom: 16px;
}
.timeline-wrap {
  padding: 8px 0;
}
.timeline-card {
  @include card-style;
  padding: 14px 16px;
  cursor: pointer;
  &:hover { transform: translateX(4px); }
  .tl-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    font-size: 13px;
    color: var(--text-regular);
    flex-wrap: wrap;
    .hospital, .doctor { display: inline-flex; align-items: center; gap: 4px; }
  }
  .tl-body {
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-regular);
  }
  .tl-row {
    margin-bottom: 4px;
    strong { margin-right: 4px; }
    span { color: var(--text-regular); }
  }
  .tl-tags { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
}
</style>
