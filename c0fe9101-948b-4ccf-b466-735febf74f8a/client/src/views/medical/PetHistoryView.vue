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
    </div>
    <el-row :gutter="16">
      <el-col :xs="24" :md="16">
        <el-card shadow="never">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600">就诊时间线</span>
              <el-button type="primary" size="small" v-if="userStore.isDoctor" @click="router.push(`/medical?pet=${route.params.petId}`)">
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
                    <el-tag :type="t.visit_type === 'emergency' ? 'danger' : t.visit_type === 'referral' ? 'warning' : ''" size="small">{{ VISIT_TYPE_LABELS[t.visit_type] }}</el-tag>
                    <span class="hospital"><el-icon><OfficeBuilding /></el-icon> {{ t.hospital }}</span>
                    <span class="doctor">· {{ t.doctor }}（{{ t.department }}）</span>
                    <el-tag size="small" :type="t.status === 'completed' ? 'success' : 'primary'" effect="plain" style="margin-left:auto">{{ t.status === 'in_progress' ? '进行中' : t.status === 'completed' ? '已完成' : '已转诊' }}</el-tag>
                  </div>
                  <div class="tl-body">
                    <div><strong>主诉：</strong>{{ t.chief_complaint || '无' }}</div>
                    <div v-if="t.diagnosis" style="margin-top:4px"><strong>诊断：</strong>{{ t.diagnosis }}</div>
                  </div>
                  <div class="tl-tags">
                    <el-tag v-if="t.has_prescription" type="warning" effect="plain" size="small"><el-icon><Medicine /></el-icon> 处方</el-tag>
                    <el-tag v-if="t.has_lab" type="danger" effect="plain" size="small"><el-icon><Microscope /></el-icon> 检验</el-tag>
                    <el-tag v-if="t.has_attachment" type="info" effect="plain" size="small"><el-icon><Paperclip /></el-icon> 附件</el-tag>
                  </div>
                </div>
              </el-timeline-item>
            </el-timeline>
          </div>
          <el-empty v-else description="暂无就诊记录" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never" style="margin-bottom:16px">
          <template #header><span style="font-weight:600">快捷操作</span></template>
          <div class="quick-ops">
            <el-button style="width:100%;margin-bottom:8px" type="primary" @click="goNewRecord">新建病历</el-button>
            <el-button style="width:100%;margin-bottom:8px" @click="goHospitalize">安排住院</el-button>
            <el-button style="width:100%" @click="printInfo">打印档案</el-button>
          </div>
        </el-card>
        <el-card shadow="never" v-if="petInfo?.remark">
          <template #header><span style="font-weight:600">备注</span></template>
          <div style="color:var(--text-regular);white-space:pre-wrap">{{ petInfo.remark }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft, Warning, User, OfficeBuilding, Medicine, Microscope, Paperclip, Plus
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
  ElMessage.info('进入新建病历页面')
  router.push('/medical')
}
function goHospitalize() {
  ElMessage.info('正在安排住院')
  router.push('/hospitalization')
}
function printInfo() {
  ElMessage.success('正在打印档案')
}

async function loadData() {
  try {
    const res = await medicalApi.getPetHistory(petId)
    if (res.code === 200) {
      petInfo.value = res.data.pet
      history.value = res.data
    }
  } catch {
    petInfo.value = {
      id: petId, owner_id: 1, owner_name: '张先生', owner_phone: '13812345678',
      name: '豆豆', species: '犬', breed: '金毛寻回犬', gender: 'male',
      birth_date: '2021-05-10', weight: 28.5, color: '金色', is_neutered: true,
      allergy_history: '青霉素过敏'
    }
    history.value = {
      total_visits: 18, hospitals_visited: 3,
      timeline: Array.from({ length: 10 }, (_, i) => ({
        record_id: 1000 + i,
        date: new Date(Date.now() - i * 12 * 86400000).toISOString(),
        hospital: ['总院', '海淀分院', '朝阳急诊'][i % 3],
        doctor: ['张医生', '李医生', '王医生'][i % 3],
        department: ['内科', '外科', '影像科'][i % 3],
        visit_type: (['outpatient', 'outpatient', 'emergency', 'referral'] as any)[i % 4],
        chief_complaint: ['体检', '食欲不振', '呕吐', '跛行', '术后复查'][i % 5],
        diagnosis: i % 3 === 0 ? '' : ['肠胃炎', '骨折恢复', '皮炎', '健康'][i % 4],
        status: i === 0 ? 'in_progress' : 'completed',
        has_prescription: i % 2 === 0, has_lab: i % 3 === 0, has_attachment: i % 4 === 0
      }))
    }
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
  @include respond-to(mobile) {
    .stats-grid { min-width: auto; width: 100%; }
  }
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
  .tl-tags { margin-top: 10px; display: flex; gap: 6px; }
}
.quick-ops { display: flex; flex-direction: column; gap: 8px; }
</style>
